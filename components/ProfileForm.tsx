"use client";

import { useState, type FormEvent } from "react";

interface DestinationPreference {
  id: string;
  destination: string;
  timeframe: string;
}

interface ProfileData {
  name: string;
  email: string;
  digestOptIn: boolean;
  profile: {
    interests?: string;
    budget?: string;
    travelers?: string;
    constraints?: string;
    destinations: DestinationPreference[];
  };
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export default function ProfileForm({ initial }: { initial: ProfileData }) {
  const [interests, setInterests] = useState(initial.profile.interests ?? "");
  const [budget, setBudget] = useState(initial.profile.budget ?? "");
  const [travelers, setTravelers] = useState(initial.profile.travelers ?? "");
  const [constraints, setConstraints] = useState(initial.profile.constraints ?? "");
  const [digestOptIn, setDigestOptIn] = useState(initial.digestOptIn);
  const [destinations, setDestinations] = useState<DestinationPreference[]>(
    initial.profile.destinations
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function addDestination() {
    setDestinations((prev) => [...prev, { id: makeId(), destination: "", timeframe: "" }]);
  }

  function removeDestination(id: string) {
    setDestinations((prev) => prev.filter((d) => d.id !== id));
  }

  function updateDestination(id: string, field: "destination" | "timeframe", value: string) {
    setDestinations((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          digestOptIn,
          profile: {
            interests,
            budget,
            travelers,
            constraints,
            destinations: destinations.filter((d) => d.destination.trim()),
          },
        }),
      });

      if (!res.ok) {
        setError(await res.text());
        setStatus("error");
        return;
      }

      setStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="profile-form">
      <section className="profile-section">
        <h2>Your destinations</h2>
        <p className="profile-hint">
          Places you're hoping to visit over the next 2-3 years. We'll build your weekly digest
          around these.
        </p>

        {destinations.map((d) => (
          <div className="destination-row" key={d.id}>
            <input
              placeholder="Destination, e.g. Japan"
              value={d.destination}
              onChange={(e) => updateDestination(d.id, "destination", e.target.value)}
            />
            <input
              placeholder="Timeframe, e.g. Spring 2027"
              value={d.timeframe}
              onChange={(e) => updateDestination(d.id, "timeframe", e.target.value)}
            />
            <button
              type="button"
              className="destination-remove"
              onClick={() => removeDestination(d.id)}
              aria-label={`Remove ${d.destination || "destination"}`}
            >
              &minus;
            </button>
          </div>
        ))}

        {destinations.length < 15 && (
          <button type="button" className="btn-secondary" onClick={addDestination}>
            + Add a destination
          </button>
        )}
      </section>

      <section className="profile-section">
        <h2>Your travel style</h2>
        <label className="form-field">
          <span>What do you enjoy on vacation?</span>
          <input
            placeholder="e.g. beach, hiking, food & culture"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Typical budget</span>
          <input
            placeholder="e.g. $2,000-3,000 per trip"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Who do you usually travel with?</span>
          <input
            placeholder="e.g. 2 adults, or family of 4"
            value={travelers}
            onChange={(e) => setTravelers(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Any constraints?</span>
          <input
            placeholder="e.g. direct flights only, accessibility needs"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
          />
        </label>
      </section>

      <section className="profile-section">
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={digestOptIn}
            onChange={(e) => setDigestOptIn(e.target.checked)}
          />
          <span>Send me a weekly email digest based on my saved preferences</span>
        </label>
      </section>

      {error && <p className="form-error">{error}</p>}
      {status === "saved" && <p className="form-success">Saved.</p>}

      <button type="submit" className="btn-primary" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
