// Helper para emitir eventos do Socket.io a partir de qualquer route handler.
// O servidor customizado (server.js) expõe a instância global `io` via globalThis.__io.
import type { Server as IOServer } from 'socket.io';

function getIO(): IOServer | null {
  const g = globalThis as unknown as { __io?: IOServer };
  return g.__io || null;
}

export const SocketEvents = {
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ITEM_STATUS_CHANGED: 'order.item_status_changed',
  CALL_CREATED: 'call.created',
  CALL_ATTENDED: 'call.attended',
  SESSION_CLOSED: 'session.closed',
  ORDER_READY: 'order.ready',
  STORE_STATE_CHANGED: 'store.state_changed',
  METRICS_TICK: 'metrics.tick',
} as const;

export function emitToKitchen(unitId: string, event: string, payload: unknown) {
  getIO()?.to(`unit:${unitId}:kitchen`).emit(event, payload);
}
export function emitToWaiters(unitId: string, event: string, payload: unknown) {
  getIO()?.to(`unit:${unitId}:waiters`).emit(event, payload);
}
export function emitToDashboard(unitId: string, event: string, payload: unknown) {
  getIO()?.to(`unit:${unitId}:dashboard`).emit(event, payload);
}
export function emitToSession(sessionId: string, event: string, payload: unknown) {
  getIO()?.to(`session:${sessionId}`).emit(event, payload);
}
export function emitToUnit(unitId: string, event: string, payload: unknown) {
  const io = getIO();
  if (!io) return;
  io.to(`unit:${unitId}:kitchen`).emit(event, payload);
  io.to(`unit:${unitId}:waiters`).emit(event, payload);
  io.to(`unit:${unitId}:dashboard`).emit(event, payload);
}
