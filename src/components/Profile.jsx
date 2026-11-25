import React, { useEffect, useRef, useState } from 'react';
import { db, unwrap } from '../db';
import { Avatar, Modal } from './UI';
const SIZE = 256,
  MAX = 96 * 1024;
export default function Profile({ profile, uid, onClose, onSaved }) {
  const [nickname, N] = useState(profile?.nickname || ''),
    [image, I] = useState(null),
    [zoom, Z] = useState(1),
    [x, X] = useState(0),
    [y, Y] = useState(0),
    [busy, B] = useState(false),
    [err, E] = useState('');
  const canvas = useRef();
  const url = useRef(null);
  const file = useRef();
  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  function paint() {
    if (!image || !canvas.current) return;
    const c = canvas.current,
      ctx = c.getContext('2d');
    const scale = Math.max(SIZE / image.naturalWidth, SIZE / image.naturalHeight) * zoom,
      w = image.naturalWidth * scale,
      h = image.naturalHeight * scale;
    ctx.fillStyle = '#e9dfc4';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(
      image,
      (SIZE - w) / 2 + (x * Math.max(0, w - SIZE)) / 200,
      (SIZE - h) / 2 + (y * Math.max(0, h - SIZE)) / 200,
      w,
      h,
    );
  }
  useEffect(paint, [image, zoom, x, y]);
  function pick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    E('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 15 * 1024 * 1024) {
      E('Escolha JPG, PNG ou WebP de até 15 MB.');
      return;
    }
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth * img.naturalHeight > 40000000) {
        E('Imagem muito grande. Reduza a resolução antes.');
        return;
      }
      I(img);
      Z(1);
      X(0);
      Y(0);
    };
    img.onerror = () => E('Não foi possível abrir a imagem.');
    img.src = url.current;
  }
  async function save(e) {
    e.preventDefault();
    B(true);
    E('');
    try {
      let avatar_url = profile?.avatar_url || null;
      if (image) {
        paint();
        let blob = null;
        for (const q of [0.85, 0.72, 0.58, 0.42, 0.28]) {
          blob = await new Promise((r) => canvas.current.toBlob(r, 'image/webp', q));
          if (blob && blob.type === 'image/webp' && blob.size <= MAX) break;
        }
        if (!blob || blob.type !== 'image/webp' || blob.size > MAX)
          throw Error('Não foi possível compactar a imagem em WebP.');
        const path = uid + '/avatar.webp';
        await unwrap(
          db.storage
            .from('avatars')
            .upload(path, blob, { upsert: true, contentType: 'image/webp', cacheControl: '60' }),
        );
        avatar_url =
          db.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
      }
      await unwrap(db.from('profiles').upsert({ id: uid, nickname: nickname.trim(), avatar_url }));
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
          {image ? (
            <canvas ref={canvas} width={SIZE} height={SIZE} aria-label="Prévia do recorte" />
          ) : (
            <Avatar profile={profile} fallback={nickname || 'Hunter'} size={160} />
          )}
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
        <label>
          Foto de perfil
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} />
        </label>
        {image && (
          <div className="stack">
            <label>
              Zoom
              <input
                type="range"
                min="1"
                max="3"
                step=".05"
                value={zoom}
                onChange={(e) => Z(+e.target.value)}
              />
            </label>
            <label>
              Posição horizontal
              <input
                type="range"
                min="-100"
                max="100"
                value={x}
                onChange={(e) => X(+e.target.value)}
              />
            </label>
            <label>
              Posição vertical
              <input
                type="range"
                min="-100"
                max="100"
                value={y}
                onChange={(e) => Y(+e.target.value)}
              />
            </label>
          </div>
        )}
        <small>
          Recorte quadrado de 256 × 256, WebP de até 96 KB. A foto substitui a anterior e aparece
          nos tokens. O endereço da imagem é público.
        </small>
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar perfil'}
        </button>
      </form>
    </Modal>
  );
}
