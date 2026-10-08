/** Server-side env access. The only module that reads process.env for app config. */

const isProduction = process.env.NODE_ENV === "production";

export const DEV_ADMIN_PASSWORD = "admin";
/** Local development only, when INVITE_CODE is unset. */
export const DEV_INVITE_CODE = "ahoy";

export const env = {
  /** Unset means the app runs on in-memory mock data. */
  get databaseUrl(): string | null {
    return process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
  },

  /** Unset means media uploads fall back to small in-memory images. */
  get blobToken(): string | null {
    return process.env.BLOB_READ_WRITE_TOKEN || null;
  },

  /** Null in production when unset, which disables admin login entirely. */
  get adminPassword(): string | null {
    return process.env.ADMIN_PASSWORD || (isProduction ? null : DEV_ADMIN_PASSWORD);
  },

  get usingDevAdminPassword(): boolean {
    return !process.env.ADMIN_PASSWORD && !isProduction;
  },

  /**
   * The code guests type to get past the gate. Null in production when unset,
   * which shuts the whole app: set INVITE_CODE in Vercel before deploying.
   */
  get inviteCode(): string | null {
    return process.env.INVITE_CODE || (isProduction ? null : DEV_INVITE_CODE);
  },

  get usingDevInviteCode(): boolean {
    return !process.env.INVITE_CODE && !isProduction;
  },

  /**
   * Signs the gate, session and admin cookies. Required in production: without
   * it nobody can get in, by design.
   */
  get sessionSecret(): string | null {
    return process.env.SESSION_SECRET || (isProduction ? null : "dev-session-secret");
  },

  /** Key for signing the admin cookie. Changing the password invalidates sessions. */
  get sessionKey(): string | null {
    const password = this.adminPassword;
    const secret = this.sessionSecret;
    if (!password || !secret) return null;
    return `${secret}:${password}`;
  },

  isProduction,
};
