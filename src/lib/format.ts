// Formatação padrão pt-BR para moeda, datas e números.
// Uso: import { formatBRL, parseBRL } from '@/lib/format';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return 'R$ 0,00';
  return BRL.format(n);
}

// Converte "R$ 32,89" ou "32,89" ou "32.89" em number.
export function parseBRL(input: string): number {
  if (!input) return 0;
  const clean = input
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

export function formatDateTimeBR(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatTimeBR(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
