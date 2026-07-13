import Anthropic from "@anthropic-ai/sdk";

// Mirrors the prompt-building and Claude call in agent-demo2.py, adapted to
// take structured JSON input (from the widget) instead of terminal stdin,
// and to stream plain text back instead of printing to stdout.

export const runtime = "nodejs";

const MODEL = "claude-opus-4-8";

interface TripInfo {
  origin?: string;
  destination?: string;
  region_preference?: string;
  travel_dates?: string;
  trip_length?: string;
  travelers?: string;
  budget?: string;
  interests?: string;
  constraints?: string;
}

const FIELDS: Array<[string, keyof TripInfo]> = [
  ["Departure city/airport", "origin"],
  ["Desired destination", "destination"],
  ["Region/trip-type preference", "region_preference"],
  ["Travel dates", "travel_dates"],
  ["Trip length", "trip_length"],
  ["Travelers", "travelers"],
  ["Budget", "budget"],
  ["Interests", "interests"],
  ["Constraints", "constraints"],
];

function buildPrompt(info: TripInfo): string {
  const lines: string[] = ["Plan a vacation based on the following traveler details:"];

  for (const [label, key] of FIELDS) {
    const value = (info[key] ?? "").trim();
    if (value) lines.push(`- ${label}: ${value}`);
  }

  lines.push("");
  lines.push(
    "If no destination was given, suggest 2-3 well-matched destinations, ranked, " +
      "with a short reason each. If a destination was given, confirm it's a good " +
      "fit (or flag concerns) and focus the plan on it."
  );
  lines.push(
    "For the chosen/recommended destination(s), include: best time to visit, " +
      "a rough daily/total budget estimate, 3-5 suggested activities matching the " +
      "traveler's interests, and any relevant travel advisories or visa notes."
  );
  lines.push(
    "For flights: use web search to find current, realistic flight options from " +
      "the departure city, including likely airlines, typical routing (direct vs " +
      "connecting), approximate round-trip economy price range, and a suggestion " +
      "for where to book (e.g. Google Flights, airline site) with a ready-to-use " +
      "search query."
  );
  lines.push(
    "Keep the response well-organized with clear headings, and keep it concise " +
      "and actionable rather than exhaustive."
  );

  return lines.join("\n");
}

const SYSTEM_PROMPT =
  "You are an expert, friendly travel agent. You give concrete, well-reasoned " +
  "vacation recommendations and realistic flight guidance. Use the web_search " +
  "tool to ground destination and flight information in current, real data " +
  "rather than guessing. Always disclose that flight prices fluctuate and " +
  "recommend the traveler confirm final prices before booking.";

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("Server is missing ANTHROPIC_API_KEY.", { status: 500 });
  }

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

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const claudeStream = client.messages.stream({
          model: MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          tools: [
            { type: "web_search_20260209", name: "web_search", max_uses: 6 },
          ],
          messages: [{ role: "user", content: buildPrompt(info) }],
        });

        claudeStream.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        const final = await claudeStream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(
            encoder.encode("\n\nClaude declined to respond to this request.")
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`\n\n[Error: ${message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
