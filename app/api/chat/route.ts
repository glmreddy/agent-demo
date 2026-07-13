import { buildFollowUpPrompt, runAgentLoop, type Turn } from "@/lib/travelAgent";

export const runtime = "nodejs";

interface ChatRequestBody {
  history?: Turn[];
  question?: string;
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return new Response("A follow-up question is required.", { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const stream = runAgentLoop(buildFollowUpPrompt(history, question));

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
