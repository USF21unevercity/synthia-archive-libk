import type { CommandDefinition } from "./types.js";
import type { PermissionService } from "../../services/permission.service.js";
import type { SearchService } from "../../services/search.service.js";
import type { StatisticsService } from "../../services/statistics.service.js";
import type { ChannelRepository } from "../../infrastructure/repositories/channel.repository.js";
import type { AdminRepository } from "../../infrastructure/repositories/admin.repository.js";
import type { ActivityLogRepository } from "../../infrastructure/repositories/activity-log.repository.js";
import type { SettingsRepository } from "../../infrastructure/repositories/settings.repository.js";
import type { HashtagRepository } from "../../infrastructure/repositories/hashtag.repository.js";
import { ValidationError } from "../../core/errors.js";

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  doc: "Word",
  docx: "Word",
  ppt: "PowerPoint",
  pptx: "PowerPoint",
  xls: "Excel",
  xlsx: "Excel",
  zip: "أرشيف مضغوط",
  rar: "أرشيف مضغوط",
  image: "صورة",
  video: "فيديو",
  audio: "صوت",
  link: "رابط",
  text: "نص",
  other: "أخرى",
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface CommandDeps {
  permissions: PermissionService;
  search: SearchService;
  statistics: StatisticsService;
  channels: ChannelRepository;
  admins: AdminRepository;
  activity: ActivityLogRepository;
  settings: SettingsRepository;
  hashtags: HashtagRepository;
}

export function buildCommands(deps: CommandDeps): CommandDefinition[] {
  const commands: CommandDefinition[] = [
    {
      name: "start",
      description: "بدء استخدام المنصة",
      handler: async ({ reply, actor }) => {
        await reply(
          [
            "<b>منصة الأرشفة العلمية</b>",
            "",
            `دورك الحالي: <b>${actor.role}</b>`,
            "",
            "أرسل /help لعرض جميع الأوامر المتاحة.",
          ].join("\n"),
        );
      },
    },
    {
      name: "help",
      description: "عرض الأوامر",
      handler: async ({ reply }) => {
        await reply(
          [
            "<b>الأوامر المتاحة</b>",
            "",
            "/addchannel &lt;channel_id&gt; | &lt;العنوان&gt; | [@username] — تسجيل قناة",
            "/channels — عرض القنوات المسجلة",
            "/setarchive &lt;channel_db_id&gt; &lt;archive_channel_id&gt; — تحديد قناة الأرشيف",
            "/channelstatus &lt;channel_db_id&gt; &lt;active|paused|disabled&gt; — تغيير الحالة",
            "/addadmin &lt;user_id&gt; [role] — إضافة مشرف",
            "/admins — عرض المشرفين",
            "/assign &lt;admin_id&gt; &lt;channel_db_id&gt; — إسناد قناة لمشرف",
            "/search &lt;نص&gt; [type:pdf] [tag:فيزياء] [from:2024-01-01] — بحث",
            "/stats — إحصائيات المنصة",
            "/tags — الوسوم الأكثر استخداماً",
            "/logs — آخر الأنشطة",
            "/settings — الإعدادات المخزنة",
          ].join("\n"),
        );
      },
    },
    {
      name: "addchannel",
      description: "تسجيل قناة جديدة",
      handler: async ({ reply, actor, args }) => {
        deps.permissions.assert(actor, "channel:manage");
        const [rawId, rawTitle, rawUsername] = args.split("|").map((p) => p.trim());
        if (!rawId || !rawTitle) {
          throw new ValidationError("الصيغة: /addchannel -1001234567890 | عنوان القناة | @username");
        }
        if (!/^-?\d{5,20}$/.test(rawId)) {
          throw new ValidationError("معرّف القناة يجب أن يكون رقمياً، مثال: -1001234567890");
        }
        if (rawTitle.length > 200) throw new ValidationError("العنوان طويل جداً.");

        const channel = await deps.channels.create({
          telegramChannelId: rawId,
          title: rawTitle,
          username: rawUsername ? rawUsername.replace(/^@/, "") : null,
        });
        await deps.activity.record({
          actorTelegramId: actor.telegramUserId,
          action: "channel.registered",
          entityType: "channel",
          entityId: String(channel.id),
        });
        await reply(`تم تسجيل القناة <b>${escapeHtml(channel.title)}</b> برقم داخلي <code>${channel.id}</code>.`);
      },
    },
    {
      name: "channels",
      description: "عرض القنوات",
      handler: async ({ reply, actor }) => {
        deps.permissions.assert(actor, "file:read");
        const list = actor.isOwner
          ? await deps.channels.list()
          : await deps.channels.listForAdmin(actor.adminId ?? -1);
        if (!list.length) {
          await reply("لا توجد قنوات مسجلة بعد.");
          return;
        }
        await reply(
          ["<b>القنوات</b>", ...list.map(
            (c) =>
              `#${c.id} — ${escapeHtml(c.title)} (<code>${c.telegramChannelId}</code>) — ${c.status}`,
          )].join("\n"),
        );
      },
    },
    {
      name: "setarchive",
      description: "تحديد قناة الأرشيف",
      handler: async ({ reply, actor, args }) => {
        deps.permissions.assert(actor, "channel:manage");
        const [idRaw, archiveRaw] = args.split(/\s+/);
        const channelId = Number.parseInt(idRaw ?? "", 10);
        if (!Number.isSafeInteger(channelId) || !archiveRaw || !/^-?\d{5,20}$/.test(archiveRaw)) {
          throw new ValidationError("الصيغة: /setarchive 3 -1009876543210");
        }
        await deps.permissions.assertChannelAccess(actor, channelId);
        await deps.channels.setArchiveChannel(channelId, archiveRaw);
        await reply("تم تحديث قناة الأرشيف.");
      },
    },
    {
      name: "channelstatus",
      description: "تغيير حالة القناة",
      handler: async ({ reply, actor, args }) => {
        deps.permissions.assert(actor, "channel:manage");
        const [idRaw, status] = args.split(/\s+/);
        const channelId = Number.parseInt(idRaw ?? "", 10);
        if (!Number.isSafeInteger(channelId) || !["active", "paused", "disabled"].includes(status ?? "")) {
          throw new ValidationError("الصيغة: /channelstatus 3 paused");
        }
        await deps.permissions.assertChannelAccess(actor, channelId);
        await deps.channels.setStatus(channelId, status as "active" | "paused" | "disabled");
        await reply("تم تحديث حالة القناة.");
      },
    },
    {
      name: "addadmin",
      description: "إضافة مشرف",
      handler: async ({ reply, actor, args }) => {
        deps.permissions.assert(actor, "admin:manage");
        const [userId, role = "admin"] = args.split(/\s+/);
        if (!userId || !/^\d{5,20}$/.test(userId)) {
          throw new ValidationError("الصيغة: /addadmin 123456789 admin");
        }
        if (!["admin", "moderator", "viewer"].includes(role)) {
          throw new ValidationError("الأدوار المتاحة: admin | moderator | viewer");
        }
        const admin = await deps.admins.upsert({
          telegramUserId: userId,
          role: role as "admin" | "moderator" | "viewer",
        });
        await deps.activity.record({
          actorTelegramId: actor.telegramUserId,
          action: "admin.added",
          entityType: "admin",
          entityId: String(admin.id),
          details: { role },
        });
        await reply(`تمت إضافة المشرف برقم داخلي <code>${admin.id}</code> بدور <b>${role}</b>.`);
      },
    },
    {
      name: "admins",
      description: "عرض المشرفين",
      handler: async ({ reply, actor }) => {
        deps.permissions.assert(actor, "admin:manage");
        const list = await deps.admins.list();
        await reply(
          ["<b>المشرفون</b>", ...list.map(
            (a) => `#${a.id} — <code>${a.telegramUserId}</code> — ${a.role}${a.isActive ? "" : " (معطّل)"}`,
          )].join("\n"),
        );
      },
    },
    {
      name: "assign",
      description: "إسناد قناة لمشرف",
      handler: async ({ reply, actor, args }) => {
        deps.permissions.assert(actor, "admin:manage");
        const [adminRaw, channelRaw] = args.split(/\s+/);
        const adminId = Number.parseInt(adminRaw ?? "", 10);
        const channelId = Number.parseInt(channelRaw ?? "", 10);
        if (!Number.isSafeInteger(adminId) || !Number.isSafeInteger(channelId)) {
          throw new ValidationError("الصيغة: /assign 2 3");
        }
        await deps.admins.assignChannel(adminId, channelId);
        await reply("تم إسناد القناة للمشرف.");
      },
    },
    {
      name: "search",
      description: "البحث في الأرشيف العلمي",
      handler: async ({ reply, actor, args }) => {
        deps.permissions.assert(actor, "file:read");
        const criteria = deps.search.parseQuery(args);
        if (!actor.isOwner && criteria.channelId) {
          await deps.permissions.assertChannelAccess(actor, criteria.channelId);
        }
        const results = await deps.search.search(criteria);
        if (!results.length) {
          await reply("لا توجد نتائج مطابقة.");
          return;
        }
        await reply(
          [
            `<b>النتائج (${results.length})</b>`,
            ...results.map(
              (f) =>
                `• [${TYPE_LABELS[f.contentType] ?? f.contentType}] ${escapeHtml(
                  f.title ?? f.fileName ?? "بدون عنوان",
                )} — ${f.publishedAt.toISOString().slice(0, 10)}`,
            ),
          ].join("\n"),
        );
      },
    },
    {
      name: "stats",
      description: "إحصائيات المنصة",
      handler: async ({ reply, actor }) => {
        deps.permissions.assert(actor, "stats:read");
        const s = await deps.statistics.overview();
        await reply(
          [
            "<b>إحصائيات المنصة</b>",
            `القنوات: ${s.channels}`,
            `الملفات: ${s.files}`,
            `اليوم: ${s.today} | الأسبوع: ${s.week} | الشهر: ${s.month}`,
            "",
            "<b>حسب النوع</b>",
            ...s.byType.map((t) => `${TYPE_LABELS[t.contentType] ?? t.contentType}: ${t.total}`),
            "",
            `الأرشفة — ناجحة: ${s.archive.archived} | فاشلة: ${s.archive.failed}`,
          ].join("\n"),
        );
      },
    },
    {
      name: "tags",
      description: "الوسوم الأكثر استخداماً",
      handler: async ({ reply, actor }) => {
        deps.permissions.assert(actor, "stats:read");
        const tags = await deps.hashtags.top(20);
        if (!tags.length) {
          await reply("لا توجد وسوم بعد.");
          return;
        }
        await reply(["<b>الوسوم</b>", ...tags.map((t) => `#${escapeHtml(t.tag)} — ${t.usageCount}`)].join("\n"));
      },
    },
    {
      name: "logs",
      description: "آخر الأنشطة",
      handler: async ({ reply, actor }) => {
        deps.permissions.assert(actor, "logs:read");
        const logs = await deps.activity.recent(15);
        if (!logs.length) {
          await reply("لا توجد أنشطة مسجلة.");
          return;
        }
        await reply(
          ["<b>سجل الأنشطة</b>", ...logs.map(
            (l) => `${l.createdAt.toISOString().slice(0, 16).replace("T", " ")} — ${l.action}`,
          )].join("\n"),
        );
      },
    },
    {
      name: "settings",
      description: "الإعدادات",
      handler: async ({ reply, actor, args }) => {
        deps.permissions.assert(actor, "settings:manage");
        const [key, ...valueParts] = args.split(/\s+/);
        if (!key) {
          const all = await deps.settings.all();
          const entries = Object.entries(all);
          await reply(
            entries.length
              ? ["<b>الإعدادات</b>", ...entries.map(([k, v]) => `${k} = ${escapeHtml(v)}`)].join("\n")
              : "لا توجد إعدادات مخزنة. لتعيين إعداد: /settings key value",
          );
          return;
        }
        const value = valueParts.join(" ");
        if (!value) throw new ValidationError("الصيغة: /settings key value");
        if (key.length > 100 || value.length > 500) throw new ValidationError("القيمة طويلة جداً.");
        await deps.settings.set(key, value);
        await reply("تم حفظ الإعداد.");
      },
    },
  ];

  return commands;
}
