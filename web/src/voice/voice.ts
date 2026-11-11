/**
 * Capa de voz con proveedores intercambiables (misma idea que LLMProvider).
 * - WebSpeechSTT: Web Speech API del navegador (Chrome, Edge, Safari). Gratis, sin API key.
 * - WhisperSTT: graba con MediaRecorder y transcribe en el servidor (/api/stt) con Whisper.
 *   Respaldo para Firefox o cuando la Web Speech API no está disponible.
 * - BrowserTTS: speechSynthesis, funciona sin conexión y permite ajustar velocidad y tono.
 * El audio nunca se guarda: solo se usa el texto reconocido (RNF-07).
 */

export interface Alternative {
  text: string;
  /** 0 – 1. Chrome a veces devuelve 0 cuando no la calcula: se trata como desconocida. */
  confidence: number;
}

export interface STTHandlers {
  onInterim?: (text: string) => void;
  onFinal: (alts: Alternative[]) => void;
  onError?: (msg: string) => void;
  onEnd?: () => void;
}

export interface STTProvider {
  readonly id: 'webspeech' | 'whisper';
  readonly nombre: string;
  start(h: STTHandlers): void;
  stop(): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = any;

function recognitionCtor(): AnyRec | null {
  const w = window as AnyRec;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const webSpeechAvailable = () => typeof window !== 'undefined' && !!recognitionCtor();
export const recorderAvailable = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

const ERRORES: Record<string, string> = {
  'not-allowed': 'El navegador bloqueó el micrófono. Permítelo en el candado de la barra de direcciones o usa el campo de texto.',
  'service-not-allowed': 'El reconocimiento de voz no está permitido en este navegador.',
  'no-speech': 'No escuché nada. Toca el micrófono e intenta otra vez.',
  'audio-capture': 'No encuentro un micrófono conectado.',
  network: 'El reconocimiento de voz del navegador necesita internet. Escribe el comando o usa los botones.',
  aborted: '',
};

export class WebSpeechSTT implements STTProvider {
  readonly id = 'webspeech' as const;
  readonly nombre = 'Web Speech API';
  private rec: AnyRec | null = null;

  start(h: STTHandlers) {
    const Ctor = recognitionCtor();
    if (!Ctor) return h.onError?.('Este navegador no tiene reconocimiento de voz.');
    const rec = new Ctor();
    this.rec = rec;
    rec.lang = 'es-PE';
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    rec.onresult = (e: AnyRec) => {
      const res = e.results[e.results.length - 1];
      if (res.isFinal) {
        const alts: Alternative[] = [];
        for (let i = 0; i < res.length; i++) alts.push({ text: res[i].transcript, confidence: res[i].confidence ?? 0 });
        h.onFinal(alts);
      } else {
        h.onInterim?.(res[0].transcript);
      }
    };
    rec.onerror = (e: AnyRec) => {
      const msg = ERRORES[e.error] ?? `Error de reconocimiento: ${e.error}`;
      if (msg) h.onError?.(msg);
    };
    rec.onend = () => h.onEnd?.();
    try {
      rec.start();
    } catch {
      h.onError?.('No se pudo iniciar el micrófono.');
      h.onEnd?.();
    }
  }

  stop() {
    try {
      this.rec?.stop();
    } catch {
      /* ya detenido */
    }
  }
}

export class WhisperSTT implements STTProvider {
  readonly id = 'whisper' as const;
  readonly nombre = 'Whisper (servidor)';
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  async start(h: STTHandlers) {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      h.onError?.(ERRORES['not-allowed']);
      h.onEnd?.();
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    this.recorder = rec;
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      h.onInterim?.('Transcribiendo…');
      try {
        const form = new FormData();
        form.append('audio', new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), 'voz.webm');
        const r = await fetch('/api/stt', { method: 'POST', body: form });
        const data = (await r.json()) as { text?: string; error?: string };
        if (!r.ok || !data.text) h.onError?.(data.error ?? 'No se entendió el audio.');
        else h.onFinal([{ text: data.text, confidence: 0.9 }]);
      } catch {
        h.onError?.('No hay conexión con el servidor de transcripción.');
      }
      h.onEnd?.();
    };
    rec.start();
    h.onInterim?.('Grabando… toca de nuevo para terminar');
    // Los comandos son cortos: se corta solo a los 5 s.
    this.timer = setTimeout(() => this.stop(), 5000);
  }

  stop() {
    clearTimeout(this.timer);
    if (this.recorder?.state === 'recording') this.recorder.stop();
  }
}

/** Elige el proveedor según la preferencia y lo que soporta el navegador y el servidor. */
export function pickSTT(pref: 'auto' | 'webspeech' | 'whisper' | 'ninguno', serverSTT: boolean): STTProvider | null {
  if (pref === 'ninguno') return null;
  if (pref === 'whisper') return recorderAvailable() && serverSTT ? new WhisperSTT() : webSpeechAvailable() ? new WebSpeechSTT() : null;
  if (webSpeechAvailable()) return new WebSpeechSTT();
  if (recorderAvailable() && serverSTT) return new WhisperSTT();
  return null;
}

// ------------------------------------------------------------ TTS

export type Tono = 'calmo' | 'neutral' | 'entusiasta';

export const tts = {
  available: () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  voz(): SpeechSynthesisVoice | null {
    const voces = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es'));
    return voces.find((v) => /pe|419|mx|us/i.test(v.lang)) ?? voces[0] ?? null;
  },
  speak(text: string, opts: { rate: number; tono: Tono }) {
    if (!tts.available() || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[→]/g, ' a ').replace(/≤/g, ' menor o igual que ').replace(/≥/g, ' mayor o igual que ').replace(/∞/g, 'infinito'));
    u.lang = 'es-PE';
    const v = tts.voz();
    if (v) u.voice = v;
    // Diseño emocional: voz más pausada y grave cuando el estudiante está frustrado o cansado.
    u.rate = Math.max(0.5, Math.min(2, opts.rate * (opts.tono === 'calmo' ? 0.9 : opts.tono === 'entusiasta' ? 1.05 : 1)));
    u.pitch = opts.tono === 'calmo' ? 0.92 : opts.tono === 'entusiasta' ? 1.12 : 1;
    speechSynthesis.speak(u);
  },
  cancel() {
    if (tts.available()) speechSynthesis.cancel();
  },
};
