import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action, ErrorType, Exercise } from '@shared/types';
import { ERROR_LABEL, NOMBRES } from '@shared/exercises';
import { recordSession } from '@shared/profile';
import { useNav } from '../App';
import { useStore } from '../state/store';
import { emitAck, getSocket } from '../net/socket';
import { PracticeView } from '../components/PracticeView';
import { Bar } from '../components/ui';
import type { CoopBridge, PracticeResult, ProgressReport } from '../practice/usePractice';
import { MODO } from './Salas';

interface Miembro {
  id: string;
  nombre: string;
  rol: 'estudiante' | 'docente';
  conectado: boolean;
  simulado?: boolean;
  progreso: ProgressReport & { ultimaAccion: number };
  terminoEn: number | null;
}

interface RoomSnap {
  codigo: string;
  nombre: string;
  modo: 'cooperativo' | 'duelo' | 'clase';
  ejercicio: Exercise;
  anfitrion: string;
  capacidad: number;
  miembros: Miembro[];
  mensajes: { de: string; texto: string; ts: number; sistema?: boolean }[];
  coop: { state: unknown; turno: string | null; cola: string[]; pasos: number; errores: number; puedeDeshacer: boolean } | null;
  grupo: [ErrorType, number][];
}

/** P09 · Sala en tiempo real (RF-16, RF-17) y P11 · panel docente (RF-21). */
export function Sala({ codigo }: { codigo: string }) {
  const { profile, setProfile } = useStore();
  const { go } = useNav();
  const [room, setRoom] = useState<RoomSnap | null>(null);
  const [error, setError] = useState('');
  const [terminado, setTerminado] = useState(false);
  const profRef = useRef(profile);
  profRef.current = profile;

  useEffect(() => {
    if (!profile) return;
    const s = getSocket();
    const onEstado = (r: RoomSnap) => r.codigo === codigo && setRoom(r);
    const unirse = () =>
      emitAck('sala:unirse', { codigo, usuario: { id: profile.id, nombre: profile.nombre, rol: profile.rol } }).then((r) => {
        if (!r.ok) setError(r.error ?? 'No se pudo entrar a la sala.');
      });
    s.on('sala:estado', onEstado);
    s.on('connect', unirse); // al reconectar, vuelve a entrar
    unirse();
    return () => {
      s.off('sala:estado', onEstado);
      s.off('connect', unirse);
      s.emit('sala:salir');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, profile?.id]);

  const yo = room?.miembros.find((m) => m.id === profile?.id);
  const esDocente = room?.modo === 'clase' && profile?.rol === 'docente';

  const coop: CoopBridge | undefined = useMemo(() => {
    if (!room?.coop || !profile) return undefined;
    const s = getSocket();
    const turnoDe = room.miembros.find((m) => m.id === room.coop!.turno)?.nombre ?? 'nadie';
    return {
      state: room.coop.state,
      miTurno: room.coop.turno === profile.id,
      turnoDe,
      puedeDeshacer: room.coop.puedeDeshacer,
      act: (a: Action) => s.emit('sala:accion', { action: a }),
      undo: () => s.emit('sala:deshacer', {}),
      turno: (tipo) => s.emit('sala:turno', { tipo }),
    };
  }, [room, profile]);

  const onProgress = useCallback((p: ProgressReport) => getSocket().emit('sala:progreso', p), []);
  const onFinish = useCallback((r: PracticeResult) => {
    const p = profRef.current;
    if (p) setProfile(recordSession(p, r.summary).profile);
    setTerminado(true);
  }, [setProfile]);

  if (!profile) return null;
  if (error) {
    return (
      <div className="tarjeta">
        <h1>No se pudo entrar a {codigo}</h1>
        <p style={{ margin: '10px 0' }}>{error}</p>
        <button className="btn prim" onClick={() => go('salas')}>Ver salas abiertas</button>
      </div>
    );
  }
  if (!room) return <p className="tenue">Entrando a la sala {codigo}…</p>;

  const lateral = (
    <>
      <Participantes room={room} yoId={profile.id} />
      <Chat room={room} />
    </>
  );

  return (
    <>
      <div className="fila" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="etiqueta">Sala {MODO[room.modo].nombre.toLowerCase()} · {NOMBRES[room.ejercicio.algoritmo]}</div>
          <div style={{ fontFamily: 'var(--f-senal)', fontWeight: 800, fontSize: '1.3rem' }}>{room.nombre}</div>
        </div>
        <div className="fila">
          <span className="chip mono" style={{ fontSize: '1.1rem' }} aria-label={`Código de la sala ${room.codigo}`}>{room.codigo}</span>
          <button className="btn chico" onClick={() => navigator.clipboard?.writeText(`${location.origin}/#/sala/${room.codigo}`)}>Copiar enlace</button>
          <button className="btn chico fantasma" onClick={() => go('salas')}>Salir</button>
        </div>
      </div>
      {terminado && room.modo !== 'cooperativo' && (
        <div className="aviso" role="status">¡Terminaste! Tu resultado quedó en tu perfil. Mira cómo van los demás en el panel de la sala.</div>
      )}
      {esDocente ? (
        <PanelDocente room={room} lateral={lateral} />
      ) : (
        <PracticeView
          key={`${room.codigo}-${room.ejercicio.id}`}
          exercise={room.ejercicio}
          examen={room.modo === 'duelo'}
          coop={coop}
          onProgress={room.modo === 'cooperativo' ? undefined : onProgress}
          onFinish={room.modo === 'cooperativo' ? undefined : onFinish}
          extraPanel={<>{room.modo !== 'cooperativo' && <Carrera room={room} yoId={yo?.id} />}{lateral}</>}
        />
      )}
    </>
  );
}

function estado(m: Miembro, ahora: number): { texto: string; clase: string } {
  if (m.progreso.done) return { texto: 'Terminó', clase: 'verde' };
  const quieto = (ahora - m.progreso.ultimaAccion) / 1000;
  if (m.progreso.errores >= 3 || (!m.simulado && quieto > 60)) return { texto: 'Necesita ayuda', clase: 'coral' };
  if (m.progreso.pasos === 0) return { texto: 'Por empezar', clase: '' };
  return { texto: 'Avanzando', clase: 'ambar' };
}

function useAhora(ms = 5000) {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), ms);
    return () => clearInterval(i);
  }, [ms]);
  return t;
}

function PanelDocente({ room, lateral }: { room: RoomSnap; lateral: JSX.Element }) {
  const ahora = useAhora();
  const alumnos = room.miembros.filter((m) => m.rol !== 'docente');
  const terminaron = alumnos.filter((m) => m.progreso.done).length;
  const ayuda = alumnos.filter((m) => estado(m, ahora).texto === 'Necesita ayuda');
  const maxErr = Math.max(1, ...room.grupo.map(([, v]) => v));
  return (
    <div className="practica">
      <section aria-labelledby="t-panel">
        <h1 id="t-panel" style={{ fontSize: 'clamp(1.5rem,3vw,2.2rem)', marginBottom: 6 }}>Panel docente</h1>
        <p className="tenue" style={{ marginBottom: 14 }}>
          Ejercicio: <b>{room.ejercicio.titulo}</b>. Comparte el código <b className="mono">{room.codigo}</b> con tu clase.
          {' '}{terminaron} de {alumnos.length} terminaron · {ayuda.length} necesitan ayuda.
        </p>
        <div className="tarjeta desplaza">
          <table className="tabla">
            <caption className="sr-only">Progreso de cada estudiante</caption>
            <thead><tr><th>Estudiante</th><th>Progreso</th><th>Errores</th><th>Pistas</th><th>Estado</th><th>Último error</th></tr></thead>
            <tbody>
              {alumnos.map((m) => {
                const e = estado(m, ahora);
                const p = m.progreso.total ? m.progreso.pasos / m.progreso.total : 0;
                return (
                  <tr key={m.id}>
                    <td><b>{m.nombre}</b><div className="tenue" style={{ fontSize: '.8rem' }}>{m.simulado ? 'simulado' : m.conectado ? 'conectado' : 'desconectado'}</div></td>
                    <td style={{ minWidth: 140 }}><Bar value={p} label={`Progreso de ${m.nombre}`} /><span className="tenue num" style={{ fontSize: '.8rem' }}>{m.progreso.pasos}/{m.progreso.total}</span></td>
                    <td className="num">{m.progreso.errores}</td>
                    <td className="num">{m.progreso.pistas}</td>
                    <td><span className={`chip estado-chip ${e.clase}`}>{e.texto}</span></td>
                    <td style={{ fontSize: '.88rem' }}>{m.progreso.ultimoError ?? '—'}</td>
                  </tr>
                );
              })}
              {alumnos.length === 0 && <tr><td colSpan={6} className="vacio">Aún no entra nadie. Comparte el código.</td></tr>}
            </tbody>
          </table>
        </div>
        <section className="tarjeta" style={{ marginTop: 14 }} aria-labelledby="t-grupo">
          <h2 id="t-grupo">Errores más frecuentes del grupo</h2>
          {room.grupo.length === 0 ? <p className="vacio">Sin errores registrados todavía.</p> : (
            <div className="barras" style={{ marginTop: 8 }}>
              {room.grupo.map(([k, v]) => (
                <div key={k} className="b"><span>{ERROR_LABEL[k]}</span><Bar value={v / maxErr} label={ERROR_LABEL[k]} /><b className="num">{v}</b></div>
              ))}
            </div>
          )}
          {room.grupo[0] && <p className="tenue" style={{ marginTop: 10 }}>Sugerencia: repasa en la pizarra “{ERROR_LABEL[room.grupo[0][0]].toLowerCase()}” con un ejemplo antes de seguir.</p>}
        </section>
      </section>
      <aside>{lateral}</aside>
    </div>
  );
}

function Carrera({ room, yoId }: { room: RoomSnap; yoId?: string }) {
  const alumnos = room.miembros.filter((m) => m.rol !== 'docente');
  return (
    <div className="panel">
      <div className="etiqueta" style={{ marginBottom: 8 }}>{room.modo === 'duelo' ? 'Carrera' : 'Avance de la clase'}</div>
      <div className="carrera">
        {alumnos.map((m) => (
          <div key={m.id} className="fila-c">
            <span style={{ fontWeight: m.id === yoId ? 800 : 400 }}>{m.id === yoId ? 'Tú' : m.nombre}</span>
            <Bar value={m.progreso.total ? m.progreso.pasos / m.progreso.total : 0} label={`Avance de ${m.nombre}`} />
            <span className="num tenue" style={{ fontSize: '.85rem' }}>{m.progreso.done ? '🏁' : `${m.progreso.errores} err`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Participantes({ room, yoId }: { room: RoomSnap; yoId: string }) {
  return (
    <div className="panel">
      <div className="etiqueta" style={{ marginBottom: 8 }}>Participantes ({room.miembros.filter((m) => m.conectado || m.simulado).length}/{room.capacidad})</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        {room.miembros.map((m) => (
          <li key={m.id} className="fila" style={{ gap: 8 }}>
            <span className={`punto ${m.conectado ? 'on' : ''}`} aria-hidden="true" />
            <span>{m.nombre}{m.id === yoId ? ' (tú)' : ''}</span>
            {m.rol === 'docente' && <span className="chip">docente</span>}
            {m.simulado && <span className="chip">simulado</span>}
            {room.coop?.turno === m.id && <span className="chip ambar">turno</span>}
            {room.coop && room.coop.cola.includes(m.id) && <span className="chip">en cola</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chat({ room }: { room: RoomSnap }) {
  const [t, setT] = useState('');
  const enviar = () => {
    if (!t.trim()) return;
    getSocket().emit('sala:mensaje', { texto: t });
    setT('');
  };
  return (
    <div className="panel">
      <div className="etiqueta" style={{ marginBottom: 8 }}>Mensajes</div>
      <div className="chat" role="log" aria-live="polite" ref={(el) => el && (el.scrollTop = el.scrollHeight)}>
        {room.mensajes.slice(-30).map((m, k) => (
          <div key={k} className={m.sistema ? 'sis' : ''}>{m.sistema ? m.texto : <><b>{m.de}:</b> {m.texto}</>}</div>
        ))}
      </div>
      <div className="fila" style={{ marginTop: 8 }}>
        <label className="sr-only" htmlFor="chat-t">Mensaje</label>
        <input id="chat-t" className="input" style={{ flex: 1 }} value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} maxLength={280} />
        <button className="btn chico" onClick={enviar}>Enviar</button>
      </div>
    </div>
  );
}
