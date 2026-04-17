'use client';
import { formatBRL } from '@/lib/format';

const METHOD_LABELS: Record<string, string> = {
  cash: '💵 Dinheiro', credit: '💳 Crédito', debit: '💳 Débito',
  pix: '📱 Pix', voucher: '🎟 Vale', other: 'Outro',
};

export function CashierSummaryCard({ summary }: { summary: any }) {
  if (!summary) return null;
  const byMethodEntries = Object.entries(summary.byMethod || {}) as [string, any][];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
      <Stat label="Vendas do dia" value={formatBRL(summary.totalSales)} hint={`${summary.sessionsClosed} mesa(s) fechadas`} tone="primary" />
      <Stat label="Ticket médio" value={formatBRL(summary.avgTicket)} hint={summary.sessionsClosed > 0 ? 'baseado em mesas fechadas' : 'aguardando fechamentos'} />
      <Stat label="Recebido" value={formatBRL(summary.totalReceived)} hint={`${byMethodEntries.reduce((s, [, v]) => s + v.count, 0)} pagamentos`} />
      <Stat label="Dinheiro esperado" value={formatBRL(summary.cashExpected)} hint={`abertura ${formatBRL(summary.openingCash)} + recebido`} tone="success" />

      <div className="card p-4 md:col-span-4">
        <div className="text-sm font-semibold mb-3">Recebimentos por método</div>
        {byMethodEntries.length === 0 ? (
          <div className="text-xs text-gray-500">Ainda nenhum pagamento registrado hoje.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {byMethodEntries.map(([method, v]) => (
              <div key={method} className="bg-[#1f1f2b] rounded-lg p-3">
                <div className="text-xs text-gray-400">{METHOD_LABELS[method] || method}</div>
                <div className="text-lg font-bold">{formatBRL(v.amount)}</div>
                <div className="text-[11px] text-gray-500">{v.count} transação(ões)
                  {v.changeGiven > 0 ? ` · troco ${formatBRL(v.changeGiven)}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'primary' | 'success' }) {
  const color = tone === 'primary' ? 'text-brand-500' : tone === 'success' ? 'text-green-400' : 'text-white';
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}
