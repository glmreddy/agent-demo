import { cookies } from "next/headers";
import { getUserByEmail, normalizeEmail } from "@/lib/users";
import { createSession, SESSION_COOKIE, SESSION_TTL_SECONDS, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

interface LoginBody {
  email?: string;
  password?: string;
}

const GENERIC_ERROR = "Invalid email or password.";
// A fixed dummy salt/hash used when no account exists, so a login attempt
// against an unknown email still runs a scrypt comparison — this keeps
// response time from leaking whether an email is registered.
const DUMMY_SALT = "0000000000000000000000000000000";
const DUMMY_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

export async function POST(req: Request) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return new Response(GENERIC_ERROR, { status: 401 });
  }

  const user = await getUserByEmail(email);
  const ok = user
    ? verifyPassword(password, user.passwordSalt, user.passwordHash)
    : verifyPassword(password, DUMMY_SALT, DUMMY_HASH);

  if (!user || !ok) {
    return new Response(GENERIC_ERROR, { status: 401 });
  }

  const sessionToken = await createSession(normalizeEmail(user.email));
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return Response.json({ name: user.name, email: user.email });
}
