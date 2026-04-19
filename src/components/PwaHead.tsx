'use client';
import { useEffect } from 'react';

export function PwaHead({ manifest }: { manifest: string }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      }).catch(() => {});
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
  }, [manifest]);

  return (
    <link rel="manifest" href={manifest} />
  );
}
