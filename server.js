const express = require('express');
const mongoose = require('mongoose');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// تفعيل إضافة التخفي لتجاوز حماية Kick
puppeteer.use(StealthPlugin());

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// الاتصال بقاعدة البيانات
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://hsamhmaydh4_db_user:xls5Av4Nr4a5PA7W@cluster0.wjnh8d0.mongodb.net/?appName=Cluster0"; 
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ متصل بالداتابيز بنجاح'))
    .catch(err => console.error('❌ خطأ في الاتصال:', err));

// تعريف الـ Models
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

// وظيفة فحص حالة الستريمرز (محسنة)
async function updateStatus() {
    let browser; 
    try {
        const streamers = await Streamer.find({ kickUsername: { $ne: null, $exists: true } });
        if (streamers.length === 0) return;

        console.log(`🔍 جاري فحص حالة ${streamers.length} ستريمرز...`);

        browser = await puppeteer.launch({
            headless: "new",
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

        for (const streamer of streamers) {
            try {
                const url = `https://kick.com/api/v2/channels/${streamer.kickUsername.trim()}`;
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                const content = await page.evaluate(() => document.body.innerText);
                let data;
                
                try {
                    data = JSON.parse(content);
                } catch (e) {
                    console.log(`⚠️ حماية Cloudflare منعت فحص: ${streamer.kickUsername}`);
                    continue;
                }
                
                streamer.isLive = !!data.livestream;
                streamer.viewers = data.livestream ? data.livestream.viewer_count : 0;
                streamer.profilePic = data.user ? data.user.profile_pic : streamer.profilePic;
                
                await streamer.save();
                console.log(`✅ ${streamer.kickUsername}: ${streamer.isLive ? '🔴 لايف (' + streamer.viewers + ')' : '⚪ أوفلاين'}`);

                await new Promise(r => setTimeout(r, 2500)); // تأخير لتجنب الحظر

            } catch (err) {
                console.log(`⚠️ فشل فحص ${streamer.kickUsername}`);
                streamer.isLive = false;
                await streamer.save();
            }
        }
    } catch (error) {
        console.log("❌ خطأ عام في عملية الفحص:", error.message);
    } finally {
        if (browser) {
            await browser.close();
            console.log("✨ انتهى الفحص وتم إغلاق المتصفح.");
        }
    }
}

// تشغيل الفحص كل 5 دقائق
setInterval(updateStatus, 300000);

// --- [ المسارات / Routes ] ---

app.get('/', async (req, res) => {
    const streamers = await Streamer.find({}).sort({ isLive: -1, viewers: -1 });
    const stats = {
        totalStreamers: streamers.length,
        liveNow: streamers.filter(s => s.isLive).length,
        totalViewers: streamers.reduce((sum, s) => sum + (s.viewers || 0), 0)
    };
    res.render('index', { streamers, stats }); 
});

app.post('/apply', async (req, res) => {
    const { kickUser, discordName } = req.body;
    if(!kickUser) return res.send("الاسم مطلوب");

    const cleanName = kickUser.trim();

    // السطر السحري: بيمسح أي طلب قديم أو ستريمر قديم بنفس الاسم عشان ما يعلق
    await Application.deleteMany({ kickUsername: cleanName });
    await Streamer.deleteMany({ kickUsername: cleanName });

    // إضافة الطلب الجديد
    await Application.create({ kickUsername: cleanName, discordName: discordName });
    
    res.send("<script>alert('✅ تم إرسال طلبك بنجاح! روح على لوحة الأدمن واقبله الآن.'); window.location='/';</script>");
});


// حماية مسارات الأدمن
app.use('/admin', (req, res, next) => {
    if (req.query.pass !== "1234") return res.status(403).send("❌ غير مصرح لك");
    next();
});

app.get('/admin-justice', async (req, res) => {
    const apps = await Application.find({ status: 'pending' });
    const streamers = await Streamer.find({});
    res.render('admin', { apps, streamers });
});

app.get('/admin/accept/:id', async (req, res) => {
    const appData = await Application.findByIdAndDelete(req.params.id);
    if (appData) {
        await Streamer.findOneAndUpdate(
            { kickUsername: appData.kickUsername },
            { kickUsername: appData.kickUsername },
            { upsert: true }
        );
    }
    res.redirect('/admin-justice?pass=1234');
});

app.get('/admin/reject/:id', async (req, res) => {
    await Application.findByIdAndDelete(req.params.id);
    res.redirect('/admin-justice?pass=1234');
});

app.get('/admin/delete-streamer/:id', async (req, res) => {
    await Streamer.findByIdAndDelete(req.params.id);
    res.redirect('/admin-justice?pass=1234');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على منفذ: ${PORT}`);
});
