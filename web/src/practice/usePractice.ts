import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ENGINES, clone, describeAction, solve } from '@shared/engines';
import { parseCommand, type Command, type CommandContext } from '@shared/commands';
import type { StepEvent } from '@shared/llm/LLMProvider';
import { declareMood, examGrade, inferMood, toneFor, type LiveSignal, type SessionSummary } from '@shared/profile';
import type { Action, ErrorType, Exercise, Mood } from '@shared/types';
import { learner, useStore } from '../state/store';
import { health, llm, providerLabel } from '../llm/client';
import { tts } from '../voice/voice';
import { getSocket } from '../net/socket';

export type MsgKind = 'info' | 'ok' | 'error' | 'pista' | 'llm' | 'tu' | 'hito' | 'pensando';
export interface Msg {
  id: number;
  kind: MsgKind;
  who: string;
  text: string;
}

export interface Stats {
  pasos: number;
  errores: number;
  pistas: number;
  retrocesos: number;
  erroresPorTipo: Partial<Record<ErrorType, number>>;
}

export interface PracticeResult {
  summary: SessionSummary;
  exercise: Exercise;
  /** Insignias nuevas obtenidas al cerrar el ejercicio. */
  nuevas?: string[];
}

/** Puente con una sala cooperativa: el estado vive en el servidor (RF-17). */
export interface CoopBridge {
  state: unknown;
  miTurno: boolean;
  turnoDe: string;
  puedeDeshacer: boolean;
  act: (a: Action) => void;
  undo: () => void;
  turno: (tipo: 'pedir' | 'ceder') => void;
}

export interface ProgressReport {
  pasos: number;
  total: number;
  errores: number;
  pistas: number;
  done: boolean;
  ultimoError: string | null;
  erroresPorTipo: Partial<Record<ErrorType, number>>;
}

interface Options {
  exercise: Exercise;
  examen: boolean;
  coop?: CoopBridge;
  onProgress?: (p: ProgressReport) => void;
  onFinish?: (r: PracticeResult) => void;
}

const ASISTENTE = 'Arquitecto Jefe';

/**
 * Sesión de práctica: une motor, comandos (voz/texto/botones), narración, pistas del LLM
 * y adaptación emocional. La misma lógica atiende voz, teclado y botones (RF-05).
 */
export function usePractice({ exercise, examen, coop, onProgress, onFinish }: Options) {
  const { profile, update } = useStore();
  const eng = ENGINES[exercise.algoritmo];
  const [localState, setLocalState] = useState<unknown>(() => eng.init(exercise));
  const state = coop ? coop.state : localState;
  const history = useRef<unknown[]>([]);
  const total = useMemo(() => solve(eng, eng.init(exercise)).length, [eng, exercise]);
  const [stats, setStats] = useState<Stats>({ pasos: 0, errores: 0, pistas: 0, retrocesos: 0, erroresPorTipo: {} });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [jam, setJam] = useState<{ t: number; node?: string } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [calmOffer, setCalmOffer] = useState(false);
  const [confirm, setConfirm] = useState<{ text: string; cmd: Command } | null>(null);
  const [inicio] = useState(() => Date.now());
  const [ahora, setAhora] = useState(Date.now());
  const signals = useRef<LiveSignal[]>([]);
  const lastAction = useRef(Date.now());
  const pausaAvisada = useRef(false);
  const hintLevel = useRef(0);
  const lastSpoken = useRef('');
  const finished = useRef(false);
  const idRef = useRef(0);
  const conModelo = useRef(false);
  const ultimoError = useRef<string | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  useEffect(() => {
    health().then((h) => (conModelo.current = h.conModelo));
  }, []);

  const tono = profile ? toneFor(profile) : 'neutral';

  const push = useCallback((kind: MsgKind, text: string, who = ASISTENTE) => {
    const id = ++idRef.current;
    setMsgs((m) => [...m, { id, kind, who, text }].slice(-40));
    return id;
  }, []);

  const replace = useCallback((id: number, kind: MsgKind, text: string, who = ASISTENTE) => {
    setMsgs((m) => m.map((x) => (x.id === id ? { ...x, kind, text, who } : x)));
  }, []);

  const speak = useCallback((text: string) => {
    lastSpoken.current = text;
    const p = profileRef.current;
    if (p?.prefs.narracion ?? true) tts.speak(text, { rate: p?.prefs.velocidadVoz ?? 1, tono: p ? toneFor(p) : 'neutral' });
  }, []);

  const say = useCallback((kind: MsgKind, text: string, hablar = true) => {
    push(kind, text);
    if (hablar) speak(text);
  }, [push, speak]);

  // Mensaje de bienvenida al ejercicio
  const introDe = useRef('');
  useEffect(() => {
    if (introDe.current === exercise.id) return; // StrictMode monta dos veces en desarrollo
    introDe.current = exercise.id;
    const intro = `${exercise.titulo}. ${exercise.metafora} ${eng.intro(state)}`;
    say('info', examen ? `Modo examen: sin pistas ni retrocesos. ${intro}` : intro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);
  useEffect(() => () => tts.cancel(), []);

  // Reloj (modo examen) y detección de pausas largas (RF-15)
  useEffect(() => {
    const t = setInterval(() => {
      setAhora(Date.now());
      const p = profileRef.current;
      if (finished.current || !p || (coop && !coop.miTurno)) return;
      const pausa = (Date.now() - lastAction.current) / 1000;
      const inf = inferMood([{ ok: true, pausa }], p.ritmo.segPorPaso || 6);
      if (inf.mood === 'cansado' && !pausaAvisada.current) {
        pausaAvisada.current = true;
        update((pp) => declareMood(pp, 'cansado', 'inferido', `pausa larga en ${exercise.titulo}`));
        say('llm', '¿Todo bien? Llevas un rato en este paso. Puedes pedir una pista, retroceder el tiempo o tomarte una pausa: la ciudad te espera.');
      }
    }, 1000);
    return () => clearInterval(t);
  }, [coop, exercise.titulo, say, update]);

  const step = useCallback((s: unknown, userAction: string, correct: boolean, error?: ErrorType, why?: string): StepEvent => ({
    algorithm: exercise.algoritmo, exerciseTitle: exercise.titulo, context: eng.describe(s), question: eng.intro(s),
    userAction, correct, error, why, hints: eng.hints(s), pseudocode: eng.pseudocodigo, line: eng.line(s),
  }), [eng, exercise]);

  const report = useCallback((s: Stats, done: boolean) => {
    onProgress?.({ pasos: s.pasos, total, errores: s.errores, pistas: s.pistas, done, ultimoError: ultimoError.current, erroresPorTipo: s.erroresPorTipo });
  }, [onProgress, total]);

  const finish = useCallback((final: Stats, s: unknown) => {
    if (finished.current) return;
    finished.current = true;
    const p = profileRef.current;
    const dur = Math.round((Date.now() - inicio) / 1000);
    const summary: SessionSummary = {
      id: `x-${Date.now().toString(36)}`, fecha: new Date().toISOString(), algoritmo: exercise.algoritmo, ejercicio: exercise.id,
      titulo: exercise.titulo, pasos: final.pasos, errores: final.errores, pistas: final.pistas, retrocesos: final.retrocesos,
      duracionSeg: dur, completado: eng.done(s), examen, nota: examen ? examGrade(final.pasos, final.errores, final.pistas) : null,
      animoInicio: p?.animo.actual ?? 'normal', animoFin: null, erroresPorTipo: final.erroresPorTipo,
    };
    setTimeout(() => onFinish?.({ summary, exercise }), 2200);
  }, [eng, examen, exercise, inicio, onFinish]);

  /** Ajustes emocionales después de cada acción. */
  const afterSignal = useCallback((ok: boolean) => {
    const pausa = (Date.now() - lastAction.current) / 1000;
    lastAction.current = Date.now();
    pausaAvisada.current = false;
    signals.current = [...signals.current, { ok, pausa }].slice(-10);
    const p = profileRef.current;
    if (!p) return;
    const inf = inferMood(signals.current, p.ritmo.segPorPaso || 6);
    if (inf.mood === 'frustrado' && p.animo.actual !== 'frustrado') {
      update((pp) => declareMood(pp, 'frustrado', 'inferido', `${inf.razon} en ${exercise.titulo}`));
      if (!p.prefs.modoCalma) setCalmOffer(true);
      say('llm', 'Respira: dos embotellamientos seguidos le pasan a cualquier urbanista. Vamos más despacio; si quieres, pide una pista.');
      signals.current = [];
    } else if (inf.mood === 'ganas' && p.animo.actual !== 'ganas') {
      update((pp) => declareMood(pp, 'ganas', 'inferido', `${inf.razon} en ${exercise.titulo}`));
      push('llm', '¡Vas con todo! Cinco aciertos seguidos y a buen ritmo.');
    }
  }, [exercise.titulo, push, say, update]);

  const doAction = useCallback((a: Action, origen: string) => {
    if (finished.current && !coop) return;
    if (coop) {
      if (!coop.miTurno) {
        say('info', `Ahora es el turno de ${coop.turnoDe}. Di "pido turno" para hacer cola.`);
        return;
      }
      coop.act(a);
      lastAction.current = Date.now();
      return;
    }
    const r = eng.step(state, a);
    const s0 = statsRef.current;
    if (r.ok) {
      history.current.push(clone(state));
      hintLevel.current = 0;
      const ns = { ...s0, pasos: s0.pasos + 1 };
      setStats(ns);
      setLocalState(r.state);
      const done = eng.done(r.state);
      const texto = [r.message, r.milestone, done ? eng.final(r.state) : eng.intro(r.state)].filter(Boolean).join(' ');
      say(done ? 'hito' : 'ok', texto);
      afterSignal(true);
      report(ns, done);
      if (done) finish(ns, r.state);
    } else if (r.error === 'comando-no-valido') {
      say('info', r.message);
    } else {
      const e = r.error!;
      ultimoError.current = r.why ?? r.message;
      const ns = { ...s0, errores: s0.errores + 1, erroresPorTipo: { ...s0.erroresPorTipo, [e]: (s0.erroresPorTipo[e] ?? 0) + 1 } };
      setStats(ns);
      setJam({ t: Date.now(), node: a.kind === 'visit' ? a.node : undefined });
      if (examen) {
        say('error', `${r.message} Revisa la condición y vuelve a intentarlo.`);
      } else {
        say('error', `${r.message} ${r.why ?? ''} Puedes intentarlo otra vez o decir "dame una pista".`);
        if (conModelo.current) {
          const p = profileRef.current;
          llm.narrate(step(state, `${describeAction(a)} (${origen})`, false, e, r.why), learner(p)).then((res) => {
            if (res.provider !== 'local' && res.provider !== 'canned') push('llm', res.text, `${ASISTENTE} · ${providerLabel(res.provider)}`);
          });
        }
      }
      afterSignal(false);
      report(ns, false);
    }
  }, [afterSignal, coop, eng, examen, finish, push, report, say, state, step]);

  // Eventos de la sala cooperativa (el servidor valida y difunde, RF-17)
  useEffect(() => {
    if (!coop) return;
    const s = getSocket();
    const onEv = (e: { por: string; ok: boolean; message: string; why?: string; milestone?: string }) => {
      const quien = e.por === profileRef.current?.nombre ? 'Tú' : e.por;
      if (e.ok) say('ok', `${quien}: ${[e.message, e.milestone].filter(Boolean).join(' ')}`);
      else {
        if (e.why) setJam({ t: Date.now() });
        say(e.why ? 'error' : 'info', `${quien}: ${e.message} ${e.why ?? ''}`);
      }
    };
    s.on('sala:evento', onEv);
    return () => {
      s.off('sala:evento', onEv);
    };
  }, [coop, say]);

  const undo = useCallback((n: number) => {
    if (examen) return say('info', 'En modo examen no se puede retroceder el tiempo.');
    if (coop) {
      if (!coop.miTurno) return say('info', 'Solo quien tiene el turno puede retroceder el tiempo.');
      coop.undo();
      return;
    }
    if (!history.current.length) return say('info', 'Estás en el inicio: no hay pasos para retroceder.');
    let prev = state;
    let k = 0;
    while (k < n && history.current.length) {
      prev = history.current.pop()!;
      k++;
    }
    finished.current = false;
    setLocalState(prev);
    setStats((s) => ({ ...s, pasos: Math.max(0, s.pasos - k), retrocesos: s.retrocesos + 1 }));
    hintLevel.current = 0;
    say('info', `Retrocediste el tiempo ${k === 1 ? 'un paso' : `${k} pasos`}. ${eng.intro(prev)}`);
  }, [coop, eng, examen, say, state]);

  const hint = useCallback(async () => {
    if (examen) return say('info', 'En modo examen no hay pistas. ¡Tú puedes!');
    if (eng.done(state)) return say('info', 'El ejercicio ya está resuelto.');
    hintLevel.current = Math.min(3, hintLevel.current + 1);
    const lvl = hintLevel.current as 1 | 2 | 3;
    setStats((s) => ({ ...s, pistas: s.pistas + 1 }));
    const id = push('pensando', '');
    const r = await llm.hint(step(state, '', true), lvl, learner(profileRef.current));
    const etiqueta = ['Orientación', 'Pregunta guiada', 'Ejemplo resuelto'][lvl - 1];
    replace(id, 'pista', r.text, `Pista ${lvl}/3 · ${etiqueta}${r.provider === 'local' || r.provider === 'canned' ? '' : ` · ${providerLabel(r.provider)}`}`);
    speak(r.text);
  }, [eng, examen, push, replace, say, speak, state, step]);

  const ask = useCallback(async (q: string) => {
    if (examen) return say('info', 'En modo examen el Arquitecto Jefe no responde preguntas.');
    push('tu', q, 'Tú');
    const id = push('pensando', '');
    const r = await llm.ask(q, step(state, '', true), learner(profileRef.current));
    replace(id, 'llm', r.text, `${ASISTENTE} · ${providerLabel(r.provider)}`);
    speak(r.text);
  }, [examen, push, replace, say, speak, state, step]);

  const setMood = useCallback((m: Mood, fuente: 'declarado' | 'inferido' = 'declarado') => {
    update((p) => declareMood(p, m, fuente, `durante ${exercise.titulo}`));
    const r = {
      frustrado: 'Gracias por decírmelo. Vamos paso a paso y con calma: mira solo los dos elementos resaltados.',
      cansado: 'Entendido. Te hablaré más despacio. Si necesitas, haz una pausa: tu avance queda guardado.',
      ganas: '¡Así me gusta! Sigamos construyendo.',
      normal: 'Perfecto, sigamos.',
    }[m];
    say('llm', r);
    if (m === 'frustrado' && !profileRef.current?.prefs.modoCalma) setCalmOffer(true);
  }, [exercise.titulo, say, update]);

  const ctx: CommandContext = useMemo(() => {
    const c: CommandContext = { acciones: eng.acciones };
    if (exercise.grafo) c.nodes = exercise.grafo.nodos;
    if (exercise.algoritmo === 'merge') {
      c.numberAction = (n: number) => {
        const s = state as { a: number[]; i: number; j: number; done: boolean };
        if (s.done) return null;
        if (s.a[s.i] === n) return { kind: 'left' };
        if (s.a[s.j] === n) return { kind: 'right' };
        return null;
      };
    }
    return c;
  }, [eng, exercise, state]);

  const run = useCallback((cmd: Command, origen: 'voz' | 'texto' | 'boton' | 'teclado', texto?: string) => {
    if (texto && origen !== 'boton') push('tu', texto, origen === 'voz' ? 'Tú (voz)' : 'Tú');
    switch (cmd.type) {
      case 'action': return doAction(cmd.action, origen);
      case 'undo': return undo(cmd.steps);
      case 'hint': return void hint();
      case 'help': setHelpOpen(true); return say('info', 'Te muestro los comandos que puedes usar aquí.', false);
      case 'slower':
      case 'faster': {
        const delta = cmd.type === 'slower' ? -0.15 : 0.15;
        const v = Math.max(0.6, Math.min(1.6, +((profileRef.current?.prefs.velocidadVoz ?? 1) + delta).toFixed(2)));
        update((p) => ({ ...p, prefs: { ...p.prefs, velocidadVoz: v } }));
        profileRef.current = profileRef.current ? { ...profileRef.current, prefs: { ...profileRef.current.prefs, velocidadVoz: v } } : null;
        return say('info', cmd.type === 'slower' ? 'Listo, hablaré más despacio.' : 'Listo, hablaré más rápido.');
      }
      case 'repeat': return speak(lastSpoken.current || eng.intro(state));
      case 'restart': {
        if (coop) return say('info', 'En una sala cooperativa no se puede reiniciar para todos.');
        history.current = [];
        finished.current = false;
        setLocalState(eng.init(exercise));
        setStats((s) => ({ ...s, pasos: 0 }));
        hintLevel.current = 0;
        return say('info', `Ejercicio reiniciado. ${eng.intro(eng.init(exercise))}`);
      }
      case 'silence': tts.cancel(); return;
      case 'mood': return setMood(cmd.mood);
      case 'turn-request': return coop ? coop.turno('pedir') : say('info', 'Los turnos solo existen en salas cooperativas.');
      case 'turn-pass': return coop ? coop.turno('ceder') : say('info', 'Los turnos solo existen en salas cooperativas.');
      case 'ask': return void ask(cmd.text);
      case 'unknown': {
        const ejemplos = eng.acciones.map((a) => ({ swap: '"intercambia"', skip: '"avanza"', left: '"izquierda"', right: '"derecha"', visit: '"visita B"' }[a]));
        return say('info', `No reconocí "${cmd.text}" como comando, así que la ciudad no cambió. Puedes decir ${ejemplos.join(', ')}, "dame una pista" o "¿qué puedo decir?".`);
      }
    }
  }, [ask, coop, doAction, eng, exercise, hint, push, say, setMood, speak, state, undo, update]);

  /** Entrada de voz o texto. Con confianza < 0.7 se pide confirmación (RF-03, HU-03.2). */
  const input = useCallback((alts: { text: string; confidence: number }[], origen: 'voz' | 'texto') => {
    if (!alts.length) return;
    if (confirm && origen === 'voz') {
      const t = alts[0].text.toLowerCase();
      if (/\b(si|sí|claro|correcto|eso|exacto)\b/.test(t)) {
        const c = confirm;
        setConfirm(null);
        return run(c.cmd, 'voz', c.text);
      }
      if (/\bno\b/.test(t)) {
        setConfirm(null);
        return say('info', 'Entendido, no hice nada. Repite el comando cuando quieras.');
      }
    }
    // Entre las alternativas del reconocedor, preferimos la que sea un comando válido.
    const parsed = alts.map((a) => ({ ...a, cmd: parseCommand(a.text, ctx) }));
    const elegido = parsed.find((p) => p.cmd.type !== 'unknown' && p.cmd.type !== 'ask') ?? parsed[0];
    if (origen === 'voz' && elegido.confidence > 0 && elegido.confidence < 0.7 && elegido.cmd.type !== 'unknown') {
      setConfirm({ text: elegido.text, cmd: elegido.cmd });
      say('info', `¿Quisiste decir "${elegido.text}"? Di "sí" o "no".`);
      return;
    }
    run(elegido.cmd, origen, elegido.text);
  }, [confirm, ctx, run, say]);

  const confirmar = useCallback((ok: boolean) => {
    const c = confirm;
    setConfirm(null);
    if (ok && c) run(c.cmd, 'voz', c.text);
  }, [confirm, run]);

  const acceptCalm = useCallback(() => {
    update((p) => ({ ...p, prefs: { ...p.prefs, modoCalma: true } }));
    setCalmOffer(false);
    say('llm', 'Modo calma activado: colores más suaves, animaciones más lentas y una voz más pausada.');
  }, [say, update]);

  // El atasco se limpia solo
  useEffect(() => {
    if (!jam) return;
    const t = setTimeout(() => setJam(null), 1400);
    return () => clearTimeout(t);
  }, [jam]);

  return {
    eng, state, total, stats, msgs, tono, jam, helpOpen, setHelpOpen, calmOffer, setCalmOffer, acceptCalm,
    confirm, confirmar, run, input, ctx, setMood,
    done: eng.done(state),
    segundos: Math.round((ahora - inicio) / 1000),
    progreso: coop ? null : total ? Math.min(1, stats.pasos / total) : 1,
  };
}
