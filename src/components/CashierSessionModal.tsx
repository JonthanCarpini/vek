'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/staff-client';
import { formatBRL } from '@/lib/format';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'Pix',
  voucher: 'Vale',
  other: 'Outro',
};

export function CashierSessionModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [enabledMethods, setEnabledMethods] = useState<string[]>(['cash', 'credit', 'debit', 'pix']);

  // Form de novo pagamento
  const [method, setMethod] = useState<string>('cash');
  const [amount, setAmount] = useState<string>('');
  const [changeGiven, setChangeGiven] = useState<string>('');
  const [partLabel, setPartLabel] = useState<string>('');
  const [reference, setReference] = useState<string>('');

  // Dividir a conta
  const [splitN, setSplitN] = useState<number>(2);

  useEffect(() => { load(); loadMethods(); }, [sessionId]);
  async function load() {
    try { const d = await apiFetch(`/api/v1/cashier/sessions/${sessionId}`); setData(d.session); }
    catch (e: any) { setErr(e.message); }
  }
  async function loadMethods() {
    try {
      const d = await apiFetch('/api/v1/admin/settings');
      const list = (d.unit?.paymentMethods || 'cash,credit,debit,pix')
        .split(',').map((s: string) => s.trim()).filter(Boolean);
      if (list.length > 0) {
        setEnabledMethods(list);
        if (!list.includes(method)) setMethod(list[0]);
      }
    } catch {}
  }

  async function addPayment(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null); setBusy(true);
    try {
      const body: any = {
        method,
        amount: Number(amount.replace(',', '.')),
        changeGiven: Number((changeGiven || '0').replace(',', '.')),
      };
      if (partLabel) body.partLabel = partLabel;
      if (reference) body.reference = reference;
      await apiFetch(`/api/v1/cashier/sessions/${sessionId}/payments`, { method: 'POST', body: JSON.stringify(body) });
      setAmount(''); setChangeGiven(''); setPartLabel(''); setReference('');
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function removePayment(pid: string) {
    if (!confirm('Remover pagamento?')) return;
    setBusy(true);
    try { await apiFetch(`/api/v1/cashier/sessions/${sessionId}/payments/${pid}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function applySplit() {
    if (!data || splitN < 2) return;
    const perPart = Number(((data.remaining || data.subtotal) / splitN).toFixed(2));
    if (!confirm(`Dividir restante em ${splitN} partes de ${formatBRL(perPart)}? Serão criados ${splitN} pagamentos em dinheiro (ajuste método depois).`)) return;
    setBusy(true); setErr(null);
    try {
      for (let i = 1; i <= splitN; i++) {
        await apiFetch(`/api/v1/cashier/sessions/${sessionId}/payments`, {
          method: 'POST',
          body: JSON.stringify({ method: 'cash', amount: perPart, partLabel: `Pessoa ${i}` }),
        });
      }
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function closeSession(force = false) {
    if (!confirm(force ? 'Fechar com diferença? Isto será registrado.' : 'Fechar conta desta mesa?')) return;
    setBusy(true); setErr(null);
    try {
      await apiFetch(`/api/v1/cashier/sessions/${sessionId}/close`, {
        method: 'POST',
        body: JSON.stringify({ force }),
      });
      onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  function sendWhatsAppReceipt() {
    if (!data) return;
    const activeOrders = data.orders.filter((o: any) => o.status !== 'cancelled');
    
    let text = `*RESUMO DA CONTA - MESA ${data.table?.number}*\n`;
    text += `Cliente: ${data.customerName}\n`;
    text += `--------------------------------\n`;

    activeOrders.forEach((o: any) => {
      text += `*Pedido #${o.sequenceNumber}*\n`;
      o.items.forEach((i: any) => {
        text += `${i.quantity}x ${i.name} - ${formatBRL(Number(i.unitPrice) * i.quantity)}\n`;
      });
      text += `\n`;
    });

    text += `--------------------------------\n`;
    text += `Subtotal: ${formatBRL(data.subtotal)}\n`;
    if (data.serviceFee > 0) {
      text += `Taxa de serviço: ${formatBRL(data.serviceFee)}\n`;
    }
    text += `*TOTAL: ${formatBRL(data.total)}*\n\n`;
    text += `Obrigado pela preferência! 😊`;

    const encoded = encodeURIComponent(text);
    const phone = data.customerPhone?.replace(/\D/g, '');
    window.open(`https://wa.me/${phone ? `55${phone}` : ''}?text=${encoded}`, '_blank');
  }

  if (!data) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="card p-6">Carregando...</div>
      </div>
    );
  }

  const remaining = Number(data.remaining || 0);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <div>
            <div className="text-xs text-gray-500">Mesa {data.table?.number}{data.table?.label ? ` · ${data.table.label}` : ''}</div>
            <div className="text-xl font-bold">{data.customerName || 'Cliente'}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost">Fechar</button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Coluna 1: Itens + Resumo */}
          <div className="space-y-4">
            <div className="card p-4">
              <div className="font-semibold mb-2">Pedidos</div>
              <div className="space-y-3 text-sm">
                {data.orders.map((o: any) => (
                  <div key={o.id} className="border border-gray-800 rounded p-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>#{o.sequenceNumber} · {o.status}</span>
                      <span>{new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {o.items.map((i: any) => (
                      <div key={i.id} className="flex justify-between">
                        <span>{i.quantity}× {i.name}</span>
                        <span>{formatBRL(Number(i.unitPrice) * i.quantity)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {data.orders.length === 0 && <div className="text-gray-500">Sem pedidos</div>}
              </div>
            </div>

            <div className="card p-4 space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><b>{formatBRL(data.subtotal)}</b></div>
              {data.serviceFee > 0 && (
                <div className="flex justify-between text-gray-400 text-sm">
                  <span>Taxa de serviço</span>
                  <span>{formatBRL(data.serviceFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-green-400"><span>Pago</span><b>{formatBRL(data.paid)}</b></div>
              <div className="flex justify-between text-lg border-t border-gray-800 pt-1 mt-1">
                <span>Total</span>
                <b className={remaining > 0 ? 'text-amber-400' : 'text-green-400'}>{formatBRL(data.total)}</b>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between text-sm italic opacity-80">
                  <span>Restante</span>
                  <span>{formatBRL(remaining)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Coluna 2: Pagamentos */}
          <div className="space-y-4">
            <div className="card p-4">
              <div className="font-semibold mb-2">Dividir a conta</div>
              <div className="flex gap-2 items-center">
                <input type="number" min={2} max={20} value={splitN} onChange={(e) => setSplitN(Number(e.target.value))} className="input w-20" />
                <span className="text-sm text-gray-400">partes iguais de {formatBRL(remaining / Math.max(1, splitN))}</span>
                <button onClick={applySplit} disabled={busy || remaining <= 0} className="btn btn-ghost">Aplicar</button>
              </div>
            </div>

            <form onSubmit={addPayment} className="card p-4 space-y-2">
              <div className="font-semibold">Adicionar pagamento</div>
              <div className="grid grid-cols-2 gap-2">
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="input">
                  {enabledMethods.map((k) => <option key={k} value={k}>{METHOD_LABELS[k] || k}</option>)}
                </select>
                <input className="input" placeholder="Valor (ex: 32,90)" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                {method === 'cash' && (
                  <input className="input col-span-2" placeholder="Troco (opcional)" value={changeGiven} onChange={(e) => setChangeGiven(e.target.value)} />
                )}
                <input className="input" placeholder="Rótulo (ex: Pessoa 1)" value={partLabel} onChange={(e) => setPartLabel(e.target.value)} />
                <input className="input" placeholder="NSU/txid (opcional)" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setAmount(remaining.toFixed(2).replace('.', ',')); }} className="btn btn-ghost text-xs">Preencher restante</button>
                <button disabled={busy} className="btn btn-primary flex-1">Adicionar</button>
              </div>
            </form>

            <div className="card p-4">
              <div className="font-semibold mb-2">Pagamentos ({data.payments?.length || 0})</div>
              <div className="space-y-2 text-sm">
                {data.payments?.length === 0 && <div className="text-gray-500">Nenhum pagamento</div>}
                {data.payments?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between border border-gray-800 rounded p-2">
                    <div>
                      <div className="font-medium">{METHOD_LABELS[p.method] || p.method} · {formatBRL(p.amount)}</div>
                      <div className="text-xs text-gray-500">
                        {p.partLabel || ''}{p.changeGiven > 0 ? ` · troco ${formatBRL(p.changeGiven)}` : ''}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </div>
                    </div>
                    <button onClick={() => removePayment(p.id)} className="text-red-400 text-xs">Remover</button>
                  </div>
                ))}
              </div>
            </div>

            {err && <div className="text-red-400 text-sm">{err}</div>}

            <div className="flex gap-2">
              <button onClick={() => closeSession(false)} disabled={busy || remaining > 0.009} className="btn btn-primary flex-1">
                Fechar conta
              </button>
              <button onClick={() => closeSession(true)} disabled={busy} className="btn btn-ghost text-red-300">
                Forçar fechamento
              </button>
            </div>

            <button
              onClick={sendWhatsAppReceipt}
              className="w-full btn btn-ghost text-green-400 border border-green-900/30 hover:bg-green-900/10 mt-2"
            >
              🟢 Enviar comprovante ao cliente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
