import type { ButtonHTMLAttributes, ReactNode } from "react";

export type RuntimeState = "ready" | "waiting" | "inactive";

export function StatusChip({ state, label }: Readonly<{ state: RuntimeState; label: string }>) {
  return (
    <span className="status-chip" data-state={state}>
      <span className="status-light" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function CommandButton({
  children,
  ...props
}: Readonly<ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }>) {
  return (
    <button className="command-button" type="button" {...props}>
      {children}
    </button>
  );
}

export function AgentCard({
  name,
  role,
  summary,
  status,
  statusLabel,
}: Readonly<{
  name: string;
  role: string;
  summary: string;
  status: RuntimeState;
  statusLabel: string;
}>) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <article className="agent-card" aria-labelledby={`agent-${initials}`}>
      <div className="avatar" aria-hidden="true">
        {initials}
      </div>
      <div className="agent-copy">
        <div className="agent-heading">
          <div>
            <h3 id={`agent-${initials}`}>{name}</h3>
            <p>{role}</p>
          </div>
          <StatusChip state={status} label={statusLabel} />
        </div>
        <p className="agent-summary">{summary}</p>
        <CommandButton aria-label={`Review ${name} details`}>Review details</CommandButton>
      </div>
    </article>
  );
}

export function AccessiblePopover({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <details className="popover">
      <summary>{label}</summary>
      <div className="popover-panel">{children}</div>
    </details>
  );
}

export function MetricBars({
  id,
  title,
  values,
}: Readonly<{ id: string; title: string; values: readonly { label: string; value: number; maximum: number }[] }>) {
  return (
    <figure className="metric-chart" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`}>{title}</figcaption>
      <dl>
        {values.map((item) => {
          const percent = item.maximum > 0 ? Math.min(100, Math.max(0, (item.value / item.maximum) * 100)) : 0;
          return (
            <div className="metric-row" key={item.label}>
              <dt>{item.label}</dt>
              <dd>
                <span className="metric-value">{item.value} of {item.maximum}</span>
                <span className="metric-track" aria-hidden="true">
                  <span className="metric-fill" style={{ width: `${percent}%` }} />
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </figure>
  );
}

export function LoadingSkeleton({ label }: Readonly<{ label: string }>) {
  return (
    <div className="skeleton" role="status" aria-live="polite">
      <span>{label}</span>
      <span className="skeleton-lines" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

export function OverlayPanel({
  id,
  title,
  children,
}: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section className="overlay-panel" role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}>
      <div className="overlay-heading">
        <h3 id={`${id}-title`}>{title}</h3>
        <CommandButton aria-label={`Close ${title}`}>Close</CommandButton>
      </div>
      {children}
    </section>
  );
}
