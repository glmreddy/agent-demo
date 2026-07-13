import TravelAgentWidget from "@/components/TravelAgentWidget";
import OpenWidgetButton from "@/components/OpenWidgetButton";
import {
  HeroIllustration,
  BeachIllustration,
  MountainIllustration,
  CityIllustration,
  CultureIllustration,
  ChatIcon,
  CompassIcon,
  TicketIcon,
  SparkleIcon,
  GlobeIcon,
  BoltIcon,
} from "@/components/illustrations";

const DESTINATIONS = [
  {
    art: <BeachIllustration />,
    title: "Tropical Beaches",
    text: "Warm coastlines, slow mornings, and water the color of glass.",
  },
  {
    art: <MountainIllustration />,
    title: "Mountain Escapes",
    text: "Trailheads, alpine air, and views worth the climb.",
  },
  {
    art: <CityIllustration />,
    title: "Historic Cities",
    text: "Old towns, great food, and a lot of walking.",
  },
  {
    art: <CultureIllustration />,
    title: "Cultural Journeys",
    text: "Temples, festivals, and stories older than the maps.",
  },
];

const STEPS = [
  {
    icon: <ChatIcon />,
    title: "Answer a few questions",
    text: "Departure city, dates, budget, and what you actually enjoy on a trip.",
  },
  {
    icon: <CompassIcon />,
    title: "Get matched to destinations",
    text: "Ranked suggestions grounded in live search, not a generic template.",
  },
  {
    icon: <TicketIcon />,
    title: "Ask anything before you book",
    text: "Flights, cancellation, baggage, or insurance — follow up right in the chat.",
  },
];

const WHY = [
  {
    icon: <SparkleIcon />,
    title: "Personalized",
    text: "Recommendations tailored to your budget, dates, and interests.",
  },
  {
    icon: <GlobeIcon />,
    title: "Up to date",
    text: "Destination and flight guidance grounded in live web search.",
  },
  {
    icon: <BoltIcon />,
    title: "Fast",
    text: "A full plan in the time it takes to answer nine questions.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">✦ AI-powered travel planning</span>
          <h1>
            Plan your next trip <em>before your coffee gets cold</em>
          </h1>
          <p className="hero-sub">
            Answer a few quick questions and get real destination ideas, real flight
            guidance, and straight answers on cancellation, baggage, and insurance —
            all grounded in live search, not guesswork.
          </p>
          <div className="hero-actions">
            <OpenWidgetButton className="btn-primary">Start planning</OpenWidgetButton>
            <a href="#destinations" className="btn-secondary">
              See destination ideas
            </a>
          </div>
        </div>
        <HeroIllustration className="hero-art" />
      </header>

      <section className="section" id="destinations">
        <div className="section-heading">
          <h2>Where travelers are headed</h2>
          <p>A starting point — tell the assistant what you're actually looking for.</p>
        </div>
        <div className="destinations">
          {DESTINATIONS.map((d) => (
            <div className="destination-card" key={d.title}>
              {d.art}
              <div className="destination-body">
                <h3>{d.title}</h3>
                <p>{d.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>How it works</h2>
        </div>
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li className="step" key={step.title}>
              <div className="step-icon-row">
                <span className="step-number">{i + 1}</span>
                <span className="step-icon">{step.icon}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Why Wanderlust</h2>
        </div>
        <div className="cards">
          {WHY.map((item) => (
            <div className="card" key={item.title}>
              <span className="card-icon">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <span>Wanderlust Travel</span>
        <span aria-hidden="true">·</span>
        <span>Built with Claude</span>
      </footer>

      <TravelAgentWidget />
    </main>
  );
}
