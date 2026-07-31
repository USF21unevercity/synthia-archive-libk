/**
 * Short-lived, in-memory conversational state.
 * Bounded and lazily swept — no timers, no listeners, no leaks.
 */
export interface PendingAction {
  action: string;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 2_000;

export class SessionStore {
  private readonly pending = new Map<string, PendingAction>();

  set(userId: string, action: string): void {
    this.sweep();
    this.pending.set(userId, { action, expiresAt: Date.now() + TTL_MS });
  }

  take(userId: string): string | null {
    const entry = this.pending.get(userId);
    if (!entry) return null;
    this.pending.delete(userId);
    if (entry.expiresAt < Date.now()) return null;
    return entry.action;
  }

  clear(userId: string): void {
    this.pending.delete(userId);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, value] of this.pending) {
      if (value.expiresAt < now) this.pending.delete(key);
    }
    while (this.pending.size >= MAX_ENTRIES) {
      const oldest = this.pending.keys().next();
      if (oldest.done) break;
      this.pending.delete(oldest.value);
    }
  }
}

/** Maps long values (subject/college names) to short callback-safe tokens. */
export class RefStore {
  private readonly forward = new Map<string, string>();
  private readonly backward = new Map<string, string>();
  private counter = 0;

  put(value: string): string {
    const existing = this.backward.get(value);
    if (existing) return existing;
    const key = (this.counter++).toString(36);
    this.forward.set(key, value);
    this.backward.set(value, key);
    if (this.forward.size > 1_000) {
      const oldest = this.forward.keys().next();
      if (!oldest.done) {
        const staleValue = this.forward.get(oldest.value);
        this.forward.delete(oldest.value);
        if (staleValue !== undefined) this.backward.delete(staleValue);
      }
    }
    return key;
  }

  get(key: string): string | null {
    return this.forward.get(key) ?? null;
  }
}
