import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const COLOR_STYLES: Record<string, string> = {
  purple: 'bg-purple-500/80 shadow-[0_0_8px_rgba(var(--color-purple-500),0.5)]',
  blue: 'bg-blue-500/80 shadow-[0_0_8px_rgba(var(--color-blue-500),0.5)]',
  cyan: 'bg-cyan-500/80 shadow-[0_0_8px_rgba(var(--color-cyan-500),0.5)]',
  green: 'bg-green-500/80 shadow-[0_0_8px_rgba(var(--color-green-500),0.5)]',
  red: 'bg-red-500/80 shadow-[0_0_8px_rgba(var(--color-red-500),0.5)]',
  orange: 'bg-orange-500/80 shadow-[0_0_8px_rgba(var(--color-orange-500),0.5)]',
  yellow: 'bg-yellow-500/80 shadow-[0_0_8px_rgba(var(--color-yellow-500),0.5)]',
  gray: 'bg-gray-500/80 shadow-[0_0_8px_rgba(var(--color-gray-500),0.5)]',
};

export const COLORS = Object.keys(COLOR_STYLES);
