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

// ===== Config folder =====
const configsDir = path.join(__dirname, 'configs');
if (!fs.existsSync(configsDir)) fs.mkdirSync(configsDir);

// ===== Save / Load =====
function saveGuildConfig(guildId, data) {
    fs.writeFileSync(path.join(configsDir, `${guildId}.json`), JSON.stringify(data, null, 2));
}

function getGuildConfig(guildId) {
    const file = path.join(configsDir, `${guildId}.json`);
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file));
}

// ===== Express setup =====
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'discord_dashboard_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 600000 * 60 }
}));

// ===== Discord Client =====
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// ===== Ready =====
client.once('ready', () => {
    console.log(`${client.user.tag} is Ready`);
});

// ===== Middlewares للأمان =====
function checkAuth(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

function checkGuildAccess(req, res, next) {
    const guildId = req.body.guildId || req.query.guildId;
    if (!guildId) return next();
    
    const guilds = req.session.guilds || [];
    const hasAccess = guilds.some(g => g.id === guildId);
    if (!hasAccess) return res.status(403).send('لا تملك صلاحية الوصول لهذا السيرفر.');
    next();
}

// =====================================================
// LOGIN (روابط تسجيل الدخول كما هي)
// =====================================================
app.get('/login', (req, res) => {
    const url =
    `https://discord.com/oauth2/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=identify%20guilds`;

    res.redirect(url);
});

// =====================================================
// CALLBACK (تعديل طفيف لضمان دقة جلب سيرفرات الأدمن)
// =====================================================
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('No Code');

    try {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI
            })
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) return res.send('Token Error');

        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const user = await userRes.json();

        const guildRes = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        const guilds = await guildRes.json();
        if (!Array.isArray(guilds)) return res.send('Guild Error');

        // السيرفرات المشتركة مع البوت فقط (بدون تعقيد permissions)
const botGuilds = client.guilds.cache.map(g => g.id);

const mutualGuilds = guilds.filter(g => botGuilds.includes(g.id));

req.session.user = user;
req.session.guilds = mutualGuilds;

res.redirect('/');
    } catch (err) {
        console.log(err);
        res.send('OAuth Error');
    }
});

// =====================================================
// DASHBOARD (تصميم خارق وجديد كلياً بنظام كروت السيرفرات)
// =====================================================
app.get('/', checkAuth, checkGuildAccess, (req, res) => {
    const guildId = req.query.guildId || '';
    const guilds = req.session.guilds || [];
    const config = guildId ? getGuildConfig(guildId) : {};
    const selectedGuild = guilds.find(g => g.id === guildId);

    // بناء كروت السيرفرات بشكل جميل
    let guildCards = '';
    guilds.forEach(g => {
        const iconUrl = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        const isSelected = guildId === g.id ? 'border: 2px solid #5865F2; transform: scale(1.03);' : '';
        
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
        <title>لوحة تحكم البوت الاحترافية</title>
        <style>
            :root {
                --bg-primary: #1e1f22;
                --bg-secondary: #2b2d31;
                --bg-tertiary: #313338;
                --accent-color: #5865F2;
                --accent-hover: #4752c4;
                --text-color: #f2f3f5;
                --text-muted: #949ba4;
            }
            body {
                background-color: var(--bg-primary);
                color: var(--text-color);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
            }
            .navbar {
                background-color: var(--bg-secondary);
                padding: 15px 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            }
            .navbar h2 { margin: 0; font-size: 22px; color: var(--accent-color); }
            .user-profile { display: flex; align-items: center; gap: 10px; }
            .user-avatar { width: 35px; height: 35px; border-radius: 50%; border: 2px solid var(--accent-color); }
            
            .container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
            
            .section-title { font-size: 20px; margin-bottom: 20px; border-right: 4px solid var(--accent-color); padding-right: 10px; }
            
            .guilds-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 20px;
                margin-bottom: 40px;
            }
            .guild-card {
                background-color: var(--bg-secondary);
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 2px solid transparent;
            }
            .guild-card:hover {
                transform: translateY(-5px);
                background-color: var(--bg-tertiary);
                border-color: var(--text-muted);
            }
            .guild-card img { width: 70px; height: 70px; border-radius: 50%; margin-bottom: 12px; object-fit: cover; box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
            .guild-name { font-weight: bold; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

            .settings-form {
                background-color: var(--bg-secondary);
                padding: 30px;
                border-radius: 16px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                max-width: 600px;
                margin: 0 auto;
                animation: fadeIn 0.5s ease;
            }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            
            .form-group { margin-bottom: 20px; }
            .form-group label { display: block; margin-bottom: 8px; font-size: 14px; color: var(--text-muted); }
            .form-group input {
                width: 100%;
                padding: 12px;
                background-color: var(--bg-primary);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px;
                color: #fff;
                box-sizing: border-box;
                font-size: 15px;
                transition: border-color 0.3s;
            }
            .form-group input:focus { border-color: var(--accent-color); outline: none; }
            
            .submit-btn {
                background-color: var(--accent-color);
                color: white;
                border: none;
                padding: 14px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                width: 100%;
                transition: background 0.2s;
            }
            .submit-btn:hover { background-color: var(--accent-hover); }
            
            .no-guild-msg { text-align: center; color: var(--text-muted); padding: 40px; font-size: 16px; background: var(--bg-secondary); border-radius: 12px; }
        </style>
    </head>
    <body>

    <div class="navbar">
        <h2>Dashboard Panel</h2>
        <div class="user-profile">
            <img class="user-avatar" src="${req.session.user.avatar ? `https://cdn.discordapp.com/avatars/${req.session.user.id}/${req.session.user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="avatar">
            <span>${req.session.user.username}</span>
        </div>
    </div>

    <div class="container">
        <div class="section-title">اختر السيرفر المراد تعديله (سيرفرات الإدارة فقط):</div>
        <div class="guilds-grid">
            ${guildCards || '<p class="no-guild-msg">لا توجد سيرفرات مشتركة متوفرة لديك فيها صلاحيات الإدارة.</p>'}
        </div>

        ${guildId && selectedGuild ? `
        <div class="section-title">إعدادات نظام التذاكر لـ: <span style="color: var(--accent-color)">${selectedGuild.name}</span></div>
        
        <form class="settings-form" method="POST" action="/save">
            <input type="hidden" name="guildId" value="${guildId}">

            <div class="form-group">
                <label>رقم روم التذاكر (Channel ID):</label>
                <input name="channelId" placeholder="اكتب ID الروم هنا" value="${config.channelId || ''}" required>
            </div>

            <div class="form-group">
                <label>رقم رتبة الدعم الفني (Staff Role ID):</label>
                <input name="staffRoleId" placeholder="اكتب ID الرتبة هنا" value="${config.staffRoleId || ''}" required>
            </div>

            <div class="form-group">
                <label>اسم خيار التذكرة الأول (Button 1):</label>
                <input name="btn1" placeholder="مثال: الدعم العام" value="${config.btn1 || ''}">
            </div>

            <div class="form-group">
                <label>اسم خيار التذكرة الثاني (Button 2):</label>
                <input name="btn2" placeholder="مثال: تقديم على الإدارة" value="${config.btn2 || ''}">
            </div>

            <button type="submit" class="submit-btn">حفظ التعديلات وإرسال اللوحة</button>
        </form>
        ` : guildId ? '' : '<div class="no-guild-msg">الرجاء تحديد سيرفر من الأعلى لعرض الإعدادات وتخصيصها.</div>'}
    </div>

    </body>
    </html>
    `);
});

// =====================================================
// SAVE + SEND PANEL (تأمين معالجة وحفظ البيانات)
// =====================================================
app.post('/save', checkAuth, checkGuildAccess, async (req, res) => {
    const data = req.body;
    saveGuildConfig(data.guildId, data);

    try {
        const channel = await client.channels.fetch(data.channelId);
        if (!channel) return res.send('لم يتم العثور على الروم المحددة.');

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_menu')
            .setPlaceholder('اختر نوع التذكرة لفتحها')
            .addOptions([
                { label: data.btn1 || 'Ticket 1', value: '1' },
                { label: data.btn2 || 'Ticket 2', value: '2' }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎫 نظام الدعم الفني والتذاكر')
            .setDescription('مرحباً بك! لفتح تذكرة جديدة والتواصل مع فريق العمل، يرجى اختيار القسم المناسب من القائمة بالأسفل.');

        await channel.send({
            embeds: [embed],
            components: [row]
        });

        res.redirect('/?guildId=' + data.guildId);

    } catch (e) {
        console.log(e);
        res.send('خطأ في إرسال اللوحة: تأكد من صحة ID الروم وإعطاء البوت صلاحية رؤية الروم وإرسال الرسائل.');
    }
});

// =====================================================
// TICKETS (تحسين متكامل لنظام إنشاء التذاكر آلياً)
// =====================================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'ticket_menu') return;

    // لتفادي انتهاء وقت التفاعل (Timeout) ولتظهر التذكرة بشكل سلس
    await interaction.deferReply({ ephemeral: true });

    const config = getGuildConfig(interaction.guild.id);

    try {
        const channel = await interaction.guild.channels.create({
            name: `🎫-${interaction.user.username}`,
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

        const welcomeEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('تذكرة جديدة المساعدة')
            .setDescription(`مرحباً بك ${interaction.user} في تذكرتك الخاصة.\nالرجاء كتابة استفسارك هنا، وسيقوم فريق الدعم الفني بالرد عليك بأقرب وقت ممكن.`);

        await channel.send({
            content: `${interaction.user} | ${config.staffRoleId ? `<@&${config.staffRoleId}>` : ''}`,
            embeds: [welcomeEmbed]
        });

        await interaction.editReply({
            content: `تم إنشاء تذكرتك بنجاح بروم منفصلة: ${channel}`
        });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: 'حدث خطأ أثناء محاولة إنشاء التذكرة، تأكد من صلاحيات البوت الإدارية بالسيرفر.' });
    }
});

// =====================================================
// START
// =====================================================
app.listen(3000, () => {
    console.log('Dashboard Running on http://localhost:3000');
});

client.login(BOT_TOKEN);
