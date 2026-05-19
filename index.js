require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

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
const DATA_DIR = './guilds_data'; // مجلد لحفظ بيانات كل سيرفر بشكل مستقل

// التأكد من وجود مجلد الحفظ لعدم حدوث كراش
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// دالة لجلب إعدادات سيرفر معين بناءً على الـ ID
function getGuildConfig(guildId) {
    const filePath = path.join(DATA_DIR, `${guildId}.json`);
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            return null;
        }
    }
    return null;
}

client.once('ready', () => {
    console.log(`[BOT] Connected successfully as ${client.user.tag}`);
});

// ==========================================
// 2. لوحة التحكم (Express Dashboard)
// ==========================================
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// الواجهة الرئيسية لـ لوحة التحكم
app.get('/', (req, res) => {
    const selectedGuildId = req.query.guildId || '';
    let currentConfig = {};

    // جلب قائمة كل السيرفرات المشترك فيها البوت حالياً
    const guildsList = client.guilds.cache.map(g => ({ id: g.id, name: g.name }));

    if (selectedGuildId) {
        currentConfig = getGuildConfig(selectedGuildId) || {};
    }

    // بناء قائمة الخيارات البرمجية للسيرفرات (Dropdown)
    let guildOptionsHtml = `<option value="">-- اختر السيرفر المراد التحكم به --</option>`;
    guildsList.forEach(g => {
        const selected = g.id === selectedGuildId ? 'selected' : '';
        guildOptionsHtml += `<option value="${g.id}" ${selected}>${g.name}</option>`;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>لوحة تحكم نظام التكت المتطور</title>
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
            .form-group input, .form-group textarea, .form-group select { padding: 10px; background-color: #1e1f22; border: 1px solid #3f4147; border-radius: 4px; color: #fff; font-size: 14px; }
            .form-group select option { background-color: #1e1f22; }
            .form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color: #5865f2; outline: none; }
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
                <h3>إعدادات قائمة التكت للسيرفرات</h3>
                <div id="successAlert" class="alert">تم حفظ التعديلات ونشر التكت الخاص بهذا السيرفر بنجاح!</div>
                
                <!-- خانة اختيار السيرفر المضاف إليه البوت -->
                <div class="form-group" style="margin-bottom: 25px;">
                    <label style="color: #5865f2; font-weight: bold; font-size: 16px;">اختر السيرفر الحالي للتعديل:</label>
                    <select id="guildSelector" onchange="changeGuild(this.value)">
                        ${guildOptionsHtml}
                    </select>
                </div>

                <!-- لن يظهر النموذج المتبقي إلا إذا تم اختيار سيرفر محدد بالفعل -->
                <form action="/save-config" method="POST" id="configForm" style="display: ${selectedGuildId ? 'block' : 'none'};">
                    <input type="hidden" name="guildId" value="${selectedGuildId}">
                    
                    <div class="row-grid">
                        <div class="form-group">
                            <label>اسم الخيار 1 في المنيو</label>
                            <input type="text" name="btnName1" value="${currentConfig.btnName1 || ''}" placeholder="مثال: الدعم الفني" required>
                        </div>
                        <div class="form-group">
                            <label>ID إيموجي الخيار 1 (اختياري)</label>
                            <input type="text" name="emojiId1" value="${currentConfig.emojiId1 || ''}" placeholder="مثال: 123456789012345">
                        </div>
                    </div>

                    <div class="row-grid">
                        <div class="form-group">
                            <label>اسم الخيار 2 في المنيو</label>
                            <input type="text" name="btnName2" value="${currentConfig.btnName2 || ''}" placeholder="مثال: تقديم إدارة" required>
                        </div>
                        <div class="form-group">
                            <label>ID إيموجي الخيار 2 (اختياري)</label>
                            <input type="text" name="emojiId2" value="${currentConfig.emojiId2 || ''}" placeholder="مثال: 123456789012345">
                        </div>
                    </div>

                    <div class="row-grid">
                        <div class="form-group">
                            <label>اسم الخيار 3 في المنيو</label>
                            <input type="text" name="btnName3" value="${currentConfig.btnName3 || ''}" placeholder="مثال: الشكاوى والبلاغات" required>
                        </div>
                        <div class="form-group">
                            <label>ID إيموجي الخيار 3 (اختياري)</label>
                            <input type="text" name="emojiId3" value="${currentConfig.emojiId3 || ''}" placeholder="مثال: 123456789012345">
                        </div>
                    </div>

                    <div class="row-grid">
                        <div class="form-group">
                            <label>اسم الخيار 4 في المنيو</label>
                            <input type="text" name="btnName4" value="${currentConfig.btnName4 || ''}" placeholder="مثال: الاستفسارات العامة" required>
                        </div>
                        <div class="form-group">
                            <label>ID إيموجي الخيار 4 (اختياري)</label>
                            <input type="text" name="emojiId4" value="${currentConfig.emojiId4 || ''}" placeholder="مثال: 123456789012345">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>وصف رسالة التكت (Embed Description)</label>
                        <textarea name="ticketDesc" rows="3" placeholder="اكتب هنا الوصف الذي سيظهر للأعضاء عند فتح التكت..." required>${currentConfig.ticketDesc || ''}</textarea>
                    </div>

                    <div class="row-grid">
                        <div class="form-group">
                            <label>ID الروم لإرسال التكت الرئيسي إليه</label>
                            <input type="text" name="channelId" value="${currentConfig.channelId || ''}" placeholder="ID الروم" required>
                        </div>
                        <div class="form-group">
                            <label>ID رتبة الإدارة (التي تستخدم منيو التحكم فقط)</label>
                            <input type="text" name="staffRoleId" value="${currentConfig.staffRoleId || ''}" placeholder="ID الرتبة" required>
                        </div>
                    </div>

                    <button type="submit" class="btn-submit">حفظ الإعدادات ونشر التكت في السيرفر</button>
                </form>
            </div>
        </div>

        <script>
            // دالة التحويل عند تغيير السيرفر المختار من القائمة المنسدلة
            function changeGuild(guildId) {
                if (guildId) {
                    window.location.href = '/?guildId=' + guildId;
                } else {
                    window.location.href = '/';
                }
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('success') === 'true') {
                document.getElementById('successAlert').style.display = 'block';
            }
        </script>
    </body>
    </html>
    `);
});

// استقبال البيانات وحفظها لكل سيرفر بشكل منفصل
app.post('/save-config', async (req, res) => {
    const configData = req.body;
    const guildId = configData.guildId;
    
    try {
        // حفظ ملف الـ JSON المخصص للسيرفر الحالي فقط
        const filePath = path.join(DATA_DIR, `${guildId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(configData, null, 4), 'utf8');
        console.log(`[DATABASE] Configuration permanently saved for Guild ID: ${guildId}`);

        const channel = await client.channels.fetch(configData.channelId);
        if (channel) {
            const options = [];
            for (let i = 1; i <= 4; i++) {
                const optionData = {
                    label: configData[`btnName${i}`],
                    value: `ticket_type_${i}_${guildId}` // دمج الـ guildId لضمان دقة التنفيذ البرمجي
                };
                if (configData[`emojiId${i}`]) {
                    optionData.emoji = { id: configData[`emojiId${i}`] };
                }
                options.push(optionData);
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('open_ticket_menu')
                .setPlaceholder('اختر القسم المناسب لفتح تكت')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(menu);
            const embed = new EmbedBuilder()
                .setDescription(configData.ticketDesc)
                .setColor('#5865f2');

            await channel.send({ embeds: [embed], components: [row] });
        }
        res.redirect(`/?guildId=${guildId}&success=true`);
    } catch (error) {
        console.error(error);
        res.status(500).send("حدث خطأ في الديسكورد، تأكد من صحة الـ IDs والرومات في هذا السيرفر.");
    }
});

app.listen(3000, () => {
    console.log('[DASHBOARD] Multi-Guild web panel running on http://localhost:3000');
});

// ==========================================
// 3. معالجة تفاعلات البوت داخل ديسكورد (Discord Interaction)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    const guildId = interaction.guild?.id;
    if (!guildId) return;

    // جلب إعدادات هذا السيرفر بالتحديد من الملف الخاص به
    const currentConfig = getGuildConfig(guildId);
    if (!currentConfig) return;

    // أولاً: فتح تكت جديدة للأعضاء
    if (interaction.isStringSelectMenu() && interaction.customId === 'open_ticket_menu') {
        await interaction.deferReply({ ephemeral: true });

        const chosenValue = interaction.values[0]; 
        const parts = chosenValue.split('_');
        const index = parts[2]; // الحصول على الترتيب البرمجي الصحيح
        const ticketName = currentConfig[`btnName${index}`];

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
                    id: currentConfig.staffRoleId,
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

        await ticketChannel.send({ content: `${interaction.user} | <@&${currentConfig.staffRoleId}>`, embeds: [startEmbed], components: [row] });
        await interaction.editReply({ content: `تم فتح التكت الخاص بك بنجاح: ${ticketChannel}`, ephemeral: true });
    }

    // ثانياً: منيو التحكم الداخلي الخاص بالإدارة
    if (interaction.isStringSelectMenu() && interaction.customId === 'admin_control_menu') {
        if (!interaction.member.roles.cache.has(currentConfig.staffRoleId)) {
            return interaction.reply({ content: 'عذراً، هذا المنيو مخصص فقط لأعضاء الإدارة المعتمدين في هذا السيرفر.', ephemeral: true });
        }

        const action = interaction.values[0];
        const channel = interaction.channel;

        const membersInChannel = channel.permissionOverwrites.cache;
        let targetMemberId = null;
        for (const [id, overwrite] of membersInChannel) {
            if (id !== interaction.guild.id && id !== currentConfig.staffRoleId && id !== client.user.id) {
                targetMemberId = id;
                break;
            }
        }

        switch (action) {
            case 'claim_ticket':
                await channel.permissionOverwrites.edit(currentConfig.staffRoleId, { SendMessages: false });
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
