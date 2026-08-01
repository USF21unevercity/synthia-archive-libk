/**
 * Declarative catalogue of the settings exposed inside the bot itself.
 * Values live in the `settings` table; this only describes and validates them.
 */
export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  type: "text" | "boolean" | "number";
  defaultValue: string;
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: "archive_channel_id",
    label: "🗄 قناة الأرشيف",
    description: "معرّف قناة الأرشيف التي تُنسخ إليها الملفات (مثال: -1001234567890).",
    type: "text",
    defaultValue: "",
  },
  {
    key: "auto_archive",
    label: "⚡ الأرشفة التلقائية",
    description: "أرشفة أي منشور جديد في القنوات المسجّلة تلقائياً.",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "welcome_message",
    label: "👋 رسالة الترحيب",
    description: "نص إضافي يظهر للطلاب عند فتح القائمة الرئيسية.",
    type: "text",
    defaultValue: "",
  },
  {
    key: "student_access",
    label: "🎓 وصول الطلاب",
    description: "السماح للطلاب بالبحث وتحميل الملفات.",
    type: "boolean",
    defaultValue: "true",
  },
  {
    key: "search_page_size",
    label: "🔍 عدد نتائج البحث",
    description: "عدد النتائج المعروضة في كل صفحة بحث (1 - 20).",
    type: "number",
    defaultValue: "10",
  },
  {
    key: "maintenance_mode",
    label: "🛠 وضع الصيانة",
    description: "إيقاف تفاعل الطلاب مؤقتاً مع إبقاء لوحة الإدارة تعمل.",
    type: "boolean",
    defaultValue: "false",
  },
];

export function findSetting(key: string): SettingDefinition | undefined {
  return SETTING_DEFINITIONS.find((s) => s.key === key);
}

export function isTruthy(value: string | null | undefined): boolean {
  return value === "true" || value === "1" || value === "on";
}

/** Returns an error message when the value is invalid, otherwise null. */
export function validateSetting(definition: SettingDefinition, value: string): string | null {
  if (definition.type === "boolean" && !["true", "false"].includes(value)) {
    return "القيمة يجب أن تكون true أو false.";
  }
  if (definition.type === "number") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "القيمة يجب أن تكون رقماً.";
    if (definition.key === "search_page_size" && (parsed < 1 || parsed > 20)) {
      return "العدد يجب أن يكون بين 1 و 20.";
    }
  }
  if (definition.key === "archive_channel_id" && value && !/^-?\d+$/.test(value) && !value.startsWith("@")) {
    return "أدخل معرّفاً رقمياً مثل -1001234567890 أو @channel.";
  }
  return null;
}

export function displayValue(definition: SettingDefinition, raw: string | undefined): string {
  const value = raw ?? definition.defaultValue;
  if (definition.type === "boolean") return isTruthy(value) ? "مُفعّل ✅" : "معطّل ⛔";
  if (!value) return "غير محدد";
  return value.length > 40 ? `${value.slice(0, 39)}…` : value;
}
