import type { Logger } from "../../core/logger.js";
import { AppError, ValidationError, toAppError } from "../../core/errors.js";
import type { Actor, PermissionService } from "../../services/permission.service.js";
import type { SearchService } from "../../services/search.service.js";
import type { StatisticsService } from "../../services/statistics.service.js";
import type { ChannelRepository } from "../../infrastructure/repositories/channel.repository.js";
import type { AdminRepository } from "../../infrastructure/repositories/admin.repository.js";
import type { FileRepository } from "../../infrastructure/repositories/file.repository.js";
import type { HashtagRepository } from "../../infrastructure/repositories/hashtag.repository.js";
import type { ArchiveRepository } from "../../infrastructure/repositories/archive.repository.js";
import type { ActivityLogRepository } from "../../infrastructure/repositories/activity-log.repository.js";
import type { SettingsRepository } from "../../infrastructure/repositories/settings.repository.js";
import type { ViewRepository } from "../../infrastructure/repositories/view.repository.js";
import type { UserRepository } from "../../infrastructure/repositories/user.repository.js";
import type {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  TelegramCallbackQuery,
  TelegramClient,
  TelegramMessage,
} from "../client.js";
import type { ScientificFile } from "../../domain/models.js";
import { RefStore, SessionStore } from "./session.js";
import {
  buildBackToMenuKeyboard,
  keyboardForPanel,
  panelFor,
  type Panel,
} from "./keyboards.js";

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  doc: "Word",
  docx: "Word",
  ppt: "PowerPoint",
  pptx: "PowerPoint",
  xls: "Excel",
  xlsx: "Excel",
  zip: "أرشيف",
  rar: "أرشيف",
  image: "صورة",
  video: "فيديو",
  audio: "صوت",
  link: "رابط",
  text: "نص",
  other: "أخرى",
};

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fileLabel(file: ScientificFile): string {
  const raw = file.title ?? file.fileName ?? file.caption ?? "بدون عنوان";
  const clean = raw.replace(/\s+/g, " ").trim();
  const short = clean.length > 38 ? `${clean.slice(0, 37)}…` : clean;
  return `${TYPE_LABELS[file.contentType] ?? file.contentType} • ${short}`;
}

export interface MenuDeps {
  telegram: TelegramClient;
  permissions: PermissionService;
  search: SearchService;
  statistics: StatisticsService;
  channels: ChannelRepository;
  admins: AdminRepository;
  files: FileRepository;
  hashtags: HashtagRepository;
  archive: ArchiveRepository;
  activity: ActivityLogRepository;
  settings: SettingsRepository;
  views: ViewRepository;
  users: UserRepository;
  sessions: SessionStore;
  refs: RefStore;
  logger: Logger;
}

/** Button-driven interface for students, admins and the owner. */
export class MenuController {
  constructor(private readonly deps: MenuDeps) {}

  // ---------------------------------------------------------------- entry points

  async showMenu(chatId: number | string, actor: Actor, messageId?: number): Promise<void> {
    const panel = panelFor(actor);
    const title =
      panel === "owner"
        ? "👑 <b>لوحة المالك</b>"
        : panel === "admin"
          ? "🛡 <b>لوحة المشرف</b>"
          : "🎓 <b>لوحة الطالب</b>";
    await this.render(chatId, messageId, `${title}\n\nاختر ما تريد:`, keyboardForPanel(panel));
  }

  async handleCallback(query: TelegramCallbackQuery, actor: Actor): Promise<void> {
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    const data = query.data ?? "";
    if (chatId === undefined) {
      await this.deps.telegram.answerCallbackQuery(query.id);
      return;
    }

    try {
      await this.route(data, chatId, messageId, actor);
      await this.deps.telegram.answerCallbackQuery(query.id);
    } catch (error) {
      const appError = toAppError(error);
      this.deps.logger.error("Callback failed", { data, error: appError.message });
      await this.deps.telegram
        .answerCallbackQuery(
          query.id,
          appError instanceof AppError ? appError.userMessage : "حدث خطأ غير متوقع.",
          true,
        )
        .catch(() => undefined);
    }
  }

  /** Consumes a pending conversational step. Returns true when the message was handled. */
  async handlePendingMessage(message: TelegramMessage, actor: Actor): Promise<boolean> {
    const userId = String(message.from?.id ?? "");
    if (!userId) return false;
    const pending = this.deps.sessions.take(userId);
    if (!pending) return false;

    const chatId = message.chat.id;
    const text = (message.text ?? message.caption ?? "").trim();

    try {
      if (pending === "search") {
        await this.runSearch(chatId, undefined, actor, text);
        return true;
      }
      if (pending === "add_channel") {
        await this.registerChannelFromMessage(chatId, actor, message, text);
        return true;
      }
      if (pending === "add_admin") {
        await this.addAdminFromText(chatId, actor, text);
        return true;
      }
      if (pending.startsWith("upload:")) {
        await this.uploadToChannel(chatId, actor, message, Number(pending.slice(7)));
        return true;
      }
      if (pending.startsWith("setting:")) {
        await this.saveSetting(chatId, actor, pending.slice(8), text);
        return true;
      }
    } catch (error) {
      const appError = toAppError(error);
      await this.deps.telegram.sendMessage(
        chatId,
        appError instanceof AppError ? appError.userMessage : "حدث خطأ غير متوقع.",
        { reply_markup: buildBackToMenuKeyboard(panelFor(actor)) },
      );
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- routing

  private async route(
    data: string,
    chatId: number,
    messageId: number | undefined,
    actor: Actor,
  ): Promise<void> {
    const panel = panelFor(actor);
    const [scope = "", action = "", arg = ""] = data.split(":");

    if (scope === "menu" || scope === "switch") {
      const target = (action || panel) as Panel;
      if ((target === "owner" && panel !== "owner") || (target === "admin" && panel === "student")) {
        throw new AppError("FORBIDDEN", "غير مصرح لك بهذه اللوحة.");
      }
      await this.render(
        chatId,
        messageId,
        target === "owner"
          ? "👑 <b>لوحة المالك</b>\n\nاختر ما تريد:"
          : target === "admin"
            ? "🛡 <b>لوحة المشرف</b>\n\nاختر ما تريد:"
            : "🎓 <b>لوحة الطالب</b>\n\nاختر ما تريد:",
        keyboardForPanel(target),
      );
      return;
    }

    switch (`${scope}:${action}`) {
      // ---------- student
      case "student:library":
      case "student:latest":
        await this.showLatest(chatId, messageId, actor);
        return;
      case "student:top":
        await this.showTopViewed(chatId, messageId, actor);
        return;
      case "student:browse":
        await this.showBrowse(chatId, messageId, actor);
        return;
      case "student:colleges":
        await this.showFacet(chatId, messageId, actor, "category");
        return;
      case "student:subjects":
        await this.showFacet(chatId, messageId, actor, "subject");
        return;
      case "student:search":
      case "admin:search":
        this.deps.sessions.set(actor.telegramUserId, "search");
        await this.render(
          chatId,
          messageId,
          [
            "🔍 <b>البحث الذكي</b>",
            "",
            "أرسل الآن كلمة البحث. يمكنك دمج المرشحات:",
            "<code>فيزياء type:pdf</code>",
            "<code>كلية:الهندسة مادة:رياضيات</code>",
            "<code>#محاضرات from:2024-01-01</code>",
            "",
            "المرشحات المدعومة: type, subject/مادة, college/كلية, level/مستوى, tag/وسم, from, to",
          ].join("\n"),
          buildBackToMenuKeyboard(panel),
        );
        return;
      case "student:help":
        await this.showHelp(chatId, messageId, actor);
        return;

      // ---------- shared / admin
      case "admin:stats":
      case "owner:stats":
        await this.showStats(chatId, messageId, actor);
        return;
      case "admin:reports":
      case "owner:reports":
        await this.showReports(chatId, messageId, actor);
        return;
      case "admin:channels":
      case "owner:channels":
        await this.showChannels(chatId, messageId, actor);
        return;
      case "admin:add_channel":
        this.deps.permissions.assert(actor, "channel:manage");
        this.deps.sessions.set(actor.telegramUserId, "add_channel");
        await this.render(
          chatId,
          messageId,
          [
            "➕ <b>إضافة قناة</b>",
            "",
            "لا حاجة لمعرفة أي معرّفات. أرسل أحد التالي:",
            "• رابط القناة مثل <code>https://t.me/mychannel</code>",
            "• أو المعرّف <code>@mychannel</code>",
            "• أو حوّل (Forward) أي رسالة من القناة إلى هنا",
            "",
            "سأستخرج المعرّف والعنوان تلقائياً.",
          ].join("\n"),
          buildBackToMenuKeyboard(panel),
        );
        return;
      case "admin:upload":
        await this.showUploadTargets(chatId, messageId, actor);
        return;
      case "admin:files":
        await this.showAdminFiles(chatId, messageId, actor);
        return;
      case "admin:settings":
      case "owner:settings":
        await this.showSettings(chatId, messageId, actor);
        return;

      // ---------- owner
      case "owner:admins":
        await this.showAdmins(chatId, messageId, actor);
        return;
      case "owner:colleges":
        await this.showFacet(chatId, messageId, actor, "category");
        return;
      case "owner:archive":
        await this.showArchive(chatId, messageId, actor);
        return;
      case "owner:backup":
        await this.showBackup(chatId, messageId, actor);
        return;
      default:
        break;
    }

    // ---------- parametric actions
    switch (scope) {
      case "file":
        await this.showFile(chatId, messageId, actor, Number(action));
        return;
      case "get":
        await this.sendFile(chatId, actor, Number(action));
        return;
      case "pick": {
        const value = this.deps.refs.get(arg);
        if (!value) throw new ValidationError("انتهت صلاحية هذا الاختيار، افتح القائمة من جديد.");
        await this.showFacetResults(chatId, messageId, actor, action === "sub" ? "subject" : "category", value);
        return;
      }
      case "chan":
        await this.showChannel(chatId, messageId, actor, Number(action));
        return;
      case "chst":
        await this.setChannelStatus(chatId, messageId, actor, Number(action), arg);
        return;
      case "upl":
        this.deps.permissions.assert(actor, "file:manage");
        await this.deps.permissions.assertChannelAccess(actor, Number(action));
        this.deps.sessions.set(actor.telegramUserId, `upload:${Number(action)}`);
        await this.render(
          chatId,
          messageId,
          "📤 أرسل الآن الملف أو الصورة أو النص المراد نشره في القناة المختارة.",
          buildBackToMenuKeyboard(panel),
        );
        return;
      case "addadm":
        this.deps.permissions.assert(actor, "admin:manage");
        this.deps.sessions.set(actor.telegramUserId, "add_admin");
        await this.render(
          chatId,
          messageId,
          [
            "👥 <b>إضافة مشرف</b>",
            "",
            "أرسل معرّف المستخدم الرقمي، ويمكن إضافة الدور بعده:",
            "<code>123456789 admin</code>",
            "الأدوار: admin | moderator | viewer",
          ].join("\n"),
          buildBackToMenuKeyboard(panel),
        );
        return;
      case "setkey": {
        this.deps.permissions.assert(actor, "settings:manage");
        const key = this.deps.refs.get(action);
        if (!key) throw new ValidationError("انتهت صلاحية هذا الاختيار.");
        this.deps.sessions.set(actor.telegramUserId, `setting:${key}`);
        await this.render(chatId, messageId, `أرسل القيمة الجديدة للإعداد <code>${escapeHtml(key)}</code>.`, buildBackToMenuKeyboard(panel));
        return;
      }
      default:
        await this.showMenu(chatId, actor, messageId);
    }
  }

  // ---------------------------------------------------------------- views

  private async showLatest(chatId: number, messageId: number | undefined, actor: Actor): Promise<void> {
    const files = await this.deps.files.latest(10);
    await this.renderFileList(chatId, messageId, actor, "⭐ <b>أحدث الملفات</b>", files);
  }

  private async showTopViewed(chatId: number, messageId: number | undefined, actor: Actor): Promise<void> {
    const top = await this.deps.views.topFileIds(10);
    const files = await this.deps.files.findByIds(top.map((t) => t.fileId));
    const ordered = top
      .map((t) => files.find((f) => f.id === t.fileId))
      .filter((f): f is ScientificFile => Boolean(f));
    await this.renderFileList(
      chatId,
      messageId,
      actor,
      ordered.length ? "📈 <b>الأكثر مشاهدة</b>" : "📈 <b>الأكثر مشاهدة</b>\n\nلا توجد مشاهدات بعد.",
      ordered,
    );
  }

  private async showBrowse(chatId: number, messageId: number | undefined, actor: Actor): Promise<void> {
    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: "🏫 حسب الكلية", callback_data: "student:colleges" },
          { text: "📖 حسب المادة", callback_data: "student:subjects" },
        ],
        [
          { text: "⭐ الأحدث", callback_data: "student:latest" },
          { text: "📈 الأكثر مشاهدة", callback_data: "student:top" },
        ],
        [{ text: "🏠 القائمة الرئيسية", callback_data: `menu:${panelFor(actor)}` }],
      ],
    };
    await this.render(chatId, messageId, "📂 <b>تصفح المحتويات</b>", keyboard);
  }

  private async showFacet(
    chatId: number,
    messageId: number | undefined,
    actor: Actor,
    field: "subject" | "category",
  ): Promise<void> {
    const values = await this.deps.files.distinctValues(field, 24);
    const title = field === "category" ? "🏫 <b>الكليات</b>" : "📖 <b>المواد</b>";
    if (!values.length) {
      await this.render(chatId, messageId, `${title}\n\nلا توجد بيانات بعد.`, buildBackToMenuKeyboard(panelFor(actor)));
      return;
    }
    const rows: InlineKeyboardButton[][] = values.map((v) => [
      {
        text: `${v.value} (${v.total})`.slice(0, 60),
        callback_data: `pick:${field === "subject" ? "sub" : "cat"}:${this.deps.refs.put(v.value)}`,
      },
    ]);
    rows.push([{ text: "🏠 القائمة الرئيسية", callback_data: `menu:${panelFor(actor)}` }]);
    await this.render(chatId, messageId, title, { inline_keyboard: rows });
  }

  private async showFacetResults(
    chatId: number,
    messageId: number | undefined,
    actor: Actor,
    field: "subject" | "category",
    value: string,
  ): Promise<void> {
    const files = await this.deps.search.search(
      field === "subject" ? { subject: value, limit: 10 } : { category: value, limit: 10 },
    );
    await this.renderFileList(chatId, messageId, actor, `📂 <b>${escapeHtml(value)}</b>`, files);
  }

  private async runSearch(
    chatId: number,
    messageId: number | undefined,
    actor: Actor,
    rawQuery: string,
  ): Promise<void> {
    this.deps.permissions.assert(actor, "file:read");
    const criteria = this.deps.search.parseQuery(rawQuery);
    const results = await this.deps.search.search(criteria);
    await this.renderFileList(
      chatId,
      messageId,
      actor,
      results.length
        ? `🔍 <b>نتائج البحث</b> (${results.length})`
        : "🔍 لا توجد نتائج مطابقة. جرّب كلمة أخرى.",
      results,
    );
    await this.deps.activity
      .record({ actorTelegramId: actor.telegramUserId, action: "search", entityType: "search" })
      .catch(() => undefined);
  }

  private async showFile(
    chatId: number,
    messageId: number | undefined,
    actor: Actor,
    fileId: number,
  ): Promise<void> {
    if (!Number.isSafeInteger(fileId)) throw new ValidationError("ملف غير صالح.");
    const file = await this.deps.files.findById(fileId);
    if (!file) throw new ValidationError("الملف غير موجود.");
    const [tags, views, channel] = await Promise.all([
      this.deps.hashtags.forFile(file.id),
      this.deps.views.countForFile(file.id),
      this.deps.channels.findById(file.channelId),
    ]);

    const lines = [
      `📄 <b>${escapeHtml(file.title ?? file.fileName ?? "بدون عنوان")}</b>`,
      "",
      `النوع: ${TYPE_LABELS[file.contentType] ?? file.contentType}`,
      file.subject ? `المادة: ${escapeHtml(file.subject)}` : null,
      file.category ? `الكلية: ${escapeHtml(file.category)}` : null,
      channel ? `المصدر: ${escapeHtml(channel.title)}` : null,
      file.fileSize ? `الحجم: ${(file.fileSize / 1024 / 1024).toFixed(2)} MB` : null,
      `التاريخ: ${file.publishedAt.toISOString().slice(0, 10)}`,
      `المشاهدات: ${views}`,
      tags.length ? `الوسوم: ${tags.map((t) => `#${escapeHtml(t)}`).join(" ")}` : null,
      file.linkUrl ? `الرابط: ${escapeHtml(file.linkUrl)}` : null,
    ].filter((l): l is string => l !== null);

    await this.render(chatId, messageId, lines.join("\n"), {
      inline_keyboard: [
        [{ text: "⬇️ استلام الملف", callback_data: `get:${file.id}` }],
        [{ text: "🏠 القائمة الرئيسية", callback_data: `menu:${panelFor(actor)}` }],
      ],
    });
  }

  private async sendFile(chatId: number, actor: Actor, fileId: number): Promise<void> {
    const file = await this.deps.files.findById(fileId);
    if (!file) throw new ValidationError("الملف غير موجود.");
    const channel = await this.deps.channels.findById(file.channelId);
    if (!channel) throw new ValidationError("قناة المصدر غير متاحة.");

    await this.deps.telegram.copyMessage(chatId, channel.telegramChannelId, file.messageId);
    await this.deps.views.record(file.id, actor.telegramUserId).catch(() => undefined);
    await this.deps.activity
      .record({
        actorTelegramId: actor.telegramUserId,
        action: "file.viewed",
        entityType: "file",
        entityId: String(file.id),
      })
      .catch(() => undefined);
  }

  private async showHelp(chatId: number, messageId: number | undefined, actor: Actor): Promise<void> {
    await this.render(
      chatId,
      messageId,
      [
        "ℹ️ <b>المساعدة</b>",
        "",
        "• كل شيء يعمل بالأزرار — لا حاجة لحفظ أوامر.",
        "• 🔍 البحث يدعم: النوع، المادة، الكلية، المستوى، الوسوم والتاريخ.",
        "• 📚 المكتبة تعرض أحدث الملفات المؤرشفة.",
        "• ⬇️ زر «استلام الملف» يرسل لك الملف مباشرة.",
        "",
        "للأوامر النصية أرسل /help.",
      ].join("\n"),
      buildBackToMenuKeyboard(panelFor(actor)),
    );
  }

  private async showStats(chatId: number, messageId: number | undefined, actor: Actor): Promise<void> {
    this.deps.permissions.assert(actor, "stats:read");
    const s = await this.deps.statistics.overview();
    const lines = [
      "📊 <b>إحصائيات المنصة</b>",
      "",
      `📂 القنوات: ${s.channels}`,
      `📄 الملفات: ${s.files}`,
      `👥 المستخدمون: ${s.users} (نشط هذا الأسبوع: ${s.activeUsers})`,
      `🛡 المشرفون: ${s.admins}`,
      `👁 المشاهدات: ${s.views}`,
      "",
      `🗓 اليوم: ${s.today} | الأسبوع: ${s.week} | الشهر: ${s.month}`,
      "",
      "🏫 <b>أكثر الكليات نشاطاً</b>",
      ...(s.topColleges.length ? s.topColleges.map((c) => `• ${escapeHtml(c.value)}: ${c.total}`) : ["• لا توجد بيانات"]),
      "",
      "📖 <b>أكثر المواد نشاطاً</b>",
      ...(s.topSubjects.length ? s.topSubjects.map((c) => `• ${escapeHtml(c.value)}: ${c.total}`) : ["• لا توجد بيانات"]),
      "",
      "🏷 <b>أكثر الوسوم استخداماً</b>",
      ...(s.topHashtags.length ? s.topHashtags.map((t) => `• #${escapeHtml(t.tag)}: ${t.usageCount}`) : ["• لا توجد بيانات"]),
      "",
      "📁 <b>حسب النوع</b>",
      ...s.byType.map((t) => `• ${TYPE_LABELS[t.contentType] ?? t.contentType}: ${t.total}`),
      "",
      `🗄 الأرشفة — ناجحة: ${s.archive.archived} | معلّقة: ${s.archive.pending} | فاشلة: ${s.archive.failed}`,
    ];
    await this.render(chatId, messageId, lines.join("\n"), buildBackToMenuKeyboard(panelFor(actor)));
  }

  private async showReports(chatId: number, messageId: number | undefined, actor: Actor): Promise<void> {
    this.deps.permissions.assert(actor, "reports:read");
    const [byChannel, channels, logs] = await Promise.all([
      this.deps.files.countByChannel(),
      this.deps.channels.list(100),
      this.deps.activity.recent(10),
    ]);
    const lines = [
      "📑 <b>تقرير النظام</b>",
      "",
      "<b>الملفات لكل قناة</b>",
      ...(byChannel.length
        ? byChannel.slice(0, 15).map((c) => {
            const channel = channels.find((ch) => ch.id === c.channelId);
            return `• ${escapeHtml(channel?.title ?? `#${c.channelId}`)}: ${c.total}`;
          })
        : ["• لا توجد بيانات"]),
      "",
      "<b>آخر الأنشطة</b>",
      ...(logs.length
        ? logs.map((l) => `• ${l.createdAt.toISOString().slice(0, 16).replace("T", " ")} — ${escapeHtml(l.action)}`)
        : ["• لا توجد أنشطة"]),
    ];
    await this.render(chatId, messageId, lines.join("\n"), buildBackToMenuKeyboard(panelFor(actor)));
  }

  private async showChannels(chatId: number, messageId: number | undefined, actor: Actor): Promise<void> {
    this.deps.permissions.assert(actor, "file:read");
    const list = actor.isOwner
      ? await this.deps.channels.list(50)
      : await this.deps.channels.listForAdmin(actor.adminId ?? -1);
    if (!list.length) {
      await this.render(
        chatId,
        messageId,
        "📂 لا توجد قنوات مسجلة بعد. استخدم «➕ إضافة قناة».",
        buildBackToMenuKeyboard(panelFor(actor)),
      );
      return;
    }
    const rows: InlineKeyboardButton[][] = list.map((c) => [
      {
        text: `${c.status === "active" ? "🟢" : c.status === "paused" ? "🟡" : "🔴"} ${c.title}`.slice(0, 60),
        callback_data: `chan:${c.id}`,
      },
    ]);
    rows.push([{ text: "🏠 القائمة الرئيسية", callback_data: `menu:${panelFor(actor)}` }]);
    await this.render(chatId, messageId, "📂 <b>القنوات</b>", { inline_keyboard: rows });
  }

  private async showChannel(
    chatId: number,
    messageId: number | undefined,
    actor: Actor,
    channelId: number,
  ): Promise<void> {
    this.deps.permissions.assert(actor, "file:read");
    const channel = await this.deps.channels.findById(channelId);
    if (!channel) throw new ValidationError("القناة غير موجودة.");
    if (!actor.isOwner) await this.deps.permissions.assertChannelAccess(actor, channelId);

    const files = await this.deps.search.search({ channelId, limit: 1 });
    const text = [
      `📂 <b>${escapeHtml(channel.title)}</b>`,
      "",
      `الحالة: ${channel.status}`,
      channel.username ? `المعرّف: @${escapeHtml(channel.username)}` : null,
      `الأرشيف: ${channel.archiveChannelId ? escapeHtml(channel.archiveChannelId) : "غير محدد"}`,
      `أحدث ملف: ${files[0] ? files[0].publishedAt.toISOString().slice(0, 10) : "لا يوجد"}`,
    ]
      .filter((l): l is string => l !== null)
      .join("\n");

    const rows: InlineKeyboardButton[][] = [];
    if (this.deps.permissions.can(actor, "channel:manage")) {
      rows.push([
        { text: "🟢 تفعيل", callback_data: `chst:${channel.id}:active` },
        { text: "🟡 إيقاف مؤقت", callback_data: `chst:${channel.id}:paused` },
        { text: "🔴 تعطيل", callback_data: `chst:${channel.id}:disabled` },
      ]);
    }
    if (this.deps.permissions.can(actor, "file:manage")) {
      rows.push([{ text: "📤 رفع محتوى لهذه القناة", callback_data: `upl:${channel.id}` }]);
    }
    rows.push([
      { text: "◀️ القنوات", callback_data: `${actor.isOwner ? "owner" : "admin"}:channels` },
      { text: "🏠 الرئيسية", callback_data: `menu:${panelFor(actor)}` },
    ]);

    await this.render(chatId, messageId, text, { inline_keyboard: rows });
  }

  private async setChannelStatus(
    chatId: number,
    messageId: number | undefined,
    actor: Actor,
    channelId: number,
    status: string,
  ): Promise<void> {
    this.deps.permissions.assert(actor, "channel:manage");
    if (!["active", "paused", "disabled"].includes(status)) {
      throw new ValidationError("حالة غير صالحة.");
    }
    await this.deps.permissions.assertChannelAccess(actor, channelId);
    await this.deps.channels.setStatus(channelId, status as "active" | "paused" | "disabled");
    await this.deps.activity
      .record({
        actorTelegramId: actor.telegramUserId,
        action: "channel.status",
        entityType: "channel",
        entityId: String(channelId),
        details: { status },
      })
      .catch(() => undefined);
    await this.showChannel(chatId, messageId, actor, channelId);
  }

  private async showUploadTargets(
    chatId: number,
    messageId: number | undefined,
    actor: Actor,
  ): Promise<void> {
    this.deps.permissions.assert(actor, "file:manage");
    const list = actor.isOwner
      ? await this.deps.channels.list(50)
      : await this.deps.channels.listForAdmin(actor.adminId ?? -1);
    if (!list.length) {
      await this.render(
        chatId,
        messageId,
        "📤 لا توجد قنوات متاحة للرفع. أضف قناة أولاً.",
        buildBackToMenuKeyboard(panelFor(actor)),
      );
      return;
    }
    const rows: InlineKeyboardButton[][] = list.map((c) => [
      { text: `📤 ${c.title}`.slice(0, 60), callback_data: `upl:${c.id}` },
    ]);
    rows.push([{ text: "🏠 القائمة الرئيسية", callback_data: `menu:${panelFor(actor)}` }]);
    await this.render(chatId, messageId, "📤 <b>اختر القناة الهدف</b>", { inline_keyboard: rows });
  }

  private async showAdminFiles(
    chatId: number,
    messageId: number | undefined,
    actor: Actor,
  ): Promise<void> {
    this.deps.permissions.assert(actor, "file:read");
    const channels = actor.isOwner
      ? await this.deps.channels.list(50)
      : await this.deps.channels.listForAdmin(actor.adminId ?? -1);
    const files = await this.deps.files.latest(10, actor.isOwner ? undefined : channels.map((c) => c.id));
    await this.renderFileList(chatId, messageId, actor, "📁 <b>الملفات المرفوعة</b>", files);
  }

  private async showSettings(
    chatId: number,
    messageId: number | undefined,
    actor: Actor,
  ): Promise<void> {
    this.deps.permissions.assert(actor, "settings:manage");
    const all = await this.deps.settings.all();
    const entries = Object.entries(all);
    const rows: InlineKeyboardButton[][] = entries
      .slice(0, 20)
      .map(([k, v]) => [{ text: `⚙️ ${k} = ${v}`.slice(0, 60), callback_data: `setkey:${this.deps.refs.put(k)}` }]);
    rows.push([{ text: "🏠 القائمة الرئيسية", callback_data: `menu:${panelFor(actor)}` }]);
    await this.render(
      chatId,
      messageId,
      entries.length
        ? "⚙️ <b>الإعدادات</b>\n\nاضغط على أي إعداد لتعديله."
        : "⚙️ لا توجد إعدادات مخزنة.\nاستخدم <code>/settings key value</code> لإضافة إعداد.",
      { inline_keyboard: rows },
    );
  }

  private async showAdmins(chatId: number, messageId: number | undefined, actor: Actor): Promise<void> {
    this.deps.permissions.assert(actor, "admin:manage");
    const list = await this.deps.admins.list();
    const text = [
      "👥 <b>المشرفون</b>",
      "",
      ...(list.length
        ? list.map((a) => `• <code>${a.telegramUserId}</code> — ${a.role}${a.isActive ? "" : " (معطّل)"}`)
        : ["لا يوجد مشرفون بعد."]),
    ].join("\n");
    await this.render(chatId, messageId, text, {
      inline_keyboard: [
        [{ text: "➕ إضافة مشرف", callback_data: "addadm:new" }],
        [{ text: "🏠 القائمة الرئيسية", callback_data: `menu:${panelFor(actor)}` }],
      ],
    });
  }

  private async showArchive(chatId: number, messageId: number | undefined, actor: Actor): Promise<void> {
    this.deps.permissions.assert(actor, "stats:read");
    const stats = await this.deps.archive.stats();
    await this.render(
      chatId,
      messageId,
      [
        "🗄 <b>الأرشيف</b>",
        "",
        `✅ مؤرشف: ${stats.archived}`,
        `⏳ معلّق: ${stats.pending}`,
        `❌ فاشل: ${stats.failed}`,
        "",
        stats.pending > 0
          ? "بعض العناصر معلّقة لعدم تحديد قناة أرشيف. حدّدها من إدارة القنوات."
          : "كل العناصر مؤرشفة بنجاح.",
      ].join("\n"),
      buildBackToMenuKeyboard(panelFor(actor)),
    );
  }

  private async showBackup(chatId: number, messageId: number | undefined, actor: Actor): Promise<void> {
    this.deps.permissions.assert(actor, "settings:manage");
    const s = await this.deps.statistics.overview();
    const snapshot = {
      generatedAt: new Date().toISOString(),
      channels: s.channels,
      files: s.files,
      users: s.users,
      admins: s.admins,
      views: s.views,
      archive: s.archive,
    };
    await this.render(
      chatId,
      messageId,
      [
        "💾 <b>النسخ الاحتياطي</b>",
        "",
        "قاعدة البيانات مستضافة خارجياً (PostgreSQL) وتُنسخ من مزوّدها.",
        "لقطة الحالة الحالية:",
        `<pre>${escapeHtml(JSON.stringify(snapshot, null, 2))}</pre>`,
      ].join("\n"),
      buildBackToMenuKeyboard(panelFor(actor)),
    );
  }

  // ---------------------------------------------------------------- conversational steps

  private async registerChannelFromMessage(
    chatId: number,
    actor: Actor,
    message: TelegramMessage,
    text: string,
  ): Promise<void> {
    this.deps.permissions.assert(actor, "channel:manage");
    const forwarded = message.forward_from_chat ?? message.sender_chat;
    let reference: string | number | null = null;

    if (forwarded && forwarded.type === "channel") {
      reference = forwarded.id;
    } else if (text) {
      const linkMatch = text.match(/(?:t\.me\/|telegram\.me\/)(?:s\/)?([A-Za-z0-9_]{4,})/);
      if (linkMatch?.[1]) reference = `@${linkMatch[1]}`;
      else if (/^@[A-Za-z0-9_]{4,}$/.test(text)) reference = text;
      else if (/^-?\d{5,20}$/.test(text)) reference = text;
    }

    if (reference === null) {
      throw new ValidationError("أرسل رابط القناة أو @معرّفها أو حوّل رسالة منها.");
    }

    const chat = await this.deps.telegram.getChat(reference).catch(() => null);
    if (!chat) {
      throw new ValidationError("تعذر الوصول للقناة. تأكد من إضافة البوت كمشرف فيها ثم أعد المحاولة.");
    }

    const channel = await this.deps.channels.create({
      telegramChannelId: String(chat.id),
      title: chat.title ?? chat.username ?? String(chat.id),
      username: chat.username ?? null,
    });
    if (!actor.isOwner && actor.adminId !== null) {
      await this.deps.admins.assignChannel(actor.adminId, channel.id);
    }
    await this.deps.activity
      .record({
        actorTelegramId: actor.telegramUserId,
        action: "channel.registered",
        entityType: "channel",
        entityId: String(channel.id),
      })
      .catch(() => undefined);

    await this.deps.telegram.sendMessage(
      chatId,
      `✅ تم تسجيل القناة <b>${escapeHtml(channel.title)}</b> تلقائياً.`,
      { reply_markup: buildBackToMenuKeyboard(panelFor(actor)) },
    );
  }

  private async addAdminFromText(chatId: number, actor: Actor, text: string): Promise<void> {
    this.deps.permissions.assert(actor, "admin:manage");
    const [userId, role = "admin"] = text.split(/\s+/);
    if (!userId || !/^\d{5,20}$/.test(userId)) {
      throw new ValidationError("أرسل معرّفاً رقمياً صحيحاً، مثال: 123456789 admin");
    }
    if (!["admin", "moderator", "viewer"].includes(role)) {
      throw new ValidationError("الأدوار المتاحة: admin | moderator | viewer");
    }
    await this.deps.admins.upsert({
      telegramUserId: userId,
      role: role as "admin" | "moderator" | "viewer",
    });
    await this.deps.telegram.sendMessage(chatId, `✅ تمت إضافة المشرف <code>${userId}</code> بدور <b>${role}</b>.`, {
      reply_markup: buildBackToMenuKeyboard(panelFor(actor)),
    });
  }

  private async uploadToChannel(
    chatId: number,
    actor: Actor,
    message: TelegramMessage,
    channelId: number,
  ): Promise<void> {
    this.deps.permissions.assert(actor, "file:manage");
    if (!Number.isSafeInteger(channelId)) throw new ValidationError("قناة غير صالحة.");
    await this.deps.permissions.assertChannelAccess(actor, channelId);
    const channel = await this.deps.channels.findById(channelId);
    if (!channel) throw new ValidationError("القناة غير موجودة.");

    await this.deps.telegram.copyMessage(channel.telegramChannelId, chatId, message.message_id);
    await this.deps.activity
      .record({
        actorTelegramId: actor.telegramUserId,
        action: "file.uploaded",
        entityType: "channel",
        entityId: String(channelId),
      })
      .catch(() => undefined);
    await this.deps.telegram.sendMessage(
      chatId,
      `✅ تم النشر في <b>${escapeHtml(channel.title)}</b> وسيُؤرشف تلقائياً.`,
      { reply_markup: buildBackToMenuKeyboard(panelFor(actor)) },
    );
  }

  private async saveSetting(chatId: number, actor: Actor, key: string, value: string): Promise<void> {
    this.deps.permissions.assert(actor, "settings:manage");
    if (!value) throw new ValidationError("القيمة فارغة.");
    if (value.length > 500) throw new ValidationError("القيمة طويلة جداً.");
    await this.deps.settings.set(key, value);
    await this.deps.telegram.sendMessage(chatId, "✅ تم حفظ الإعداد.", {
      reply_markup: buildBackToMenuKeyboard(panelFor(actor)),
    });
  }

  // ---------------------------------------------------------------- helpers

  private async renderFileList(
    chatId: number,
    messageId: number | undefined,
    actor: Actor,
    title: string,
    files: ScientificFile[],
  ): Promise<void> {
    const rows: InlineKeyboardButton[][] = files
      .slice(0, 10)
      .map((f) => [{ text: fileLabel(f), callback_data: `file:${f.id}` }]);
    rows.push([{ text: "🏠 القائمة الرئيسية", callback_data: `menu:${panelFor(actor)}` }]);
    const text = files.length ? title : `${title}\n\nلا توجد عناصر لعرضها.`;
    await this.render(chatId, messageId, text, { inline_keyboard: rows });
  }

  private async render(
    chatId: number | string,
    messageId: number | undefined,
    text: string,
    keyboard: InlineKeyboardMarkup,
  ): Promise<void> {
    if (messageId !== undefined) {
      try {
        await this.deps.telegram.editMessageText(chatId, messageId, text, { reply_markup: keyboard });
        return;
      } catch (error) {
        this.deps.logger.debug("Edit failed, sending a new message", {
          error: toAppError(error).message,
        });
      }
    }
    await this.deps.telegram.sendMessage(chatId, text, { reply_markup: keyboard });
  }
}
