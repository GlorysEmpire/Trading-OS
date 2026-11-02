import React from 'react';

/** Shared page heading: a plain title and one sentence that explains the
 * screen to anyone, trader or not. */
export const PageTitle: React.FC<{
  icon: React.ElementType;
  title: string;
  description: string;
  meta?: React.ReactNode;
}> = ({ icon: Icon, title, description, meta }) => (
  <div className="flex items-start gap-3 min-w-0">
    <span className="grid place-items-center w-10 h-10 rounded-xl bg-sky-950/50 text-sky-400 border border-sky-900/60 shrink-0">
      <Icon className="w-5 h-5" />
    </span>
    <div className="min-w-0">
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="text-sm text-ink-3 mt-0.5 max-w-3xl leading-relaxed">{description}</p>
      {meta && <div className="mt-1 text-sm text-ink-2">{meta}</div>}
    </div>
  </div>
);
