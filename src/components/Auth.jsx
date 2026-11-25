import React, { useState, useEffect } from 'react';
import { db, unwrap } from '../db';
import { asset } from '../assets';
const isSignup = () => window.location.hash === '#/cadastro';
export default function Auth() {
  const [signup, setSignup] = useState(isSignup),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(null);
  useEffect(() => {
    const onHash = () => {
      setSignup(isSignup());
      setMessage(null);
      setPassword('');
      setConfirm('');
      setShow(false);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setMessage(null);
    if (!email.trim() || !password.trim()) {
      setMessage({ error: true, text: 'Preencha o e-mail e a senha.' });
      return;
    }
    if (signup && password !== confirm) {
      setMessage({ error: true, text: 'As senhas não coincidem.' });
      return;
    }
    setBusy(true);
    try {
      if (signup) {
        const data = await unwrap(
          db.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: window.location.origin + window.location.pathname },
          }),
        );
        if (!data.session)
          setMessage({
            text: 'Confira sua caixa de entrada e confirme o e-mail. Depois, volte para entrar.',
          });
      } else await unwrap(db.auth.signInWithPassword({ email: email.trim(), password }));
    } catch (e) {
      const translations = {
        'Invalid login credentials': 'E-mail ou senha incorretos.',
        'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
        'Anonymous sign-ins are disabled': 'Informe um e-mail e uma senha válidos.',
      };
      setMessage({ error: true, text: translations[e.message] || e.message });
    } finally {
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
        <div className="auth-form panel" key={signup ? 'signup' : 'login'}>
          <div className="eyebrow">
            {signup ? 'REGISTRO DE NOVO HUNTER' : 'ACESSO À ASSOCIAÇÃO'}
          </div>
          <h1>{signup ? 'Crie sua conta' : 'Bem-vindo, Hunter.'}</h1>
          <p className="muted">
            {signup
              ? 'Cadastre seu acesso para começar sua aventura.'
              : 'Entre para continuar sua expedição.'}
          </p>
          <form className="stack" onSubmit={submit}>
            <label>
              E-mail
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Senha
              <div className="password-field">
                <input
                  type={show ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  placeholder="Mínimo de 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {show ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </label>
            {signup && (
              <label>
                Confirmar senha
                <input
                  type={show ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
            )}
            <button className="primary" disabled={busy}>
              {busy ? 'Aguarde…' : signup ? 'Criar minha conta' : 'Entrar na associação'}{' '}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          {message && (
            <div
              role={message.error ? 'alert' : 'status'}
              className={message.error ? 'error' : 'notice'}
            >
              {message.text}
            </div>
          )}
          <div className="auth-switch">
            {signup ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
            <a href={signup ? '#/entrar' : '#/cadastro'}>
              {signup ? 'Voltar ao login' : 'Criar conta'}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
