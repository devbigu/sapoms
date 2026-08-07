import "server-only";

import { scryptSync, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/mongodb";
import { sanitizeLegacyProfile } from "@/server/auth/sanitize-profile";
import type { AuthenticationProvider, LegacyAuthenticatedActor } from "./types";

const DEMO = {
  _id: "demo000000000000000000000",
  name: "Demo Accountant",
  email: "demo@omsons.com",
  password: "demo1234",
  phone: "+91 00000 00000",
  role: "accountant",
};

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    const hashBuffer = Buffer.from(hash, "hex");
    const derived = scryptSync(password, salt, 64);
    return timingSafeEqual(hashBuffer, derived);
  } catch {
    return false;
  }
}

export class MongoAccountantAuthenticationProvider implements AuthenticationProvider {
  async authenticate(input: { email: string; password: string }): Promise<LegacyAuthenticatedActor> {
    const normalizedEmail = input.email.trim().toLowerCase();

    if (normalizedEmail === DEMO.email && input.password === DEMO.password) {
      const profile = sanitizeLegacyProfile({ _id: DEMO._id, name: DEMO.name, email: DEMO.email, phone: DEMO.phone, role: DEMO.role });
      return {
        source: "MONGODB",
        legacyActorId: DEMO._id,
        role: "ACCOUNTANT",
        email: DEMO.email,
        displayName: DEMO.name,
        profile,
      };
    }

    const db = await getDb();
    const accountant = await db.collection("accountants").findOne({ email: normalizedEmail });
    const storedPassword = typeof accountant?.password === "string" ? accountant.password : "";
    if (!accountant || !storedPassword || !verifyPassword(input.password, storedPassword)) {
      throw new Error("Invalid credentials");
    }

    const profile = sanitizeLegacyProfile({
      _id: accountant._id.toString(),
      name: accountant.name,
      email: accountant.email,
      phone: accountant.phone,
      role: accountant.role ?? "accountant",
    });

    return {
      source: "MONGODB",
      legacyActorId: accountant._id.toString(),
      role: "ACCOUNTANT",
      email: typeof accountant.email === "string" ? accountant.email : normalizedEmail,
      displayName: typeof accountant.name === "string" ? accountant.name : undefined,
      profile,
    };
  }
}

export const mongoAccountantAuthenticationProvider = new MongoAccountantAuthenticationProvider();
