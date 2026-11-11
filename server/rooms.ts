import { ENGINES, clone } from '../shared/engines';
import type { Action, ErrorType, Exercise } from '../shared/types';
import { findExercise } from '../shared/exercises';

/**
 * Salas multiusuario (RF-16, RF-17, RF-21, RNF-09). El servidor es la autoridad:
 * en las salas cooperativas aplica cada acción con el mismo motor determinista que
 * usa la PWA, así todos ven exactamente la misma ciudad y los turnos son consistentes.
 */
export type RoomMode = 'cooperativo' | 'duelo' | 'clase';

export interface Usuario {
  id: string;
  nombre: string;
  rol: 'estudiante' | 'docente';
}

export interface Progreso {
  pasos: number;
  total: number;
  errores: number;
  pistas: number;
  done: boolean;
  ultimoError: string | null;
  erroresPorTipo: Partial<Record<ErrorType, number>>;
  ultimaAccion: number;
}

export interface Miembro extends Usuario {
  conectado: boolean;
  simulado?: boolean;
  progreso: Progreso;
  terminoEn: number | null;
}

export interface Mensaje {
  de: string;
  texto: string;
  ts: number;
  sistema?: boolean;
}

export interface CoopState {
  state: unknown;
  history: unknown[];
  turno: string | null;
  cola: string[];
  pasos: number;
  errores: number;
}

export interface Room {
  codigo: string;
  nombre: string;
  modo: RoomMode;
  ejercicio: Exercise;
  anfitrion: string;
  capacidad: number;
  miembros: Miembro[];
  mensajes: Mensaje[];
  creada: number;
  coop: CoopState | null;
}

export const MAX_SALAS = 30;
export const CAPACIDAD_MAX = 8;

const progresoVacio = (total: number): Progreso => ({ pasos: 0, total, errores: 0, pistas: 0, done: false, ultimoError: null, erroresPorTipo: {}, ultimaAccion: Date.now() });

function totalPasos(ex: Exercise): number {
  const eng = ENGINES[ex.algoritmo];
  let s = eng.init(ex);
  let n = 0;
  while (!eng.done(s) && n < 2000) {
    s = eng.step(s, eng.expected(s)[0]).state;
    n++;
  }
  return n;
}

export class RoomManager {
  rooms = new Map<string, Room>();

  private nuevoCodigo(modo: RoomMode): string {
    const prefijo = { cooperativo: 'URB', duelo: 'DUE', clase: 'CLS' }[modo];
    for (;;) {
      const c = `${prefijo}-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!this.rooms.has(c)) return c;
    }
  }

  create(modo: RoomMode, nombre: string, ejercicio: Exercise, anfitrion: Usuario, codigo?: string): Room {
    if (this.rooms.size >= MAX_SALAS) throw new Error('Se alcanzó el máximo de 30 salas simultáneas. Intenta en unos minutos.');
    if (!ENGINES[ejercicio.algoritmo]) throw new Error('Algoritmo no válido.');
    const room: Room = {
      codigo: codigo ?? this.nuevoCodigo(modo),
      nombre: nombre.trim().slice(0, 60) || 'Sala sin nombre',
      modo,
      ejercicio,
      anfitrion: anfitrion.id,
      capacidad: modo === 'duelo' ? 2 : CAPACIDAD_MAX,
      miembros: [],
      mensajes: [],
      creada: Date.now(),
      coop: null,
    };
    if (modo === 'cooperativo') {
      const eng = ENGINES[ejercicio.algoritmo];
      room.coop = { state: eng.init(ejercicio), history: [], turno: null, cola: [], pasos: 0, errores: 0 };
    }
    this.rooms.set(room.codigo, room);
    return room;
  }

  join(codigo: string, u: Usuario): Room {
    const room = this.rooms.get(codigo.trim().toUpperCase());
    if (!room) throw new Error('No existe una sala con ese código.');
    const existente = room.miembros.find((m) => m.id === u.id);
    if (existente) {
      existente.conectado = true;
      existente.nombre = u.nombre;
    } else {
      const reales = room.miembros.filter((m) => !m.simulado).length;
      // En una clase el docente no ocupa cupo de estudiante.
      if (reales >= room.capacidad && !(room.modo === 'clase' && u.rol === 'docente')) throw new Error('La sala está llena.');
      room.miembros.push({ ...u, conectado: true, progreso: progresoVacio(totalPasos(room.ejercicio)), terminoEn: null });
      this.system(room, `${u.nombre} entró a la sala.`);
    }
    if (room.coop && !this.turnoValido(room)) room.coop.turno = u.id;
    return room;
  }

  leave(codigo: string, userId: string): Room | null {
    const room = this.rooms.get(codigo);
    if (!room) return null;
    const m = room.miembros.find((x) => x.id === userId);
    if (!m) return room;
    m.conectado = false;
    this.system(room, `${m.nombre} salió de la sala.`);
    if (room.coop) {
      room.coop.cola = room.coop.cola.filter((id) => id !== userId);
      if (room.coop.turno === userId) this.pasarTurno(room);
    }
    if (!room.miembros.some((x) => x.conectado && !x.simulado) && !room.miembros.some((x) => x.simulado)) {
      // Salas creadas por usuarios se borran al quedar vacías; las de demostración se mantienen.
      this.rooms.delete(codigo);
      return null;
    }
    return room;
  }

  private turnoValido(room: Room): boolean {
    const t = room.coop?.turno;
    return !!t && room.miembros.some((m) => m.id === t && m.conectado && !m.simulado);
  }

  private pasarTurno(room: Room): void {
    const c = room.coop!;
    while (c.cola.length) {
      const siguiente = c.cola.shift()!;
      if (room.miembros.some((m) => m.id === siguiente && m.conectado)) {
        c.turno = siguiente;
        return;
      }
    }
    const conectados = room.miembros.filter((m) => m.conectado && !m.simulado);
    if (!conectados.length) {
      c.turno = null;
      return;
    }
    const idx = conectados.findIndex((m) => m.id === c.turno);
    c.turno = conectados[(idx + 1) % conectados.length].id;
  }

  turno(codigo: string, userId: string, tipo: 'pedir' | 'ceder'): Room {
    const room = this.mustGet(codigo);
    if (!room.coop) throw new Error('Los turnos solo existen en salas cooperativas.');
    const m = room.miembros.find((x) => x.id === userId);
    if (!m) throw new Error('No estás en esta sala.');
    if (tipo === 'pedir') {
      if (room.coop.turno === userId) return room;
      if (!this.turnoValido(room)) room.coop.turno = userId;
      else if (!room.coop.cola.includes(userId)) {
        room.coop.cola.push(userId);
        this.system(room, `${m.nombre} pidió el turno.`);
      }
    } else if (room.coop.turno === userId) {
      this.pasarTurno(room);
      const nuevo = room.miembros.find((x) => x.id === room.coop!.turno);
      this.system(room, `${m.nombre} cedió el turno${nuevo && nuevo.id !== userId ? ` a ${nuevo.nombre}` : ''}.`);
    }
    return room;
  }

  /** Acción en sala cooperativa: valida turno y paso con el motor compartido. */
  coopAction(codigo: string, userId: string, action: Action): { room: Room; ok: boolean; message: string; why?: string; milestone?: string } {
    const room = this.mustGet(codigo);
    const c = room.coop;
    if (!c) throw new Error('Esta sala no es cooperativa.');
    const m = room.miembros.find((x) => x.id === userId);
    if (!m) throw new Error('No estás en esta sala.');
    if (c.turno !== userId) {
      const quien = room.miembros.find((x) => x.id === c.turno)?.nombre ?? 'nadie';
      return { room, ok: false, message: `Ahora es el turno de ${quien}. Di "pido turno" para hacer cola.` };
    }
    const eng = ENGINES[room.ejercicio.algoritmo];
    if (eng.done(c.state)) return { room, ok: false, message: 'La ciudad ya está terminada.' };
    const r = eng.step(c.state, action);
    m.progreso.ultimaAccion = Date.now();
    if (!r.ok) {
      c.errores++;
      m.progreso.errores++;
      if (r.error) m.progreso.erroresPorTipo[r.error] = (m.progreso.erroresPorTipo[r.error] ?? 0) + 1;
      m.progreso.ultimoError = r.why ?? r.message;
      return { room, ok: false, message: r.message, why: r.why };
    }
    c.history.push(clone(c.state));
    if (c.history.length > 200) c.history.shift();
    c.state = r.state;
    c.pasos++;
    m.progreso.pasos++;
    // Si alguien pidió el turno, se lo pasa después de un paso correcto.
    if (c.cola.length) this.pasarTurno(room);
    if (eng.done(c.state)) this.system(room, '¡La ciudad del equipo está terminada!');
    return { room, ok: true, message: r.message, milestone: r.milestone };
  }

  coopUndo(codigo: string, userId: string): Room {
    const room = this.mustGet(codigo);
    const c = room.coop;
    if (!c) throw new Error('Esta sala no es cooperativa.');
    if (c.turno !== userId) throw new Error('Solo quien tiene el turno puede retroceder el tiempo.');
    const prev = c.history.pop();
    if (prev !== undefined) {
      c.state = prev;
      c.pasos = Math.max(0, c.pasos - 1);
      this.system(room, 'El equipo retrocedió el tiempo un paso.');
    }
    return room;
  }

  progress(codigo: string, userId: string, p: Partial<Progreso>): Room {
    const room = this.mustGet(codigo);
    const m = room.miembros.find((x) => x.id === userId);
    if (!m) throw new Error('No estás en esta sala.');
    const antes = m.progreso.done;
    m.progreso = { ...m.progreso, ...sanitize(p), ultimaAccion: Date.now() };
    if (m.progreso.done && !antes) {
      m.terminoEn = Date.now();
      const lugar = room.miembros.filter((x) => x.terminoEn !== null).length;
      this.system(room, room.modo === 'duelo' && lugar === 1 ? `🏁 ${m.nombre} terminó primero con ${m.progreso.errores} errores.` : `${m.nombre} terminó el ejercicio.`);
    }
    return room;
  }

  message(codigo: string, userId: string, texto: string): Room {
    const room = this.mustGet(codigo);
    const m = room.miembros.find((x) => x.id === userId);
    if (!m) throw new Error('No estás en esta sala.');
    const limpio = texto.trim().slice(0, 280);
    if (limpio) room.mensajes.push({ de: m.nombre, texto: limpio, ts: Date.now() });
    if (room.mensajes.length > 100) room.mensajes.shift();
    return room;
  }

  private system(room: Room, texto: string) {
    room.mensajes.push({ de: 'AlgoCity', texto, ts: Date.now(), sistema: true });
    if (room.mensajes.length > 100) room.mensajes.shift();
  }

  mustGet(codigo: string): Room {
    const r = this.rooms.get(codigo);
    if (!r) throw new Error('La sala ya no existe.');
    return r;
  }

  /** Lista pública para unirse "por lista" (RF-16). */
  list() {
    return [...this.rooms.values()].map((r) => ({
      codigo: r.codigo,
      nombre: r.nombre,
      modo: r.modo,
      algoritmo: r.ejercicio.algoritmo,
      ejercicio: r.ejercicio.titulo,
      participantes: r.miembros.filter((m) => m.conectado || m.simulado).length,
      capacidad: r.capacidad,
    }));
  }

  /** Errores más frecuentes del grupo, para el panel docente (RF-21). */
  static resumenGrupo(room: Room) {
    const total: Partial<Record<ErrorType, number>> = {};
    for (const m of room.miembros) {
      if (m.rol === 'docente') continue;
      for (const [k, v] of Object.entries(m.progreso.erroresPorTipo)) total[k as ErrorType] = (total[k as ErrorType] ?? 0) + (v ?? 0);
    }
    return Object.entries(total).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  }

  /** Salas y participantes de demostración desde data/mock (datos simulados incluidos). */
  seed(salas: SalaMock[], usuarios: UsuarioMock[]) {
    for (const s of salas) {
      const ex = findExercise(s.ejercicio);
      if (!ex) continue;
      const anfitrion = usuarios.find((u) => u.id === s.anfitrion);
      const modo = s.modo as RoomMode;
      const nombre = { cooperativo: 'Ciudad en equipo (demo)', duelo: 'Duelo de urbanistas (demo)', clase: 'Algoritmos 2026-II · Prof. Ramírez (demo)' }[modo];
      const room = this.create(modo, nombre, ex, { id: s.anfitrion, nombre: anfitrion?.nombre ?? 'Anfitrión', rol: anfitrion?.rol === 'docente' ? 'docente' : 'estudiante' }, s.codigo);
      const total = totalPasos(ex);
      s.participantes.forEach((uid, i) => {
        const u = usuarios.find((x) => x.id === uid);
        if (!u || u.rol === 'docente') return;
        const errores = u.erroresFrecuentes ?? {};
        const nErr = Object.values(errores).reduce((a, b) => a + (b ?? 0), 0);
        const pasos = modo === 'cooperativo' ? 0 : Math.min(total, Math.round(total * [0.85, 0.35, 0.6, 0.15][i % 4]));
        room.miembros.push({
          id: u.id, nombre: u.nombre, rol: 'estudiante', conectado: false, simulado: true, terminoEn: null,
          progreso: {
            pasos, total, errores: modo === 'cooperativo' ? 0 : Math.min(nErr, [4, 1, 2, 3][i % 4]), pistas: i, done: false,
            ultimoError: modo === 'clase' ? ULTIMOS[i % ULTIMOS.length] : null,
            erroresPorTipo: modo === 'clase' ? { 'insertar-bst': Math.min(nErr, [4, 1, 2, 3][i % 4]) } : {},
            ultimaAccion: Date.now() - [20, 95, 40, 130][i % 4] * 1000,
          },
        });
      });
    }
  }
}

const ULTIMOS = [
  '45 ≥ 40: giró a la izquierda en el cruce 40, pero los mayores o iguales van a la derecha.',
  '15 < 20: giró a la derecha en el cruce 20.',
  '60 < 70: giró a la derecha en el cruce 70.',
  '80 ≥ 70: giró a la izquierda en el cruce 70.',
];

export interface SalaMock {
  codigo: string;
  modo: string;
  ejercicio: string;
  anfitrion: string;
  participantes: string[];
}

export interface UsuarioMock {
  id: string;
  nombre: string;
  rol: string;
  erroresFrecuentes?: Partial<Record<ErrorType, number>>;
}

function sanitize(p: Partial<Progreso>): Partial<Progreso> {
  const out: Partial<Progreso> = {};
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.min(x, 10000) : undefined);
  if (num(p.pasos) !== undefined) out.pasos = num(p.pasos);
  if (num(p.total) !== undefined) out.total = num(p.total);
  if (num(p.errores) !== undefined) out.errores = num(p.errores);
  if (num(p.pistas) !== undefined) out.pistas = num(p.pistas);
  if (typeof p.done === 'boolean') out.done = p.done;
  if (typeof p.ultimoError === 'string') out.ultimoError = p.ultimoError.slice(0, 200);
  if (p.erroresPorTipo && typeof p.erroresPorTipo === 'object') out.erroresPorTipo = p.erroresPorTipo;
  return out;
}
