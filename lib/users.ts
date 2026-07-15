import { del, get, list, put, BlobError } from "@vercel/blob";
import { randomUUID } from "node:crypto";

// User accounts and travel-preference profiles, persisted to Vercel Blob as
// one private JSON object per user. There is no database in this project —
// this follows the exact put/get pathname conventions already established
// in scripts/ingest_knowledge_base.mjs and lib/travelAgent.ts's
// loadKnowledgeBaseIndex() (private access, addRandomSuffix: false).

const USERS_PREFIX = "users/by-email/";

export interface DestinationPreference {
  id: string;
  destination: string;
  timeframe: string;
}

export interface UserProfile {
  interests?: string;
  budget?: string;
  travelers?: string;
  constraints?: string;
  destinations: DestinationPreference[];
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  digestOptIn: boolean;
  lastDigestSentAt: string | null;
  profile: UserProfile;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("An account with that email already exists.");
    this.name = "DuplicateEmailError";
  }
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function userPathname(normalizedEmail: string): string {
  // Deliberately not URL-encoding the email: @vercel/blob applies its own
  // encoding when building the presigned URL for private blobs, and
  // pre-encoding here (e.g. "@" -> "%40") caused a write/read pathname
  // mismatch — the put() and get() ended up targeting different storage
  // keys, so newly-registered users could never be found. A literal "@" in
  // the pathname works correctly. Guard only against "/", which would
  // otherwise be interpreted as a path separator.
  const safe = normalizedEmail.replace(/\//g, "_");
  return `${USERS_PREFIX}${safe}.json`;
}

function requireBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set.");
  }
  return token;
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const token = requireBlobToken();
  const normalized = normalizeEmail(email);

  // useCache: false — this is often read moments after a write (e.g. right
  // after registering, or right after saving profile changes), and the
  // default CDN-cached read can miss/serve stale content for a blob that
  // was just written.
  const result = await get(userPathname(normalized), {
    access: "private",
    token,
    useCache: false,
  });
  if (!result) return null;

  const text = await new Response(result.stream).text();
  return JSON.parse(text) as UserRecord;
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
}): Promise<UserRecord> {
  const token = requireBlobToken();
  const normalized = normalizeEmail(input.email);

  const user: UserRecord = {
    id: randomUUID(),
    email: normalized,
    name: input.name,
    passwordHash: input.passwordHash,
    passwordSalt: input.passwordSalt,
    createdAt: new Date().toISOString(),
    digestOptIn: true,
    lastDigestSentAt: null,
    profile: { destinations: [] },
  };

  try {
    await put(userPathname(normalized), JSON.stringify(user), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
      token,
    });
  } catch (err) {
    if (err instanceof BlobError) {
      throw new DuplicateEmailError();
    }
    throw err;
  }

  return user;
}

export async function updateUser(user: UserRecord): Promise<void> {
  const token = requireBlobToken();
  await put(userPathname(user.email), JSON.stringify(user), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token,
  });
}

export async function listAllUserRecords(): Promise<UserRecord[]> {
  const token = requireBlobToken();
  const users: UserRecord[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: USERS_PREFIX, cursor, token });
    for (const blobItem of page.blobs) {
      const result = await get(blobItem.pathname, {
        access: "private",
        token,
        useCache: false,
      });
      if (!result) continue;
      const text = await new Response(result.stream).text();
      users.push(JSON.parse(text) as UserRecord);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return users;
}

export async function deleteUser(email: string): Promise<void> {
  const token = requireBlobToken();
  await del(userPathname(normalizeEmail(email)), { token });
}
