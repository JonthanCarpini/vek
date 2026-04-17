'use client';
import { useEffect } from 'react';

export function PwaHead({ manifest }: { manifest: string }) {
  useEffect(() => {
    // Remove existing manifest links
    const links = document.querySelectorAll('link[rel="manifest"]');
    links.forEach(l => l.remove());

    // Add new manifest link
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifest;
    document.head.appendChild(link);
  }, [manifest]);

  return null;
}
