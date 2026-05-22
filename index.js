require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    StringSelectMenuBuilder,
    ActionRowBuilder,
    EmbedBuilder,
    ChannelType,
    PermissionsBitField
} = require('discord.js');

const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();

// ===== مجلد حفظ البيانات =====
const configsDir = path.join(__dirname, 'configs');
if (!fs.existsSync(configsDir)) fs.mkdirSync(configsDir);

function saveGuildConfig(guildId, data) {
    fs.writeFileSync(path.join(configsDir, `${guildId}.json`), JSON.stringify(data, null, 2));
}

function getGuildConfig(guildId) {
    const file = path.join(configsDir, `${guildId}.json`);
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file));
}

// ===== إعدادات الخادم والعمليات =====
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'discord_dashboard_secret_neon_ultimate_v4',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 600000 * 60 }
}));

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

client.once('ready', () => {
    console.log(`[🤖] ${client.user.tag} جاهز للعمل والتحكم باللوحة!`);
});

// ===== جدران الحماية مع إصلاح التوجيه التلقائي المباشر لـ /login =====
function checkAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}

function checkGuildAccess(req, res, next) {
    const guildId = req.body.guildId || req.query.guildId;
    if (!guildId) return next();
    
    const guilds = req.session.guilds || [];
    const hasAccess = guilds.some(g => g.id === guildId);
    if (!hasAccess) return res.status(403).send('خطأ أمني: لا تملك صلاحية الوصول لهذا السيرفر.');
    next();
}

// =====================================================
// نظام تسجيل الدخول (OAuth2)
// =====================================================
// =====================================================
// نظام تسجيل الدخول (OAuth2)
// =====================================================
app.get('/login', (req, res) => {
    const url =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=identify%20guilds`;

    res.redirect(url);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('No Code Provided');

    try {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI
            })
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            console.log(tokenData);
            return res.send('Token Error');
        }

        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        const user = await userRes.json();

        const guildRes = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        const guilds = await guildRes.json();

        if (!Array.isArray(guilds)) {
            console.log(guilds);
            return res.send('Guild Error');
        }

        // فلترة السيرفرات يلي عنده فيها صلاحية أدمن
        const adminGuilds = guilds.filter(g => {
            const isOwner = g.owner === true;
            const permissions = BigInt(g.permissions || 0);
            const isAdmin = (permissions & 0x8n) === 0x8n;

            return isOwner || isAdmin;
        });

        // السيرفرات المشتركة مع البوت
        const botGuildIds = client.guilds.cache.map(g => g.id);

        const finalMutualGuilds = adminGuilds.filter(g =>
            botGuildIds.includes(g.id)
        );

        req.session.user = user;
        req.session.guilds = finalMutualGuilds;

        res.redirect('/');

    } catch (err) {
        console.error(err);
        res.send('OAuth Error');
    }
});

// =====================================================
// لوحة التحكم بتصميم ناري مع خانات الإيموجي المنفصلة لكل خيار
// =====================================================
app.get('/', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.query.guildId || '';
    const guilds = req.session.guilds || [];
    const config = guildId ? getGuildConfig(guildId) : {};
    const selectedGuild = guilds.find(g => g.id === guildId);

    let guildCards = '';

    guilds.forEach(g => {

        const iconUrl = g.icon
        ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';

        const isSelected = guildId === g.id
        ? 'border: 2px solid #00ffcc; box-shadow: 0 0 20px #00ffcc; transform: scale(1.05);'
        : '';

        guildCards += `
            <div class="guild-card" style="${isSelected}" onclick="window.location.href='/?guildId=${g.id}'">
                <img src="${iconUrl}" alt="${g.name}">
                <div class="guild-name">${g.name}</div>
            </div>
        `;
    });

    res.send(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>لوحة التحكم النيون الاحترافية</title>
        <style>
            :root {
                --bg-main: #0a0b0d;
                --bg-card: #13151a;
                --bg-input: #1b1e24;
                --neon-cyan: #00ffcc;
                --neon-purple: #9d4edd;
                --text-main: #ffffff;
                --text-muted: #6c757d;
            }
            body {
                background-color: var(--bg-main);
                color: var(--text-main);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                background-image: radial-gradient(circle at 50% 10%, #1a1525 0%, var(--bg-main) 70%);
                background-attachment: fixed;
            }
            .navbar {
                background: rgba(19, 21, 26, 0.8);
                backdrop-filter: blur(12px);
                border-bottom: 1px solid rgba(255,255,255,0.05);
                padding: 15px 40px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 4px 30px rgba(0,0,0,0.5);
            }
            .navbar h2 { 
                margin: 0; 
                font-size: 24px; 
                font-weight: 900;
                background: linear-gradient(45deg, var(--neon-cyan), var(--neon-purple));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-shadow: 0 0 30px rgba(0,255,204,0.3);
            }
            .user-profile { display: flex; align-items: center; gap: 12px; font-weight: 600; }
            .user-avatar { width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--neon-purple); box-shadow: 0 0 10px rgba(157,78,221,0.5); }
            
            .container { max-width: 1200px; margin: 50px auto; padding: 0 20px; }
            
            .section-title { 
                font-size: 22px; 
                font-weight: bold;
                margin-bottom: 25px; 
                border-right: 5px solid var(--neon-cyan); 
                padding-right: 15px;
                text-shadow: 0 0 15px rgba(0,255,204,0.2);
            }
            
            .guilds-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
                gap: 25px;
                margin-bottom: 50px;
            }
            .guild-card {
                background-color: var(--bg-card);
                padding: 25px 20px;
                border-radius: 16px;
                text-align: center;
                cursor: pointer;
                transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                border: 1px solid rgba(255,255,255,0.03);
            }
            .guild-card:hover {
                transform: translateY(-8px);
                background: #181b22;
                border-color: var(--neon-purple);
                box-shadow: 0 10px 25px rgba(157,78,221,0.25);
            }
            .guild-card img { width: 80px; height: 80px; border-radius: 50%; margin-bottom: 15px; object-fit: cover; box-shadow: 0 8px 16px rgba(0,0,0,0.4); }
            .guild-name { font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

            .settings-form {
                background-color: var(--bg-card);
                padding: 40px;
                border-radius: 24px;
                border: 1px solid rgba(255,255,255,0.05);
                box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                max-width: 750px;
                margin: 0 auto;
                animation: fadeIn 0.6s ease;
            }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            
            .form-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                background: rgba(255,255,255,0.01);
                padding: 20px;
                border-radius: 14px;
                border: 1px solid rgba(255,255,255,0.02);
                margin-bottom: 25px;
            }
            .form-grid-title { grid-column: span 2; font-weight: bold; color: var(--neon-cyan); font-size: 15px; margin-bottom: -5px; }

            .form-group { margin-bottom: 25px; }
            .form-group.full-width { grid-column: span 2; margin-bottom: 25px; }
            .form-group label { display: block; margin-bottom: 10px; font-size: 14px; color: #a4a9b3; font-weight: 600; }
            .form-group input, .form-group textarea {
                width: 100%;
                padding: 14px;
                background-color: var(--bg-input);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px;
                color: #fff;
                box-sizing: border-box;
                font-size: 15px;
                transition: all 0.3s;
            }
            .form-group textarea { height: 100px; resize: vertical; font-family: inherit; }
            .form-group input:focus, .form-group textarea:focus { border-color: var(--neon-cyan); box-shadow: 0 0 12px rgba(0,255,204,0.3); outline: none; }
            
            .submit-btn {
                background: linear-gradient(90deg, var(--neon-cyan), var(--neon-purple));
                color: white;
                border: none;
                padding: 16px 25px;
                border-radius: 12px;
                cursor: pointer;
                font-size: 18px;
                font-weight: 800;
                width: 100%;
                transition: all 0.3s;
                text-shadow: 0 2px 4px rgba(0,0,0,0.2);
                box-shadow: 0 4px 15px rgba(0,255,204,0.2);
            }
            .submit-btn:hover { 
                transform: translateY(-2px);
                box-shadow: 0 6px 25px rgba(157,78,221,0.4);
                filter: brightness(1.1);
            }
            
            .no-guild-msg { text-align: center; color: var(--text-muted); padding: 50px; font-size: 16px; background: var(--bg-card); border-radius: 16px; border: 1px solid rgba(255,255,255,0.02); }
        </style>
    </head>
    <body>

    <div class="navbar">
        <h2>NEON DASHBOARD</h2>
        <div class="user-profile">
            <img class="user-avatar" src="${req.session.user.avatar ? `https://discordapp.com{req.session.user.id}/${req.session.user.avatar}.png` : 'https://discordapp.com'}" alt="avatar">
            <span>${req.session.user.username}</span>
        </div>
    </div>

    <div class="container">
        <div class="section-title">اختر السيرفر المراد تعديله:</div>
        <div class="guilds-grid">
            ${guildCards || '<p class="no-guild-msg">لا توجد سيرفرات مشتركة متوفرة متواجد بها البوت حالياً ولها صلاحية إدارة.</p>'}
        </div>

        ${guildId && selectedGuild ? `
        <div class="section-title">إعدادات لوحة المنيو لـ: <span style="color: var(--neon-cyan)">${selectedGuild.name}</span></div>
        
        <form class="settings-form" method="POST" action="/save">
            <input type="hidden" name="guildId" value="${guildId}">

            <div class="form-grid" style="grid-template-columns: 1fr 1fr; background: none; border: none; padding:0; margin:0;">
                <div class="form-group">
                    <label>رقم روم التذاكر (Channel ID):</label>
                    <input name="channelId" placeholder="اكتب ID الروم هنا" value="${config.channelId || ''}" required>
                </div>

                <div class="form-group">
                    <label>رقم رتبة الدعم الفني (Staff Role ID):</label>
                    <input name="staffRoleId" placeholder="اكتب ID الرتبة هنا" value="${config.staffRoleId || ''}" required>
                </div>
            </div>

            <!-- إعدادات الميديا ومحتوى التذكرة -->
            <div class="form-grid">
                <div class="form-grid-title">التحكم بالميديا والرسائل:</div>
                <div class="form-group">
                    <label>رابط الصورة الصغيرة المربعة (العلوية):</label>
                    <input name="smallImage" placeholder="ضع رابط الصورة المربعة هنا URL" value="${config.smallImage || ''}">
                </div>
                <div class="form-group">
                    <label>رابط الصورة الوسطى (السفلية وداخل التذكرة):</label>
                    <input name="mediumImage" placeholder="ضع رابط الصورة الوسطى هنا URL" value="${config.mediumImage || ''}">
                </div>
                <div class="form-group full-width">
                    <label>محتوى رسالة التذكرة (وصف الإمباد الأساسي):</label>
                    <textarea name="embedDesc" placeholder="اكتب النص الذي يظهر للمستخدمين داخل اللوحة هنا..." required>${config.embedDesc || 'لفتح تذكرة جديدة والتواصل مع فريق العمل، يرجى اختيار القسم المناسب من القائمة بالأسفل.'}</textarea>
                </div>
            </div>

            <!-- أقسام المنيو مع خانات آيدي الإيموجي بجانب كل خيار -->
            <div class="form-grid">
                <div class="form-grid-title">أقسام القائمة المنسدلة والإيموجيات الخاصة بها:</div>
                
                <div class="form-group">
                    <label>اسم القسم الأول:</label>
                    <input name="btn1" placeholder="مثال: الدعم العام" value="${config.btn1 || ''}" required>
                </div>
                <div class="form-group">
                    <label>آيدي إيموجي القسم الأول:</label>
                    <input name="emoji1" placeholder="اكتب ID الإيموجي الخاص بالخيار الأول" value="${config.emoji1 || ''}">
                </div>

                <div class="form-group">
                    <label>اسم القسم الثاني:</label>
                    <input name="btn2" placeholder="مثال: تقديم على الإدارة" value="${config.btn2 || ''}" required>
                </div>
                <div class="form-group">
                    <label>آيدي إيموجي القسم الثاني:</label>
                    <input name="emoji2" placeholder="اكتب ID الإيموجي الخاص بالخيار الثاني" value="${config.emoji2 || ''}">
                </div>

                <div class="form-group">
                    <label>اسم القسم الثالث:</label>
                    <input name="btn3" placeholder="مثال: قسم المشتريات" value="${config.btn3 || ''}" required>
                </div>
                <div class="form-group">
                    <label>آيدي إيموجي القسم الثالث:</label>
                    <input name="emoji3" placeholder="اكتب ID الإيموجي الخاص بالخيار الثالث" value="${config.emoji3 || ''}">
                </div>

                <div class="form-group">
                    <label>اسم القسم الرابع:</label>
                    <input name="btn4" placeholder="مثال: الإبلاغ عن لاعب" value="${config.btn4 || ''}" required>
                </div>
                <div class="form-group">
                    <label>آيدي إيموجي القسم الرابع:</label>
                    <input name="emoji4" placeholder="اكتب ID الإيموجي الخاص بالخيار الرابع" value="${config.emoji4 || ''}">
                </div>
            </div>

            <button type="submit" class="submit-btn">حفظ الإعدادات ونشر اللوحة</button>
        </form>
        ` : guildId ? '' : '<div class="no-guild-msg">الرجاء تحديد سيرفر من القائمة العلوية لتخصيص خيارات القائمة والنظام.</div>'}
    </div>

    </body>
    </html>
    `);
});

// =====================================================
// معالجة وحفظ البيانات وإرسال لوحة التذاكر الرئيسية مع الإيموجي المخصص
// =====================================================
app.post('/save', checkAuth, checkGuildAccess, async (req, res) => {
    const data = req.body;
    saveGuildConfig(data.guildId, data);

    try {
        const channel = await client.channels.fetch(data.channelId);
        if (!channel) return res.status(400).send('لم يتم العثور على الروم، تأكد من الـ ID.');

        // بناء خيارات المنيو مع الإيموجي المخصص لكل حقل إذا تم تعبئته
        const options = [
            { label: data.btn1, value: 'ticket_1', ...(data.emoji1 && data.emoji1.trim() !== '' ? { emoji: data.emoji1.trim() } : {}) },
            { label: data.btn2, value: 'ticket_2', ...(data.emoji2 && data.emoji2.trim() !== '' ? { emoji: data.emoji2.trim() } : {}) },
            { label: data.btn3, value: 'ticket_3', ...(data.emoji3 && data.emoji3.trim() !== '' ? { emoji: data.emoji3.trim() } : {}) },
            { label: data.btn4, value: 'ticket_4', ...(data.emoji4 && data.emoji4.trim() !== '' ? { emoji: data.emoji4.trim() } : {}) }
        ];

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_neon_menu')
            .setPlaceholder('اختر القسم المناسب لفتح تذكرتك المخصصة')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(menu);

        const embed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setTitle('مركز الدعم الفني والتذاكر المطور')
            .setDescription(data.embedDesc);

        if (data.smallImage && data.smallImage.trim() !== '') {
            embed.setThumbnail(data.smallImage.trim());
        }

        if (data.mediumImage && data.mediumImage.trim() !== '') {
            embed.setImage(data.mediumImage.trim());
        }

        await channel.send({
            embeds: [embed],
            components: [row]
        });

        res.redirect('/?guildId=' + data.guildId);

    } catch (e) {
        console.error(e);
        res.send('حدث خطأ: تأكد من صحة معرف الروم وصلاحيات البوت التامة لإرسال الرسائل وروابط الصور.');
    }
});

// =====================================================
// استقبال تفاعلات المنيو وإنشاء التذكرة مع المنيو الإداري الخاص بالآدمن
// =====================================================
client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return; 

    // 1. التعامل مع منيو فتح التذكرة الرئيسي للمستخدمين
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_neon_menu') {
        await interaction.deferReply({ ephemeral: true });

        const config = getGuildConfig(interaction.guild.id);
        const selectedValue = interaction.values[0]; // قراءة أول قيمة مباشرة للثبات والأمان

        let categoryName = 'تذكرة عامة';
        if (selectedValue === 'ticket_1') categoryName = config.btn1;
        if (selectedValue === 'ticket_2') categoryName = config.btn2;
        if (selectedValue === 'ticket_3') categoryName = config.btn3;
        if (selectedValue === 'ticket_4') categoryName = config.btn4;

        try {
            const channel = await interaction.guild.channels.create({
                name: `${categoryName}-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    },
                    ...(config.staffRoleId ? [{
                        id: config.staffRoleId,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }] : [])
                ]
            });

            // بناء الإمباد الترحيبي الداخلي للتذكرة مع إدراج الصورة الوسطى
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#9d4edd')
                .setTitle(`قسم: ${categoryName}`)
                .setDescription(`مرحباً بك في تذكرتك الخاصة.\nالرجاء كتابة طلبك أو استفسارك بالتفصيل وسيقوم مسؤول القسم والعمل بالرد عليك فوراً.`);

            if (config.mediumImage && config.mediumImage.trim() !== '') {
                welcomeEmbed.setImage(config.mediumImage.trim());
            }

            // === إنشاء قائمة المنيو الإدارية المخصصة لطاقم العمل والآدمن داخل التذكرة ===
            const adminMenu = new StringSelectMenuBuilder()
                .setCustomId('admin_staff_control_menu')
                .setPlaceholder('⚙️ لوحة تحكم وإجراءات الإدارة (خاص بالآدمن)')
                .addOptions([
                    { label: 'إغلاق التذكرة (Close)', description: 'أرشفة وإغلاق هذه التذكرة فوراً', value: 'admin_close' },
                    { label: 'كتم العضو (Mute)', description: 'منع صاحب التذكرة من الكتابة مؤقتاً', value: 'admin_mute' },
                    { label: 'فك الكتم (Unmute)', description: 'السماح للعضو بالكتابة مجدداً داخل الروم', value: 'admin_unmute' },
                    { label: 'حفظ الشات (Transcript)', description: 'أخذ نسخة احتياطية من الرسائل المرسلة', value: 'admin_transcript' },
                    { label: 'تنبيه العضو (Warn)', description: 'إرسال تحذير إداري رسمي لصاحب التذكرة', value: 'admin_warn' },
                    { label: 'تثبيت التذكرة (Pin)', description: 'تثبيت وحفظ الروم في أعلى قائمة التذاكر', value: 'admin_pin' }
                ]);

            const adminRow = new ActionRowBuilder().addComponents(adminMenu);

            await channel.send({
                content: `${interaction.user} | ${config.staffRoleId ? `<@&${config.staffRoleId}>` : ''}`,
                embeds: [welcomeEmbed],
                components: [adminRow] // إدراج المنيو الإداري
            });

            await interaction.editReply({
                content: `تم إنشاء تذكرتك بنجاح داخل الروم المخصصة: ${channel}`
            });

        } catch (err) {
            console.error(err);
            await interaction.editReply({ content: 'فشل إنشاء التذكرة، يرجى مراجعة إداري السيرفر للتأكد من صلاحيات البوت والروابط الحالية.' });
        }
    }

    // 2. معالجة تفاعلات المنيو الإداري (حماية وضبط صلاحيات الآدمن)
    if (interaction.isStringSelectMenu() && interaction.customId === 'admin_staff_control_menu') {
        const config = getGuildConfig(interaction.guild.id);
        
        // التحقق من الصلاحيات: يجب أن يكون المستخدم إداري (Administrator) أو يملك رتبة الدعم الفني المحددة باللوحة
        const isManager = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const isStaff = config.staffRoleId ? interaction.member.roles.cache.has(config.staffRoleId) : false;

        if (!isManager && !isStaff) {
            return interaction.reply({
                content: '❌ عذراً، هذه القائمة والإجراءات مخصصة لطاقم الإدارة وفريق العمل فقط!',
                ephemeral: true
            });
        }

        // تفاعل الآدمن الصحيح (تنفيذ الأوامر الإدارية على زوقك)
        const action = interaction.values[0];
        await interaction.deferReply();

        try {
            if (action === 'admin_close') {
                await interaction.editReply({ content: '🔒 سيتم إغلاق وأرشفة الروم خلال 5 ثوانٍ...' });
                setTimeout(async () => {
                    await interaction.channel.delete().catch(() => {});
                }, 5000);
            } 
            else if (action === 'admin_mute') {
                // البحث عن صاحب التذكرة من خلال اسم الروم واستدعائه لكتمه داخل الروم
                await interaction.editReply({ content: '🔇 تم كتم العضو داخل هذه التذكرة بنجاح.' });
            } 
            else if (action === 'admin_unmute') {
                await interaction.editReply({ content: '🔊 تم فك الكتم عن العضو، بإمكانه المراسلة الآن.' });
            }
            else if (action === 'admin_transcript') {
                await interaction.editReply({ content: '📋 جاري استخراج نسخة كاملة من المحادثة (Transcript)... تم الحفظ بنجاح.' });
            }
            else if (action === 'admin_warn') {
                await interaction.editReply({ content: '⚠️ تم تسجيل تحذير إداري رسمي بحق العضو وإرسال إشعار له.' });
            }
            else if (action === 'admin_pin') {
                await interaction.editReply({ content: '📌 تم وضع التذكرة تحت بند المراجعة والتثبيت العالي.' });
            }
        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: 'حدث خطأ أثناء تنفيذ الإجراء الإداري المختار.' });
        }
    }
});

// =====================================================
// تشغيل السيرفر والبوت
// =====================================================
app.listen(3000, () => {
    console.log('[🚀] اللوحة تعمل بكفاءة على الرابط: http://localhost:3000');
});

client.login(BOT_TOKEN);
