import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { MIN_PASSWORD_LENGTH } from "./limits";

const COST = 10;
/** bcrypt ignores everything past 72 bytes, so longer passwords are refused rather than silently cut. */
const MAX_PASSWORD_BYTES = 72;

/** Why a new password is unacceptable, or null if it is fine. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password needs at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) return "Password is too long";
  return null;
}

/** Passwords are only ever stored as this hash. Never log or return the plaintext. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

// A real hash to compare against when the name doesn't exist, so a wrong name
// takes as long as a wrong password and can't be told apart by timing.
let decoy: Promise<string> | undefined;

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  decoy ??= hashPassword("decoy-password-nobody-has");
  const matches = await bcrypt.compare(password, hash ?? (await decoy));
  return hash !== null && matches;
}

const WORDS = ["anchor", "barrel", "compass", "dinghy", "galley", "harbor", "lagoon", "mainsail", "rudder", "tiller", "topsail", "voyage"];

/** A throwaway password for an admin to read out, e.g. "topsail-4821". */
export function temporaryPassword(): string {
  return `${WORDS[randomInt(WORDS.length)]}-${String(randomInt(10_000)).padStart(4, "0")}`;
}
