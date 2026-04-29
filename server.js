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
  console.log("🔄 جاري التحديث المضمون...");
  const streamers = await Streamer.find({});
  if (streamers.length === 0) return;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new", // تأكد أن النسخة حديثة
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // تقليل استهلاك الموارد: منع الصور والخطوط من التحميل
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'font', 'stylesheet'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    for (const streamer of streamers) {
      try {
        const cleanName = streamer.kickUsername.trim().toLowerCase();
        console.log(`🔍 فحص قناة: ${cleanName}`);
        
        // الإصلاح هنا: أضفنا / و علامة $
        await page.goto(`https://kick.com/${cleanName}`, {
          waitUntil: 'networkidle0', 
          timeout: 30000 
        });

        // انتظر ثواني بسيطة للتأكد من تحميل الـ DOM
        await new Promise(r => setTimeout(r, 3000));

        const statusData = await page.evaluate(() => {
          // فحص علامة الـ LIVE بأكثر من طريقة
          const isLive = !!document.querySelector('.v-live-indicator') || 
                         !!document.querySelector('[data-is-live="true"]') ||
                         document.body.innerText.includes('LIVE');
          
          const viewersEl = document.querySelector('.v-live-indicator__viewer-count') || 
                            document.querySelector('.viewer-count');
          
          let vCount = 0;
          if (viewersEl) {
              vCount = parseInt(viewersEl.innerText.replace(/[^0-9]/g, '')) || 0;
          }

          return { isLive, viewers: vCount };
        });

        await Streamer.updateOne(
          { _id: streamer._id },
          { $set: { 
              isLive: statusData.isLive, 
              viewers: statusData.viewers
          }}
        );
        console.log(`✅ ${cleanName} | لايف: ${statusData.isLive} | المشاهدات: ${statusData.viewers}`);

      } catch (err) {
        console.error(`❌ خطأ في فحص ${streamer.kickUsername}:`, err.message);
      }
    }
  } catch (error) {
    console.error("❌ خطأ متصفح كلي:", error.message);
  } finally {
    if (browser) await browser.close();
    console.log("🏁 انتهت الدورة.");
  }
}


// تحديث كل 3 دقائق (180000 مللي ثانية)
setInterval(updateStatus, 4000);

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
// ✅ راوت رفض طلبات الانضمام
app.get('/admin/reject/:id', async (req, res) => {
  if (req.query.pass !== "1234") return res.status(403).send("❌ غير مصرح");
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.redirect('/admin-justice?pass=1234');
  } catch (err) {
    res.send("خطأ في الحذف: " + err.message);
  }
});

// ✅ راوت طرد/حذف ستريمر موجود بالموقع
app.get('/admin/delete-streamer/:id', async (req, res) => {
  if (req.query.pass !== "1234") return res.status(403).send("❌ غير مصرح");
  try {
    await Streamer.findByIdAndDelete(req.params.id);
    res.redirect('/admin-justice?pass=1234');
  } catch (err) {
    res.send("خطأ في الحذف: " + err.message);
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 السيرفر شغال بنجاح على المنفذ ${PORT}`);
});
