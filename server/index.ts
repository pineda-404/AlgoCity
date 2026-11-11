import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { buildLLM, sttConfig, transcribe } from './llm';
import { RoomManager, type RoomMode, type Room, type Usuario, type SalaMock, type UsuarioMock } from './rooms';
import { ALGORITHMS, type Action, type AlgorithmId, type Exercise } from '../shared/types';
import { validateExercise } from '../shared/exercises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 3001);
const app = express();
app.use(express.json({ limit: '64kb' }));

// ------------------------------------------------------------------ LLM (RF-10, RF-11, RF-12)
const llm = buildLLM();
const stt = sttConfig();
console.log(`[llm] cadena: ${llm.nombres.join(' → ')} · stt: ${stt ? stt.model : 'no configurado'}`);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, llm: { cadena: llm.nombres, ultimo: llm.full.lastUsed || null }, stt: !!stt, salas: rooms.rooms.size });
});

type Op = 'narrate' | 'hint' | 'ask' | 'reflect' | 'variant';
app.post('/api/llm/:op', async (req, res) => {
  const op = req.params.op as Op;
  // Sin consentimiento, el texto nunca sale a un proveedor remoto (RNF-07).
  const chain = req.header('x-llm-consent') === '0' ? llm.privada : llm.full;
  const b = req.body ?? {};
  try {
    let text: string | undefined;
    let exercise: Exercise | undefined;
    switch (op) {
      case 'narrate': text = await chain.narrate(b.step, b.profile); break;
      case 'hint': text = await chain.hint(b.step, ([1, 2, 3].includes(b.level) ? b.level : 1) as 1 | 2 | 3, b.profile); break;
      case 'ask': text = await chain.ask(String(b.question ?? '').slice(0, 500), b.step ?? null, b.profile); break;
      case 'reflect': text = await chain.reflect(b.recap, b.profile); break;
      case 'variant': {
        if (!ALGORITHMS.includes(b.algorithm)) return res.status(400).json({ error: 'Algoritmo no válido' });
        exercise = await chain.variant({ algorithm: b.algorithm as AlgorithmId, level: b.level ?? 'intermedio', weakSpots: Array.isArray(b.weakSpots) ? b.weakSpots : [] });
        break;
      }
      default: return res.status(404).json({ error: 'Operación desconocida' });
    }
    res.json({ text, exercise, provider: chain.lastUsed });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// ------------------------------------------------------------------ STT de respaldo (Whisper)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });
app.post('/api/stt', upload.single('audio'), async (req, res) => {
  if (!stt) return res.status(501).json({ error: 'El reconocimiento en servidor no está configurado (STT_API_KEY).' });
  if (!req.file) return res.status(400).json({ error: 'Falta el audio.' });
  try {
    // El audio solo vive en memoria durante la petición: nunca se guarda (RNF-07).
    const text = await transcribe(stt, req.file.buffer, req.file.mimetype || 'audio/webm');
    res.json({ text });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// ------------------------------------------------------------------ Salas (RF-16, RF-17, RF-21)
const rooms = new RoomManager();
const leer = <T,>(f: string): T => JSON.parse(readFileSync(join(root, 'data/mock', f), 'utf8')) as T;
rooms.seed(leer<SalaMock[]>('salas.json'), leer<UsuarioMock[]>('usuarios.json'));

app.get('/api/salas', (_req, res) => res.json(rooms.list()));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });

function snapshot(room: Room) {
  return { ...room, coop: room.coop ? { ...room.coop, history: undefined, puedeDeshacer: room.coop.history.length > 0 } : null, grupo: RoomManager.resumenGrupo(room) };
}
const emitir = (room: Room | null) => room && io.to(room.codigo).emit('sala:estado', snapshot(room));

type Ack = (r: { ok: boolean; error?: string; codigo?: string }) => void;
const safe = (fn: () => void, ack?: Ack) => {
  try {
    fn();
  } catch (err) {
    ack?.({ ok: false, error: (err as Error).message });
  }
};

function usuarioValido(u: unknown): Usuario {
  const x = u as Partial<Usuario>;
  if (!x || typeof x.id !== 'string' || typeof x.nombre !== 'string') throw new Error('Usuario no válido.');
  return { id: x.id.slice(0, 40), nombre: x.nombre.trim().slice(0, 40) || 'Invitado', rol: x.rol === 'docente' ? 'docente' : 'estudiante' };
}

io.on('connection', (socket) => {
  let codigo: string | null = null;
  let usuario: Usuario | null = null;

  const salir = () => {
    if (codigo && usuario) {
      socket.leave(codigo);
      emitir(rooms.leave(codigo, usuario.id));
    }
    codigo = null;
  };

  socket.on('sala:crear', (p: { modo: RoomMode; nombre: string; ejercicio: Exercise; usuario: Usuario }, ack: Ack) =>
    safe(() => {
      if (!['cooperativo', 'duelo', 'clase'].includes(p.modo)) throw new Error('Modo no válido.');
      if (!validateExercise(p.ejercicio, p.ejercicio?.algoritmo)) throw new Error('Ejercicio no válido.');
      salir();
      usuario = usuarioValido(p.usuario);
      const room = rooms.create(p.modo, p.nombre, p.ejercicio, usuario);
      rooms.join(room.codigo, usuario);
      codigo = room.codigo;
      socket.join(codigo);
      ack({ ok: true, codigo });
      emitir(room);
    }, ack),
  );

  socket.on('sala:unirse', (p: { codigo: string; usuario: Usuario }, ack: Ack) =>
    safe(() => {
      const u = usuarioValido(p.usuario);
      const room = rooms.join(String(p.codigo ?? ''), u);
      if (codigo !== room.codigo) salir();
      usuario = u;
      codigo = room.codigo;
      socket.join(codigo);
      ack({ ok: true, codigo });
      emitir(room);
    }, ack),
  );

  socket.on('sala:salir', () => salir());

  socket.on('sala:accion', (p: { action: Action }, ack?: Ack) =>
    safe(() => {
      if (!codigo || !usuario) throw new Error('No estás en una sala.');
      const r = rooms.coopAction(codigo, usuario.id, p.action);
      io.to(codigo).emit('sala:evento', { por: usuario.nombre, porId: usuario.id, ok: r.ok, message: r.message, why: r.why, milestone: r.milestone });
      emitir(r.room);
      ack?.({ ok: r.ok });
    }, ack),
  );

  socket.on('sala:deshacer', (_p: unknown, ack?: Ack) =>
    safe(() => {
      if (!codigo || !usuario) throw new Error('No estás en una sala.');
      emitir(rooms.coopUndo(codigo, usuario.id));
      ack?.({ ok: true });
    }, ack),
  );

  socket.on('sala:turno', (p: { tipo: 'pedir' | 'ceder' }, ack?: Ack) =>
    safe(() => {
      if (!codigo || !usuario) throw new Error('No estás en una sala.');
      emitir(rooms.turno(codigo, usuario.id, p.tipo === 'ceder' ? 'ceder' : 'pedir'));
      ack?.({ ok: true });
    }, ack),
  );

  socket.on('sala:progreso', (p) =>
    safe(() => {
      if (!codigo || !usuario) return;
      emitir(rooms.progress(codigo, usuario.id, p ?? {}));
    }),
  );

  socket.on('sala:mensaje', (p: { texto: string }) =>
    safe(() => {
      if (!codigo || !usuario) return;
      emitir(rooms.message(codigo, usuario.id, String(p?.texto ?? '')));
    }),
  );

  socket.on('disconnect', salir);
});

// ------------------------------------------------------------------ PWA compilada (producción)
const dist = join(root, 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}

httpServer.listen(PORT, () => {
  console.log(`[algocity] API y salas en http://localhost:${PORT}${existsSync(dist) ? ' (sirviendo la PWA compilada)' : ''}`);
});
