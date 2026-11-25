import React, { useEffect, useRef, useState } from 'react';
import { asset } from '../assets';
import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = worker;
const books = [
  {
    id: 'jogador',
    name: 'Livro do Jogador',
    version: '3.0.1',
    pages: 241,
    url: asset('livros/livro-jogador.pdf'),
  },
  {
    id: 'narrador',
    name: 'Manual do Narrador',
    version: '3.0',
    pages: 119,
    url: asset('livros/manual-narrador.pdf'),
  },
  {
    id: 'shingen',
    name: 'Manual Shingen-Ryu',
    version: '3.0.1',
    pages: 121,
    url: asset('livros/manual-shingen-ryu.pdf'),
  },
];
function Page({ doc, num }) {
  const ref = useRef();
  const [error, E] = useState('');
  useEffect(() => {
    if (!doc || num > doc.numPages) return;
    let active = true,
      task = null;
    E('');
    doc
      .getPage(num)
      .then((p) => {
        if (!active) return;
        const c = ref.current,
          v = p.getViewport({ scale: Math.min(2.6, 1500 / p.getViewport({ scale: 1 }).width) });
        c.width = v.width;
        c.height = v.height;
        task = p.render({ canvasContext: c.getContext('2d'), viewport: v });
        return task.promise;
      })
      .catch((e) => {
        if (active && e.name !== 'RenderingCancelledException')
          E('Não foi possível renderizar a página.');
      });
    return () => {
      active = false;
      task?.cancel();
    };
  }, [doc, num]);
  return (
    <div className="book-page">
      {doc && num <= doc.numPages ? (
        <>
          <canvas ref={ref} aria-label={'Página ' + num} />
          {error && <p>{error}</p>}
          <small>{num}</small>
        </>
      ) : (
        <div className="blank-page" />
      )}
    </div>
  );
}
export default function Library() {
  const [book, B] = useState(null),
    [doc, D] = useState(null),
    [page, P] = useState(0),
    [err, E] = useState(''),
    [zoom, Z] = useState(false),
    [jump, J] = useState('');
  useEffect(() => {
    if (!book) return;
    let active = true;
    D(null);
    P(0);
    J('');
    E('');
    const task = pdfjs.getDocument(book.url);
    task.promise
      .then((d) => {
        if (active) D(d);
      })
      .catch((e) => {
        if (active) E(e.message);
      });
    return () => {
      active = false;
      task.destroy().catch(() => {});
    };
  }, [book]);
  useEffect(() => {
    if (!book) return;
    const key = (e) => {
      if (e.target.matches('input,textarea,select')) return;
      if (e.key === 'ArrowRight')
        P((p) => Math.min(2 * Math.floor((doc?.numPages || book.pages) / 2), p === 0 ? 2 : p + 2));
      if (e.key === 'ArrowLeft') P((p) => Math.max(0, p - 2));
      if (e.key === 'Escape') B(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [book, doc]);
  const last = doc?.numPages || book?.pages || 0;
  const go = () => {
    const n = Math.max(1, Math.min(last, Math.floor(+jump || 1)));
    P(n <= 1 ? 0 : n % 2 ? n - 1 : n);
    J('');
  };
  return (
    <section className="library3">
      <div className="section-head">
        <div>
          <span className="eyebrow">ARQUIVO DA ASSOCIAÇÃO</span>
          <h1>{book ? book.name : 'Biblioteca'}</h1>
          <p className="muted">
            {book
              ? 'Edição digital · leitura em páginas duplas'
              : 'Escolha um volume para abrir o livro.'}
          </p>
        </div>
        {book && <button onClick={() => B(null)}>← Voltar à estante</button>}
      </div>
      {!book ? (
        <div className="book-grid">
          {books.map((b) => (
            <article className="book-card" key={b.id}>
              <button className="book-cover" onClick={() => B(b)}>
                <img src={asset('assets/capa-' + b.id + '.webp')} alt={'Capa de ' + b.name} />
              </button>
              <div className="book-info">
                <small>
                  EDIÇÃO {b.version} · {b.pages} PÁGINAS
                </small>
                <h3>{b.name}</h3>
                <button className="primary" onClick={() => B(b)}>
                  Abrir livro →
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="reader3">
          <div className="row book-tools">
            <button disabled={!page} onClick={() => P((p) => Math.max(0, p - 2))}>
              ← Anterior
            </button>
            <button
              disabled={!doc || page >= 2 * Math.floor(last / 2)}
              onClick={() => P((p) => (p === 0 ? 2 : p + 2))}
            >
              {page ? 'Próxima →' : 'Abrir capa →'}
            </button>
            <span>{page ? `${page}–${Math.min(page + 1, last)} / ${last}` : 'Capa'}</span>
            <label>
              Ir à página
              <input
                type="number"
                min="1"
                max={last}
                placeholder="Nº"
                value={jump}
                onChange={(e) => J(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') go();
                }}
              />
            </label>
            <button disabled={!doc || !jump} onClick={go}>
              Ir
            </button>
            <button onClick={() => Z((v) => !v)}>{zoom ? 'Ajustar' : 'Ampliar'}</button>
            <a href={book.url} target="_blank" rel="noreferrer">
              PDF original ↗
            </a>
          </div>
          {err && <p className="error">Falha no leitor: {err}. Use o PDF original.</p>}
          {page === 0 ? (
            <button className="closed-book" onClick={() => P(2)}>
              <img src={asset('assets/capa-' + book.id + '.webp')} alt="Abrir capa" />
              <span>Abrir livro</span>
            </button>
          ) : !doc ? (
            <p className="loading-screen">Carregando páginas…</p>
          ) : (
            <div className={'spread ' + (zoom ? 'zoomed' : '')} key={page}>
              <Page doc={doc} num={page} />
              <Page doc={doc} num={page + 1} />
            </div>
          )}
        </div>
      )}
      <p className="library-credit">
        Acervo local para uso privado. Materiais originais de seus respectivos criadores.
      </p>
    </section>
  );
}
