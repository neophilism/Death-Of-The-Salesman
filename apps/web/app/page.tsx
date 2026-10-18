export default function Home() {
  return <div className="shell">
    <aside aria-label="Workspace"><a className="brand" href="/">Salesroom<span>COMMAND CENTER</span></a>
      <nav aria-label="Primary"><a href="#main" aria-current="page">Overview</a></nav>
      <p className="phase">Application foundation<br /><strong>Offline mode</strong></p>
    </aside>
    <main id="main" tabIndex={-1}>
      <header><p className="eyebrow">YOUR WORKSPACE</p><h1>Overview</h1><p className="intro">A foundation for your sales and fundraising operations.</p></header>
      <p className="notice" role="status"><strong>Offline application shell</strong><span>Live integrations are disabled. No model calls or outbound messages are available.</span></p>
      <section className="grid" aria-label="Workspace summary">
        <article><p className="eyebrow">AGENT ACTIVITY</p><h2>No agents connected</h2><p>Live worker presence is not implemented yet.</p><span className="tag">Inactive</span></article>
        <article><p className="eyebrow">CAMPAIGNS</p><h2>No campaigns loaded</h2><p>Campaign management and persistence arrive in later work units.</p><span className="tag">Unavailable</span></article>
        <article><p className="eyebrow">SPENDING</p><h2>Paid operations disabled</h2><p>No funding, provider credentials, or billing integration is configured.</p><span className="tag">Default cap: USD 0</span></article>
      </section>
      <section className="empty" aria-labelledby="foundation"><p className="eyebrow">GETTING STARTED</p><h2 id="foundation">Your command center starts here</h2><p>This is the local application foundation. Authentication, assignment controls, conversations and revenue reporting are planned and unavailable in this shell.</p><p>No sales or fundraising results are being reported.</p></section>
    </main>
  </div>;
}
