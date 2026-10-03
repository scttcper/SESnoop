import { useParams } from '@tanstack/react-router';
import { useEffect } from 'react';

const STORAGE_KEY = 'sesnoop_active_source_id';

export const readStoredSourceId = () => {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

/** The source in the URL, or the last one viewed on pages outside a source. */
export function useActiveSourceId() {
  const { sourceId } = useParams({ strict: false });

  useEffect(() => {
    if (sourceId) {
      try {
        localStorage.setItem(STORAGE_KEY, String(sourceId));
      } catch {
        // Storage is optional; the URL still identifies the source.
      }
    }
  }, [sourceId]);

  return sourceId ?? readStoredSourceId();
}
