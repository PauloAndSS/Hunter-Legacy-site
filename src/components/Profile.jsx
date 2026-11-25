import React, { useState } from 'react';
import { db, unwrap } from '../db';
import { Avatar, Modal } from './UI';
export default function Profile({ profile, uid, onClose, onSaved }) {
  const [nickname, N] = useState(profile?.nickname || ''),
    [busy, B] = useState(false),
    [err, E] = useState('');
  async function save(e) {
    e.preventDefault();
    B(true);
    E('');
    try {
      await unwrap(db.from('profiles').upsert({ id: uid, nickname: nickname.trim() }));
      await onSaved();
      onClose();
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  return (
    <Modal title="Meu perfil" onClose={onClose}>
      <form className="profile-form stack" onSubmit={save}>
        <div className="crop-preview">
          <Avatar profile={profile} fallback={nickname || 'Hunter'} size={160} />
        </div>
        <label>
          Nickname
          <input
            required
            maxLength={32}
            minLength={2}
            value={nickname}
            onChange={(e) => N(e.target.value)}
            placeholder="Seu nome na associação"
          />
        </label>
        <small>
          A foto vem do Discord. Se você trocar a foto lá, saia e entre de novo para atualizar.
        </small>
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar perfil'}
        </button>
      </form>
    </Modal>
  );
}
