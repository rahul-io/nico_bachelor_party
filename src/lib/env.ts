/** Server-side env access. The only module that reads process.env for app config. */

const isProduction = process.env.NODE_ENV === "production";

export const DEV_ADMIN_PASSWORD = "admin";

export const env = {
  /** Null in production when unset, which disables admin login entirely. */
  get adminPassword(): string | null {
    return process.env.ADMIN_PASSWORD || (isProduction ? null : DEV_ADMIN_PASSWORD);
  },

  get usingDevAdminPassword(): boolean {
    return !process.env.ADMIN_PASSWORD && !isProduction;
  },

  /** Key for signing the admin cookie. Changing the password invalidates sessions. */
  get sessionKey(): string | null {
    const password = this.adminPassword;
    if (!password) return null;
    return `${process.env.SESSION_SECRET || "dev-session-secret"}:${password}`;
  },

  isProduction,
};
