import type { Preferences } from '@shared/profile';
import type { Level } from '@shared/types';
import { useNav } from '../App';
import { useStore } from '../state/store';
import { tts, webSpeechAvailable } from '../voice/voice';

function Radio<K extends keyof Preferences>({ k, opciones, label, p, set }: {
  k: K; opciones: [Preferences[K], string][]; label: string; p: Preferences; set: (k: K, v: Preferences[K]) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="opciones">
        {opciones.map(([v, l]) => (
          <label key={String(v)} className="opcion">
            <input type="radio" name={String(k)} checked={p[k] === v} onChange={() => set(k, v)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** P02 · Tu forma de aprender. Cada cambio se aplica de inmediato en toda la app (RF-02). */
export function Preferencias() {
  const { profile, update } = useStore();
  const { go, red } = useNav();
  if (!profile) return null;
  const p = profile.prefs;
  const set = <K extends keyof Preferences>(k: K, v: Preferences[K]) => update((x) => ({ ...x, prefs: { ...x.prefs, [k]: v } }));
  const primera = profile.sesiones.length === 0;

  return (
    <>
      <h1 style={{ fontSize: 'clamp(1.7rem,3.4vw,2.5rem)', marginBottom: 6 }}>Tu forma de aprender</h1>
      <p className="tenue" style={{ marginBottom: 20 }}>Puedes cambiar esto cuando quieras desde tu perfil. Los cambios se ven al instante.</p>
      <div className="dos">
        <div className="pila">
          <Radio p={p} set={set} k="texto" label="Tamaño del texto" opciones={[['normal', 'Normal'], ['grande', 'Grande'], ['muy-grande', 'Muy grande']]} />
          <Radio p={p} set={set} k="contraste" label="Contraste" opciones={[['estandar', 'Estándar'], ['alto', 'Alto contraste']]} />
          <Radio p={p} set={set} k="tema" label="Tema" opciones={[['auto', 'Como mi sistema'], ['claro', 'Claro'], ['oscuro', 'Oscuro']]} />
          <fieldset>
            <legend>Nivel</legend>
            <div className="opciones">
              {(['basico', 'intermedio', 'avanzado'] as Level[]).map((n) => (
                <label key={n} className="opcion">
                  <input type="radio" name="nivel" checked={profile.nivel === n} onChange={() => update((x) => ({ ...x, nivel: n }))} />
                  <span>{{ basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' }[n]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="pila">
          <fieldset>
            <legend>Voz</legend>
            <label className="interruptor">Narración del asistente (texto a voz)
              <input type="checkbox" checked={p.narracion} onChange={(e) => set('narracion', e.target.checked)} />
            </label>
            <label className="campo" style={{ marginTop: 8 }}>
              Velocidad de la narración: {p.velocidadVoz.toFixed(2)}×
              <input type="range" min={0.6} max={1.6} step={0.05} value={p.velocidadVoz} onChange={(e) => set('velocidadVoz', Number(e.target.value))} />
            </label>
            <button className="btn chico" style={{ marginTop: 8 }} onClick={() => tts.speak('Hola, soy el Arquitecto Jefe. Así sonará mi voz.', { rate: p.velocidadVoz, tono: p.modoCalma ? 'calmo' : 'neutral' })}>Probar voz</button>
            <label className="campo" style={{ marginTop: 12 }}>
              Reconocimiento de voz
              <select className="input" value={p.motorVoz} onChange={(e) => set('motorVoz', e.target.value as Preferences['motorVoz'])}>
                <option value="auto">Automático (recomendado)</option>
                <option value="webspeech" disabled={!webSpeechAvailable()}>Web Speech API del navegador{webSpeechAvailable() ? '' : ' (no disponible aquí)'}</option>
                <option value="whisper" disabled={!red?.stt}>Whisper en el servidor{red?.stt ? '' : ' (no configurado)'}</option>
                <option value="ninguno">Sin micrófono: solo texto, botones y teclado</option>
              </select>
            </label>
          </fieldset>
          <fieldset>
            <legend>Comodidad</legend>
            <label className="interruptor">Modo calma (colores suaves, voz pausada, menos animación)
              <input type="checkbox" checked={p.modoCalma} onChange={(e) => set('modoCalma', e.target.checked)} />
            </label>
            <label className="interruptor">Reducir movimiento
              <input type="checkbox" checked={p.reducirMovimiento} onChange={(e) => set('reducirMovimiento', e.target.checked)} />
            </label>
          </fieldset>
          <fieldset>
            <legend>Privacidad</legend>
            <label className="interruptor">Permitir enviar el texto de mis preguntas a un proveedor de IA remoto
              <input type="checkbox" checked={p.consentimientoLLM} onChange={(e) => set('consentimientoLLM', e.target.checked)} />
            </label>
            <p className="tenue" style={{ fontSize: '.88rem' }}>Si lo desactivas, el asistente usa solo un modelo local o respuestas predefinidas. Tu voz nunca se guarda.</p>
          </fieldset>
        </div>
      </div>
      <div className="fila" style={{ marginTop: 22 }}>
        <button className="btn prim" onClick={() => go('inicio')}>{primera ? 'Guardar y entrar a mi ciudad' : 'Listo'}</button>
      </div>
    </>
  );
}
