'use client';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_SOCKET_URL || '';
  socket = io(url, { transports: ['websocket', 'polling'], autoConnect: true });
  return socket;
}

export function joinRooms(rooms: string[]) {
  const s = getSocket();
  const fire = () => s.emit('join', rooms);
  if (s.connected) fire(); else s.once('connect', fire);
}
