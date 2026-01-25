import { Link } from '@tanstack/react-router';

import { useActiveSourceId } from '../../lib/use-active-source';

import { SourceSwitcher } from './SourceSwitcher';

export function Navbar() {
  const sourceId = useActiveSourceId();
  const sourceIdStr = sourceId?.toString();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0B0C0E]/80 backdrop-blur-md supports-[backdrop-filter]:bg-[#0B0C0E]/60">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center px-4 md:px-6">
        <div className="mr-6 flex items-center space-x-4">
          <Link to="/" className="font-display text-lg font-bold tracking-tight text-white">
            SESnoop
          </Link>
          <div className="mx-2 h-6 w-px bg-white/10" />
          <SourceSwitcher />
        </div>
        <div className="flex items-center space-x-6 text-sm font-medium">
          {sourceIdStr ? (
            <Link
              to="/s/$sourceId/dashboard"
              params={{ sourceId: sourceIdStr }}
              className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/dashboard"
              className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
            >
              Dashboard
            </Link>
          )}
          {sourceIdStr ? (
            <>
              <Link
                to="/s/$sourceId/events"
                params={{ sourceId: sourceIdStr }}
                className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
              >
                Events
              </Link>
              <Link
                to="/s/$sourceId/setup"
                params={{ sourceId: sourceIdStr }}
                className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
              >
                Setup
              </Link>
              <Link
                to="/s/$sourceId/settings"
                params={{ sourceId: sourceIdStr }}
                className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
              >
                Settings
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/sources"
                className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
              >
                Sources
              </Link>
              <span
                className="cursor-not-allowed text-white/20"
                title="Select a source to view events"
              >
                Events
              </span>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
