// Registro de push nativo via Capacitor (sem import direto do plugin).
// Acessa window.Capacitor.Plugins.PushNotifications que é injetado pelo WebView.
// Em browser regular é no-op automático.

interface CapacitorPushPlugin {
  requestPermissions(): Promise<{ receive: 'granted' | 'denied' | 'prompt' }>;
  register(): Promise<void>;
  addListener(event: 'registration', cb: (data: { value: string }) => void): void;
  addListener(event: 'pushNotificationActionPerformed', cb: (action: any) => void): void;
}

function getPushPlugin(): CapacitorPushPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as any).Capacitor;
  if (!cap?.Plugins?.PushNotifications) return null;
  return cap.Plugins.PushNotifications as CapacitorPushPlugin;
}

export function isCapacitorApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor;
}

/**
 * Registra push nativo (FCM) via Capacitor e envia o token ao backend.
 * Chamado após login do cliente. No-op silencioso em browser regular.
 */
export async function registerCapacitorPush(customerId: string): Promise<void> {
  const plugin = getPushPlugin();
  if (!plugin) return;

  try {
    const perm = await plugin.requestPermissions();
    if (perm.receive !== 'granted') return;

    await plugin.register();

    plugin.addListener('registration', async (data) => {
      try {
        await fetch('/api/v1/delivery/fcm', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: data.value }),
        });
      } catch {}
    });

    plugin.addListener('pushNotificationActionPerformed', (action) => {
      const url: string = action?.notification?.data?.url || '';
      if (url && typeof window !== 'undefined') {
        window.location.href = url;
      }
    });
  } catch (e) {
    console.warn('[CapacitorPush] registration failed:', e);
  }
}
