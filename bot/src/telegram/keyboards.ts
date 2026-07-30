import type { InlineKeyboardMarkup } from "./client.js";

export function mainMenu(role: string): InlineKeyboardMarkup {
  const keyboard = [];

  keyboard.push([
    {
      text: "🔍 البحث",
      callback_data: "search",
    },
    {
      text: "📚 المكتبة",
      callback_data: "library",
    },
  ]);

  keyboard.push([
    {
      text: "📊 الإحصائيات",
      callback_data: "stats",
    },
  ]);

  if (role === "admin" || role === "owner") {
    keyboard.push([
      {
        text: "➕ إضافة قناة",
        callback_data: "add_channel",
      },
      {
        text: "📂 القنوات",
        callback_data: "channels",
      },
    ]);
  }

  if (role === "owner") {
    keyboard.push([
      {
        text: "👥 المشرفون",
        callback_data: "admins",
      },
      {
        text: "⚙️ الإعدادات",
        callback_data: "settings",
      },
    ]);
  }

  return {
    inline_keyboard: keyboard,
  };
}
