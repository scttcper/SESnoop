import { Link, ToOptions } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { useActiveSourceId } from '../../lib/use-active-source';

import { SourceSwitcher } from './SourceSwitcher';

export function Navbar() {
  const sourceId = useActiveSourceId();
  const sourceIdStr = sourceId?.toString();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = useMemo((): Array<ToOptions & { label: string }> => {
    if (sourceIdStr) {
      return [
        {
          label: 'Dashboard',
          to: '/s/$sourceId/dashboard',
          params: { sourceId: sourceIdStr },
        },
        {
          label: 'Events',
          to: '/s/$sourceId/events',
          params: { sourceId: sourceIdStr },
        },
        {
          label: 'Setup',
          to: '/s/$sourceId/setup',
          params: { sourceId: sourceIdStr },
        },
        {
          label: 'Settings',
          to: '/s/$sourceId/settings',
          params: { sourceId: sourceIdStr },
        },
      ];
    }

    return [
      {
        label: 'Dashboard',
        to: '/dashboard',
      },
      {
        label: 'Sources',
        to: '/sources',
      },
    ];
  }, [sourceIdStr]);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0B0C0E]/80 backdrop-blur-md supports-[backdrop-filter]:bg-[#0B0C0E]/60">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="font-display text-lg font-bold tracking-tight text-white">
              SESnoop
            </Link>
            <div className="hidden h-6 w-px bg-white/10 sm:block" />
            <SourceSwitcher />
            <div className="hidden items-center space-x-6 text-sm font-medium sm:flex sm:pl-1">
              {links.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  params={link.params}
                  className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
                >
                  {link.label}
                </Link>
              ))}
              {!sourceIdStr ? (
                <span
                  className="cursor-not-allowed text-white/20"
                  title="Select a source to view events"
                >
                  Events
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            aria-controls="mobile-menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-md p-2 text-white/70 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 sm:hidden"
          >
            <span className="sr-only">Toggle menu</span>
            {mobileOpen ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
                className="size-6"
              >
                <path d="M6 18 18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
                className="size-6"
              >
                <path
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
        <div id="mobile-menu" className={`sm:hidden ${mobileOpen ? 'block' : 'hidden'}`}>
          <div className="space-y-2 border-t border-white/10 px-1 pt-3 pb-4 text-base font-medium">
            {links.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                params={link.params}
                onClick={() => setMobileOpen(false)}
                className="block rounded-md px-3 py-2 text-white/70 transition hover:bg-white/5 hover:text-white [&.active]:bg-white/5 [&.active]:text-white"
              >
                {link.label}
              </Link>
            ))}
            {!sourceIdStr ? (
              <span className="block cursor-not-allowed rounded-md px-3 py-2 text-white/30">
                Events
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
