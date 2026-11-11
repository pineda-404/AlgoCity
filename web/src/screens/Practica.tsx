import { useCallback, useRef } from 'react';
import { recordSession } from '@shared/profile';
import { useNav } from '../App';
import { useStore } from '../state/store';
import { PracticeView } from '../components/PracticeView';
import type { PracticeResult } from '../practice/usePractice';

/** P05 · Ejecución guiada por voz. */
export function Practica() {
  const { practica, go, setResultado } = useNav();
  const { profile, setProfile } = useStore();
  const ref = useRef(profile);
  ref.current = profile;

  const onFinish = useCallback((r: PracticeResult) => {
    // El perfil se actualiza al cerrar cada ejercicio (RF-13).
    const p = ref.current;
    let nuevas: string[] = [];
    if (p) {
      const res = recordSession(p, r.summary);
      nuevas = res.nuevas;
      setProfile(res.profile);
    }
    setResultado({ ...r, nuevas });
    go('resumen');
  }, [go, setProfile, setResultado]);

  if (!practica) {
    return (
      <div className="tarjeta">
        <h1>No hay un ejercicio abierto</h1>
        <p style={{ margin: '10px 0' }}>Elige uno en el catálogo.</p>
        <button className="btn prim" onClick={() => go('catalogo')}>Ir al catálogo</button>
      </div>
    );
  }
  return <PracticeView key={`${practica.exercise.id}-${practica.examen}`} exercise={practica.exercise} examen={practica.examen} onFinish={onFinish} />;
}
