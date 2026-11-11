import { CannedProvider, type LearnerProfile, type SessionRecap, type StepEvent, type VariantRequest } from '@shared/llm/LLMProvider';
import type { Exercise } from '@shared/types';

/**
 * Cliente del LLM en la PWA. Llama al servidor (que elige el proveedor real) y, si no hay
 * red o el servidor no responde, usa los textos predefinidos localmente (RF-22).
 */
const local = new CannedProvider();
const TIMEOUT = 4500;

export interface Health {
  online: boolean;
  cadena: string[];
  stt: boolean;
  /** Hay un modelo real (remoto o local) además de los textos predefinidos. */
  conModelo: boolean;
}

let cache: { t: number; h: Health } | null = null;

export async function health(force = false): Promise<Health> {
  if (!force && cache && Date.now() - cache.t < 20000) return cache.h;
  let h: Health = { online: false, cadena: ['canned (sin conexión)'], stt: false, conModelo: false };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) {
      const d = (await r.json()) as { llm: { cadena: string[] }; stt: boolean };
      h = { online: true, cadena: d.llm.cadena, stt: d.stt, conModelo: d.llm.cadena.some((c) => c !== 'canned') };
    }
  } catch {
    /* sin servidor: modo sin conexión */
  }
  cache = { t: Date.now(), h };
  return h;
}

let consentimiento = true;
export function setConsent(v: boolean) {
  consentimiento = v;
}

async function call<T>(op: string, body: unknown): Promise<T & { provider?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(`/api/llm/${op}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-llm-consent': consentimiento ? '1' : '0' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T & { provider?: string };
  } finally {
    clearTimeout(t);
  }
}

export interface LLMText {
  text: string;
  provider: string;
}

export const llm = {
  async hint(step: StepEvent, level: 1 | 2 | 3, profile: LearnerProfile): Promise<LLMText> {
    try {
      const r = await call<{ text: string }>('hint', { step, level, profile });
      return { text: r.text, provider: r.provider ?? 'servidor' };
    } catch {
      return { text: await local.hint(step, level), provider: 'local' };
    }
  },
  async narrate(step: StepEvent, profile: LearnerProfile): Promise<LLMText> {
    try {
      const r = await call<{ text: string }>('narrate', { step, profile });
      return { text: r.text, provider: r.provider ?? 'servidor' };
    } catch {
      return { text: await local.narrate(step, profile), provider: 'local' };
    }
  },
  async ask(question: string, step: StepEvent | null, profile: LearnerProfile): Promise<LLMText> {
    try {
      const r = await call<{ text: string }>('ask', { question, step, profile });
      return { text: r.text, provider: r.provider ?? 'servidor' };
    } catch {
      return { text: await local.ask(question, step), provider: 'local' };
    }
  },
  async reflect(recap: SessionRecap, profile: LearnerProfile): Promise<LLMText> {
    try {
      const r = await call<{ text: string }>('reflect', { recap, profile });
      return { text: r.text, provider: r.provider ?? 'servidor' };
    } catch {
      return { text: await local.reflect(recap), provider: 'local' };
    }
  },
  async variant(req: VariantRequest): Promise<{ exercise: Exercise; provider: string }> {
    try {
      const r = await call<{ exercise: Exercise }>('variant', req);
      return { exercise: r.exercise, provider: r.provider ?? 'servidor' };
    } catch {
      return { exercise: await local.variant(req), provider: 'local' };
    }
  },
};

export function providerLabel(p: string): string {
  if (p.startsWith('remote')) return 'IA remota';
  if (p.startsWith('local:')) return 'IA local (Ollama)';
  if (p === 'canned' || p === 'local') return 'respuesta predefinida';
  return p;
}
