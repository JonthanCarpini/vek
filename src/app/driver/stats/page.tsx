'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Package, Navigation, DollarSign, TrendingUp } from 'lucide-react';

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Period = { count: number; revenue: number; km: number; avgTicket: number; commission: number; feeSum: number };

export default function DriverStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/driver/stats');
        if (res.status === 401) {
          router.replace('/driver/login');
          return;
        }
        const body = await res.json();
        setStats(body.data?.stats);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }
  if (!stats) {
    return <div className="p-6 text-center text-gray-400">Sem dados.</div>;
  }

  const d = stats.driver;
  const hasCommissionConfig = d.commissionPerDelivery > 0 || d.commissionPercent > 0;

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-10 bg-[var(--bg)] border-b border-[var(--border)] p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/driver" className="p-2 text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold">Estatísticas</h1>
            <p className="text-xs text-gray-400">{d.name} — {d.totalDeliveries} entregas no total</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        <PeriodCard title="Hoje" data={stats.today} showCommission={hasCommissionConfig} />
        <PeriodCard title="Semana (desde domingo)" data={stats.week} showCommission={hasCommissionConfig} />
        <PeriodCard title="Este mês" data={stats.month} showCommission={hasCommissionConfig} />

        {hasCommissionConfig ? (
          <div className="card p-4 text-sm text-gray-300">
            <div className="font-semibold mb-1">💰 Sua comissão</div>
            <div className="text-gray-400 text-xs">
              {d.commissionPerDelivery > 0 && <>Fixo: <b className="text-gray-200">{formatBRL(d.commissionPerDelivery)}</b> por entrega</>}
              {d.commissionPerDelivery > 0 && d.commissionPercent > 0 && <> + </>}
              {d.commissionPercent > 0 && <><b className="text-gray-200">{d.commissionPercent}%</b> sobre a taxa de entrega</>}
            </div>
          </div>
        ) : (
          <div className="card p-4 text-sm text-gray-400">
            Sua comissão ainda não foi configurada. Fale com o gerente para cadastrar valor fixo por entrega ou percentual sobre a taxa.
          </div>
        )}
      </main>
    </div>
  );
}

function PeriodCard({ title, data, showCommission }: { title: string; data: Period; showCommission: boolean }) {
  return (
    <div className="card p-4">
      <h2 className="font-semibold mb-3">{title}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Package className="w-4 h-4" />} label="Entregas" value={String(data.count)} />
        <Stat icon={<Navigation className="w-4 h-4" />} label="Km rodados" value={`${data.km.toFixed(1)} km`} />
        <Stat icon={<TrendingUp className="w-4 h-4" />} label="Ticket médio" value={formatBRL(data.avgTicket)} />
        <Stat icon={<DollarSign className="w-4 h-4" />} label="Receita" value={formatBRL(data.revenue)} />
        {showCommission && (
          <div className="col-span-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <div className="text-xs text-orange-300">Sua comissão no período</div>
            <div className="text-xl font-bold text-orange-400">{formatBRL(data.commission)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-black/20 border border-[var(--border)] rounded-lg p-3">
      <div className="flex items-center gap-2 text-gray-400 text-xs">
        {icon} {label}
      </div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}
