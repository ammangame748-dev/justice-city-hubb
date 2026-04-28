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
async function updateStatus() {
  let browser;
  try {
    const streamers = await Streamer.find({ kickUsername: { $ne: null } });
    if (!streamers.length) return;

    console.log(`🔍 جاري التحديث الذكي لـ ${streamers.length} ستريمر عبر Puppeteer...`);

    // تشغيل المتصفح مرة واحدة لتوفير الموارد
    browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    // إعداد واجهة مستخدم حقيقية لتجنب الحظر
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    for (const streamer of streamers) {
      try {
        const username = streamer.kickUsername.trim();
        const apiUrl = `https://kick.com/api/v1/channels/${username}`;

        // الدخول للرابط وانتظار البيانات
        await page.goto(apiUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // استخراج نص الـ JSON من الصفحة
        const content = await page.evaluate(() => document.body.innerText);
        const data = JSON.parse(content);

        if (data) {
          // تحديث بيانات البث
          streamer.isLive = !!data.livestream;
          streamer.viewers = data.livestream ? data.livestream.viewer_count : 0;
          
          // تحديث الصورة الشخصية الحقيقية
          if (data.user && data.user.profile_pic) {
            streamer.profilePic = data.user.profile_pic;
          }

          await streamer.save();
          console.log(`✅ تم تحديث ${username}: [بث: ${streamer.isLive} | مشاهدين: ${streamer.viewers}]`);
        }
      } catch (err) {
        console.log(`⚠️ فشل تحديث ${streamer.kickUsername}: تأكد من الاسم أو حماية الموقع`);
      }
    }
  } catch (err) {
    console.error("❌ خطأ عام في عملية التحديث:", err.message);
  } finally {
    if (browser) await browser.close(); // إغلاق المتصفح بعد الانتهاء
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
