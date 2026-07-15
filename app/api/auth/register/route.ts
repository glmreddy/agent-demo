import { cookies } from "next/headers";
import { createUser, DuplicateEmailError, normalizeEmail } from "@/lib/users";
import { createSession, hashPassword, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RegisterBody {
  name?: string;
  email?: string;
  password?: string;
}

export async function POST(req: Request) {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!name || name.length > 100) {
    return new Response("Name is required (max 100 characters).", { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return new Response("A valid email is required.", { status: 400 });
  }
  if (password.length < 8 || password.length > 200) {
    return new Response("Password must be at least 8 characters.", { status: 400 });
  }

  const { salt, hash } = hashPassword(password);

  let user;
  try {
    user = await createUser({ email, name, passwordHash: hash, passwordSalt: salt });
  } catch (err) {
    if (err instanceof DuplicateEmailError) {
      return new Response(err.message, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Registration failed: ${message}`, { status: 500 });
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
