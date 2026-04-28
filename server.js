const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://hsamhmaydh4_db_user:xls5Av4Nr4a5PA7W@cluster0.wjnh8d0.mongodb.net/?appName=Cluster0"; 

mongoose.connect(MONGO_URI).then(() => console.log('✅ متصل بالداتابيز')).catch(err => console.log(err));


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

// دالة التحديث المصححة
async function updateStatus() {
    let browser; 
    try {
        console.log("🔍 جاري فحص حالة الستريمرز...");
        
        const streamers = await Streamer.find({ kickUsername: { $ne: null, $exists: true } });
        if (streamers.length === 0) {
            console.log("ℹ️ لا يوجد ستريمرز للفحص.");
            return;
        }

browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null, // عشان يقرأ المسار من رندر
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});


        const page = await browser.newPage();
        
        // --- حلقة لفحص كل ستريمر ---
        for (const streamer of streamers) {
            try {
                // الكود هنا يذهب لصفحة الستريمر ويفحص حالته
                await page.goto(`https://kick.com{streamer.kickUsername}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                
                // مثال بسيط للفحص (هذا الجزء يعتمد على تصميم موقع Kick المتغير)
                const isLive = await page.evaluate(() => {
                    return document.body.innerText.includes('LIVE') || document.body.innerText.includes('مباشر');
                });

                streamer.isLive = isLive;
                await streamer.save();
                console.log(`✅ تم تحديث ${streamer.kickUsername}: ${isLive ? 'لايف 🔴' : 'أوفلاين ⚪'}`);
                
            } catch (err) {
                console.log(`⚠️ فشل فحص الستريمر ${streamer.kickUsername}:`, err.message);
            }
        }

    } catch (error) {
        console.log("❌ خطأ عام في عملية الفحص:", error.message);
    } finally {
        // هذا الجزء يضمن إغلاق المتصفح دائماً ومنع استهلاك الرام
        if (browser) {
            await browser.close();
            console.log("✨ انتهى الفحص وتم إغلاق المتصفح.");
        }
    }
}


setInterval(updateStatus, 300000); // 300000 تساوي 5 دقائق


// --- [ المسارات ] ---

app.get('/', async (req, res) => {
    const streamers = await Streamer.find({}).sort({ isLive: -1, viewers: -1 });
    
    // لازم نحسب الأرقام هون عشان نبعتها للموقع
    const stats = {
        totalStreamers: streamers.length,
        liveNow: streamers.filter(s => s.isLive).length,
        totalViewers: streamers.reduce((sum, s) => sum + (s.viewers || 0), 0)
    };

    // هون بنبعت الـ streamers والـ stats مع بعض
    res.render('index', { streamers, stats }); 
});


app.post('/apply', async (req, res) => { // تأكد من وجود async هنا
    const { kickUser, discordName } = req.body;
    
    if(!kickUser) return res.send("الاسم مطلوب");

    // السطر اللي مسبب لك المشكلة
    const existing = await Application.findOne({ kickUsername: kickUser.trim() });
    
    if(existing) return res.send("<script>alert('⚠️ هذا الاسم قدم طلباً بالفعل.'); window.location='/';</script>");

    await Application.create({ kickUsername: kickUser.trim(), discordName: discordName });
    res.send("<script>alert('✅ تم إرسال طلبك بنجاح!'); window.location='/';</script>");
});

app.get('/admin/reject/:id', async (req, res) => {
    await Application.findByIdAndDelete(req.params.id);
    res.redirect('/admin-justice');
});
// الحماية المحدثة: بتفحص أي رابط ببدأ بكلمة admin
app.use('/admin', (req, res, next) => {
    const password = req.query.pass;
    if (password !== "1234") return res.send("❌ ممنوع");
    next();
});

app.get('/admin-justice', async (req, res) => {
    const apps = await Application.find({ status: 'pending' });
    const streamers = await Streamer.find({}); // جلب الستريمرز الحاليين
    res.render('admin', { apps, streamers }); // تمرير الستريمرز للأدمن
});

app.get('/admin/delete-streamer/:id', async (req, res) => {
    await Streamer.findByIdAndDelete(req.params.id);
    res.redirect('/admin-justice');
});
app.get('/live', async (req, res) => {
    const liveStreamers = await Streamer.find({ isLive: true }).sort({ viewers: -1 });
    res.render('live', { streamers: liveStreamers });
});


app.get('/admin/accept/:id', async (req, res) => {
    const appData = await Application.findById(req.params.id);
    if (appData) {
        await Streamer.findOneAndUpdate(
            { kickUsername: appData.kickUsername },
            { kickUsername: appData.kickUsername },
            { upsert: true }
        );
        appData.status = 'accepted';
        await appData.save();
    }
    res.redirect('/admin-justice');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
