import { Link, useParams } from '@tanstack/react-router'
import { SourceSwitcher } from './SourceSwitcher'

export function Navbar() {
  // @ts-ignore
  const { sourceId } = useParams({ strict: false })
  
  return (
     <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0B0C0E]/80 backdrop-blur-md supports-[backdrop-filter]:bg-[#0B0C0E]/60">
        <div className="flex h-14 items-center px-4 md:px-6 max-w-7xl mx-auto w-full">
          <div className="mr-6 flex items-center space-x-4">
             <Link to="/" className="font-display font-bold text-lg tracking-tight text-white">
              SESnoop
            </Link>
            <div className="h-6 w-px bg-white/10 mx-2" />
            <SourceSwitcher />
          </div>
          <div className="flex items-center space-x-6 text-sm font-medium">
             <Link
              to="/dashboard"
              className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
            >
              Dashboard
            </Link>
             {sourceId ? (
                <Link
                  to="/s/$sourceId/events"
                  params={{ sourceId }}
                  className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
                >
                  Events
                </Link>
             ) : (
                <span className="text-white/20 cursor-not-allowed" title="Select a source to view events">Events</span>
             )}
            <Link
              to="/sources"
              className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
            >
              Sources
            </Link>
            <Link
              to="/setup"
              className="text-white/60 transition-colors hover:text-white [&.active]:text-white"
            >
              Setup
            </Link>
          </div>
        </div>
      </nav>
  )
}
