import React from 'react';

/** Shared page heading: a plain title and one sentence that explains the
 * screen to anyone, trader or not. */
export const PageTitle: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  meta?: React.ReactNode;
}> = ({ icon: Icon, title, description, meta }) => (
  <div className="tos-page-title flex min-w-0 items-start gap-3.5">
    <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-raised" aria-hidden="true">
      <Icon className="size-5 text-accent" />
    </span>
    <div className="min-w-0">
      <h1 className="text-[1.5rem] sm:text-[1.75rem] font-semibold tracking-[-0.025em] leading-tight text-ink">{title}</h1>
      <p className="text-sm text-ink-3 mt-1 max-w-3xl leading-relaxed">{description}</p>
      {meta && <div className="mt-1.5 text-sm text-ink-2">{meta}</div>}
    </div>
  </div>
);
