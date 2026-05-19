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
    saveUninitialized: false
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

// =====================================================
// LOGIN
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
// CALLBACK (FIXED 100%)
// =====================================================
app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('No Code');

    try {
        // 1. TOKEN
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
        if (!tokenData.access_token) return res.send('Token Error');

        // 2. USER
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });
        const user = await userRes.json();

        // 3. GUILDS
        const guildRes = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        const guilds = await guildRes.json();
        if (!Array.isArray(guilds)) return res.send('Guild Error');

        // 4. ADMIN ONLY
        const adminGuilds = guilds.filter(g => (Number(g.permissions) & 0x8) === 0x8);

        // 5. BOT GUILDS
        const botGuilds = client.guilds.cache.map(g => g.id);

        const mutualGuilds = adminGuilds.filter(g => botGuilds.includes(g.id));

        // 6. SESSION
        req.session.user = user;
        req.session.guilds = mutualGuilds;

        res.redirect('/');

    } catch (err) {
        console.log(err);
        res.send('OAuth Error');
    }
});

// =====================================================
// DASHBOARD
// =====================================================
app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    const guildId = req.query.guildId || '';
    const guilds = req.session.guilds || [];
    const config = guildId ? getGuildConfig(guildId) : {};

    let options = `<option value="">اختر السيرفر</option>`;

    guilds.forEach(g => {
        options += `<option value="${g.id}" ${guildId === g.id ? 'selected' : ''}>${g.name}</option>`;
    });

    res.send(`
    <html dir="rtl">
    <body style="background:#111;color:white;font-family:sans-serif;padding:20px">

    <h2>Dashboard</h2>
    <p>Welcome ${req.session.user.username}</p>

    <form>
        <select name="guildId" onchange="this.form.submit()">
            ${options}
        </select>
    </form>

    ${guildId ? `
    <form method="POST" action="/save">
        <input type="hidden" name="guildId" value="${guildId}">

        <input name="channelId" placeholder="Channel ID" value="${config.channelId || ''}"><br>
        <input name="staffRoleId" placeholder="Role ID" value="${config.staffRoleId || ''}"><br>
        <input name="btn1" placeholder="Button 1" value="${config.btn1 || ''}"><br>
        <input name="btn2" placeholder="Button 2" value="${config.btn2 || ''}"><br>

        <button type="submit">Save</button>
    </form>
    ` : ''}

    </body>
    </html>
    `);
});

// =====================================================
// SAVE + SEND PANEL
// =====================================================
app.post('/save', async (req, res) => {
    const data = req.body;
    saveGuildConfig(data.guildId, data);

    try {
        const channel = await client.channels.fetch(data.channelId);

        const menu = new StringSelectMenuBuilder()
            .setCustomId('ticket_menu')
            .setPlaceholder('اختر التكت')
            .addOptions([
                { label: data.btn1 || 'Ticket 1', value: '1' },
                { label: data.btn2 || 'Ticket 2', value: '2' }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setDescription('اضغط لفتح تذكرة');

        await channel.send({
            embeds: [embed],
            components: [row]
        });

        res.redirect('/?guildId=' + data.guildId);

    } catch (e) {
        console.log(e);
        res.send('Channel Error');
    }
});

// =====================================================
// TICKETS
// =====================================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'ticket_menu') return;

    const config = getGuildConfig(interaction.guild.id);

    const channel = await interaction.guild.channels.create({
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

    await channel.send(`Ticket for ${interaction.user}`);

    await interaction.reply({
        content: `Ticket created: ${channel}`,
        ephemeral: true
    });
});

// =====================================================
// START
// =====================================================
app.listen(3000, () => {
    console.log('Dashboard Running');
});

client.login(BOT_TOKEN);
