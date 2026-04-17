'use client';
import { formatBRL } from '@/lib/format';
import type { Order } from './types';
import { ORDER_STATUS_STEPS, STATUS_LABEL } from './types';

type Props = {
  orders: Order[];
  primaryColor: string;
  onGoToMenu: () => void;
};

export function OrdersTab({ orders, primaryColor, onGoToMenu }: Props) {
  if (orders.length === 0) {
    return (
      <div className="p-10 text-center text-gray-400">
        <div className="text-6xl mb-4">📋</div>
        <div className="text-lg font-semibold mb-2">Nenhum pedido ainda</div>
        <div className="text-sm mb-5">Vá ao cardápio e faça seu primeiro pedido.</div>
        <button onClick={onGoToMenu} className="btn btn-primary" style={{ backgroundColor: primaryColor }}>
          Ver cardápio
        </button>
      </div>
    );
  }

  const active = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const done = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');

  return (
    <div className="p-4 space-y-4 pb-28">
      {active.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-semibold">
            Em andamento ({active.length})
          </div>
          <div className="space-y-3">
            {active.map((o) => <OrderCard key={o.id} order={o} primaryColor={primaryColor} />)}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-semibold">
            Concluídos ({done.length})
          </div>
          <div className="space-y-3">
            {done.map((o) => <OrderCard key={o.id} order={o} primaryColor={primaryColor} compact />)}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, primaryColor, compact }: { order: Order; primaryColor: string; compact?: boolean }) {
  const isCancelled = order.status === 'cancelled';
  const currentIdx = ORDER_STATUS_STEPS.findIndex((s) => s.key === order.status);

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">#{order.sequenceNumber}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColorClass(order.status)}`}>
              {STATUS_LABEL[order.status] || order.status}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-lg" style={{ color: primaryColor }}>{formatBRL(order.total)}</div>
        </div>
      </div>

      {!compact && !isCancelled && (
        <Timeline currentIdx={currentIdx} primaryColor={primaryColor} />
      )}

      <ul className="text-sm space-y-1 mt-3 pt-3 border-t border-[color:var(--border)]">
        {order.items.map((i, idx) => (
          <li key={i.id || idx} className="flex justify-between gap-2">
            <span className="flex-1">
              <span className="text-gray-400">{i.quantity}×</span> {i.name}
              {i.notes && <div className="text-xs text-amber-400 italic ml-5">📝 {i.notes}</div>}
            </span>
            <span className="text-gray-400 whitespace-nowrap">{formatBRL(Number(i.unitPrice) * i.quantity)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Timeline({ currentIdx, primaryColor }: { currentIdx: number; primaryColor: string }) {
  return (
    <div className="mt-3 flex items-center">
      {ORDER_STATUS_STEPS.slice(0, 4).map((s, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex-1 flex items-center">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition ${done ? 'text-white' : 'bg-[#1f1f2b] text-gray-600'} ${active ? 'ring-2 ring-offset-2 ring-offset-[color:var(--card)] animate-pulse' : ''}`}
                style={done ? { backgroundColor: primaryColor, ...(active ? { boxShadow: `0 0 0 2px ${primaryColor}` } : {}) } : undefined}
              >
                {s.icon}
              </div>
              <span className={`text-[10px] ${done ? 'text-white' : 'text-gray-500'}`}>{s.label}</span>
            </div>
            {i < 3 && (
              <div className={`flex-1 h-0.5 mx-1 ${i < currentIdx ? '' : 'bg-[#1f1f2b]'}`}
                style={i < currentIdx ? { backgroundColor: primaryColor } : undefined} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function getStatusColorClass(status: string): string {
  switch (status) {
    case 'received': return 'bg-gray-600/30 text-gray-300';
    case 'accepted': return 'bg-blue-600/30 text-blue-300';
    case 'preparing': return 'bg-amber-600/30 text-amber-300';
    case 'ready': return 'bg-green-600/30 text-green-300animate-pulse';
    case 'delivered': return 'bg-emerald-800/30 text-emerald-300';
    case 'cancelled': return 'bg-red-700/30 text-red-300';
    default: return 'bg-gray-700/30 text-gray-300';
  }
}
