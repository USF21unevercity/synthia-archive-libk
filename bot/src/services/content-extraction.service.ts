import type { ContentType } from "../domain/models.js";
import type { TelegramMessage } from "../telegram/client.js";

const EXTENSION_MAP: Record<string, ContentType> = {
  pdf: "pdf",
  doc: "doc",
  docx: "docx",
  ppt: "ppt",
  pptx: "pptx",
  xls: "xls",
  xlsx: "xlsx",
  zip: "zip",
  rar: "rar",
};

export interface ExtractedContent {
  contentType: ContentType;
  telegramFileId: string | null;
  telegramFileUniqueId: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  linkUrl: string | null;
  title: string | null;
  caption: string | null;
  hashtags: string[];
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const HASHTAG_PATTERN = /#([\p{L}\p{N}_]{2,50})/gu;

/** Arabic + English keyword dictionary used to derive hashtags when none are present. */
const KEYWORD_HINTS: Array<{ tag: string; patterns: RegExp }> = [
  { tag: "محاضرة", patterns: /محاضر|lecture/i },
  { tag: "ملخص", patterns: /ملخص|summary/i },
  { tag: "امتحان", patterns: /امتحان|اختبار|exam|quiz/i },
  { tag: "واجب", patterns: /واجب|تكليف|assignment|homework/i },
  { tag: "بحث", patterns: /بحث|ورقة علمية|research|paper/i },
  { tag: "كتاب", patterns: /كتاب|مرجع|book|textbook/i },
  { tag: "شرح", patterns: /شرح|explanation|tutorial/i },
  { tag: "رياضيات", patterns: /رياضيات|جبر|تفاضل|math|calculus|algebra/i },
  { tag: "فيزياء", patterns: /فيزياء|physics/i },
  { tag: "كيمياء", patterns: /كيمياء|chemistry/i },
  { tag: "أحياء", patterns: /أحياء|biology/i },
  { tag: "برمجة", patterns: /برمجة|حاسوب|programming|software|code/i },
  { tag: "طب", patterns: /طب|تشريح|medicine|anatomy/i },
  { tag: "هندسة", patterns: /هندسة|engineering/i },
];

function classifyDocument(fileName: string | undefined, mimeType: string | undefined): ContentType {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  if (ext && EXTENSION_MAP[ext]) return EXTENSION_MAP[ext];
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType?.startsWith("video/")) return "video";
  if (mimeType?.startsWith("audio/")) return "audio";
  return "other";
}

function deriveTitle(text: string | null): string | null {
  if (!text) return null;
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return null;
  return firstLine.replace(HASHTAG_PATTERN, "").trim().slice(0, 200) || null;
}

export function extractHashtags(text: string | null): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    if (match[1]) found.add(match[1].toLowerCase());
  }
  return [...found];
}

/** Generates hashtags from content keywords when the post has none. */
export function generateHashtags(text: string | null, contentType: ContentType): string[] {
  const tags = new Set<string>([contentType]);
  if (text) {
    for (const hint of KEYWORD_HINTS) {
      if (hint.patterns.test(text)) tags.add(hint.tag);
    }
  }
  return [...tags];
}

/** Turns a raw Telegram post into normalized scientific content metadata. */
export class ContentExtractionService {
  extract(message: TelegramMessage): ExtractedContent {
    const caption = message.caption ?? message.text ?? null;
    let contentType: ContentType = "text";
    let telegramFileId: string | null = null;
    let telegramFileUniqueId: string | null = null;
    let fileName: string | null = null;
    let mimeType: string | null = null;
    let fileSize: number | null = null;
    let linkUrl: string | null = null;

    if (message.document) {
      contentType = classifyDocument(message.document.file_name, message.document.mime_type);
      telegramFileId = message.document.file_id;
      telegramFileUniqueId = message.document.file_unique_id;
      fileName = message.document.file_name ?? null;
      mimeType = message.document.mime_type ?? null;
      fileSize = message.document.file_size ?? null;
    } else if (message.video) {
      contentType = "video";
      telegramFileId = message.video.file_id;
      telegramFileUniqueId = message.video.file_unique_id;
      fileName = message.video.file_name ?? null;
      mimeType = message.video.mime_type ?? null;
      fileSize = message.video.file_size ?? null;
    } else if (message.audio || message.voice) {
      const audio = (message.audio ?? message.voice)!;
      contentType = "audio";
      telegramFileId = audio.file_id;
      telegramFileUniqueId = audio.file_unique_id;
      fileName = audio.file_name ?? null;
      mimeType = audio.mime_type ?? null;
      fileSize = audio.file_size ?? null;
    } else if (message.photo?.length) {
      const largest = message.photo[message.photo.length - 1]!;
      contentType = "image";
      telegramFileId = largest.file_id;
      telegramFileUniqueId = largest.file_unique_id;
      fileSize = largest.file_size ?? null;
    } else if (caption) {
      const url = caption.match(URL_PATTERN)?.[0];
      if (url) {
        contentType = "link";
        linkUrl = url;
      }
    }

    const explicit = extractHashtags(caption);
    const hashtags = explicit.length ? explicit : generateHashtags(caption, contentType);

    return {
      contentType,
      telegramFileId,
      telegramFileUniqueId,
      fileName,
      mimeType,
      fileSize,
      linkUrl,
      title: deriveTitle(caption) ?? fileName,
      caption,
      hashtags,
    };
  }
}
