import { Outlet } from '@tanstack/react-router';

import { Toaster } from '../ui/sonner';

import { Navbar } from './Navbar';

export function AppLayout() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1">
        <Outlet />
      </main>
      <Toaster />
    </>
  );
}
