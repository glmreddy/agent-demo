import { del, get, put } from "@vercel/blob";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getUserByEmail, type UserRecord } from "@/lib/users";

// Hand-rolled email/password auth: no auth library, no bcrypt dependency —
// Node's built-in crypto covers password hashing (scrypt) and session
// tokens, consistent with this project's preference for built-ins/raw fetch
// over extra dependencies (see lib/travelAgent.ts's embedText()).

export const SESSION_COOKIE = "wanderlust_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const SESSIONS_PREFIX = "sessions/";
const SCRYPT_KEY_LENGTH = 64;

interface SessionRecord {
  email: string;
  expiresAt: string;
}

function requireBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set.");
  }
  return token;
}

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function sessionPathname(token: string): string {
  return `${SESSIONS_PREFIX}${token}.json`;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(email: string): Promise<string> {
  const blobToken = requireBlobToken();
  const sessionToken = generateSessionToken();
  const record: SessionRecord = {
    email,
    expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
  };

  await put(sessionPathname(sessionToken), JSON.stringify(record), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json",
    token: blobToken,
  });

  return sessionToken;
}

export async function getSession(sessionToken: string): Promise<SessionRecord | null> {
  const blobToken = requireBlobToken();
  // useCache: false — a session is often read moments after it's created
  // (e.g. the page load right after registering), and the default
  // CDN-cached read can miss a blob that was just written.
  const result = await get(sessionPathname(sessionToken), {
    access: "private",
    token: blobToken,
    useCache: false,
  });
  if (!result) return null;

  const text = await new Response(result.stream).text();
  const record = JSON.parse(text) as SessionRecord;

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    return null;
  }
  return record;
}

export async function deleteSession(sessionToken: string): Promise<void> {
  const blobToken = requireBlobToken();
  await del(sessionPathname(sessionToken), { token: blobToken });
}

export async function getSessionUser(): Promise<UserRecord | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await getSession(token);
  if (!session) return null;

  return getUserByEmail(session.email);
}
