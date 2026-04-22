'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { getSocket } from '@/lib/socket-client';
import { CheckCircle2, XCircle, QrCode, Loader2, RefreshCw } from 'lucide-react';

export default function WhatsAppAdmin() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    load();

    const socket = getSocket();
    const onQr = (p: any) => setData((prev: any) => ({ ...prev, whatsappStatus: 'qr', whatsappSession: p.qrDataUrl }));
    const onStatus = (p: any) => setData((prev: any) => ({ ...prev, whatsappStatus: p.status, whatsappSession: null }));

    socket.on('whatsapp.qr', onQr);
    socket.on('whatsapp.status', onStatus);

    return () => {
      socket.off('whatsapp.qr', onQr);
      socket.off('whatsapp.status', onStatus);
    };
  }, []);

  async function load() {
    try {
      setBusy(true);
      const res = await apiFetch('/api/v1/admin/whatsapp');
      setData(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(enabled: boolean) {
    try {
      setBusy(true);
      await apiFetch('/api/v1/admin/whatsapp', {
        method: 'POST',
        body: JSON.stringify({ action: 'toggle', enabled })
      });
      load();
    } catch (e: any) {
      alert(e.message);
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm('Deseja realmente desconectar o WhatsApp?')) return;
    try {
      setBusy(true);
      await apiFetch('/api/v1/admin/whatsapp', {
        method: 'POST',
        body: JSON.stringify({ action: 'disconnect' })
      });
      load();
    } catch (e: any) {
      alert(e.message);
      setBusy(false);
    }
  }

  if (!data && busy) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto mb-2" /> Carregando...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Conexão WhatsApp</h1>
          <p className="text-gray-400 text-sm">Envie resumos de pedidos automaticamente para os clientes.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${data?.whatsappEnabled ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}>
            {data?.whatsappEnabled ? 'HABILITADO' : 'DESABILITADO'}
          </span>
          <button
            onClick={() => toggle(!data.whatsappEnabled)}
            disabled={busy}
            className={`btn ${data?.whatsappEnabled ? 'bg-red-600/10 text-red-400 hover:bg-red-600/20' : 'btn-primary'}`}
          >
            {data?.whatsappEnabled ? 'Desativar' : 'Ativar Serviço'}
          </button>
        </div>
      </header>

      {data?.whatsappEnabled && (
        <div className="grid gap-6">
          <section className="card p-6 border-brand-600/20 bg-brand-600/5">
            <div className="flex items-center gap-4 mb-6">
              <div className={`p-3 rounded-2xl ${data.whatsappStatus === 'connected' ? 'bg-green-600/20 text-green-400' : 'bg-amber-600/20 text-amber-400'}`}>
                {data.whatsappStatus === 'connected' ? <CheckCircle2 size={32} /> : <QrCode size={32} />}
              </div>
              <div>
                <h2 className="text-lg font-bold">Status da Conexão</h2>
                <p className="text-sm text-gray-400">
                  {data.whatsappStatus === 'connected' ? 'WhatsApp conectado e pronto para uso.' : 
                   data.whatsappStatus === 'qr' ? 'Aguardando leitura do QR Code.' : 'Iniciando serviço...'}
                </p>
              </div>
            </div>

            {data.whatsappStatus === 'qr' && data.whatsappSession && (
              <div className="flex flex-col items-center bg-white p-6 rounded-2xl w-fit mx-auto shadow-2xl">
                <img src={data.whatsappSession} alt="WhatsApp QR Code" className="w-64 h-64" />
                <p className="text-black text-sm font-bold mt-4 text-center">
                  Abra o WhatsApp no seu celular,<br />vá em Aparelhos Conectados e escaneie.
                </p>
              </div>
            )}

            {data.whatsappStatus === 'connected' && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={disconnect}
                  disabled={busy}
                  className="btn bg-red-600/10 text-red-400 hover:bg-red-600/20 flex items-center gap-2"
                >
                  <XCircle size={18} /> Desconectar WhatsApp
                </button>
              </div>
            )}

            {data.whatsappStatus === 'disconnected' && data.whatsappEnabled && (
              <div className="text-center py-8">
                <Loader2 className="animate-spin mx-auto mb-4 text-brand-500" size={40} />
                <p className="text-gray-400">Iniciando motor do WhatsApp...</p>
                <button onClick={load} className="btn btn-ghost mt-4 flex items-center gap-2 mx-auto">
                  <RefreshCw size={16} /> Atualizar Status
                </button>
              </div>
            )}
          </section>

          <section className="card p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-400" />
              Funcionalidades Ativas
            </h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="text-brand-500">•</span>
                Envio de resumo do pedido assim que o cliente finaliza.
              </li>
              <li className="flex gap-2">
                <span className="text-brand-500">•</span>
                Link do pedido para acompanhamento em tempo real.
              </li>
              <li className="flex gap-2">
                <span className="text-brand-500">•</span>
                Notificação de mudanças de status (em breve).
              </li>
            </ul>
          </section>
        </div>
      )}

      {!data?.whatsappEnabled && (
        <div className="card p-12 text-center bg-gray-900/20 border-dashed border-gray-800">
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
            <RefreshCw size={40} />
          </div>
          <h2 className="text-xl font-bold mb-2">Serviço Desativado</h2>
          <p className="text-gray-500 max-w-sm mx-auto">
            Ative o serviço de WhatsApp para começar a enviar resumos de pedidos automaticamente para seus clientes.
          </p>
        </div>
      )}
    </div>
  );
}
