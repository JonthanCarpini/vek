'use client';
import { formatBRL } from '@/lib/format';
import type { Call, Order, Session } from './types';
import { PAYMENT_HINTS } from './types';

type Props = {
  session: Session | null;
  orders: Order[];
  subtotal: number;
  serviceFee: number;
  total: number;
  serviceFeePct: number;
  calls: Call[];
  primaryColor: string;
  onCallWaiter: () => void;
  onRequestBill: () => void;
  onCancelCall: (id: string) => void;
};

export function BillTab({
  session, orders, subtotal, serviceFee, total, serviceFeePct,
  calls, primaryColor, onCallWaiter, onRequestBill, onCancelCall,
}: Props) {
  const activeOrders = orders.filter((o) => o.status !== 'cancelled');
  const pendingCalls = calls.filter((c) => c.status === 'pending');
  const waiterCall = pendingCalls.find((c) => c.type === 'waiter');
  const billCall = pendingCalls.find((c) => c.type === 'bill');

  return (
    <div className="p-4 space-y-4 pb-28">
      {/* Resumo da mesa */}
      <div className="card p-5"
        style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, transparent 100%)`, borderColor: `${primaryColor}40` }}>
        <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Sua mesa</div>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold">Mesa {session?.tableNumber}</div>
          <div className="text-xs text-gray-400">{session?.customerName}</div>
        </div>

        <div className="mt-4 space-y-1.5 text-sm">
          <Row label="Subtotal" value={formatBRL(subtotal)} />
          {serviceFeePct > 0 && (
            <Row label={`Taxa de serviço (${Math.round(serviceFeePct * 100)}%)`} value={formatBRL(serviceFee)} muted />
          )}
          <div className="border-t border-[color:var(--border)] pt-2 mt-2">
            <div className="flex justify-between items-baseline">
              <span className="text-base">Total</span>
              <span className="text-3xl font-bold" style={{ color: primaryColor }}>{formatBRL(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chamadas pendentes */}
      {pendingCalls.length > 0 && (
        <div className="space-y-2">
          {waiterCall && (
            <CallStatusCard
              icon="🙋"
              title="Garçom a caminho"
              subtitle={waiterCall.reason || 'Aguardando atendimento'}
              onCancel={() => onCancelCall(waiterCall.id)}
            />
          )}
          {billCall && (
            <CallStatusCard
              icon="💳"
              title="Conta solicitada"
              subtitle={
                billCall.paymentHint
                  ? `Pagamento: ${hintLabel(billCall.paymentHint)}${billCall.splitCount ? ` (dividir em ${billCall.splitCount})` : ''}`
                  : 'Aguardando o garçom'
              }
              onCancel={() => onCancelCall(billCall.id)}
            />
          )}
        </div>
      )}

      {/* Ações */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onCallWaiter} disabled={!!waiterCall}
          className="card p-4 text-center hover:border-gray-500 transition disabled:opacity-50">
          <div className="text-3xl mb-1">🙋</div>
          <div className="font-semibold">Chamar garçom</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {waiterCall ? 'Já chamado' : 'Com motivo específico'}
          </div>
        </button>
        <button onClick={onRequestBill} disabled={!!billCall || total <= 0}
          className="card p-4 text-center hover:border-gray-500 transition disabled:opacity-50"
          style={billCall ? {} : { borderColor: primaryColor }}>
          <div className="text-3xl mb-1">💳</div>
          <div className="font-semibold" style={billCall ? {} : { color: primaryColor }}>Pedir a conta</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {billCall ? 'Já solicitado' : 'Com forma de pagamento'}
          </div>
        </button>
      </div>

      {/* Itens consolidados */}
      <div className="card p-4">
        <div className="font-semibold mb-3">Itens consumidos</div>
        {activeOrders.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-4">Nenhum pedido até agora</div>
        )}
        <div className="space-y-3">
          {activeOrders.map((o) => (
            <div key={o.id} className="border-b border-[color:var(--border)] pb-2 last:border-0">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Pedido #{o.sequenceNumber}</span>
                <span>{new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <ul className="text-sm space-y-0.5">
                {o.items.map((i, idx) => (
                  <li key={i.id || idx} className="flex justify-between">
                    <span><span className="text-gray-400">{i.quantity}×</span> {i.name}</span>
                    <span className="text-gray-400">{formatBRL(Number(i.unitPrice) * i.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? 'text-gray-400' : ''}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function CallStatusCard({ icon, title, subtitle, onCancel }: { icon: string; title: string; subtitle: string; onCancel: () => void }) {
  return (
    <div className="card p-3 flex items-center gap-3 border-amber-600/40 bg-amber-600/10">
      <div className="text-2xl">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-amber-300">{title}</div>
        <div className="text-xs text-amber-200/70 truncate">{subtitle}</div>
      </div>
      <button onClick={onCancel} className="text-xs text-gray-400 hover:text-red-400">Cancelar</button>
    </div>
  );
}

function hintLabel(hint: string): string {
  return PAYMENT_HINTS.find((p) => p.id === hint)?.label || hint;
}
