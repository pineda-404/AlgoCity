import { useEffect, useRef, type ReactNode } from 'react';
import type { Mood } from '@shared/types';
import { commandHelp } from '@shared/commands';
import type { ActionKind } from '@shared/types';

export function Dialog({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, [href], input, select, textarea')?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('keydown', esc);
      previo?.focus();
    };
  }, [onClose]);
  return (
    <div className="velo" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialogo" role="dialog" aria-modal="true" aria-labelledby="dlg-titulo" ref={ref}>
        <h2 id="dlg-titulo">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

export function HelpDialog({ acciones, nodo, onClose }: { acciones: ActionKind[]; nodo?: string; onClose: () => void }) {
  return (
    <Dialog titulo="¿Qué puedo decir?" onClose={onClose}>
      <p className="tenue" style={{ marginBottom: 12 }}>Dilo con el micrófono, escríbelo o usa el atajo de teclado. Todos hacen lo mismo.</p>
      <div className="desplaza">
        <table className="tabla">
          <thead><tr><th>Di o escribe</th><th>Qué hace</th><th>Atajo</th></tr></thead>
          <tbody>
            {commandHelp(acciones, nodo).map((c) => (
              <tr key={c.frase}><td><b>“{c.frase}”</b></td><td>{c.efecto}</td><td>{c.atajo ? <kbd>{c.atajo}</kbd> : '—'}</td></tr>
            ))}
            <tr><td><b>Micrófono</b></td><td>Empieza o detiene la escucha</td><td><kbd>M</kbd></td></tr>
          </tbody>
        </table>
      </div>
      <div className="fila" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
        <button className="btn prim" onClick={onClose}>Entendido</button>
      </div>
    </Dialog>
  );
}

export const MOODS: { id: Mood; label: string; icono: string }[] = [
  { id: 'ganas', label: 'Con ganas', icono: '🚀' },
  { id: 'normal', label: 'Normal', icono: '🙂' },
  { id: 'cansado', label: 'Cansado/a', icono: '😴' },
  { id: 'frustrado', label: 'Frustrado/a', icono: '😣' },
];

export function MoodPicker({ value, onChange, label }: { value: Mood | null; onChange: (m: Mood) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="animos">
      {MOODS.map((m) => (
        <button key={m.id} type="button" aria-pressed={value === m.id} onClick={() => onChange(m.id)}>
          <span aria-hidden="true">{m.icono}</span> {m.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return <div className="toast" role="status">{children}</div>;
}

export function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div className="barra-prog" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <i style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg className="marca-signo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="12" fill="var(--verde)" />
      <rect x="12" y="30" width="10" height="22" rx="1.5" fill="var(--sobre-verde)" />
      <rect x="27" y="14" width="10" height="38" rx="1.5" fill="var(--sobre-verde)" />
      <rect x="42" y="38" width="10" height="14" rx="1.5" fill="var(--ambar)" />
    </svg>
  );
}

export function fmtTiempo(seg: number): string {
  const m = Math.floor(seg / 60), s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
