import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const CURRENT_PREFIX = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${CURRENT_PREFIX}:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    const [algorithm, salt, hash] = passwordHash.split(":");
    if (algorithm !== CURRENT_PREFIX || !salt || !hash) return false;

    const expected = Buffer.from(hash, "hex");
    if (expected.length !== KEY_LENGTH) return false;

    const actual = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch (error) {
    console.error("[auth password] Unsupported or malformed password hash", error);
    return false;
  }
}