import React from 'react';

/** Shared page heading: a plain title and one sentence that explains the
 * screen to anyone, trader or not. */
export const PageTitle: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  meta?: React.ReactNode;
}> = ({ icon: Icon, title, description, meta }) => (
  <div className="tos-rise flex items-start gap-3.5 min-w-0">
    <span className="relative grid place-items-center w-11 h-11 rounded-2xl shrink-0 ring-1 ring-inset ring-line-strong shadow-[inset_0_1px_0_var(--tos-card-highlight),0_10px_24px_-12px_rgba(45,212,191,.55)]"
      style={{ background: 'linear-gradient(160deg, color-mix(in oklab, var(--tos-accent) 22%, transparent), color-mix(in oklab, var(--tos-accent) 6%, transparent))' }}>
      <Icon className="w-5 h-5 text-accent" />
    </span>
    <div className="min-w-0">
      <h1 className="text-[1.5rem] sm:text-[1.75rem] font-semibold tracking-[-0.025em] leading-tight text-ink">{title}</h1>
      <p className="text-sm text-ink-3 mt-1 max-w-3xl leading-relaxed">{description}</p>
      {meta && <div className="mt-1.5 text-sm text-ink-2">{meta}</div>}
    </div>
  </div>
);
