const express = require('express');
const mongoose = require('mongoose');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// ✅ تم إزالة مكتبة Pusher لأنها تسبب الخطأ ولست بحاجة لها مع وجود دالة التحديث الدوري
const app = express();

puppeteer.use(StealthPlugin());

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// ================= DATABASE =================
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://hsamhmaydh4_db_user:xls5Av4Nr4a5PA7W@cluster0.wjnh8d0.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ متصل بالداتابيز بنجاح'))
  .catch(err => console.error('❌ خطأ في الاتصال:', err));

// ================= MODELS =================
const Streamer = mongoose.model('KickConfig', new mongoose.Schema({
  kickUsername: String,
  isLive: { type: Boolean, default: false },
  viewers: { type: Number, default: 0 },
  profilePic: String
}));

const Application = mongoose.model('Application', new mongoose.Schema({
  kickUsername: String,
  discordName: String,
  status: { type: String, default: 'pending' }
}));
const cloudscraper = require('cloudscraper');

async function updateStatus() {
  try {
    const streamers = await Streamer.find({ kickUsername: { $ne: null } });
    if (!streamers.length) return;

    console.log(`🚀 جاري التحديث الذكي لـ ${streamers.length} ستريمر عبر Cloudscraper...`);

    for (const streamer of streamers) {
      const username = streamer.kickUsername.trim();
      const apiUrl = `https://kick.com/api/v1/channels/${username}`;

      // طلب البيانات بطريقة تكسر الحماية
      cloudscraper.get(apiUrl)
        .then(async (response) => {
          const data = JSON.parse(response);

          if (data) {
            streamer.isLive = !!data.livestream;
            streamer.viewers = data.livestream ? data.livestream.viewer_count : 0;
            
            if (data.user && data.user.profile_pic) {
              streamer.profilePic = data.user.profile_pic;
            }

            await streamer.save();
            console.log(`✅ ${username} -> [بث: ${streamer.isLive} | مشاهدين: ${streamer.viewers}]`);
          }
        })
        .catch(err => {
          console.log(`⚠️ فشل تحديث ${username}: ممكن الحساب خطأ أو الحماية قوية`);
        });

      // انتظار ثانية بين كل طلب عشان ما نتبلك
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  } catch (err) {
    console.error("❌ خطأ عام:", err.message);
  }
}


// فحص الحالة كل دقيقتين (120000 مللي ثانية)
setInterval(updateStatus, 120000);
// تشغيل الفحص فور تشغيل السيرفر
updateStatus();

// ================= ROUTES =================
app.get('/', async (req, res) => {
  const streamers = await Streamer.find({}).sort({ isLive: -1, viewers: -1 });
  const stats = {
    totalStreamers: streamers.length,
    liveNow: streamers.filter(s => s.isLive).length,
    totalViewers: streamers.reduce((a, b) => a + (b.viewers || 0), 0)
  };
  res.render('index', { streamers, stats });
});

app.post('/apply', async (req, res) => {
  const { kickUser, discordName } = req.body;
  if (!kickUser) return res.send("الاسم مطلوب");
  const clean = kickUser.trim();
  await Application.deleteMany({ kickUsername: clean });
  await Application.create({ kickUsername: clean, discordName });
  res.send("<script>alert('✅ تم إرسال طلبك!'); window.location='/';</script>");
});

app.get('/admin-justice', async (req, res) => {
  if (req.query.pass !== "1234") return res.status(403).send("❌ غير مصرح");
  const apps = await Application.find({ status: 'pending' });
  const streamers = await Streamer.find({});
  res.render('admin', { apps, streamers });
});

app.get('/admin/accept/:id', async (req, res) => {
  const appData = await Application.findByIdAndDelete(req.params.id);
  if (appData) {
    await Streamer.updateOne(
      { kickUsername: appData.kickUsername },
      { $set: { kickUsername: appData.kickUsername } },
      { upsert: true }
    );
    // تحديث الحالة فوراً بعد القبول
    updateStatus();
  }
  res.redirect('/admin-justice?pass=1234');
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 السيرفر شغال بنجاح على المنفذ ${PORT}`);
});
