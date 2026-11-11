import { useCallback, useEffect, useRef, useState } from 'react';
import { pickSTT, type Alternative, type STTProvider } from '../voice/voice';
import { health } from '../llm/client';
import { useStore } from '../state/store';
import { tts } from '../voice/voice';

/**
 * Barra de mando: micrófono (Web Speech API o Whisper), campo de texto y frases rápidas.
 * Voz, texto y botones llegan al mismo intérprete de comandos (RF-05).
 */
export function CommandBar({ onInput, sugerencias, onSugerencia, disabled }: {
  onInput: (alts: Alternative[], origen: 'voz' | 'texto') => void;
  sugerencias: string[];
  onSugerencia: (s: string) => void;
  disabled?: boolean;
}) {
  const { profile } = useStore();
  const [stt, setStt] = useState<STTProvider | null>(null);
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState('');
  const [ultimo, setUltimo] = useState<{ text: string; conf: number } | null>(null);
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;
  const pref = profile?.prefs.motorVoz ?? 'auto';

  useEffect(() => {
    let vivo = true;
    health().then((h) => vivo && setStt(pickSTT(pref, h.stt)));
    return () => {
      vivo = false;
    };
  }, [pref]);

  const toggle = useCallback(() => {
    if (!stt || disabled) return;
    if (escuchando) {
      stt.stop();
      return;
    }
    tts.cancel(); // no escucharse a sí mismo
    setError('');
    setParcial('');
    setEscuchando(true);
    stt.start({
      onInterim: setParcial,
      onFinal: (alts) => {
        setParcial('');
        setUltimo({ text: alts[0]?.text ?? '', conf: alts[0]?.confidence ?? 0 });
        onInputRef.current(alts, 'voz');
      },
      onError: (m) => setError(m),
      onEnd: () => setEscuchando(false),
    });
  }, [disabled, escuchando, stt]);

  // Atajo M para el micrófono
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [toggle]);

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    onInput([{ text: t, confidence: 1 }], 'texto');
    setTexto('');
  };

  const sinVoz = !stt;
  return (
    <div className="mando" aria-label="Mando por voz y texto" role="region">
      <div className="mando-fila">
        <button className="mic" type="button" onClick={toggle} disabled={sinVoz || disabled} aria-pressed={escuchando}
          aria-label={sinVoz ? 'Micrófono no disponible' : escuchando ? 'Detener micrófono (M)' : 'Hablar (M)'}
          title={sinVoz ? 'Este navegador no tiene reconocimiento de voz: usa el texto o los botones' : `Voz: ${stt?.nombre}`}>
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12Z" /></svg>
        </button>
        <label className="sr-only" htmlFor="cmd-texto">Escribe un comando</label>
        <input id="cmd-texto" className="input" value={texto} onChange={(e) => setTexto(e.target.value)} disabled={disabled}
          onKeyDown={(e) => e.key === 'Enter' && enviar()} placeholder='Di o escribe: "intercambia", "dame una pista", "¿por qué?"…' autoComplete="off" />
        <button className="btn prim" type="button" onClick={enviar} disabled={disabled}>Enviar</button>
      </div>
      <div className="fila" style={{ marginTop: 10 }}>
        {sugerencias.map((s) => (
          <button key={s} type="button" className="btn chico fantasma" onClick={() => onSugerencia(s)} disabled={disabled}>“{s}”</button>
        ))}
      </div>
      <p className="escuche" aria-live="polite">
        {escuchando ? (
          <><span className="onda" aria-hidden="true"><i /><i /><i /><i /></span>{parcial || 'Escuchando…'}</>
        ) : error ? (
          <span style={{ color: 'var(--coral)' }}>{error}</span>
        ) : ultimo ? (
          <>Escuché: “{ultimo.text}”{ultimo.conf > 0 ? ` · confianza ${Math.round(ultimo.conf * 100)} %` : ''}</>
        ) : sinVoz ? (
          'Este navegador no tiene reconocimiento de voz. Usa el texto, los botones o el teclado.'
        ) : (
          <>Toca el micrófono o pulsa <kbd>M</kbd> para hablar · voz: {stt?.nombre}</>
        )}
      </p>
    </div>
  );
}
