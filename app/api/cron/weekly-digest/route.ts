import { timingSafeEqual } from "node:crypto";
import { listAllUserRecords, updateUser } from "@/lib/users";
import { buildDigestEmail, sendDigestEmail } from "@/lib/digest";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 10;

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail closed if unset — this route is a public URL

  const got = req.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${expected}`;

  const gotBuf = Buffer.from(got);
  const expectedBuf = Buffer.from(expectedHeader);
  if (gotBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(gotBuf, expectedBuf);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const users = await listAllUserRecords();
  const recipients = users.filter((u) => u.digestOptIn);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (user) => {
        const { subject, html, text } = buildDigestEmail(user);
        await sendDigestEmail(user.email, subject, html, text);
        user.lastDigestSentAt = new Date().toISOString();
        await updateUser(user);
      })
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        sent++;
      } else {
        failed++;
        console.error("weekly-digest: failed to send to a user", result.reason);
      }
    }
  }

  return Response.json({ sent, failed, totalOptedIn: recipients.length });
}
