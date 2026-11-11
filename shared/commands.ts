import type { Action, ActionKind, Mood } from './types';
import { norm } from './engines/engine';
import { matchNode } from './engines/graph';

/**
 * Intérprete de comandos (RF-03, RF-05). Funciona igual para voz, texto y botones,
 * no usa red y responde al instante. Solo las preguntas libres se envían al LLM.
 */
export type Command =
  | { type: 'action'; action: Action }
  | { type: 'undo'; steps: number }
  | { type: 'hint' }
  | { type: 'help' }
  | { type: 'slower' }
  | { type: 'faster' }
  | { type: 'repeat' }
  | { type: 'restart' }
  | { type: 'silence' }
  | { type: 'mood'; mood: Mood }
  | { type: 'turn-request' }
  | { type: 'turn-pass' }
  | { type: 'ask'; text: string }
  | { type: 'unknown'; text: string };

export interface CommandContext {
  acciones: ActionKind[];
  nodes?: string[];
  /** Traduce "entra el 27" a izquierda/derecha según el estado actual. */
  numberAction?: (n: number) => Action | null;
}

const NUMEROS: Record<string, number> = {
  cero: 0, uno: 1, una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90, cien: 100,
};

/** "veintisiete" no se cubre; el reconocedor de voz suele devolver dígitos para números grandes. */
export function numbersIn(t: string): number[] {
  const out: number[] = [];
  for (const w of t.split(' ')) {
    if (/^\d+$/.test(w)) out.push(Number(w));
    else if (w in NUMEROS) out.push(NUMEROS[w]);
  }
  return out;
}

const has = (t: string, re: RegExp) => re.test(t);

export function parseCommand(texto: string, ctx: CommandContext): Command {
  const t = norm(texto);
  if (!t) return { type: 'unknown', text: texto };

  // Estado de ánimo declarado (RF-15)
  if (has(t, /\b(estoy|me siento|ando)\b.*\b(frustrad[oa]|molest[oa]|harto|harta|perdid[oa])\b/) || has(t, /\bno entiendo( nada)?\b/)) return { type: 'mood', mood: 'frustrado' };
  if (has(t, /\b(estoy|me siento|ando)\b.*\b(cansad[oa]|agotad[oa]|con sueno)\b/)) return { type: 'mood', mood: 'cansado' };
  if (has(t, /\b(estoy|me siento|ando)\b.*\b(bien|con ganas|motivad[oa]|feliz|animad[oa])\b/)) return { type: 'mood', mood: 'ganas' };

  if (has(t, /\b(que puedo decir|que digo|comandos|que comandos)\b/) || t === 'ayuda') return { type: 'help' };
  if (has(t, /\b(retrocede|retroceder|deshaz|deshacer|regresa|vuelve atras|atras)\b/)) {
    const n = numbersIn(t).find((x) => x > 0 && x <= 20);
    return { type: 'undo', steps: n ?? 1 };
  }
  if (has(t, /\b(pista|una ayuda|ayudame|ayuda con|no se que hacer)\b/)) return { type: 'hint' };
  if (has(t, /\b(mas lento|mas despacio|despacio|lento)\b/)) return { type: 'slower' };
  if (has(t, /\b(mas rapido|rapido|acelera)\b/)) return { type: 'faster' };
  if (has(t, /\b(repite|repetir|otra vez|de nuevo que dijiste)\b/)) return { type: 'repeat' };
  if (has(t, /\b(reinicia|reiniciar|empezar de nuevo|empieza de nuevo|desde el inicio)\b/)) return { type: 'restart' };
  if (has(t, /\b(silencio|callate|calla|para de hablar|deja de hablar)\b/)) return { type: 'silence' };
  if (has(t, /\b(pido|quiero|dame) (el )?turno\b/)) return { type: 'turn-request' };
  if (has(t, /\b(paso|cedo|suelto) (el )?turno\b/)) return { type: 'turn-pass' };

  const pregunta = /\?|¿/.test(texto) || has(t, /^(por que|porque|como|que es|que pasa|cuando|explica|explicame|cual es la diferencia)\b/);

  if (!pregunta) {
    const a = ctx.acciones;
    if (a.includes('skip') && has(t, /\b(no intercambi\w*|no cambi\w*|avanza|avanzar|avanzo|sigue|siguiente|continua|deja asi|dejalo|pasa)\b/)) {
      return { type: 'action', action: { kind: 'skip' } };
    }
    if (a.includes('swap') && has(t, /\b(intercambi\w*|cambia|cambialos|swap|voltea)\b/)) {
      const nums = numbersIn(t);
      const action: Action = nums.length >= 2 ? { kind: 'swap', values: [nums[0], nums[1]] } : { kind: 'swap' };
      return { type: 'action', action };
    }
    if (a.includes('left') && has(t, /\b(izquierda|izquierdo|izq|menor)\b/)) return { type: 'action', action: { kind: 'left' } };
    if (a.includes('right') && has(t, /\b(derecha|derecho|der|mayor)\b/)) return { type: 'action', action: { kind: 'right' } };
    if (a.includes('visit') && ctx.nodes) {
      const m = t.match(/\b(?:visita|visitar|visito|ve a|anda a|vamos a|ir a|explora|fija|fijar|fijo|procesa|elige|sigue con)\s+(.+)$/);
      const nodo = matchNode(ctx.nodes, m ? m[1] : t);
      if (nodo) return { type: 'action', action: { kind: 'visit', node: nodo } };
    }
    if (ctx.numberAction) {
      const nums = numbersIn(t);
      if (nums.length === 1) {
        const act = ctx.numberAction(nums[0]);
        if (act) return { type: 'action', action: act };
      }
    }
  }

  if (pregunta || t.split(' ').length >= 4) return { type: 'ask', text: texto.trim() };
  return { type: 'unknown', text: texto.trim() };
}

/** Comandos que se muestran en "¿Qué puedo decir?" (RF-19), según la pantalla. */
export function commandHelp(acciones: ActionKind[], ejemploNodo?: string): { frase: string; efecto: string; atajo?: string }[] {
  const lista: { frase: string; efecto: string; atajo?: string }[] = [];
  if (acciones.includes('swap')) lista.push({ frase: 'Intercambia (o "intercambia el 8 con el 5")', efecto: 'Cambia de lugar los dos edificios comparados', atajo: 'I' });
  if (acciones.includes('skip')) lista.push({ frase: 'Avanza', efecto: 'Pasa a la siguiente pareja sin intercambiar', atajo: 'A' });
  if (acciones.includes('left')) lista.push({ frase: 'Izquierda (o "menor")', efecto: 'Elige el lado izquierdo', atajo: '←' });
  if (acciones.includes('right')) lista.push({ frase: 'Derecha (o "mayor")', efecto: 'Elige el lado derecho', atajo: '→' });
  if (acciones.includes('visit')) lista.push({ frase: `Visita ${ejemploNodo ?? 'B'}`, efecto: 'Visita o fija esa estación', atajo: 'Clic en la estación' });
  lista.push(
    { frase: 'Retrocede el tiempo (o "retrocede 2")', efecto: 'Deshace uno o varios pasos', atajo: 'Z' },
    { frase: 'Dame una pista', efecto: 'Pista gradual: orientación, pregunta y ejemplo', atajo: 'P' },
    { frase: '¿Por qué…? / Explícame…', efecto: 'Pregunta libre al Arquitecto Jefe (LLM)' },
    { frase: 'Repite', efecto: 'Vuelve a narrar el último mensaje', atajo: 'R' },
    { frase: 'Más lento / más rápido', efecto: 'Cambia la velocidad de la narración' },
    { frase: 'Estoy frustrado / cansado / con ganas', efecto: 'Ajusta el tono y el ritmo del asistente' },
    { frase: 'Reinicia', efecto: 'Empieza el ejercicio desde cero' },
    { frase: 'Silencio', efecto: 'Detiene la narración' },
  );
  return lista;
}
