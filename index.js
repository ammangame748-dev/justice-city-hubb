require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs'); // استدعاء حزمة نظام الملفات لحفظ البيانات

// ==========================================
// 1. إعدادات البوت والاتصال بالديسكورد
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const BOT_TOKEN = process.env.BOT_TOKEN; 
const CONFIG_FILE = './ticket_config.json'; // اسم الملف الذي سيحفظ الإعدادات للأبد
let ticketConfig = null;

// دالة لجلب الإعدادات من الملف عند تشغيل البوت
function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            ticketConfig = JSON.parse(data);
            console.log('[DATABASE] Saved configuration loaded successfully.');
        } catch (error) {
            console.error('[DATABASE] Error reading config file:', error);
            ticketConfig = null;
        }
    } else {
        console.log('[DATABASE] No previous configuration found. Waiting for Dashboard setup.');
    }
}

client.once('ready', () => {
    console.log(`[BOT] Connected successfully as ${client.user.tag}`);
    loadConfig(); // قراءة الإعدادات المحفوظة فور تشغيل البوت
});

// ==========================================
// 2. لوحة التحكم (Express Dashboard)
// ==========================================
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// واجهة الـ HTML للوحة التحكم (صفحة واحدة، منيو يسار، الخانات المطلوبة)
app.get('/', (req, res) => {
    // جلب القيم الحالية المحفوظة لكي تظهر داخل الخانات تلقائياً في الموقع إذا كانت موجودة
    const c = ticketConfig || {};
    
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>لوحة تحكم نظام التكت</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            body { display: flex; height: 100vh; background-color: #1e1f22; color: #f2f3f5; }
            .sidebar { width: 260px; background-color: #111214; padding: 20px; display: flex; flex-direction: column; gap: 10px; border-left: 1px solid #2b2d31; }
            .sidebar h2 { font-size: 20px; text-align: center; margin-bottom: 20px; color: #5865f2; }
            .menu-item { padding: 12px; background-color: #2b2d31; border-radius: 6px; cursor: pointer; text-align: center; font-weight: bold; }
            .menu-item.active { background-color: #5865f2; }
            .main-content { flex: 1; padding: 40px; overflow-y: auto; }
            .form-container { max-width: 700px; background-color: #2b2d31; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
            .form-container h3 { margin-bottom: 20px; color: #fff; border-bottom: 2px solid #35363c; padding-bottom: 10px; }
            .row-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
            .form-group { display: flex; flex-direction: column; margin-bottom: 15px; }
            .form-group label { margin-bottom: 8px; font-size: 14px; color: #b5bac1; }
            .form-group input, .form-group textarea { padding: 10px; background-color: #1e1f22; border: 1px solid #3f4147; border-radius: 4px; color: #fff; font-size: 14px; }
            .form-group input:focus, .form-group textarea:focus { border-color: #5865f2; outline: none; }
            button.btn-submit { width: 100%; padding: 12px; background-color: #248046; border: none; border-radius: 4px; color: white; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; }
            button.btn-submit:hover { background-color: #1a6535; }
            .alert { padding: 10px; background-color: #248046; color: white; border-radius: 4px; margin-bottom: 15px; display: none; text-align: center; }
        </style>
    </head>
    <body>

        <div class="sidebar">
            <h2>التحكم</h2>
            <div class="menu-item active">صفحة التكت</div>
        </div>

        <div class="main-content">
            <div class="form-container">
                <h3>إعدادات قائمة التكت (4 خانات مخصصة)</h3>
                <div id="successAlert" class="alert">تم حفظ الإعدادات بنجاح في قاعدة البيانات ونشر التكت!</div>
                
                <form action="/save-config" method="POST">
                    
                    <div class="row-grid">
                        <div class="form-group">
                            <label>اسم الخيار 1 في المنيو</label>
                            <input type="text" name="btnName1" value="${c.btnName1 || ''}" placeholder="مثال: الدعم الفني" required>
                        </div>
                        <div class="form-group">
                            <label>ID إيموجي الخيار 1 (اختياري)</label>
                            <input type="text" name="emojiId1" value="${c.emojiId1 || ''}" placeholder="مثال: 123456789012345">
                        </div>
                    </div>

                    <div class="row-grid">
                        <div class="form-group">
                            <label>اسم الخيار 2 في المنيو</label>
                            <input type="text" name="btnName2" value="${c.btnName2 || ''}" placeholder="مثال: تقديم إدارة" required>
                        </div>
                        <div class="form-group">
                            <label>ID إيموجي الخيار 2 (اختياري)</label>
                            <input type="text" name="emojiId2" value="${c.emojiId2 || ''}" placeholder="مثال: 123456789012345">
                        </div>
                    </div>

                    <div class="row-grid">
                        <div class="form-group">
                            <label>اسم الخيار 3 في المنيو</label>
                            <input type="text" name="btnName3" value="${c.btnName3 || ''}" placeholder="مثال: الشكاوى والبلاغات" required>
                        </div>
                        <div class="form-group">
                            <label>ID إيموجي الخيار 3 (اختياري)</label>
                            <input type="text" name="emojiId3" value="${c.emojiId3 || ''}" placeholder="مثال: 123456789012345">
                        </div>
                    </div>

                    <div class="row-grid">
                        <div class="form-group">
                            <label>اسم الخيار 4 في المنيو</label>
                            <input type="text" name="btnName4" value="${c.btnName4 || ''}" placeholder="مثال: الاستفسارات العامة" required>
                        </div>
                        <div class="form-group">
                            <label>ID إيموجي الخيار 4 (اختياري)</label>
                            <input type="text" name="emojiId4" value="${c.emojiId4 || ''}" placeholder="مثال: 123456789012345">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>وصف رسالة التكت (Embed Description)</label>
                        <textarea name="ticketDesc" rows="3" placeholder="اكتب هنا الوصف الذي سيظهر للأعضاء عند فتح التكت..." required>${c.ticketDesc || ''}</textarea>
                    </div>

                    <div class="row-grid">
                        <div class="form-group">
                            <label>ID الروم لإرسال التكت الرئيسي إليه</label>
                            <input type="text" name="channelId" value="${c.channelId || ''}" placeholder="ID الروم" required>
                        </div>
                        <div class="form-group">
                            <label>ID رتبة الإدارة (التي تستخدم منيو التحكم فقط)</label>
                            <input type="text" name="staffRoleId" value="${c.staffRoleId || ''}" placeholder="ID الرتبة" required>
                        </div>
                    </div>

                    <button type="submit" class="btn-submit">حفظ الإعدادات ونشر التكت</button>
                </form>
            </div>
        </div>

        <script>
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('success') === 'true') {
                document.getElementById('successAlert').style.display = 'block';
            }
        </script>
    </body>
    </html>
    `);
});

// استقبال البيانات، حفظها في ملف خارجي، ونشر التكت في الديسكورد
app.post('/save-config', async (req, res) => {
    ticketConfig = req.body;
    
    try {
        // حفظ الإعدادات في ملف ticket_config.json بشكل دائم
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(ticketConfig, null, 4), 'utf8');
        console.log('[DATABASE] New settings permanently saved to JSON file.');

        const channel = await client.channels.fetch(ticketConfig.channelId);
        if (channel) {
            const options = [];
            for (let i = 1; i <= 4; i++) {
                const optionData = {
                    label: ticketConfig[`btnName${i}`],
                    value: `ticket_type_${i}`
                };
                if (ticketConfig[`emojiId${i}`]) {
                    optionData.emoji = { id: ticketConfig[`emojiId${i}`] };
                }
                options.push(optionData);
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('open_ticket_menu')
                .setPlaceholder('اختر القسم المناسب لفتح تكت')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(menu);
            const embed = new EmbedBuilder()
                .setDescription(ticketConfig.ticketDesc)
                .setColor('#5865f2');

            await channel.send({ embeds: [embed], components: [row] });
        }
        res.redirect('/?success=true');
    } catch (error) {
        console.error(error);
        res.status(500).send("حدث خطأ أثناء الاتصال بالديسكورد، تأكد من الـ IDs والإعدادات.");
    }
});

app.listen(3000, () => {
    console.log('[DASHBOARD] Web panel running on http://localhost:3000');
});

// ==========================================
// 3. معالجة تفاعلات البوت داخل ديسكورد (Discord Interaction)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    // إذا لم تكن هناك إعدادات محملة في الذاكرة أو في الملف، يتجاهل الأمر لمنع كراش البوت
    if (!ticketConfig) return;

    if (interaction.isStringSelectMenu() && interaction.customId === 'open_ticket_menu') {
        await interaction.deferReply({ ephemeral: true });

        const chosenValue = interaction.values[0]; 
        const index = chosenValue.split('_')[2]; // تعديل بسيط لجلب الرقم الصحيح من المصفوفة بدقة v14
        const ticketName = ticketConfig[`btnName${index}`];

        const guild = interaction.guild;
        const ticketChannel = await guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                },
                {
                    id: ticketConfig.staffRoleId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                }
            ],
        });

        const adminMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_control_menu')
            .setPlaceholder('قائمة التحكم بالاستمارة - للإدارة فقط')
            .addOptions([
                { label: 'استلام تكت', value: 'claim_ticket' },
                { label: 'استدعاء العضو', value: 'call_member' },
                { label: 'اضافه عضو', value: 'add_member' },
                { label: 'طرد عضو', value: 'kick_member' },
                { label: 'اغلاق التكت', value: 'close_ticket' }
            ]);

        const row = new ActionRowBuilder().addComponents(adminMenu);
        const startEmbed = new EmbedBuilder()
            .setDescription(`مرحبا بك في قسم: ${ticketName}\nيرجى طرح مشكلتك هنا وسيقوم فريق الدعم بالرد عليك قريباً.\n\nهذه القائمة مخصصة لطاقم العمل فقط لإدارة التكت والاستجابة المباشرة.`)
            .setColor('#2f3136');

        await ticketChannel.send({ content: `${interaction.user} | <@&${ticketConfig.staffRoleId}>`, embeds: [startEmbed], components: [row] });
        await interaction.editReply({ content: `تم فتح التكت الخاص بك بنجاح: ${ticketChannel}`, ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'admin_control_menu') {
        if (!interaction.member.roles.cache.has(ticketConfig.staffRoleId)) {
            return interaction.reply({ content: 'عذراً، هذا المنيو مخصص فقط لأعضاء الإدارة المعتمدين.', ephemeral: true });
        }

        const action = interaction.values[0];
        const channel = interaction.channel;

        const membersInChannel = channel.permissionOverwrites.cache;
        let targetMemberId = null;
        for (const [id, overwrite] of membersInChannel) {
            if (id !== interaction.guild.id && id !== ticketConfig.staffRoleId && id !== client.user.id) {
                targetMemberId = id;
                break;
            }
        }

        switch (action) {
            case 'claim_ticket':
                await channel.permissionOverwrites.edit(ticketConfig.staffRoleId, { SendMessages: false });
                await channel.permissionOverwrites.edit(interaction.user.id, { SendMessages: true, ViewChannel: true });
                await interaction.reply({ content: `تم استلام التكت بواسطة: ${interaction.user}. بقية الإداريين لا يمكنهم الإرسال الآن.` });
                break;

            case 'call_member':
                if (targetMemberId) {
                    await interaction.reply({ content: 'تم إرسال تنبيه الاستدعاء للعضو المفتوح له التكت.' });
                    await channel.send({ content: `<@${targetMemberId}>، يرجى التواجد في التكت الآن، الإدارة بانتظارك.` });
                } else {
                    await interaction.reply({ content: 'لم يتم العثور على العضو في هذا الروم لإرسال الاستدعاء.', ephemeral: true });
                }
                break;

            case 'add_member':
                await interaction.reply({ content: 'يرجى كتابة إيدي (ID) العضو الذي تريد إضافته للتكت هنا في الشات:', ephemeral: true });
                const filterAdd = m => m.author.id === interaction.user.id;
                const collectorAdd = channel.createMessageCollector({ filter: filterAdd, max: 1, time: 30000 });
                collectorAdd.on('collect', async m => {
                    const userId = m.content.trim();
                    try {
                        await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true });
                        await channel.send({ content: `تم إضافة <@${userId}> بنجاح إلى التكت.` });
                    } catch {
                        await channel.send({ content: 'فشل إضافة العضو، يرجى التأكد من الـ ID الصحيح.' });
                    }
                });
                break;

            case 'kick_member':
                await interaction.reply({ content: 'يرجى كتابة إيدي (ID) العضو الذي تريد إزالته من التكت هنا في الشات:', ephemeral: true });
                const filterKick = m => m.author.id === interaction.user.id;
                const collectorKick = channel.createMessageCollector({ filter: filterKick, max: 1, time: 30000 });
                collectorKick.on('collect', async m => {
                    const userId = m.content.trim();
                    try {
                        await channel.permissionOverwrites.delete(userId);
                        await channel.send({ content: `تم إزالة <@${userId}> بنجاح من التكت.` });
                    } catch {
                        await channel.send({ content: 'فشل إزالة العضو، يرجى التأكد من الـ ID الصحيح.' });
                    }
                });
                break;

            case 'close_ticket':
                await interaction.reply({ content: 'سيتم إغلاق وحذف هذا التكت خلال 5 ثوانٍ...' });
                setTimeout(async () => {
                    try { await channel.delete(); } catch (e) { console.log(e); }
                }, 5000);
                break;
        }
    }
});

client.login(BOT_TOKEN);
