import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { updateUser, type DestinationPreference, type UserProfile } from "@/lib/users";

export const runtime = "nodejs";

const MAX_FIELD_LENGTH = 300;
const MAX_DESTINATIONS = 15;

interface ProfileBody {
  digestOptIn?: boolean;
  profile?: {
    interests?: string;
    budget?: string;
    travelers?: string;
    constraints?: string;
    destinations?: Array<{ id?: string; destination?: string; timeframe?: string }>;
  };
}

function cleanField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_FIELD_LENGTH);
  return trimmed || undefined;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Not authenticated.", { status: 401 });
  }
  return Response.json({
    name: user.name,
    email: user.email,
    digestOptIn: user.digestOptIn,
    profile: user.profile,
  });
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Not authenticated.", { status: 401 });
  }

  let body: ProfileBody;
  try {
    body = (await req.json()) as ProfileBody;
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  const rawDestinations = Array.isArray(body.profile?.destinations)
    ? body.profile!.destinations!
    : [];

  if (rawDestinations.length > MAX_DESTINATIONS) {
    return new Response(`You can save at most ${MAX_DESTINATIONS} destinations.`, {
      status: 400,
    });
  }

  const destinations: DestinationPreference[] = rawDestinations
    .map((d) => ({
      id: typeof d.id === "string" && d.id ? d.id : randomUUID(),
      destination: cleanField(d.destination) ?? "",
      timeframe: cleanField(d.timeframe) ?? "",
    }))
    .filter((d) => d.destination.length > 0);

  const profile: UserProfile = {
    interests: cleanField(body.profile?.interests),
    budget: cleanField(body.profile?.budget),
    travelers: cleanField(body.profile?.travelers),
    constraints: cleanField(body.profile?.constraints),
    destinations,
  };

  user.profile = profile;
  user.digestOptIn = Boolean(body.digestOptIn);

  await updateUser(user);

  return Response.json({
    name: user.name,
    email: user.email,
    digestOptIn: user.digestOptIn,
    profile: user.profile,
  });
}
