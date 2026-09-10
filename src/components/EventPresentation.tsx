import { useEffect, useState } from 'react';

import { cn } from '../lib/utils';

const GRAVATAR_HASH_CACHE = new Map<string, Promise<string> | string>();

const eventBadgeClassNames: Record<string, string> = {
  Bounce: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  Complaint: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  Reject: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  RenderingFailure: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  Delivery: 'border-teal-400/20 bg-teal-400/10 text-teal-300',
  DeliveryDelay: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  Send: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
  Open: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  Click: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-300',
};

const eventDotClassNames: Record<string, string> = {
  Bounce: 'bg-rose-400',
  Complaint: 'bg-rose-400',
  Reject: 'bg-rose-400',
  RenderingFailure: 'bg-rose-400',
  Delivery: 'bg-teal-400',
  DeliveryDelay: 'bg-amber-400',
  Send: 'bg-blue-400',
  Open: 'bg-violet-400',
  Click: 'bg-indigo-400',
};

const eventTypeLabels: Record<string, string> = {
  DeliveryDelay: 'Delivery delay',
  RenderingFailure: 'Rendering failure',
};

export const formatEventType = (eventType: string) => eventTypeLabels[eventType] ?? eventType;

const RECIPIENT_AVATAR_CLASSES = [
  'bg-blue-500/15 text-blue-200 ring-blue-400/20',
  'bg-emerald-500/15 text-emerald-200 ring-emerald-400/20',
  'bg-amber-500/15 text-amber-200 ring-amber-400/20',
  'bg-fuchsia-500/15 text-fuchsia-200 ring-fuchsia-400/20',
  'bg-cyan-500/15 text-cyan-200 ring-cyan-400/20',
  'bg-rose-500/15 text-rose-200 ring-rose-400/20',
];

export const countBadgeClassName =
  'inline-flex shrink-0 items-center rounded-md bg-white/5 px-2 py-1 text-xs font-medium whitespace-nowrap text-white/45 tabular-nums';

const fullDateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'long',
});
const compactDateTime = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export const formatDateTime = (value?: number | null) =>
  value == null ? '—' : fullDateTime.format(value);

export const formatCompactEventTime = (value?: number | null) =>
  value == null ? '—' : compactDateTime.format(value);

export const eventBadgeClassName = (eventType: string) =>
  eventBadgeClassNames[eventType] ?? 'border-white/10 bg-white/5 text-white/70';

export const eventDotClassName = (eventType: string) =>
  eventDotClassNames[eventType] ?? 'bg-white/40';

export function EventBadge({ eventType, className }: { eventType: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-md border px-2 py-1 text-xs leading-4 font-medium',
        eventBadgeClassName(eventType),
        className,
      )}
    >
      <span className="truncate">{formatEventType(eventType)}</span>
    </span>
  );
}

const hashString = (value: string) => {
  let hash = 0;
  for (const character of value) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) % Number.MAX_SAFE_INTEGER;
  }
  return Math.abs(hash);
};

const recipientAvatarClassName = (email: string) =>
  RECIPIENT_AVATAR_CLASSES[hashString(email.toLowerCase()) % RECIPIENT_AVATAR_CLASSES.length];

const recipientInitial = (email: string) => email.trim().charAt(0).toUpperCase() || '?';

const createGravatarHash = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !window.crypto?.subtle) {
    return null;
  }

  const cachedHash = GRAVATAR_HASH_CACHE.get(normalizedEmail);
  if (typeof cachedHash === 'string') {
    return cachedHash;
  }
  if (cachedHash) {
    return cachedHash;
  }

  const hashPromise = window.crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(normalizedEmail))
    .then((hashBuffer) =>
      [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
    );

  GRAVATAR_HASH_CACHE.set(normalizedEmail, hashPromise);

  try {
    const hash = await hashPromise;
    GRAVATAR_HASH_CACHE.set(normalizedEmail, hash);
    return hash;
  } catch (error) {
    GRAVATAR_HASH_CACHE.delete(normalizedEmail);
    throw error;
  }
};

const gravatarUrl = (hash: string) => `https://gravatar.com/avatar/${hash}?s=48&d=404`;

export function RecipientAvatar({ email }: { email: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    setAvatarUrl(null);
    setImageFailed(false);

    createGravatarHash(email)
      .then((hash) => {
        if (isCurrent && hash) {
          setAvatarUrl(gravatarUrl(hash));
        }
      })
      .catch(() => {
        if (isCurrent) {
          setImageFailed(true);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [email]);

  const showImage = avatarUrl && !imageFailed;

  return (
    <span
      className={cn(
        'relative inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1',
        recipientAvatarClassName(email),
      )}
      aria-hidden="true"
    >
      <span className="text-[10px] font-semibold">{recipientInitial(email)}</span>
      {showImage ? (
        <img
          src={avatarUrl}
          alt=""
          className="absolute inset-0 size-full rounded-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : null}
    </span>
  );
}
