import { buildPlanningPrompt, runAgentLoop, type TripInfo } from "@/lib/travelAgent";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let info: TripInfo;
  try {
    info = (await req.json()) as TripInfo;
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  if (!info.origin?.trim() && !info.destination?.trim()) {
    return new Response(
      "I need at least a departure city or a destination to help.",
      { status: 400 }
    );
  }

  const stream = runAgentLoop(buildPlanningPrompt(info));

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
