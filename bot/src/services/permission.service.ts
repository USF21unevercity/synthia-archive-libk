import type { AdminRepository } from "../infrastructure/repositories/admin.repository.js";
import type { Admin, AdminRole } from "../domain/models.js";
import { PermissionError } from "../core/errors.js";

export type Capability =
  | "channel:manage"
  | "admin:manage"
  | "file:read"
  | "file:manage"
  | "stats:read"
  | "reports:read"
  | "settings:manage"
  | "logs:read";

const ROLE_CAPABILITIES: Record<AdminRole, Capability[]> = {
  owner: [
    "channel:manage",
    "admin:manage",
    "file:read",
    "file:manage",
    "stats:read",
    "reports:read",
    "settings:manage",
    "logs:read",
  ],
  admin: ["channel:manage", "file:read", "file:manage", "stats:read", "reports:read", "logs:read"],
  moderator: ["file:read", "file:manage", "stats:read"],
  viewer: ["file:read", "stats:read"],
};

export interface Actor {
  telegramUserId: string;
  role: AdminRole;
  adminId: number | null;
  isOwner: boolean;
}

/** RBAC. The owner is resolved from OWNER_ID and can never lose access. */
export class PermissionService {
  constructor(
    private readonly admins: AdminRepository,
    private readonly ownerId: number,
  ) {}

  async resolve(telegramUserId: string): Promise<Actor | null> {
    if (telegramUserId === String(this.ownerId)) {
      const owner = await this.admins.upsert({ telegramUserId, role: "owner" });
      return { telegramUserId, role: "owner", adminId: owner.id, isOwner: true };
    }

    const admin: Admin | null = await this.admins.findByTelegramId(telegramUserId);
    if (!admin || !admin.isActive) return null;
    return {
      telegramUserId,
      role: admin.role,
      adminId: admin.id,
      isOwner: false,
    };
  }

  can(actor: Actor, capability: Capability): boolean {
    if (actor.isOwner) return true;
    return ROLE_CAPABILITIES[actor.role].includes(capability);
  }

  assert(actor: Actor | null, capability: Capability): asserts actor is Actor {
    if (!actor || !this.can(actor, capability)) {
      throw new PermissionError();
    }
  }

  /** Admins may only act on channels explicitly assigned to them. */
  async assertChannelAccess(actor: Actor, channelId: number): Promise<void> {
    if (actor.isOwner) return;
    if (actor.adminId === null || !(await this.admins.hasChannel(actor.adminId, channelId))) {
      throw new PermissionError("هذه القناة غير مسندة إليك.");
    }
  }
}
