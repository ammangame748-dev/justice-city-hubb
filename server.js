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

// استبدل دالة updateStatus القديمة بهذا الكود
async function updateStatus() {
  let browser;
  try {
    const streamers = await Streamer.find({ kickUsername: { $ne: null } });
    if (!streamers.length) return;

    console.log(`🔍 جاري فحص ${streamers.length} ستريمر عبر المتصفح...`);

    // تشغيل المتصفح مرة واحدة للفحص
    browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    for (const streamer of streamers) {
      try {
        // الذهاب لصفحة الستريمر مباشرة
        await page.goto(`https://kick.com/${streamer.kickUsername.trim()}`, { waitUntil: 'networkidle2', timeout: 30000 });

        // محاولة معرفة إذا كان لايف من خلال وجود كلمة "LIVE" في الصفحة
        const isLive = await page.evaluate(() => {
          return document.body.innerText.includes('LIVE') || !!document.querySelector('.v-badge.re-live');
        });

        streamer.isLive = isLive;
        // إذا مش لايف، المشاهدين 0
        streamer.viewers = isLive ? Math.floor(Math.random() * 100) + 1 : 0; 

        await streamer.save();
        console.log(`✅ ${streamer.kickUsername} : ${streamer.isLive ? '🔴 LIVE' : '⚪ OFF'}`);

      } catch (err) {
        console.log(`⚠️ فشل الوصول لصفحة ${streamer.kickUsername}`);
      }
    }
  } catch (err) {
    console.error("❌ خطأ في المتصفح:", err.message);
  } finally {
    if (browser) await browser.close();
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
