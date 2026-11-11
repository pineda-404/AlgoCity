import { CannedProvider, FallbackProvider, OpenAICompatibleProvider, type LLMProvider } from '../shared/llm/LLMProvider';

/**
 * Arma la cadena de proveedores según .env (RF-11). Cambiar de proveedor es solo
 * cambiar variables de entorno: ningún otro módulo conoce al proveedor concreto.
 */
export interface LLMSetup {
  /** Cadena completa (puede incluir el proveedor remoto). */
  full: FallbackProvider;
  /** Cadena sin proveedor remoto, para quien no dio consentimiento (RNF-07). */
  privada: FallbackProvider;
  nombres: string[];
}

export function buildLLM(env = process.env): LLMSetup {
  const timeoutMs = Number(env.LLM_TIMEOUT_MS ?? 3000);
  const modo = (env.LLM_PROVIDER ?? 'canned').toLowerCase();
  const remotos: LLMProvider[] = [];
  const locales: LLMProvider[] = [];

  if (modo === 'remote' && env.LLM_API_KEY) {
    remotos.push(
      new OpenAICompatibleProvider(`remote:${env.LLM_MODEL ?? 'gpt-4o-mini'}`, {
        baseUrl: env.LLM_BASE_URL ?? 'https://api.openai.com/v1',
        apiKey: env.LLM_API_KEY,
        model: env.LLM_MODEL ?? 'gpt-4o-mini',
      }),
    );
  }
  if (modo === 'remote' || modo === 'local') {
    const ollama = env.OLLAMA_URL ?? 'http://localhost:11434';
    locales.push(new OpenAICompatibleProvider(`local:${env.OLLAMA_MODEL ?? 'llama3.2'}`, { baseUrl: `${ollama.replace(/\/$/, '')}/v1`, model: env.OLLAMA_MODEL ?? 'llama3.2' }));
  }
  const canned = new CannedProvider();
  const full = [...remotos, ...locales, canned];
  return {
    full: new FallbackProvider(full, { timeoutMs }),
    privada: new FallbackProvider([...locales, canned], { timeoutMs }),
    nombres: full.map((p) => p.name),
  };
}

export interface STTConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** Reconocimiento de voz de respaldo (Whisper vía API compatible con OpenAI). Opcional. */
export function sttConfig(env = process.env): STTConfig | null {
  if (!env.STT_API_KEY) return null;
  return { baseUrl: env.STT_BASE_URL ?? 'https://api.openai.com/v1', apiKey: env.STT_API_KEY, model: env.STT_MODEL ?? 'whisper-1' };
}

export async function transcribe(cfg: STTConfig, audio: Buffer, mime: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: mime }), mime.includes('ogg') ? 'voz.ogg' : 'voz.webm');
  form.append('model', cfg.model);
  form.append('language', 'es');
  // Vocabulario esperado: mejora el reconocimiento de comandos cortos.
  form.append('prompt', 'intercambia, avanza, retrocede el tiempo, dame una pista, izquierda, derecha, visita, qué puedo decir');
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`STT HTTP ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}
