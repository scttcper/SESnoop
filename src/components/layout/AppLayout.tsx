import { Outlet } from '@tanstack/react-router'
import { Navbar } from './Navbar'

export function AppLayout() {
  return (
    <>
        <Navbar />
        <main className="flex-1 max-w-7xl mx-auto w-full">
            <Outlet />
        </main>
    </>
  )
}
