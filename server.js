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

async function updateStatus() {
    let browser; 
    try {
        console.log("🔍 جاري فحص حالة الستريمرز...");
        
        const streamers = await Streamer.find({ kickUsername: { $ne: null, $exists: true } });
        if (streamers.length === 0) return;

        browser = await puppeteer.launch({
            headless: "new",
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        
        // تعيين User-Agent واقعي للمتصفح ككل
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

        for (const streamer of streamers) {
            try {
                // نستخدم المتصفح لزيارة الرابط بدلاً من axios
                const url = `https://kick.com/api/v2/channels/${streamer.kickUsername.trim()}`;
                
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

                // استخراج النص (JSON) من الصفحة
                const content = await page.evaluate(() => document.querySelector("pre").innerText);
                const data = JSON.parse(content);
                
                streamer.isLive = !!data.livestream;
                streamer.viewers = data.livestream ? data.livestream.viewer_count : 0;
                streamer.profilePic = data.user.profile_pic;
                
                await streamer.save();
                console.log(`✅ ${streamer.kickUsername}: ${streamer.isLive ? '🔴 لايف (' + streamer.viewers + ')' : '⚪ أوفلاين'}`);

                // انتظار بسيط بين كل ستريمر وآخر لتجنب الحظر
                await new Promise(r => setTimeout(r, 2000));

            } catch (err) {
                console.log(`⚠️ فشل فحص ${streamer.kickUsername}: قد يكون البروفايل خاص أو هناك حماية`);
                // تأكد من جعل الحالة أوفلاين إذا فشل الفحص تماماً لتجنب تعليق الستاتوس
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
