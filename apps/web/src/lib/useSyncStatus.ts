import { useEffect, useState } from 'react';
import { getSyncStatus, SYNC_EVENT, type SyncStatusSnapshot } from './sync.js';

export function useSyncStatus(): SyncStatusSnapshot {
  const [status, setStatus] = useState(getSyncStatus);

  useEffect(() => {
    const onStatus = (event: Event) => {
      setStatus((event as CustomEvent<SyncStatusSnapshot>).detail ?? getSyncStatus());
    };
    window.addEventListener(SYNC_EVENT, onStatus);
    return () => window.removeEventListener(SYNC_EVENT, onStatus);
  }, []);

  return status;
}
