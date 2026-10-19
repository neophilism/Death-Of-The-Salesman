const services = [
  { name: "Web console", status: "Ready", state: "ready" },
  { name: "API", status: "Local only", state: "waiting" },
  { name: "Worker", status: "Disabled", state: "inactive" },
] as const;

export default function Home() {
  return (
    <main className="shell">
      <header className="shell-header">
        <div className="shell-copy">
          <p className="eyebrow">Development shell</p>
          <h1>Death Of The Salesman</h1>
          <p className="summary">
            The workspace is ready for zero-cost local development. No models, messages, or paid
            integrations are active.
          </p>
        </div>
        <span className="mode-badge">Zero-cost mode</span>
      </header>
      <section className="runtime" aria-labelledby="services-heading">
        <div className="runtime-heading">
          <h2 id="services-heading">Runtime boundaries</h2>
          <p className="runtime-note">Local development state</p>
        </div>
        <dl className="runtime-list">
          {services.map((service) => (
            <div className="runtime-row" key={service.name}>
              <dt>{service.name}</dt>
              <dd className="status" data-state={service.state}>
                {service.status}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
