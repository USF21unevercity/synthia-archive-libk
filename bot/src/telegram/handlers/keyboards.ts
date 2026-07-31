import type { TelegramClient, InlineKeyboardMarkup } from "../client.js";
import type { Actor } from "../../services/permission.service.js";

/** Telegram keyboard layouts per user role — no textual commands needed. */
export function buildStudentKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "📚 المكتبة الرقمية", callback_data: "student:library" },
        { text: "🔍 البحث", callback_data: "student:search" },
      ],
      [
        { text: "📂 تصفح المحتويات", callback_data: "student:browse" },
        { text: "🏫 اختيار الكلية", callback_data: "student:colleges" },
      ],
      [
        { text: "📖 اختيار المادة", callback_data: "student:subjects" },
        { text: "⭐ أحدث الملفات", callback_data: "student:latest" },
      ],
      [
        { text: "📈 الأكثر مشاهدة", callback_data: "student:top" },
        { text: "ℹ️ المساعدة", callback_data: "student:help" },
      ],
    ],
  };
}

export function buildAdminKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "📤 رفع محتوى", callback_data: "admin:upload" },
        { text: "➕ إضافة قناة", callback_data: "admin:add_channel" },
      ],
      [
        { text: "📂 إدارة القنوات", callback_data: "admin:channels" },
        { text: "📊 الإحصائيات", callback_data: "admin:stats" },
      ],
      [
        { text: "📑 التقارير", callback_data: "admin:reports" },
        { text: "🔍 البحث", callback_data: "admin:search" },
      ],
      [
        { text: "📁 الملفات المرفوعة", callback_data: "admin:files" },
        { text: "⚙️ الإعدادات", callback_data: "admin:settings" },
      ],
      [{ text: "🔀 التبديل للوحة الطالب 🎓", callback_data: "switch:student" }],
    ],
  };
}

export function buildOwnerKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "👥 إدارة المشرفين", callback_data: "owner:admins" },
        { text: "🏫 إدارة الكليات", callback_data: "owner:colleges" },
      ],
      [
        { text: "📂 إدارة جميع القنوات", callback_data: "owner:channels" },
        { text: "📊 إحصائيات النظام", callback_data: "owner:stats" },
      ],
      [
        { text: "📈 تقارير النظام", callback_data: "owner:reports" },
        { text: "🗄 الأرشيف", callback_data: "owner:archive" },
      ],
      [
        { text: "⚙️ إعدادات النظام", callback_data: "owner:settings" },
        { text: "💾 النسخ الاحتياطي", callback_data: "owner:backup" },
      ],
      [
        { text: "👑 المشرفون 🛡", callback_data: "switch:admin" },
        { text: "🎓 الطالب", callback_data: "switch:student" },
      ],
    ],
  };
}

export type Panel = "owner" | "admin" | "student";

export function panelFor(actor: Actor): Panel {
  if (actor.isOwner || actor.role === "owner") return "owner";
  if (actor.role === "admin" || actor.role === "moderator") return "admin";
  return "student";
}

export function keyboardForPanel(panel: Panel): InlineKeyboardMarkup {
  if (panel === "owner") return buildOwnerKeyboard();
  if (panel === "admin") return buildAdminKeyboard();
  return buildStudentKeyboard();
}

export function buildBackToMenuKeyboard(panel: Panel): InlineKeyboardMarkup {
  const prefix = panel;
  return {
    inline_keyboard: [[{ text: "🏠 العودة إلى القائمة الرئيسية", callback_data: `menu:${prefix}` }]],
  };
}

export async function sendWelcomeMenu(
  telegram: TelegramClient,
  chatId: number | string,
  actor: Actor,
  fullName?: string,
): Promise<void> {
  const name = fullName ? escapeHtml(fullName) : "مرحباً بك";
  const panel = panelFor(actor);
  const roleTitle = panel === "owner" ? "👑 المالك" : panel === "admin" ? "🛡 مشرف" : "🎓 طالب";

  const intro = [
    `👋 <b>${name}</b> في <b>منصة الأرشفة العلمية</b>`,
    "",
    `نوع الحساب: <b>${roleTitle}</b>`,
    "",
    "اختر من اللوحة أدناه للوصول السريع دون أوامر نصية:",
  ].join("\n");

  const keyboard = keyboardForPanel(panel);

  await telegram.sendMessage(chatId, intro, { reply_markup: keyboard });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
