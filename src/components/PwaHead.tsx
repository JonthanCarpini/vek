'use client';
import { useEffect } from 'react';

export function PwaHead({ manifest }: { manifest: string }) {
  useEffect(() => {
    const links = document.querySelectorAll('link[rel="manifest"]');
    links.forEach(l => l.remove());

    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifest;
    document.head.appendChild(link);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      }).catch(() => {});
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
  }, [manifest]);

  return null;
}
