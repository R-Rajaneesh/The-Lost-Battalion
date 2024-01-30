/* -----IMPORTS----- */
import "dotenv/config";
import Discord, { REST, Routes } from "discord.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import sqlite from "better-sqlite3";
import cron from "cron";
import moment from "moment";
import Color from "color";
import fs from "fs-extra";
/* -----WEB SERVER----- */ // - To keep it running on repl.it
const server = express();
server.use(cors());
server.use(helmet());
server.get("/", (req, res) => res.status(200).send("The Lost Battlion lives once again!"));
server.listen(80, () => { });
/* -----DISCORD BOT----- */
const sql = new sqlite("./TLB.sqlite", { fileMustExist: false });
sql
    .prepare(`CREATE TABLE IF NOT EXISTS TheLostBattlion (userid TEXT PRIMARY KEY UNIQUE, strikes TEXT, strikeNumber TEXT DEFAULT 0);`)
    .run();
const rest = new REST().setToken(`${process?.env?.BOT_TOKEN}`);
const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.AutoModerationConfiguration,
        Discord.GatewayIntentBits.AutoModerationExecution,
        Discord.GatewayIntentBits.DirectMessageReactions,
        Discord.GatewayIntentBits.DirectMessageTyping,
        Discord.GatewayIntentBits.DirectMessages,
        Discord.GatewayIntentBits.DirectMessages,
        Discord.GatewayIntentBits.GuildEmojisAndStickers,
        Discord.GatewayIntentBits.GuildIntegrations,
        Discord.GatewayIntentBits.GuildInvites,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildMessageReactions,
        Discord.GatewayIntentBits.GuildMessageTyping,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.GuildModeration,
        Discord.GatewayIntentBits.GuildPresences,
        Discord.GatewayIntentBits.GuildScheduledEvents,
        Discord.GatewayIntentBits.GuildVoiceStates,
        Discord.GatewayIntentBits.GuildWebhooks,
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.MessageContent,
    ],
    allowedMentions: { parse: ["everyone", "roles", "users"], repliedUser: true },
    presence: {
        afk: false,
        status: "online",
        activities: [
            {
                name: `The Lost Battlion lives once again!`,
                type: Discord.ActivityType.Playing,
            },
        ],
    },
});
/* -CHANNELS- */
const strikeChannelId = "1180483453137977436";
const recruitmentChannelId = "1144049478727372860";
const blacklistChannelId = "1180539348567982191";
/* -----STRIKE RELEASE----- */
const strikeClearer = new cron.CronJob("* * * * *", () => {
    const strikelogs = sql.prepare(`SELECT * FROM TheLostBattlion;`).all();
    strikelogs.forEach(async (strikelog) => {
        const strikes = JSON.parse(strikelog.strikes);
        strikes.forEach(async (strike) => {
            if (moment().unix() >= parseInt(strike.tilldate)) {
                const strikeChannel = await client.channels.fetch(strikeChannelId);
                if (strikeChannel?.isTextBased()) {
                    const strikeMessage = (await strikeChannel.messages.fetch()).find((msg) => msg.id === strike.messageid);
                    if (!strikeMessage)
                        return;
                    const strikeEmbed = JSON.parse(JSON.stringify(strikeMessage?.embeds[0]));
                    if (!strikeEmbed)
                        return;
                    strikeEmbed.description = `${strikeEmbed?.description}\n**\`This strike has been cleared\`**`;
                    const updatedStrikelog = {
                        ...strikelog,
                        ...{
                            strikes: JSON.stringify(strikes.filter((v) => moment().unix() < parseInt(v.tilldate))),
                            strikeNumber: `${parseInt(strikelog.strikeNumber) - 1}`,
                        },
                    };
                    sql
                        .prepare("INSERT OR REPLACE INTO TheLostBattlion VALUES (?, ?, ?);")
                        .run(updatedStrikelog.userid, updatedStrikelog.strikes, updatedStrikelog.strikeNumber);
                    await strikeMessage?.edit({
                        embeds: [new Discord.EmbedBuilder(strikeEmbed)],
                    });
                }
            }
        });
    });
});
/* -----COMMANDS----- */
const strikeMemberCommand = new Discord.SlashCommandBuilder()
    .setName("strike")
    .setDescription("Strike a member in the clan")
    .addUserOption((user) => user
    .setName("member")
    .setDescription("Select the member you want to strike.")
    .setRequired(true))
    .addStringOption((input) => input
    .setName("reason")
    .setDescription("Provide a reason for this strike.")
    .setRequired(true));
const recruitMemberCommand = new Discord.SlashCommandBuilder()
    .setName("recruit")
    .setDescription("recruit a member to the clan")
    .addStringOption((input) => input
    .setName("ign")
    .setDescription("Provide the In-Game name of the recruited. (Format: FirstName_LastName)")
    .setRequired(true))
    .addAttachmentOption((attachment) => attachment
    .setName("evidence")
    .setDescription("Attach a screenshot of the recruitment evidence. (Note: A screenshot of the recruitment process)")
    .setRequired(true))
    .addBooleanOption((bool) => bool
    .setName("invitation")
    .setDescription("Is the recruited invited to The Lost Battalion discord server?")
    .setRequired(true))
    .addStringOption((comments) => comments
    .setName("additional-comments")
    .setDescription("Provide a comment for the recruitment.")
    .setRequired(false));
const blacklistCommand = new Discord.SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Blacklist a member in the clan")
    .addStringOption((user) => user
    .setName("member")
    .setDescription("Name of the member you want to blacklist. (Format: FirstName_LastName)")
    .setRequired(true))
    .addStringOption((input) => input
    .setName("reason")
    .setDescription("Provide a reason for this blacklist.")
    .setRequired(true));
/* -----EVENTS----- */
client.once("ready", () => {
    rest.put(Routes.applicationCommands(process?.env?.BOT_ID), {
        body: [strikeMemberCommand, recruitMemberCommand, blacklistCommand],
    });
    console.log("The Lost Battlion is living!");
    strikeClearer.start();
});
client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton()) {
        const interactionMember = await interaction.guild?.members.fetch({
            user: interaction.user,
        });
        if (!interactionMember?.roles.cache.find((role) => role.id === ("1139667002097664191" || "1139667184839303328")))
            return;
        const strikedEmbed = interaction.message.embeds[0];
        if (interaction.customId === "strike-forgive") {
            if (strikedEmbed.footer?.text.split("⚬")[0].trim() ===
                ("Forgiven" || "Kicked" || "Banned"))
                return;
            const strikeMemberId = strikedEmbed?.footer?.text
                .split("⚬")[1]
                .trim();
            const strikeMember = (await interaction.guild?.members.fetch())?.get(strikeMemberId);
            const strikelogs = sql.prepare(`SELECT * FROM TheLostBattlion;`).all();
            const memberStrikeLog = strikelogs.find((strikelog) => `${strikelog.userid}` === strikeMemberId);
            const memberStrikes = JSON.parse(memberStrikeLog?.strikes);
            const updatedStrikes = memberStrikes.filter((strike) => strike.messageid !== interaction.message.id);
            const updatedStrikeLog = {
                ...memberStrikeLog,
                ...{
                    strikes: JSON.stringify(updatedStrikes),
                    strikeNumber: `${parseInt(memberStrikeLog.strikeNumber) - 1}`,
                },
            };
            sql
                .prepare("INSERT OR REPLACE INTO TheLostBattlion VALUES (?, ?, ?);")
                .run(updatedStrikeLog.userid, updatedStrikeLog.strikes, updatedStrikeLog.strikeNumber);
            const strikeEmbed = new Discord.EmbedBuilder(interaction.message.embeds[0]);
            strikeEmbed
                .setDescription(`${strikeEmbed.data.description}\n\n**\`You have been forgiven by\`**<@${interaction.user.id}>`)
                .setFooter({
                text: `Forgiven ⚬ ${strikedEmbed?.footer?.text.split("⚬")[1].trim()}`,
            });
            await interaction.message.edit({ embeds: [strikeEmbed] });
            await interaction.reply({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setTitle("Strike Log")
                        .setDescription(`You have forgiven <@${strikeMember?.id}>`)
                        .setTimestamp()
                        .setColor(Color("#ff5733").rgbNumber()),
                ],
                ephemeral: true,
            });
        }
        else if (interaction.customId === "strike-kick") {
            if (strikedEmbed.footer?.text.split("⚬")[0].trim() ===
                ("Forgiven" || "Kicked" || "Banned"))
                return;
            const strikeMemberId = strikedEmbed?.footer?.text
                .split("⚬")[1]
                .trim();
            const strikeMember = (await interaction.guild?.members.fetch())?.get(strikeMemberId);
            const strikeEmbed = new Discord.EmbedBuilder(interaction.message.embeds[0]);
            strikeEmbed
                .setDescription(`${strikeEmbed.data.description}\n\n**\`Member has been kicked by\`**<@${interaction.user.id}>`)
                .setFooter({
                text: `Kicked ⚬ ${strikedEmbed?.footer?.text.split("⚬")[1].trim()}`,
            });
            await interaction.message.edit({ embeds: [strikeEmbed] });
            strikeMember?.kick(`Got your third strike`);
            await interaction.reply({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setTitle("Strike Log")
                        .setDescription(`You have kicked <@${strikeMember?.id}>`)
                        .setTimestamp()
                        .setColor(Color("#ff5733").rgbNumber()),
                ],
                ephemeral: true,
            });
        }
        else if (interaction.customId === "strike-ban") {
            if (strikedEmbed.footer?.text === ("Forgiven" || "Kicked" || "Banned"))
                return;
            const strikeMemberId = strikedEmbed?.footer?.text
                .split("⚬")[1]
                .trim();
            const strikeMember = (await interaction.guild?.members.fetch())?.get(strikeMemberId);
            const strikeEmbed = new Discord.EmbedBuilder(interaction.message.embeds[0]);
            strikeEmbed
                .setDescription(`${strikeEmbed.data.description}\n\n**\`Member has been banned by\`**<@${interaction.user.id}>`)
                .setFooter({
                text: `Banned ⚬ ${strikedEmbed?.footer?.text.split("⚬")[1].trim()}`,
            });
            await interaction.message.edit({ embeds: [strikeEmbed] });
            strikeMember?.ban({ reason: `Got your third strike` });
            await interaction.reply({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setTitle("Strike Log")
                        .setDescription(`You have banned <@${strikeMember?.id}>`)
                        .setTimestamp()
                        .setColor(Color("#ff5733").rgbNumber()),
                ],
                ephemeral: true,
            });
        }
        else if (interaction.customId === "delete") {
            const strikeMemberId = strikedEmbed?.footer?.text
                .split("⚬")[1]
                .trim();
            const strikeMember = (await interaction.guild?.members.fetch())?.get(strikeMemberId);
            if (!strikedEmbed?.footer?.text)
                await interaction.message.delete();
            else {
                const strikelogs = sql.prepare(`SELECT * FROM TheLostBattlion;`).all();
                const memberStrikeLog = strikelogs.find((strikelog) => `${strikelog.userid}` === strikeMemberId);
                const memberStrikes = JSON.parse(memberStrikeLog?.strikes);
                const updatedStrikes = memberStrikes.filter((strike) => strike.messageid !== interaction.message.id);
                const updatedStrikeLog = {
                    ...memberStrikeLog,
                    ...{
                        strikes: JSON.stringify(updatedStrikes),
                        strikeNumber: `${parseInt(memberStrikeLog.strikeNumber) - 1}`,
                    },
                };
                sql
                    .prepare("INSERT OR REPLACE INTO TheLostBattlion VALUES (?, ?, ?);")
                    .run(updatedStrikeLog.userid, updatedStrikeLog.strikes, updatedStrikeLog.strikeNumber);
                await interaction.message.delete();
                await interaction.reply({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle("Strike Log")
                            .setDescription(`You have deleted <@${strikeMember?.id}>'s strike log`)
                            .setTimestamp()
                            .setColor(Color("#ff5733").rgbNumber()),
                    ],
                    ephemeral: true,
                });
            }
        }
    }
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "strike") {
            if (!interaction.inGuild())
                return;
            await interaction.deferReply({ ephemeral: true });
            const user = interaction.options.getUser("member");
            const reason = interaction.options.getString("reason");
            const member = (await interaction.guild?.members.fetch({
                user: user,
            }));
            const interactionMember = await interaction.guild?.members.fetch({
                user: interaction.user,
            });
            if (!interactionMember?.roles.cache.find((role) => role.id === "1139667002097664191" ||
                role.id === "1139667184839303328")) {
                await interaction.editReply({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle(`Strike Logs`)
                            .setDescription(`You don't have permissions to strike a member`)
                            .setTimestamp()
                            .setColor(Color("#ff5733").rgbNumber()),
                    ],
                });
            }
            else if (interactionMember?.roles?.highest.rawPosition <=
                member?.roles?.highest?.rawPosition) {
                await interaction.editReply({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle(`Strike Logs`)
                            .setDescription(`You cannot strike members higher or equal to your rank`)
                            .setTimestamp()
                            .setColor(Color("#ff5733").rgbNumber()),
                    ],
                });
            }
            else {
                const memberData = sql
                    .prepare(`SELECT * FROM TheLostBattlion WHERE userid = (?)`)
                    .get(member.id);
                let currentStrikeNumber = 1;
                let memberStrikes = [];
                const strikeTillDate = moment().add(14, "days").unix();
                if (memberData !== undefined) {
                    currentStrikeNumber = parseInt(memberData?.strikeNumber) + 1;
                    memberStrikes = JSON.parse(memberData?.strikes);
                }
                const strikeEmbed = new Discord.EmbedBuilder()
                    .setTitle("Member Striked")
                    .setAuthor({
                    name: `${member?.nickname ?? member.displayName}`,
                    iconURL: member?.displayAvatarURL({ extension: "png" }),
                })
                    .setColor("Red")
                    .setTimestamp();
                const strikeComponents = new Discord.ActionRowBuilder();
                if (currentStrikeNumber === 3) {
                    const banButton = new Discord.ButtonBuilder({ emoji: { name: "🖕" } })
                        .setCustomId("strike-ban")
                        .setLabel("Ban")
                        .setStyle(Discord.ButtonStyle.Danger);
                    const kickButton = new Discord.ButtonBuilder({
                        emoji: { name: "🫳" },
                    })
                        .setCustomId("strike-kick")
                        .setLabel("Kick")
                        .setStyle(Discord.ButtonStyle.Danger);
                    const forgiveButton = new Discord.ButtonBuilder({
                        emoji: { name: "🫴" },
                    })
                        .setCustomId("strike-forgive")
                        .setLabel("Forgive")
                        .setStyle(Discord.ButtonStyle.Success);
                    const deleteButton = new Discord.ButtonBuilder()
                        .setCustomId("delete")
                        .setLabel("Delete")
                        .setStyle(Discord.ButtonStyle.Danger)
                        .setEmoji({ name: "🕳" });
                    strikeComponents.setComponents(forgiveButton, kickButton, banButton, deleteButton);
                    strikeEmbed
                        .setDescription(`<@${user.id}> has recieved a **Third strike**`)
                        .setFields([
                        {
                            name: "Strike Number",
                            value: `${currentStrikeNumber}`,
                            inline: true,
                        },
                        { name: "Strike Reason", value: `${reason}`, inline: true },
                        {
                            name: "Striker Name",
                            value: `<@${interaction.user.id}>`,
                            inline: false,
                        },
                        {
                            name: "Strike clearance",
                            value: `<t:${strikeTillDate}:R>`,
                            inline: false,
                        },
                    ])
                        .setFooter({ text: `${strikeTillDate} ⚬ ${member.id}` });
                }
                else {
                    const forgiveButton = new Discord.ButtonBuilder({
                        emoji: { name: "🫴" },
                    })
                        .setCustomId("strike-forgive")
                        .setLabel("Forgive")
                        .setStyle(Discord.ButtonStyle.Success);
                    const deleteButton = new Discord.ButtonBuilder()
                        .setCustomId("delete")
                        .setLabel("Delete")
                        .setStyle(Discord.ButtonStyle.Danger)
                        .setEmoji({ name: "🕳" });
                    strikeComponents.setComponents(forgiveButton, deleteButton);
                    strikeEmbed
                        .setDescription(`<@${user?.id}> has been striked`)
                        .setFields([
                        {
                            name: "Strike Number",
                            value: `${currentStrikeNumber}`,
                            inline: true,
                        },
                        { name: "Strike Reason", value: `${reason}`, inline: true },
                        {
                            name: "Striker Name",
                            value: `<@${interaction.user.id}>`,
                            inline: false,
                        },
                        {
                            name: "Strike clearance (only cleared if clean)",
                            value: `<t:${strikeTillDate}:R>`,
                            inline: false,
                        },
                    ])
                        .setFooter({ text: `${strikeTillDate} ⚬ ${member.id}` });
                }
                const strikeChannel = await client.channels.fetch(strikeChannelId);
                if (strikeChannel?.isTextBased())
                    strikeChannel
                        .send({
                        embeds: [strikeEmbed],
                        components: [strikeComponents],
                    })
                        .then(async (message) => {
                        memberStrikes.push({
                            reason: reason,
                            tilldate: `${strikeTillDate}`,
                            messageid: message.id,
                        });
                        sql
                            .prepare(`INSERT OR REPLACE INTO TheLostBattlion VALUES(?, ?, ?)`)
                            .run(member.id, JSON.stringify(memberStrikes), currentStrikeNumber);
                        await interaction
                            .editReply({
                            embeds: [
                                new Discord.EmbedBuilder()
                                    .setTitle(`Strike Logs`)
                                    .setDescription(`Your strike has been added ${message.url}`)
                                    .setColor(Color("#ff5733").rgbNumber()),
                            ],
                        })
                            .catch(() => { });
                    });
            }
        }
        else if (interaction.commandName === "recruit") {
            const interactionMember = await interaction.guild?.members.fetch({
                user: interaction.user,
            });
            await interaction.deferReply({ ephemeral: true });
            if (!interactionMember?.roles.cache.find((role) => role.id === "1139667002097664191" ||
                role.id === "1139667184839303328" ||
                role.id === "1139667424971599934")) {
                await interaction.editReply({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle(`Recruitment Logs`)
                            .setDescription(`You don't have permissions to recruit a member`)
                            .setColor(Color("#ff5733").rgbNumber())
                            .setTimestamp(),
                    ],
                });
            }
            else {
                const ign = interaction.options.getString("ign");
                const evidence = interaction.options.getAttachment("evidence");
                const invitation = interaction.options.getBoolean("invitation");
                const comments = interaction.options.getString("additional-comments");
                const recruitmentEmbed = new Discord.EmbedBuilder()
                    .setTitle("Recruitment logs")
                    .setDescription("A new member has been recruited to The Lost Battlion")
                    .setFields([
                    {
                        name: "Recruiter",
                        value: `<@${interaction.user.id}>`,
                        inline: true,
                    },
                    { name: "Recruited Member", value: `${ign}`, inline: true },
                    {
                        name: "Invited to Discord",
                        value: `\`${invitation ? "Yes" : "No"}\``,
                        inline: true,
                    },
                    {
                        name: "Additional Comments",
                        value: `\`${comments ?? "No Comments Provided"}\``,
                        inline: false,
                    },
                ])
                    .setImage(evidence?.url)
                    .setColor(Color("#ff5733").rgbNumber())
                    .setTimestamp();
                const recruitmentChannel = await interaction.guild?.channels.fetch(recruitmentChannelId);
                if (recruitmentChannel?.isTextBased())
                    recruitmentChannel
                        .send({ embeds: [recruitmentEmbed] })
                        .then(async (message) => {
                        await interaction.editReply({
                            embeds: [
                                new Discord.EmbedBuilder()
                                    .setTitle("Recruitment logs")
                                    .setDescription(`Your recruitment has been added to the logs. ${message.url}`)
                                    .setColor(Color("#ff5733").rgbNumber())
                                    .setTimestamp(),
                            ],
                        });
                    });
            }
        }
        else if (interaction.commandName === "blacklist") {
            if (!interaction.inGuild())
                return;
            await interaction.deferReply({ ephemeral: true });
            const user = interaction.options.getString("member");
            const reason = interaction.options.getString("reason");
            const deleteButton = new Discord.ButtonBuilder()
                .setCustomId("delete")
                .setLabel("Delete")
                .setStyle(Discord.ButtonStyle.Danger)
                .setEmoji({ name: "🕳" });
            const blacklistComponents = new Discord.ActionRowBuilder().addComponents(deleteButton);
            const blacklistEmbed = new Discord.EmbedBuilder()
                .setTitle("Blacklist Logs")
                .setDescription(`\`${user}\` is blacklisted in The Lost Battalion.`)
                .setFields([
                {
                    name: "Blacklister",
                    value: `<@${interaction.user.id}>`,
                    inline: true,
                },
                { name: "Blacklisted", value: `\`${user}\``, inline: true },
                { name: "Reason", value: `${reason}`, inline: false },
            ])
                .setColor(Color("#000000").rgbNumber())
                .setTimestamp();
            const blacklistChannel = await interaction.guild?.channels.fetch(blacklistChannelId);
            if (blacklistChannel?.isTextBased())
                blacklistChannel
                    .send({ embeds: [blacklistEmbed], components: [blacklistComponents] })
                    .then(async (message) => {
                    await interaction.editReply({
                        embeds: [
                            new Discord.EmbedBuilder()
                                .setTitle("Blacklist Logs")
                                .setDescription(`Member has been blacklisted and added to the logs. ${message.url}`)
                                .setColor(Color("#ff5733").rgbNumber())
                                .setTimestamp(),
                        ],
                    });
                });
        }
    }
});
client.login(process.env.BOT_TOKEN);
fs.ensureFileSync("crash.log");
process
    .on("unhandledRejection", (reason) => {
    console.log(reason);
})
    .on("uncaughtException", (err) => {
    console.log(err);
});
