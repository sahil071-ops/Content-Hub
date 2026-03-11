'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * VersionUpdater
 *
 * Registers the service worker and listens for APP_UPDATED messages.
 * When a new deployment is detected:
 * 1. Shows a toast notification
 * 2. Waits 2 seconds
 * 3. Reloads the page to get the latest version
 *
 * This ensures users always run the latest code without manually refreshing.
 */
export function VersionUpdater() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Register service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[VersionUpdater] Service worker registered:', registration.scope);
      })
      .catch((err) => {
        console.warn('[VersionUpdater] Service worker registration failed:', err);
      });

    // Listen for update messages from the SW
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'APP_UPDATED') {
        const { version } = event.data;

        toast.info(`App updated to v${version}`, {
          description: 'Reloading in 2 seconds to apply the latest changes...',
          duration: 3000,
        });

        // Reload after a brief delay so the user sees the notification
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  // Renders nothing — pure side-effect component
  return null;
}
