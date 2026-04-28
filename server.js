const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function updateStatus() {
    console.log("🔍 جاري فحص حالة الستريمرز...");
    const streamers = await Streamer.find({ kickUsername: { $ne: null, $exists: true } });
    
    if (streamers.length === 0) return console.log("⚠️ لا يوجد قنوات للفحص حالياً.");

    const browser = await puppeteer.launch({
        headless: "new", // ✅ ضروري جداً لتجنب الـ Crash في Render
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', 
            '--single-process',
            '--no-zygote'
        ],
        // ✅ حذفنا المسار القديم واستبدلناه بمتغير البيئة التلقائي لـ Render
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
    });



    const page = await browser.newPage();

    for (const s of streamers) {
        try {
            // ✅ تم تصحيح الرابط هنا بإضافة المسار الصحيح وعلامة الـ $
            const url = `https://kick.com/api/v2/channels/${s.kickUsername.trim()}`;
            await page.goto(`https://kick.com/api/v2/channels/${s.kickUsername.trim()}`, { waitUntil: 'networkidle2', timeout: 60000 });
            
            const content = await page.evaluate(() => document.querySelector('body').innerText);
            const data = JSON.parse(content);

            // ✅ التعديل هنا: سحبنا حالة البث، عدد المشاهدين، وصورة البروفايل
            await Streamer.updateOne({ _id: s._id }, {
                isLive: data.livestream ? true : false,
                viewers: data.livestream ? data.livestream.viewer_count : 0,
                profilePic: data.user ? data.user.profile_pic : null // جلب الصورة
            });
            
            console.log(`✅ ${s.kickUsername} -> تم تحديث البيانات والصورة`);
        } catch (e) {
            console.log(`❌ فشل فحص: ${s.kickUsername} | السبب: ${e.message}`);
        }
    }
    await browser.close();
    console.log("✨ انتهى الفحص.");
}


setInterval(updateStatus, 300000); // 300000 تساوي 5 دقائق
const browser = await puppeteer.launch({
    headless: "new", // ضروري جداً لتوفير الرام
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
});

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
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});

