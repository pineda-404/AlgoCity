import type { AlgorithmId, ErrorType, Level, Mood } from './types';
import { ALGORITHMS } from './types';
import { ERROR_ALGO, NOMBRES } from './exercises';

/**
 * Perfil persistente del estudiante (RF-13). Se guarda en el dispositivo
 * (localStorage) y se actualiza al cerrar cada ejercicio y con cada señal de ánimo.
 * Todas las funciones son puras para poder probarlas.
 */
export type TextSize = 'normal' | 'grande' | 'muy-grande';

export interface Preferences {
  texto: TextSize;
  contraste: 'estandar' | 'alto';
  tema: 'auto' | 'claro' | 'oscuro';
  narracion: boolean;
  /** 0.6 – 1.6, se ajusta con "más lento" / "más rápido" (HU-04.2). */
  velocidadVoz: number;
  modoCalma: boolean;
  motorVoz: 'auto' | 'webspeech' | 'whisper' | 'ninguno';
  /** Consentimiento para enviar texto (nunca audio) al proveedor LLM remoto (RNF-07). */
  consentimientoLLM: boolean;
  reducirMovimiento: boolean;
}

export interface AlgoProgress {
  intentos: number;
  completados: number;
  pasos: number;
  errores: number;
  pistas: number;
  mejorTiempoSeg: number | null;
  /** 0 – 1: media móvil de aciertos por paso. */
  dominio: number;
  ultimaVez: string | null;
}

export interface MoodEntry {
  fecha: string;
  animo: Mood;
  fuente: 'declarado' | 'inferido';
  contexto: string;
}

export interface SessionSummary {
  id: string;
  fecha: string;
  algoritmo: AlgorithmId;
  ejercicio: string;
  titulo: string;
  pasos: number;
  errores: number;
  pistas: number;
  retrocesos: number;
  duracionSeg: number;
  completado: boolean;
  examen: boolean;
  nota: number | null;
  animoInicio: Mood;
  animoFin: Mood | null;
  erroresPorTipo: Partial<Record<ErrorType, number>>;
  reflexion?: string;
}

export interface Profile {
  version: 1;
  id: string;
  nombre: string;
  rol: 'estudiante' | 'docente';
  nivel: Level;
  creado: string;
  prefs: Preferences;
  animo: { actual: Mood; historial: MoodEntry[] };
  errores: Partial<Record<ErrorType, number>>;
  progreso: Partial<Record<AlgorithmId, AlgoProgress>>;
  /** Segundos promedio por paso: el "ritmo" del estudiante. */
  ritmo: { segPorPaso: number; muestras: number };
  sesiones: SessionSummary[];
  insignias: string[];
  racha: { dias: number; ultimoDia: string | null };
  simulado?: boolean;
}

export const DEFAULT_PREFS: Preferences = {
  texto: 'normal', contraste: 'estandar', tema: 'auto', narracion: true, velocidadVoz: 1,
  modoCalma: false, motorVoz: 'auto', consentimientoLLM: true, reducirMovimiento: false,
};

export function newProfile(nombre: string, rol: Profile['rol'] = 'estudiante', now = new Date()): Profile {
  return {
    version: 1,
    id: `u-${now.getTime().toString(36)}`,
    nombre: nombre.trim() || 'Invitado',
    rol,
    nivel: 'basico',
    creado: now.toISOString(),
    prefs: { ...DEFAULT_PREFS },
    animo: { actual: 'normal', historial: [] },
    errores: {},
    progreso: {},
    ritmo: { segPorPaso: 0, muestras: 0 },
    sesiones: [],
    insignias: [],
    racha: { dias: 0, ultimoDia: null },
  };
}

const emptyProgress = (): AlgoProgress => ({ intentos: 0, completados: 0, pasos: 0, errores: 0, pistas: 0, mejorTiempoSeg: null, dominio: 0, ultimaVez: null });

export function declareMood(p: Profile, animo: Mood, fuente: MoodEntry['fuente'], contexto: string, now = new Date()): Profile {
  const historial = [...p.animo.historial, { fecha: now.toISOString(), animo, fuente, contexto }].slice(-100);
  return { ...p, animo: { actual: animo, historial } };
}

// ------------------------------------------------------------ inferencia de emociones (RF-15)

export interface LiveSignal {
  ok: boolean;
  /** Segundos desde la acción anterior. */
  pausa: number;
}

export interface Inference {
  mood: Mood | null;
  razon: string;
}

/**
 * Infiere el ánimo por patrones: 2 errores seguidos o una pausa larga sugieren frustración;
 * una racha de aciertos rápidos sugiere ganas. Nunca reemplaza lo que el estudiante declara.
 */
export function inferMood(signals: LiveSignal[], ritmoBase: number): Inference {
  const ult = signals.slice(-6);
  const n = ult.length;
  if (n >= 2 && !ult[n - 1].ok && !ult[n - 2].ok) return { mood: 'frustrado', razon: 'dos errores seguidos' };
  const umbral = Math.max(40, ritmoBase * 4);
  if (n >= 1 && ult[n - 1].pausa > umbral) return { mood: 'cansado', razon: `una pausa de ${Math.round(ult[n - 1].pausa)} s` };
  if (n >= 5 && ult.slice(-5).every((x) => x.ok && x.pausa < Math.max(6, ritmoBase))) return { mood: 'ganas', razon: 'cinco aciertos seguidos a buen ritmo' };
  return { mood: null, razon: '' };
}

/** Tono del asistente según el ánimo y el modo calma (diseño emocional, nivel conductual). */
export type Tone = 'calmo' | 'neutral' | 'entusiasta';
export function toneFor(p: Profile): Tone {
  if (p.prefs.modoCalma || p.animo.actual === 'frustrado' || p.animo.actual === 'cansado') return 'calmo';
  if (p.animo.actual === 'ganas') return 'entusiasta';
  return 'neutral';
}

// ------------------------------------------------------------ cierre de ejercicio

export function recordSession(p: Profile, s: SessionSummary, now = new Date()): { profile: Profile; nuevas: string[] } {
  const progreso = { ...p.progreso };
  const prev = progreso[s.algoritmo] ?? emptyProgress();
  const acierto = s.pasos > 0 ? Math.max(0, (s.pasos - s.errores) / s.pasos) : 0;
  const ap: AlgoProgress = {
    intentos: prev.intentos + 1,
    completados: prev.completados + (s.completado ? 1 : 0),
    pasos: prev.pasos + s.pasos,
    errores: prev.errores + s.errores,
    pistas: prev.pistas + s.pistas,
    mejorTiempoSeg: s.completado ? Math.min(prev.mejorTiempoSeg ?? Infinity, s.duracionSeg) : prev.mejorTiempoSeg,
    dominio: s.completado ? +(prev.intentos === 0 ? acierto : prev.dominio * 0.6 + acierto * 0.4).toFixed(3) : prev.dominio,
    ultimaVez: now.toISOString(),
  };
  progreso[s.algoritmo] = ap;

  const errores = { ...p.errores };
  for (const [k, v] of Object.entries(s.erroresPorTipo)) errores[k as ErrorType] = (errores[k as ErrorType] ?? 0) + (v ?? 0);

  const muestras = p.ritmo.muestras + s.pasos;
  const segPorPaso = s.pasos > 0 ? (p.ritmo.segPorPaso * p.ritmo.muestras + s.duracionSeg) / muestras : p.ritmo.segPorPaso;

  const hoy = now.toISOString().slice(0, 10);
  const ayer = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const racha = p.racha.ultimoDia === hoy ? p.racha : { dias: p.racha.ultimoDia === ayer ? p.racha.dias + 1 : 1, ultimoDia: hoy };

  let next: Profile = {
    ...p, progreso, errores, racha,
    ritmo: { segPorPaso: +segPorPaso.toFixed(2), muestras },
    sesiones: [...p.sesiones, s].slice(-60),
  };
  if (s.animoFin) next = declareMood(next, s.animoFin, 'declarado', `al cerrar ${s.titulo}`, now);

  const nuevas = badgesEarned(next, s).filter((b) => !p.insignias.includes(b));
  next = { ...next, insignias: [...p.insignias, ...nuevas], nivel: suggestLevel(next) };
  return { profile: next, nuevas };
}

export const BADGES: Record<string, { nombre: string; desc: string }> = {
  'primera-ciudad': { nombre: 'Primera ciudad', desc: 'Completaste tu primer ejercicio' },
  'sin-embotellamientos': { nombre: 'Tráfico fluido', desc: 'Un ejercicio sin ningún error' },
  'viajero-del-tiempo': { nombre: 'Viajero del tiempo', desc: 'Retrocediste y terminaste igual' },
  'sin-pistas': { nombre: 'Sin mapa', desc: 'Un ejercicio intermedio o avanzado sin pistas' },
  'examen-aprobado': { nombre: 'Licencia de urbanista', desc: 'Aprobaste un modo examen' },
  'urbanista-completo': { nombre: 'Urbanista completo', desc: 'Completaste los 6 algoritmos' },
  'racha-3': { nombre: 'Tres días seguidos', desc: 'Practicaste 3 días seguidos' },
};

function badgesEarned(p: Profile, s: SessionSummary): string[] {
  const b: string[] = [];
  if (!s.completado) return b;
  b.push('primera-ciudad');
  if (s.errores === 0 && s.pasos >= 3) b.push('sin-embotellamientos');
  if (s.retrocesos > 0) b.push('viajero-del-tiempo');
  if (s.pistas === 0 && s.pasos >= 5) b.push('sin-pistas');
  if (s.examen && (s.nota ?? 0) >= 11) b.push('examen-aprobado');
  if (ALGORITHMS.every((a) => (p.progreso[a]?.completados ?? 0) > 0)) b.push('urbanista-completo');
  if (p.racha.dias >= 3) b.push('racha-3');
  return b;
}

/** Sube de nivel cuando domina al menos 3 algoritmos; nunca baja solo. */
function suggestLevel(p: Profile): Level {
  const dominados = ALGORITHMS.filter((a) => (p.progreso[a]?.completados ?? 0) >= 1 && (p.progreso[a]?.dominio ?? 0) >= 0.85).length;
  if (dominados >= 5) return 'avanzado';
  if (dominados >= 3 && p.nivel === 'basico') return 'intermedio';
  return p.nivel;
}

/** Identidad de urbanista (nivel reflexivo del diseño emocional). */
export function urbanistTitle(p: Profile): string {
  const total = Object.values(p.progreso).reduce((acc, x) => acc + (x?.completados ?? 0), 0);
  if (total >= 20) return 'Arquitecta/o mayor de la ciudad';
  if (total >= 10) return 'Urbanista senior';
  if (total >= 4) return 'Urbanista';
  if (total >= 1) return 'Aprendiz de urbanista';
  return 'Recién llegada/o a la ciudad';
}

// ------------------------------------------------------------ recomendación del siguiente reto (RF-14)

export interface Recommendation {
  algoritmo: AlgorithmId;
  razon: string;
  /** Si conviene una variante enfocada en un tipo de error. */
  enfoque: ErrorType | null;
}

export const ORDEN_CURRICULAR: AlgorithmId[] = ['bubble', 'merge', 'quick', 'bst', 'bfs', 'dijkstra'];

export function recommend(p: Profile): Recommendation {
  const recientes = p.sesiones.slice(-10);
  const conteo: Partial<Record<ErrorType, number>> = {};
  for (const s of recientes) for (const [k, v] of Object.entries(s.erroresPorTipo)) conteo[k as ErrorType] = (conteo[k as ErrorType] ?? 0) + (v ?? 0);
  const peor = (Object.entries(conteo) as [ErrorType, number][])
    .filter(([k]) => ERROR_ALGO[k])
    .sort((a, b) => b[1] - a[1])[0];
  if (peor && peor[1] >= 2) {
    const alg = ERROR_ALGO[peor[0]]!;
    return { algoritmo: alg, enfoque: peor[0], razon: `En tus últimas prácticas tuviste ${peor[1]} errores al "${errorLabelCorto(peor[0])}". Te propongo una variante de ${NOMBRES[alg]} enfocada en eso.` };
  }
  const nuevo = ORDEN_CURRICULAR.find((a) => !p.progreso[a]?.completados);
  if (nuevo) {
    const primero = !Object.keys(p.progreso).length;
    return { algoritmo: nuevo, enfoque: null, razon: primero ? `Empieza por ${NOMBRES[nuevo]}: es la mejor puerta de entrada a la ciudad.` : `Ya dominas lo anterior. El siguiente barrio por descubrir es ${NOMBRES[nuevo]}.` };
  }
  const flojo = [...ORDEN_CURRICULAR].sort((a, b) => (p.progreso[a]?.dominio ?? 0) - (p.progreso[b]?.dominio ?? 0))[0];
  return { algoritmo: flojo, enfoque: null, razon: `Ya recorriste los 6 algoritmos. ${NOMBRES[flojo]} es donde tienes menos dominio: practícalo en modo examen.` };
}

function errorLabelCorto(e: ErrorType): string {
  return {
    'decidir-intercambio': 'decidir si intercambiar',
    'pareja-equivocada': 'elegir la pareja',
    'elegir-pivote': 'comparar con el pivote',
    fusionar: 'fusionar barrios',
    'insertar-bst': 'girar en los cruces del árbol',
    'visitar-nodo': 'elegir la siguiente estación',
    'comando-no-valido': 'dar comandos',
  }[e];
}

/** Nota vigesimal del modo examen. */
export function examGrade(pasos: number, errores: number, pistas: number): number {
  if (pasos === 0) return 0;
  const n = 20 * (pasos / (pasos + errores)) - pistas * 2;
  return Math.max(0, Math.min(20, Math.round(n)));
}
