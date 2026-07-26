export type ChannelStatus = "active" | "paused" | "disabled";
export type AdminRole = "owner" | "admin" | "moderator" | "viewer";

export type ContentType =
  | "pdf"
  | "doc"
  | "docx"
  | "ppt"
  | "pptx"
  | "xls"
  | "xlsx"
  | "zip"
  | "rar"
  | "image"
  | "video"
  | "audio"
  | "link"
  | "text"
  | "other";

export interface Channel {
  id: number;
  telegramChannelId: string;
  title: string;
  username: string | null;
  archiveChannelId: string | null;
  status: ChannelStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Admin {
  id: number;
  telegramUserId: string;
  fullName: string | null;
  username: string | null;
  role: AdminRole;
  isActive: boolean;
  createdAt: Date;
}

export interface AdminChannelAssignment {
  adminId: number;
  channelId: number;
  createdAt: Date;
}

export interface ScientificFile {
  id: number;
  channelId: number;
  messageId: number;
  telegramFileId: string | null;
  telegramFileUniqueId: string | null;
  contentType: ContentType;
  title: string | null;
  caption: string | null;
  subject: string | null;
  category: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  linkUrl: string | null;
  publishedAt: Date;
  createdAt: Date;
}

export interface ArchiveLog {
  id: number;
  fileId: number;
  archiveChannelId: string;
  archiveMessageId: number | null;
  status: "pending" | "archived" | "failed";
  errorMessage: string | null;
  createdAt: Date;
}

export interface Hashtag {
  id: number;
  tag: string;
  usageCount: number;
}

export interface ActivityLog {
  id: number;
  actorTelegramId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}
