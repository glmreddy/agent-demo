import { cookies } from "next/headers";
import { deleteSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    try {
      await deleteSession(token);
    } catch {
      // Best-effort — still clear the cookie even if the Blob delete fails.
    }
  }

  store.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
