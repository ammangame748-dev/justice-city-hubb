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


const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
async function updateStatus() {
  console.log("🔄 جاري التحديث باستخدام المتصفح (Puppeteer)...");
  
  const streamers = await Streamer.find({});
  let browser;

  try {
browser = await puppeteer.launch({
  headless: "new",
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});



    const page = await browser.newPage();
    
    // محاكاة متصفح حقيقي عشان ما ننكشف
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

    for (const streamer of streamers) {
      try {
        console.log(`🔍 فحص: ${streamer.kickUsername}`);
        
        // الانتقال لرابط الـ API الخاص بالقناة
        await page.goto(`https://kick.com/api/v2/channels/${streamer.kickUsername}`, {
          waitUntil: 'networkidle2', // انتظر لينتهي تحميل البيانات
          timeout: 30000
        });

        // سحب محتوى الصفحة (JSON)
        const content = await page.evaluate(() => document.querySelector("pre")?.innerText || document.body.innerText);
        const data = JSON.parse(content);

        if (data && data.channel) {
          const isLive = data.channel.is_live;
          const viewers = data.channel.viewer_count || 0;
          const profilePic = data.channel?.user?.profile_pic || streamer.profilePic;

          await Streamer.updateOne(
            { _id: streamer._id },
            { $set: { isLive, viewers, profilePic } }
          );
          console.log(`✅ ${streamer.kickUsername} | مباشر: ${isLive} | 👁 ${viewers}`);
        }
      } catch (err) {
        console.error(`❌ خطأ في معالجة ${streamer.kickUsername}:`, err.message);
      }
    }
  } catch (error) {
    console.error("❌ فشل تشغيل المتصفح:", error.message);
  } finally {
    if (browser) await browser.close(); // إغلاق المتصفح لتوفير الرام
    console.log("🏁 انتهت عملية التحديث.");
  }
}


// تحديث كل 3 دقائق (180000 مللي ثانية)
setInterval(updateStatus, 180000);

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
// راوت لرفض الطلبات
app.get('/admin/reject/:id', async (req, res) => {
  if (req.query.pass !== "1234") return res.status(403).send("❌ غير مصرح");
  await Application.findByIdAndDelete(req.params.id);
  res.redirect('/admin-justice?pass=1234');
});

// راوت لطرد/حذف ستريمر موجود أصلاً
app.get('/admin/delete-streamer/:id', async (req, res) => {
  if (req.query.pass !== "1234") return res.status(403).send("❌ غير مصرح");
  await Streamer.findByIdAndDelete(req.params.id);
  res.redirect('/admin-justice?pass=1234');
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
