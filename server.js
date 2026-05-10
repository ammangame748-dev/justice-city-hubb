const express = require('express');
const mongoose = require('mongoose');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// ================= DATABASE =================
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://hsamhmaydh4_db_user:xls5Av4Nr4a5PA7W@cluster0.wjnh8d0.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ متصل بالداتابيز بنجاح (نظام الوهمي)'))
  .catch(err => console.error('❌ خطأ في الاتصال:', err));

// ================= MODELS =================
const FakeService = mongoose.model('FakeService', new mongoose.Schema({
  targetName: String,
  platform: String,
  fakeCount: { type: Number, default: 0 },
  expiryDate: Date,
  createdAt: { type: Date, default: Date.now }
}));

// ================= ROUTES =================

// الصفحة الرئيسية
app.get('/', async (req, res) => {
  const now = new Date();
  // جلب الخدمات اللي لسا ما خلص وقتها (شهر)
  const services = await FakeService.find({ expiryDate: { $gt: now } }).sort({ createdAt: -1 });
  
  const stats = {
    totalOrders: services.length + 540, // رقم وهمي للجمالية
    activeNow: services.length,
    totaldelivered: 12400
  };
  
  res.render('index', { services, stats });
});

// لوحة التحكم (الأدمن)
app.get('/admin-justice', async (req, res) => {
  if (req.query.pass !== "1234") return res.status(403).send("❌ غير مصرح");
  const services = await FakeService.find({});
  res.render('admin', { services });
});

// إضافة خدمة وهمية جديدة
app.post('/admin/add-fake', async (req, res) => {
  if (req.body.pass !== "1234") return res.status(403).send("❌ غير مصرح");
  
  const { targetName, platform, count, months } = req.body;
  
  let expiry = new Date();
  expiry.setMonth(expiry.getMonth() + parseInt(months || 1));

  await FakeService.create({
    targetName,
    platform,
    fakeCount: count,
    expiryDate: expiry
  });

  res.send("<script>alert('✅ تم تفعيل التزويد الوهمي!'); window.location='/admin-justice?pass=1234';</script>");
});

// حذف خدمة
app.get('/admin/delete-service/:id', async (req, res) => {
  if (req.query.pass !== "1234") return res.status(403).send("❌ غير مصرح");
  await FakeService.findByIdAndDelete(req.params.id);
  res.redirect('/admin-justice?pass=1234');
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 نظام الوهمي شغال على المنفذ ${PORT}`);
});
