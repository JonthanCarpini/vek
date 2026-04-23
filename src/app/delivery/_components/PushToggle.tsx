'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import {
  checkPushSupport,
  getPushConfig,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '../_lib/push';

/**
 * Toggle de notificações push para o cliente.
 * Só aparece se o browser suportar E a loja tiver configurado VAPID.
 */
export function PushToggle() {
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sup = checkPushSupport();
      if (!sup.supported) {
        setReady(true);
        return;
      }
      const cfg = await getPushConfig();
      if (!cfg.enabled) {
        setReady(true);
        return;
      }
      const sub = await getExistingSubscription();
      setSubscribed(!!sub);
      setAvailable(true);
      setReady(true);
    })();
  }, []);

  if (!ready) return null;
  if (!available) return null;

  const handleToggle = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
        setMsg('Notificações desativadas.');
      } else {
        const res = await subscribeToPush();
        if (res.ok) {
          setSubscribed(true);
          setMsg('Pronto! Você vai receber notificações do seu pedido.');
        } else {
          setMsg(res.error);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden">
      <button
        onClick={handleToggle}
        disabled={busy}
        className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 disabled:opacity-70 text-left"
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          subscribed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
        }`}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" />
            : subscribed ? <Bell className="w-5 h-5" />
            : <BellOff className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-800">
            {subscribed ? 'Notificações ativadas' : 'Ativar notificações'}
          </div>
          <div className="text-xs text-gray-500">
            {subscribed
              ? 'Avisamos no seu celular quando o pedido mudar de status.'
              : 'Receba alerta quando o pedido for confirmado, sair para entrega, etc.'}
          </div>
        </div>
      </button>
      {msg && (
        <div className="px-4 pb-3 text-xs text-gray-600">{msg}</div>
      )}
    </div>
  );
}
