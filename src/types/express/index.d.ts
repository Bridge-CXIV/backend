import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface AuthPayload {
      userId: string;
      role: UserRole | string;
      magicUserId?: string | null;
      hederaAccountId?: string | null;
      email?: string | null;
      displayName?: string | null;
    }

    interface Request {
      user?: AuthPayload;
    }
  }
}

export {};
