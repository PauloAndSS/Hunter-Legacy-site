import React, { useEffect, useRef } from 'react';
import { isDiscordAvatar } from '../discord';
export function Avatar({ profile, fallback = '?', size = 40 }) {
  return (
    <span className="avatar3" style={{ width: size, height: size }}>
      {isDiscordAvatar(profile?.avatar_url) ? (
        <img
          key={profile.avatar_url}
          src={profile.avatar_url}
          alt=""
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      <span>{(profile?.nickname || fallback).slice(0, 2).toUpperCase()}</span>
    </span>
  );
}
export function Modal({ title, onClose, children, wide = false, drawer = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const root = ref.current;
    root?.focus();
    function key(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const a = [
          ...root.querySelectorAll(
            'button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        ];
        if (!a.length) return;
        if (e.shiftKey && (document.activeElement === a[0] || document.activeElement === root)) {
          e.preventDefault();
          a.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === a.at(-1)) {
          e.preventDefault();
          a[0].focus();
        }
      }
    }
    root?.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      root?.removeEventListener('keydown', key);
      document.body.style.overflow = prev;
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div
      className={'modal-back ' + (drawer ? 'drawer-back' : '')}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={'modal3 ' + (wide ? 'wide ' : '') + (drawer ? 'drawer' : '')}
      >
        <header className="modal-head">
          <button className="quiet" onClick={onClose}>
            ← Voltar
          </button>
          <strong>{title}</strong>
          <button className="quiet" aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Empty({ title, children }) {
  return (
    <div className="empty">
      <span>✦</span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Meter({ label, value, max, color = '#477e57' }) {
  const v = Math.max(0, Number(value) || 0),
    m = Math.max(0, Number(max) || 0);
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <strong>
          {v} / {m}
        </strong>
      </div>
      <div className="meter-track">
        <i style={{ width: (m ? Math.min(100, (100 * v) / m) : 0) + '%', background: color }} />
      </div>
    </div>
  );
}
export function DiceToast({ roll, onClose }) {
  if (!roll) return null;
  return (
    <div className="dice-toast" key={roll.id} role="status">
      <button className="quiet" onClick={onClose} aria-label="Fechar resultado">
        ×
      </button>
      <div className="dice-poly">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <polygon
            points="50,2 93,27 93,73 50,98 7,73 7,27"
            fill="#d6b66b"
            stroke="#fff4cb"
            strokeWidth="2"
          />
          <path
            d="M50 2L27 68 93 27 50 98 7 27 73 68 50 2M7 73L93 73M27 68L73 68"
            stroke="#927744"
            fill="none"
            strokeWidth="1.5"
          />
        </svg>
        <b>{roll.dice?.[0] ?? roll.total}</b>
      </div>
      <div className="dice-copy">
        <small>RESULTADO DA ROLAGEM</small>
        <strong>{roll.label}</strong>
        <span>
          {roll.expression} · [{roll.dice?.join(', ')}]
        </span>
        <b>{roll.total}</b>
      </div>
    </div>
  );
}
