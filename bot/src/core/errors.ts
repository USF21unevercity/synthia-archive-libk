/** Base class for every expected, handled application error. */
export class AppError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly meta: Record<string, unknown>;

  constructor(
    code: string,
    userMessage: string,
    message?: string,
    meta: Record<string, unknown> = {},
  ) {
    super(message ?? userMessage);
    this.name = new.target.name;
    this.code = code;
    this.userMessage = userMessage;
    this.meta = meta;
  }
}

export class ValidationError extends AppError {
  constructor(userMessage: string, meta?: Record<string, unknown>) {
    super("VALIDATION_ERROR", userMessage, userMessage, meta);
  }
}

export class PermissionError extends AppError {
  constructor(userMessage = "ليس لديك صلاحية لتنفيذ هذا الإجراء.", meta?: Record<string, unknown>) {
    super("PERMISSION_DENIED", userMessage, "permission denied", meta);
  }
}

export class NotFoundError extends AppError {
  constructor(userMessage = "العنصر المطلوب غير موجود.", meta?: Record<string, unknown>) {
    super("NOT_FOUND", userMessage, "not found", meta);
  }
}

export class ConflictError extends AppError {
  constructor(userMessage = "هذا العنصر مسجّل مسبقاً.", meta?: Record<string, unknown>) {
    super("CONFLICT", userMessage, "conflict", meta);
  }
}

export class TelegramApiError extends AppError {
  readonly method: string;
  readonly description: string;
  readonly errorCode?: number;

  constructor(method: string, description: string, errorCode?: number) {
    super("TELEGRAM_API_ERROR", "تعذر تنفيذ الطلب عبر تليجرام.", `${method}: ${description}`, {
      method,
      errorCode,
    });
    this.method = method;
    this.description = description;
    this.errorCode = errorCode;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const appError = new AppError("INTERNAL_ERROR", "حدث خطأ غير متوقع. تمت مراجعة السجلات.", message);
  if (error instanceof Error && error.stack) appError.stack = error.stack;
  return appError;
}
