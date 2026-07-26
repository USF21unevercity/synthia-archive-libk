import type { FileRepository, SearchCriteria } from "../infrastructure/repositories/file.repository.js";
import type { ScientificFile, ContentType } from "../domain/models.js";
import { ValidationError } from "../core/errors.js";

const CONTENT_TYPES: ContentType[] = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "zip",
  "rar",
  "image",
  "video",
  "audio",
  "link",
  "text",
  "other",
];

/** Module 7 — Search Engine. Parses `key:value` filters plus free text. */
export class SearchService {
  constructor(private readonly files: FileRepository) {}

  parseQuery(raw: string): SearchCriteria {
    if (raw.trim().length === 0) {
      throw new ValidationError("اكتب كلمة للبحث، مثال: /search فيزياء type:pdf");
    }
    if (raw.length > 300) {
      throw new ValidationError("نص البحث طويل جداً (الحد 300 حرف).");
    }

    const criteria: SearchCriteria = { limit: 10 };
    const freeText: string[] = [];

    for (const token of raw.split(/\s+/)) {
      const [key, ...rest] = token.split(":");
      const value = rest.join(":").trim();

      if (!value) {
        if (token.startsWith("#")) criteria.hashtag = token.slice(1).toLowerCase();
        else freeText.push(token);
        continue;
      }

      switch (key) {
        case "type":
          if (!CONTENT_TYPES.includes(value as ContentType)) {
            throw new ValidationError(`نوع غير مدعوم: ${value}`);
          }
          criteria.contentType = value as ContentType;
          break;
        case "subject":
          criteria.subject = value;
          break;
        case "category":
          criteria.category = value;
          break;
        case "tag":
          criteria.hashtag = value.replace(/^#/, "").toLowerCase();
          break;
        case "channel": {
          const channelId = Number.parseInt(value, 10);
          if (!Number.isSafeInteger(channelId)) throw new ValidationError("معرّف القناة غير صالح.");
          criteria.channelId = channelId;
          break;
        }
        case "from":
        case "to": {
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) {
            throw new ValidationError(`تاريخ غير صالح: ${value} (استخدم YYYY-MM-DD)`);
          }
          if (key === "from") criteria.from = date;
          else criteria.to = date;
          break;
        }
        default:
          freeText.push(token);
      }
    }

    if (freeText.length) criteria.text = freeText.join(" ");
    return criteria;
  }

  search(criteria: SearchCriteria): Promise<ScientificFile[]> {
    return this.files.search(criteria);
  }
}
