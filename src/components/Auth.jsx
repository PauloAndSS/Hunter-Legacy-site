import React, { useState } from 'react';
import { db, unwrap } from '../db';
import { asset } from '../assets';

// Erro devolvido pelo Discord/Supabase no endereço de retorno.
function callbackError() {
  for (const part of [window.location.search, window.location.hash]) {
    const params = new URLSearchParams(part.replace(/^[?#]/, ''));
    if (params.get('error') === 'access_denied') return 'A entrada com o Discord foi cancelada.';
    if (params.get('error_description')) return params.get('error_description');
  }
  return '';
}
export default function Auth() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(callbackError);
  async function discord() {
    if (busy) return;
    setMessage('');
    setBusy(true);
    try {
      await unwrap(
        db.auth.signInWithOAuth({
          provider: 'discord',
          options: { redirectTo: window.location.origin + window.location.pathname },
        }),
      );
    } catch (e) {
      setMessage(e.message);
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="auth-brand">
          <span className="compass">✦</span>
          <div>
            HUNTER LEGACY<small>ASSOCIAÇÃO DE HUNTERS</small>
          </div>
        </div>
        <div className="auth-art">
          <img src={asset('assets/mapa-mundi.png')} alt="Mapa do mundo de Hunter Legacy" />
        </div>
        <div className="auth-intro">
          <span className="eyebrow">ARQUIVO DE EXPEDIÇÃO / 001</span>
          <h1>Toda grande jornada começa com uma escolha.</h1>
          <p>Crie seu personagem, encontre sua equipe e explore o mundo.</p>
        </div>
        <small>PLATAFORMA DE RPG • PROJETO DE FÃS</small>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form panel">
          <div className="eyebrow">ACESSO À ASSOCIAÇÃO</div>
          <h1>Bem-vindo, Hunter.</h1>
          <p className="muted">
            Entre com o Discord. No primeiro acesso, sua conta é criada automaticamente.
          </p>
          <button className="discord-button" type="button" disabled={busy} onClick={discord}>
            {busy ? 'Aguarde…' : 'Entrar com o Discord'} <span aria-hidden="true">→</span>
          </button>
          {message && (
            <div role="alert" className="error">
              {message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
