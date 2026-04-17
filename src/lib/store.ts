// Helpers para estado da loja (dia operacional, horário de funcionamento, overrides manuais).
import { prisma } from '@/lib/prisma';

function nowInTz(tz: string = 'America/Sao_Paulo'): { weekday: number; hhmm: string } {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const wd = parts.find((p) => p.type === 'weekday')?.value || 'Sun';
  const hh = parts.find((p) => p.type === 'hour')?.value || '00';
  const mm = parts.find((p) => p.type === 'minute')?.value || '00';
  const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: WEEKDAY[wd] ?? 0, hhmm: `${hh === '24' ? '00' : hh}:${mm}` };
}

function inRange(hhmm: string, open: string, close: string): boolean {
  // Suporta horário que atravessa meia-noite (close < open).
  if (open <= close) return hhmm >= open && hhmm < close;
  return hhmm >= open || hhmm < close;
}

export async function getCurrentStoreDay(unitId: string) {
  return prisma.storeDay.findFirst({
    where: { unitId, status: 'open' },
    orderBy: { openedAt: 'desc' },
  });
}

export async function getActiveOverride(unitId: string) {
  const now = new Date();
  return prisma.storeOverride.findFirst({
    where: {
      unitId,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { startsAt: 'desc' },
  });
}

export type StoreState = {
  open: boolean;
  reason?: string;
  hasDay: boolean;
  storeDayId?: string;
  override?: { id: string; type: string; reason: string; endsAt: Date | null };
  schedule?: { weekday: number; openTime: string; closeTime: string } | null;
};

export async function getStoreState(unitId: string, tz?: string): Promise<StoreState> {
  const [day, override, hours, unit] = await Promise.all([
    getCurrentStoreDay(unitId),
    getActiveOverride(unitId),
    prisma.businessHours.findMany({ where: { unitId, active: true } }),
    prisma.unit.findUnique({ where: { id: unitId }, select: { timezone: true } }),
  ]);

  const timezone = tz || unit?.timezone || 'America/Sao_Paulo';
  const { weekday, hhmm } = nowInTz(timezone);
  const todayHours = hours.find((h) => h.weekday === weekday) || null;

  // Override manual vence tudo
  if (override) {
    return {
      open: override.type === 'open',
      reason: override.reason,
      hasDay: !!day,
      storeDayId: day?.id,
      override: { id: override.id, type: override.type, reason: override.reason, endsAt: override.endsAt },
      schedule: todayHours ? { weekday, openTime: todayHours.openTime, closeTime: todayHours.closeTime } : null,
    };
  }

  // Sem horário configurado => depende apenas do StoreDay
  if (!todayHours) {
    return {
      open: !!day,
      reason: day ? undefined : 'Dia não aberto',
      hasDay: !!day,
      storeDayId: day?.id,
      schedule: null,
    };
  }

  const withinHours = inRange(hhmm, todayHours.openTime, todayHours.closeTime);
  const open = withinHours && !!day;
  let reason: string | undefined;
  if (!open) {
    if (!withinHours) reason = `Fora do horário (${todayHours.openTime}–${todayHours.closeTime})`;
    else if (!day) reason = 'Dia operacional não aberto';
  }
  return {
    open,
    reason,
    hasDay: !!day,
    storeDayId: day?.id,
    schedule: { weekday, openTime: todayHours.openTime, closeTime: todayHours.closeTime },
  };
}

export async function ensureStoreOpen(unitId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const s = await getStoreState(unitId);
  if (s.open) return { ok: true };
  return { ok: false, reason: s.reason || 'Loja fechada' };
}
