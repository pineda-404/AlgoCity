import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_PREFS, newProfile, type Profile, type SessionSummary } from '@shared/profile';
import type { LearnerProfile } from '@shared/llm/LLMProvider';
import type { ErrorType, Mood } from '@shared/types';
import usuarios from '../../../data/mock/usuarios.json';
import sesiones from '../../../data/mock/sesiones.json';
import { CATALOGO } from '@shared/exercises';

/** Perfil persistente en el dispositivo (RF-13). No se guarda audio nunca (RNF-07). */
const KEY = 'algocity.perfil.v1';

function load(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    return { ...p, prefs: { ...DEFAULT_PREFS, ...p.prefs } };
  } catch {
    return null;
  }
}

function save(p: Profile | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    /* almacenamiento lleno o bloqueado: la app sigue funcionando en memoria */
  }
}

interface Store {
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  update: (fn: (p: Profile) => Profile) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile | null>(load);

  const setProfile = useCallback((p: Profile | null) => {
    setProfileState(p);
    save(p);
  }, []);

  const update = useCallback((fn: (p: Profile) => Profile) => {
    setProfileState((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  // Preferencias aplicadas de inmediato en toda la app (RF-02).
  useEffect(() => {
    const prefs = profile?.prefs ?? DEFAULT_PREFS;
    const root = document.documentElement;
    root.style.setProperty('--escala', { normal: '1', grande: '1.2', 'muy-grande': '1.45' }[prefs.texto]);
    root.dataset.contraste = prefs.contraste === 'alto' ? 'alto' : '';
    const oscuro = prefs.tema === 'oscuro' || (prefs.tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = oscuro ? 'dark' : 'light';
    root.dataset.calma = prefs.modoCalma ? 'si' : '';
    root.dataset.movimiento = prefs.reducirMovimiento ? 'reducido' : '';
  }, [profile?.prefs]);

  const value = useMemo(() => ({ profile, setProfile, update }), [profile, setProfile, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider no montado');
  return s;
}

export function learner(p: Profile | null): LearnerProfile {
  return {
    name: p?.nombre,
    level: p?.nivel ?? 'basico',
    mood: p?.animo.actual ?? 'normal',
    frequentErrors: p?.errores ?? {},
    calmMode: p?.prefs.modoCalma ?? false,
  };
}

// ------------------------------------------------------------ perfiles simulados (data/mock)

interface UsuarioMock {
  id: string;
  nombre: string;
  rol: string;
  nivel?: Profile['nivel'];
  preferencias?: { texto?: string; contraste?: string; narracion?: boolean; ritmo?: string; modoCalma?: boolean };
  erroresFrecuentes?: Partial<Record<ErrorType, number>>;
  racha?: number;
  nota?: string;
}

interface SesionMock {
  id: string;
  usuario: string;
  ejercicio: string;
  inicio: string;
  animoInicio: string;
  animoFin: string;
  pasos?: { error?: string }[];
  comparaciones: number;
  errores: number;
  pistas: number;
  duracionSeg: number;
  reflexion?: string;
}

export const USUARIOS_SIMULADOS = (usuarios as UsuarioMock[]).map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol, nota: describeMock(u) }));

function describeMock(u: UsuarioMock): string {
  if (u.rol === 'docente') return 'Docente: abre la sala de clase CLS-2026';
  const p = u.preferencias ?? {};
  const rasgos = [u.nivel, p.texto && p.texto !== 'normal' ? `texto ${p.texto}` : '', p.contraste === 'alto' ? 'alto contraste' : '', p.modoCalma ? 'modo calma' : '', p.narracion === false ? 'sin narración' : '', u.nota ?? ''];
  return rasgos.filter(Boolean).join(' · ');
}

const moodOf = (m: string): Mood => (['ganas', 'normal', 'cansado', 'frustrado'].includes(m) ? (m as Mood) : m === 'orgullosa' || m === 'orgulloso' ? 'ganas' : 'normal');

export function profileFromMock(id: string): Profile | null {
  const u = (usuarios as UsuarioMock[]).find((x) => x.id === id);
  if (!u) return null;
  const p = newProfile(u.nombre, u.rol === 'docente' ? 'docente' : 'estudiante');
  p.id = u.id;
  p.simulado = true;
  p.nivel = u.nivel ?? 'basico';
  const pr = u.preferencias ?? {};
  p.prefs = {
    ...p.prefs,
    texto: (['normal', 'grande', 'muy-grande'].includes(pr.texto ?? '') ? pr.texto : 'normal') as Profile['prefs']['texto'],
    contraste: pr.contraste === 'alto' ? 'alto' : 'estandar',
    narracion: pr.narracion ?? true,
    velocidadVoz: pr.ritmo === 'rapido' ? 1.25 : pr.ritmo === 'pausado' ? 0.85 : 1,
    modoCalma: !!pr.modoCalma,
  };
  p.errores = { ...(u.erroresFrecuentes ?? {}) };
  p.racha = { dias: u.racha ?? 0, ultimoDia: u.racha ? new Date(Date.now() - 86400000).toISOString().slice(0, 10) : null };
  const propias = (sesiones as SesionMock[]).filter((s) => s.usuario === u.id);
  p.sesiones = propias.map((s): SessionSummary => {
    const ex = CATALOGO.find((e) => e.id === s.ejercicio);
    const porTipo: Partial<Record<ErrorType, number>> = {};
    for (const paso of s.pasos ?? []) if (paso.error) porTipo[paso.error as ErrorType] = (porTipo[paso.error as ErrorType] ?? 0) + 1;
    return {
      id: s.id, fecha: s.inicio, algoritmo: ex?.algoritmo ?? 'bubble', ejercicio: s.ejercicio, titulo: ex?.titulo ?? s.ejercicio,
      pasos: s.comparaciones, errores: s.errores, pistas: s.pistas, retrocesos: 0, duracionSeg: s.duracionSeg, completado: true,
      examen: false, nota: null, animoInicio: moodOf(s.animoInicio), animoFin: moodOf(s.animoFin), erroresPorTipo: porTipo, reflexion: s.reflexion,
    };
  });
  for (const s of p.sesiones) {
    const prev = p.progreso[s.algoritmo];
    const acierto = s.pasos ? (s.pasos - s.errores) / s.pasos : 0;
    p.progreso[s.algoritmo] = {
      intentos: (prev?.intentos ?? 0) + 1, completados: (prev?.completados ?? 0) + 1, pasos: (prev?.pasos ?? 0) + s.pasos,
      errores: (prev?.errores ?? 0) + s.errores, pistas: (prev?.pistas ?? 0) + s.pistas,
      mejorTiempoSeg: Math.min(prev?.mejorTiempoSeg ?? Infinity, s.duracionSeg), dominio: +acierto.toFixed(2), ultimaVez: s.fecha,
    };
    p.animo.historial.push({ fecha: s.fecha, animo: s.animoInicio, fuente: 'declarado', contexto: `al iniciar ${s.titulo}` });
    if (s.animoFin) p.animo.historial.push({ fecha: s.fecha, animo: s.animoFin, fuente: 'declarado', contexto: `al cerrar ${s.titulo}` });
  }
  if (p.sesiones.length) p.insignias = ['primera-ciudad'];
  return p;
}
