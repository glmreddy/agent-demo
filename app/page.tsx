import TravelAgentWidget from "@/components/TravelAgentWidget";

export default function Home() {
  return (
    <main>
      <header className="hero">
        <h1>Wanderlust Travel</h1>
        <p>Real destinations. Real flights. Planned in minutes.</p>
      </header>

      <section className="section">
        <h2>How it works</h2>
        <ol>
          <li>Click the floating button in the corner.</li>
          <li>Answer a few quick questions about your trip.</li>
          <li>Get destination ideas and flight guidance, grounded in live search.</li>
        </ol>
      </section>

      <section className="section">
        <h2>Why Wanderlust</h2>
        <div className="cards">
          <div className="card">
            <h3>Personalized</h3>
            <p>Recommendations tailored to your budget, dates, and interests.</p>
          </div>
          <div className="card">
            <h3>Up to date</h3>
            <p>Destination and flight guidance grounded in live web search.</p>
          </div>
          <div className="card">
            <h3>Fast</h3>
            <p>A full plan in the time it takes to answer nine questions.</p>
          </div>
        </div>
      </section>

      <footer className="footer">Built with Claude</footer>

      <TravelAgentWidget />
    </main>
  );
}
