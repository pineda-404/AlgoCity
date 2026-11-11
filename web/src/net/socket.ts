import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Conexión única a las salas (Socket.IO). Se abre solo cuando se usa una sala. */
export function getSocket(): Socket {
  if (!socket) socket = io({ autoConnect: true, reconnectionDelay: 1500, timeout: 5000 });
  return socket;
}

export function emitAck<T = { ok: boolean; error?: string; codigo?: string }>(ev: string, payload: unknown, ms = 6000): Promise<T> {
  const s = getSocket();
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ ok: false, error: 'El servidor de salas no responde. ¿Está corriendo "npm run dev"?' } as T), ms);
    s.emit(ev, payload, (r: T) => {
      clearTimeout(t);
      resolve(r);
    });
  });
}
