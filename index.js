require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    PermissionsBitField,
    ChannelType
} = require('discord.js');

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: 'justice_city_secret',
    resave: false,
    saveUninitialized: false
}));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const DATA_DIR = './guilds_data';

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

function getGuildConfig(guildId) {
    const filePath = path.join(DATA_DIR, `${guildId}.json`);

    if (!fs.existsSync(filePath)) return {};

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveGuildConfig(guildId, data) {
    const filePath = path.join(DATA_DIR, `${guildId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
}

client.once('ready', () => {
    console.log(`${client.user.tag} Ready`);
});

app.get('/login', (req, res) => {

    const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify guilds`;

    res.redirect(url);
});

app.get('/callback', async (req, res) => {

    const code = req.query.code;

    if (!code) return res.send('No Code');

    try {

        const params = new URLSearchParams();

        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', REDIRECT_URI);

        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const tokenData = await tokenRes.json();

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

        const adminGuilds = guilds.filter(g =>
            (g.permissions & 0x8) === 0x8
        );

        const botGuilds = client.guilds.cache.map(g => g.id);

        const mutualGuilds = adminGuilds.filter(g =>
            botGuilds.includes(g.id)
        );

        req.session.user = user;
        req.session.guilds = mutualGuilds;

        res.redirect('/');

    } catch (err) {
        console.log(err);
        res.send('OAuth Error');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

app.get('/', async (req, res) => {

    if (!req.session.user) {
        return res.redirect('/login');
    }

    const guildId = req.query.guildId || '';

    const guilds = req.session.guilds || [];

    const currentConfig = guildId
        ? getGuildConfig(guildId)
        : {};

    let guildOptions = `<option value="">اختر السيرفر</option>`;

    guilds.forEach(g => {

        guildOptions += `
        <option value="${g.id}" ${guildId === g.id ? 'selected' : ''}>
            ${g.name}
        </option>
        `;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">

    <head>
        <meta charset="UTF-8">
        <title>Justice City Panel</title>

        <style>

            *{
                margin:0;
                padding:0;
                box-sizing:border-box;
                font-family:sans-serif;
            }

            body{
                background:#0f1015;
                color:white;
                display:flex;
                min-height:100vh;
            }

            .sidebar{
                width:260px;
                background:#090a0f;
                padding:20px;
                border-left:1px solid #1d1f2b;
            }

            .sidebar h1{
                text-align:center;
                color:#5865f2;
                margin-bottom:25px;
            }

            .user-box{
                background:#14161f;
                padding:15px;
                border-radius:10px;
                margin-bottom:20px;
                text-align:center;
            }

            .menu{
                background:#5865f2;
                padding:14px;
                border-radius:10px;
                text-align:center;
                font-weight:bold;
            }

            .main{
                flex:1;
                padding:40px;
            }

            .card{
                max-width:900px;
                margin:auto;
                background:#161821;
                padding:30px;
                border-radius:15px;
                box-shadow:0 0 20px rgba(0,0,0,.4);
            }

            .card h2{
                margin-bottom:25px;
                color:#5865f2;
            }

            .group{
                margin-bottom:18px;
            }

            label{
                display:block;
                margin-bottom:8px;
                color:#ccc;
            }

            input, textarea, select{
                width:100%;
                padding:14px;
                background:#0f1015;
                border:1px solid #2d3145;
                color:white;
                border-radius:10px;
            }

            textarea{
                resize:none;
            }

            .grid{
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:15px;
            }

            button{
                width:100%;
                padding:15px;
                background:#5865f2;
                border:none;
                border-radius:10px;
                color:white;
                font-size:16px;
                cursor:pointer;
                margin-top:15px;
            }

            button:hover{
                opacity:.9;
            }

        </style>

    </head>

    <body>

        <div class="sidebar">

            <h1>Justice</h1>

            <div class="user-box">
                <p>${req.session.user.username}</p>
            </div>

            <div class="menu">
                Ticket System
            </div>

        </div>

        <div class="main">

            <div class="card">

                <h2>لوحة تحكم التكت</h2>

                <form action="/" method="GET">

                    <div class="group">
                        <label>اختيار السيرفر</label>

                        <select name="guildId" onchange="this.form.submit()">
                            ${guildOptions}
                        </select>
                    </div>

                </form>

                ${guildId ? `

                <form action="/save-config" method="POST">

                    <input type="hidden" name="guildId" value="${guildId}">

                    <div class="grid">

                        <div class="group">
                            <label>اسم الخيار 1</label>
                            <input name="btn1" value="${currentConfig.btn1 || ''}">
                        </div>

                        <div class="group">
                            <label>اسم الخيار 2</label>
                            <input name="btn2" value="${currentConfig.btn2 || ''}">
                        </div>

                    </div>

                    <div class="grid">

                        <div class="group">
                            <label>اسم الخيار 3</label>
                            <input name="btn3" value="${currentConfig.btn3 || ''}">
                        </div>

                        <div class="group">
                            <label>اسم الخيار 4</label>
                            <input name="btn4" value="${currentConfig.btn4 || ''}">
                        </div>

                    </div>

                    <div class="group">
                        <label>وصف التكت</label>
                        <textarea rows="5" name="desc">${currentConfig.desc || ''}</textarea>
                    </div>

                    <div class="group">
                        <label>صورة كبيرة تحت الايمبد</label>
                        <input name="banner" value="${currentConfig.banner || ''}">
                    </div>

                    <div class="group">
                        <label>صورة صغيرة فوق الايمبد</label>
                        <input name="thumbnail" value="${currentConfig.thumbnail || ''}">
                    </div>

                    <div class="grid">

                        <div class="group">
                            <label>ايدي الروم</label>
                            <input name="channelId" value="${currentConfig.channelId || ''}">
                        </div>

                        <div class="group">
                            <label>ايدي رتبة الادارة</label>
                            <input name="staffRoleId" value="${currentConfig.staffRoleId || ''}">
                        </div>

                    </div>

                    <button type="submit">
                        حفظ ونشر التكت
                    </button>

                </form>

                ` : ''}

            </div>

        </div>

    </body>

    </html>
    `);
});

app.post('/save-config', async (req, res) => {

    const data = req.body;

    saveGuildConfig(data.guildId, data);

    try {

        const channel = await client.channels.fetch(data.channelId);

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_menu')
            .setPlaceholder('اختر القسم')
            .addOptions([
                {
                    label: data.btn1,
                    value: '1'
                },
                {
                    label: data.btn2,
                    value: '2'
                },
                {
                    label: data.btn3,
                    value: '3'
                },
                {
                    label: data.btn4,
                    value: '4'
                }
            ]);

        const row = new ActionRowBuilder()
            .addComponents(menu);

        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setDescription(data.desc)
            .setImage(data.banner)
            .setThumbnail(data.thumbnail);

        await channel.send({
            embeds: [embed],
            components: [row]
        });

        res.redirect('/?guildId=' + data.guildId);

    } catch (err) {

        console.log(err);
        res.send('Error');
    }
});

client.on('interactionCreate', async interaction => {

    if (!interaction.isStringSelectMenu()) return;

    if (interaction.customId !== 'ticket_menu') return;

    const config = getGuildConfig(interaction.guild.id);

    const ticket = await interaction.guild.channels.create({

        name: `ticket-${interaction.user.username}`,

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
                    PermissionsBitField.Flags.SendMessages
                ]
            },

            {
                id: config.staffRoleId,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages
                ]
            }

        ]

    });

    const embed = new EmbedBuilder()
        .setColor('#5865f2')
        .setDescription(`
        اهلا ${interaction.user}

        تم فتح التكت بنجاح
        الرجاء انتظار الادارة
        `)
        .setImage(config.banner)
        .setThumbnail(config.thumbnail);

    await ticket.send({
        content: `${interaction.user} <@&${config.staffRoleId}>`,
        embeds: [embed]
    });

    await interaction.reply({
        content: `تم فتح التكت ${ticket}`,
        ephemeral: true
    });

});

app.listen(3000, () => {
    console.log('Dashboard Running');
});

client.login(BOT_TOKEN);