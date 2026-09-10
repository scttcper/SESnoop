import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

export const focusClassName =
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-blue-400';
export const panelClassName = 'min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.02]';
export const sectionHeadingClassName = 'text-sm font-semibold text-white/90';
export const labelClassName = 'block text-xs font-medium text-white/60';
export const tableHeaderClassName = 'text-xs font-medium text-white/40';
export const errorClassName =
  'rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-300';
export const controlClassName =
  'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-0 text-xs leading-4 font-medium whitespace-nowrap transition-colors focus-visible:border-blue-400 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-blue-400 focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0';
export const secondaryControlClassName =
  'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white';
export const primaryControlClassName =
  'border-blue-400/20 bg-blue-400/10 text-blue-200 hover:bg-blue-400/20';
export const dangerControlClassName =
  'border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20';
export const inputClassName =
  'h-9 w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-0 text-sm text-white/85 placeholder:text-white/30 focus-visible:border-blue-400 focus-visible:ring-blue-400/20';

export function PageLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-[calc(100vh-3.5rem)] px-4 py-7 sm:px-6 sm:py-9 lg:px-8', className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  actions,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-center justify-between gap-5">
      <div className="min-w-0 flex-1 basis-48">
        <h1 className="text-2xl font-semibold tracking-tight break-words text-white sm:text-3xl">
          {title}
        </h1>
        {children}
      </div>
      {actions ? (
        <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
