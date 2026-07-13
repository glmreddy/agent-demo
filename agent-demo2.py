#!/usr/bin/env python3
"""Travel Agent CLI powered by Claude.

Run from a terminal:
    python agent-demo2.py

Reads ANTHROPIC_API_KEY from config.env (same directory as this script).
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
import anthropic

MODEL = "claude-opus-4-8"
SCRIPT_DIR = Path(__file__).resolve().parent


def load_api_key() -> str:
    load_dotenv(SCRIPT_DIR / "config.env")
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key or api_key == "your-api-key-here":
        print(
            "No Anthropic API key found.\n"
            f"Add ANTHROPIC_API_KEY=<your key> to {SCRIPT_DIR / 'config.env'} and try again."
        )
        sys.exit(1)
    return api_key


def ask(prompt: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    answer = input(f"{prompt}{suffix}: ").strip()
    return answer or default


def collect_trip_info() -> dict:
    print("=" * 60)
    print("  Claude Travel Agent")
    print("=" * 60)
    print("Answer a few questions and I'll put together a vacation plan.")
    print("(Press Enter to skip any question you're not sure about.)\n")

    info = {}
    info["origin"] = ask("Which city/airport will you be traveling from?")
    info["destination"] = ask(
        "Do you have a destination in mind? (leave blank for suggestions)"
    )
    info["region_preference"] = ""
    if not info["destination"]:
        info["region_preference"] = ask(
            "Any preferred region or type of trip? (e.g. beach, Europe, mountains, "
            "anywhere warm)"
        )
    info["travel_dates"] = ask(
        "When do you want to travel? (specific dates or a month/season)"
    )
    info["trip_length"] = ask("How many days is the trip?")
    info["travelers"] = ask("How many travelers (and any kids)?", "1 adult")
    info["budget"] = ask("What's your approximate total budget (per person or total)?")
    info["interests"] = ask(
        "What do you enjoy on vacation? (e.g. relaxing on a beach, hiking, "
        "food & culture, nightlife, adventure sports)"
    )
    info["constraints"] = ask(
        "Any constraints? (e.g. direct flights only, visa-free, pet-friendly, "
        "accessibility needs)"
    )
    return info


def build_prompt(info: dict) -> str:
    lines = ["Plan a vacation based on the following traveler details:"]
    for label, key in [
        ("Departure city/airport", "origin"),
        ("Desired destination", "destination"),
        ("Region/trip-type preference", "region_preference"),
        ("Travel dates", "travel_dates"),
        ("Trip length", "trip_length"),
        ("Travelers", "travelers"),
        ("Budget", "budget"),
        ("Interests", "interests"),
        ("Constraints", "constraints"),
    ]:
        value = info.get(key, "").strip()
        if value:
            lines.append(f"- {label}: {value}")

    lines.append("")
    lines.append(
        "If no destination was given, suggest 2-3 well-matched destinations, ranked, "
        "with a short reason each. If a destination was given, confirm it's a good "
        "fit (or flag concerns) and focus the plan on it."
    )
    lines.append(
        "For the chosen/recommended destination(s), include: best time to visit, "
        "a rough daily/total budget estimate, 3-5 suggested activities matching the "
        "traveler's interests, and any relevant travel advisories or visa notes."
    )
    lines.append(
        "For flights: use web search to find current, realistic flight options from "
        "the departure city, including likely airlines, typical routing (direct vs "
        "connecting), approximate round-trip economy price range, and a suggestion "
        "for where to book (e.g. Google Flights, airline site) with a ready-to-use "
        "search query."
    )
    lines.append(
        "Keep the response well-organized with clear headings, and keep it concise "
        "and actionable rather than exhaustive."
    )
    return "\n".join(lines)


def main() -> None:
    api_key = load_api_key()
    client = anthropic.Anthropic(api_key=api_key)

    try:
        info = collect_trip_info()
    except (KeyboardInterrupt, EOFError):
        print("\nCancelled.")
        sys.exit(0)

    if not info.get("origin") and not info.get("destination"):
        print("\nI need at least a departure city or a destination to help. Bye!")
        sys.exit(1)

    print("\nWorking on your vacation plan (this can take a bit while I check "
          "flights and destinations)...\n")

    system_prompt = (
        "You are an expert, friendly travel agent. You give concrete, "
        "well-reasoned vacation recommendations and realistic flight guidance. "
        "Use the web_search tool to ground destination and flight information in "
        "current, real data rather than guessing. Always disclose that flight "
        "prices fluctuate and recommend the traveler confirm final prices before "
        "booking."
    )

    try:
        with client.messages.stream(
            model=MODEL,
            max_tokens=4096,
            system=system_prompt,
            thinking={"type": "adaptive"},
            output_config={"effort": "medium"},
            tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": 6}],
            messages=[{"role": "user", "content": build_prompt(info)}],
        ) as stream:
            for text in stream.text_stream:
                print(text, end="", flush=True)
            print()
            final = stream.get_final_message()
            if final.stop_reason == "refusal":
                print("\nClaude declined to respond to this request.")
    except anthropic.AuthenticationError:
        print("Authentication failed. Check your ANTHROPIC_API_KEY in config.env.")
        sys.exit(1)
    except anthropic.RateLimitError:
        print("\nRate limited by the API. Please wait a moment and try again.")
        sys.exit(1)
    except anthropic.APIStatusError as e:
        print(f"\nAPI error ({e.status_code}): {e.message}")
        sys.exit(1)
    except anthropic.APIConnectionError:
        print("\nCouldn't reach the Anthropic API. Check your internet connection.")
        sys.exit(1)


if __name__ == "__main__":
    main()
