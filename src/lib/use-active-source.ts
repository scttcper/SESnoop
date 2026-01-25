import { useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'sesnoop_active_source_id';

export function useActiveSourceId() {
  const { sourceId: paramSourceId } = useParams({ strict: false });
  const [storedSourceId, setStoredSourceId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  // If there is a param, it wins and updates storage
  useEffect(() => {
    if (paramSourceId) {
      localStorage.setItem(STORAGE_KEY, paramSourceId);
      setStoredSourceId(paramSourceId);
    }
  }, [paramSourceId]);

  // If we are on a global page (no param), we use stored ID
  // If we are on a source page (param), we use param ID (which matches stored)
  return paramSourceId ? Number(paramSourceId) : storedSourceId ? Number(storedSourceId) : null;
}
