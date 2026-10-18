const services = [
  { name: "Web console", status: "Ready" },
  { name: "API", status: "Local only" },
  { name: "Worker", status: "Disabled" },
];

export default function Home() {
  return (
    <main>
      <header>
        <p className="eyebrow">Development shell</p>
        <h1>Death Of The Salesman</h1>
        <p className="summary">
          The workspace is ready for zero-cost local development. No models, messages, or paid
          integrations are active.
        </p>
      </header>
      <section aria-labelledby="services-heading">
        <h2 id="services-heading">Runtime boundaries</h2>
        <dl>
          {services.map((service) => (
            <div key={service.name}>
              <dt>{service.name}</dt>
              <dd>{service.status}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
