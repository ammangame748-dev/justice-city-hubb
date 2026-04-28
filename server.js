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

    console.log(`🔍 جاري فحص ${streamers.length} ستريمر عبر المتصفح...`);

    browser = await puppeteer.launch({ 
      headless: "new", 
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    for (const streamer of streamers) {
      try {
        await page.goto(`https://kick.com/${streamer.kickUsername.trim()}`, { 
          waitUntil: 'networkidle2', 
          timeout: 60000 
        });

 // قبل الدخول في evaluate، أضف هذا التفاعل الحقيقي
await page.mouse.move(Math.random() * 500, Math.random() * 500); // حركة عشوائية
await new Promise(r => setTimeout(r, 8000)); // انتظر 8 ثواني لضمان ظهور الرقم
// انتظر حتى يظهر عنصر الفيديو أو عدد المشاهدات
try {
    await page.waitForSelector('span[data-viewer-count]', { timeout: 15000 });
} catch (e) {
    console.log("⏱️ تأخر تحميل عدد المشاهدين، سأحاول جلب البيانات المتاحة.");
}

// عمل Scroll خفيف للأعلى والأسفل لتحفيز تحميل الصور (Lazy Load)
await page.evaluate(() => window.scrollBy(0, 500));
await new Promise(r => setTimeout(r, 2000));
await page.evaluate(() => window.scrollBy(0, -500));


const streamData = await page.evaluate(() => {
    // 1. فحص الحالة (LIVE) - الطريقة الأضمن هي البحث عن كلمة "LIVE" في عناصر معينة
    const isLive = !!document.querySelector('.v-badge.re-live') || 
                   !!document.querySelector('[data-is-live="true"]') ||
                   document.body.innerText.includes('LIVE');

    let count = 0;
    let profileImg = "";

    // 2. جلب عدد المشاهدين (تحديث الـ Selectors)
    const viewerElement = document.querySelector('span[data-viewer-count]') || 
                          document.querySelector('.v-badge span') ||
                          document.querySelector('#video-player-viewer-count');
    
    if (viewerElement) {
        count = parseInt(viewerElement.innerText.replace(/[^0-9]/g, '')) || 0;
    }

    // 3. جلب صورة البروفايل - استهداف أدق
    // نبحث عن الصورة اللي الـ Alt تبعها هو اسم القناة أو تحتوي على كلاسات معينة
    const imgElement = document.querySelector('img.object-cover.rounded-full') || 
                       document.querySelector('img[alt*="avatar"]') ||
                       document.querySelector('.profile-picture img');
    
    if (imgElement && imgElement.src) {
        profileImg = imgElement.src;
    }

    return { isLive, viewers: count, profilePic: profileImg };
});


        // تحديث قاعدة البيانات
        streamer.isLive = streamData.isLive;
        streamer.viewers = streamData.isLive ? streamData.viewers : 0;
        if (streamData.profilePic) streamer.profilePic = streamData.profilePic;
        
        await streamer.save();

        console.log(`✅ ${streamer.kickUsername} : ${streamer.isLive ? `🔴 LIVE (${streamer.viewers})` : '⚪ OFF'}`);

      } catch (err) {
        console.log(`⚠️ فشل فحص ${streamer.kickUsername}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error("❌ خطأ عام في المتصفح:", err.message);
  } finally {
    if (browser) {
      await browser.close();
      console.log("🔒 تم إغلاق المتصفح.");
    }
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
