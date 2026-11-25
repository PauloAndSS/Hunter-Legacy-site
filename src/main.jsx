import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { db, configured, unwrap, rpc } from './db';
import { asset } from './assets';
import { discordProfile } from './discord';
import Auth from './components/Auth';
import Library from './components/Library';
import Profile from './components/Profile';
import Sheet from './components/Sheet';
import Combat from './components/Combat';
import { Avatar, Modal, Empty, DiceToast } from './components/UI';
import { catalogs, initial, normalize, kinds } from './rules';
import './style.css';
import './v03.css';
const emptyRecord = { kind: 'npc', title: '', body: '', visible: false, data: {} };
const personalTabs = ['Início', 'Fichas', 'Biblioteca', 'Catálogo'];
const campaignTabs = ['Campanha', 'Fichas', 'Combate', 'Buscas', 'Biblioteca'];
function App() {
  const [session, S] = useState(null),
    [ready, R] = useState(!configured),
    [campaigns, C] = useState([]),
    [cid, CI] = useState(''),
    [tab, T] = useState('Início'),
    [characters, CH] = useState([]),
    [profiles, PR] = useState({}),
    [records, RE] = useState([]),
    [battle, B] = useState(null),
    [rolls, RO] = useState([]),
    [positions, PO] = useState([]),
    [invite, I] = useState(''),
    [online, O] = useState(false),
    [error, X] = useState(''),
    [notice, N] = useState(''),
    [busy, BU] = useState(false),
    [modal, M] = useState(null),
    [name, NA] = useState(''),
    [code, CO] = useState(''),
    [record, REC] = useState(emptyRecord),
    [mapChar, MC] = useState(''),
    [query, Q] = useState(''),
    [catalog, CAT] = useState('classes_hunter'),
    [rollForm, RF] = useState({
      count: 1,
      faces: 20,
      bonus: 0,
      label: 'Rolagem livre',
      private: false,
    }),
    [toast, TO] = useState(null),
    [logOpen, LO] = useState(false);
  const pending = useRef(false),
    refreshRef = useRef(null),
    rollSeen = useRef(null),
    toastTimer = useRef(null),
    context = useRef('');
  const uid = session?.user?.id;
  const campaign = campaigns.find((c) => c.id === cid);
  const gm = !!uid && campaign?.owner === uid;
  const mine = characters.filter((c) => c.owner === uid);
  // A exportação cria uma cópia na campanha; a ficha pessoal fica sem campanha.
  const personal = mine.filter((c) => !c.campaign_id);
  const exported = mine.filter((c) => c.campaign_id);
  const shared = cid ? characters.filter((c) => c.campaign_id === cid) : [];
  const myProfile = profiles[uid];
  const discord = discordProfile(session?.user);
  const close = useCallback(() => M(null), []);
  context.current = cid;
  useEffect(() => {
    if (!db) return;
    db.auth
      .getSession()
      .then(({ data }) => {
        S(data.session);
        R(true);
      })
      .catch(() => R(true));
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_, s) => S(s));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    CI('');
    T('Início');
    C([]);
    CH([]);
    PR({});
    M(null);
    X('');
    N('');
    if (uid && ['#/cadastro', '#/entrar'].includes(location.hash))
      history.replaceState(null, '', location.pathname + location.search);
  }, [uid]);
  // Cria o perfil no primeiro acesso e mantém a foto igual à do Discord.
  useEffect(() => {
    if (!uid || !discord) return;
    let alive = true;
    (async () => {
      try {
        const current = await unwrap(db.from('profiles').select('*').eq('id', uid).maybeSingle());
        if (!alive || (current && current.avatar_url === discord.avatar_url)) return;
        await unwrap(
          db.from('profiles').upsert({
            id: uid,
            nickname: current?.nickname || discord.nickname,
            avatar_url: discord.avatar_url,
          }),
        );
        if (alive) await refreshRef.current?.();
      } catch (e) {
        if (alive) X(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid, discord?.avatar_url, discord?.nickname]);
  const animate = useCallback((r) => {
    if (!r) return;
    TO(r);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => TO(null), 6500);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (!uid) return;
    let alive = true,
      seq = 0;
    rollSeen.current = null;
    O(false);
    const currentCid = cid;
    async function refresh() {
      const id = ++seq;
      try {
        const [ca, ch, pr, re, ba, ro, po, iv] = await Promise.all([
          unwrap(db.from('campaigns').select('*').order('created_at')),
          unwrap(db.from('characters').select('*').order('created_at')),
          unwrap(db.from('profiles').select('*')),
          cid ? unwrap(db.from('records').select('*').eq('campaign_id', cid)) : [],
          cid ? unwrap(db.from('battles').select('*').eq('campaign_id', cid).maybeSingle()) : null,
          unwrap(
            (cid
              ? db.from('rolls').select('*').eq('campaign_id', cid)
              : db.from('rolls').select('*').is('campaign_id', null).eq('user_id', uid)
            )
              .order('created_at', { ascending: false })
              .limit(60),
          ),
          cid ? unwrap(db.from('positions').select('*').eq('campaign_id', cid)) : [],
          cid
            ? unwrap(db.from('invites').select('code').eq('campaign_id', cid).maybeSingle())
            : null,
        ]);
        if (!alive || id !== seq || context.current !== currentCid) return;
        C(ca);
        CH(ch);
        PR(Object.fromEntries(pr.map((p) => [p.id, p])));
        RE(re);
        B(ba);
        RO(ro);
        PO(po);
        I(iv?.code || '');
        if (cid && !ca.some((c) => c.id === cid)) {
          CI('');
          T('Início');
          return;
        }
        if (rollSeen.current !== null && ro[0] && rollSeen.current !== ro[0].id) animate(ro[0]);
        rollSeen.current = ro[0]?.id || '';
      } catch (e) {
        if (alive && id === seq) {
          X(e.message);
        }
      }
    }
    refreshRef.current = refresh;
    let timer;
    const queue = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 100);
    };
    const channel = db.channel('hunter-v03-' + (cid || uid));
    for (const table of [
      'characters',
      'profiles',
      'campaigns',
      'members',
      'records',
      'battles',
      'rolls',
      'positions',
    ])
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, queue);
    channel.subscribe((status) => {
      if (alive) {
        O(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') queue();
      }
    });
    refresh();
    const interval = setInterval(refresh, 6000);
    window.addEventListener('focus', refresh);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      if (refreshRef.current === refresh) refreshRef.current = null;
      db.removeChannel(channel);
    };
  }, [uid, cid, animate]);
  const safe = async (fn, { throwError = false } = {}) => {
    if (pending.current) {
      if (throwError) throw Error('Aguarde a operação atual.');
      return;
    }
    pending.current = true;
    BU(true);
    X('');
    N('');
    try {
      const v = await fn();
      await refreshRef.current?.();
      return v;
    } catch (e) {
      X(e.message);
      if (throwError) throw e;
    } finally {
      pending.current = false;
      BU(false);
    }
  };
  function navigate(next) {
    LO(false);
    T(next);
    X('');
    N('');
    M(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  function enter(id) {
    LO(false);
    CI(id);
    T('Campanha');
    RE([]);
    B(null);
    RO([]);
    PO([]);
    I('');
    M(null);
    TO(null);
    X('');
    N('');
    MC('');
  }
  function leave() {
    LO(false);
    CI('');
    T('Início');
    RE([]);
    B(null);
    RO([]);
    PO([]);
    I('');
    M(null);
    TO(null);
    X('');
    N('');
    MC('');
  }
  const command = (type, payload = {}) =>
    safe(() => {
      if (!battle || battle.campaign_id !== cid) throw Error('Combate ainda não carregado.');
      return rpc('battle_command', {
        p_campaign: cid,
        p_revision: battle.revision,
        p_type: type,
        p_payload: payload,
      });
    });
  const createSheet = () => {
    if (personal.length >= 5) {
      X('Limite de 5 fichas pessoais atingido.');
      return;
    }
    M({ type: 'sheet', id: 'new' });
  };
  const openSheet = (c, t) => M({ type: 'sheet', id: c.id, drawer: !!t, tokenId: t?.id });
  const selectedChar =
    modal?.id === 'new'
      ? { id: 'new', owner: uid, name: '', sheet: initial, campaign_id: null }
      : characters.find((c) => c.id === modal?.id);
  const selectedToken = battle?.state?.tokens?.find(
    (t) =>
      (!!modal?.tokenId && t.id === modal.tokenId) ||
      (!!selectedChar?.id && t.characterId === selectedChar.id),
  );
  const sheetCombat = !!(cid && selectedChar?.campaign_id === cid && battle?.state?.active);
  const sheetTokenIndex = battle?.state?.tokens?.findIndex((t) => t.id === selectedToken?.id) ?? -1;
  const allowedKinds =
    sheetCombat && selectedToken
      ? ['action', 'power', 'bonus', 'reaction'].filter(
          (k) =>
            selectedToken[k] &&
            (k === 'reaction'
              ? battle.state.reactionFor === sheetTokenIndex
              : battle.state.turn === sheetTokenIndex),
        )
      : [];
  const saveSheet = (draft, c, revision) =>
    safe(
      async () => {
        const { name, ...sheet } = draft;
        const payload = { name: name.trim(), sheet };
        if (c.id === 'new') {
          const row = await unwrap(db.from('characters').insert(payload).select('id').single());
          M({ type: 'sheet', id: row.id });
          N('Ficha salva na biblioteca pessoal.');
        } else {
          const rows = await unwrap(
            db
              .from('characters')
              .update(payload)
              .eq('id', c.id)
              .eq('revision', revision)
              .select('id'),
          );
          if (!rows.length)
            throw Error(
              'Outra pessoa alterou esta ficha enquanto você editava. Copie o que mudou, cancele e edite de novo.',
            );
          N('Ficha atualizada.');
        }
      },
      { throwError: true },
    );
  const shareSheet = (c, id) =>
    safe(async () => {
      await rpc('export_sheet', { p_character: c.id, p_campaign: id });
      N('Cópia enviada para a campanha. A ficha pessoal continua salva.');
    });
  const deleteSheet = (c) => {
    const question = !c.campaign_id
      ? 'Excluir definitivamente esta ficha pessoal? As cópias em campanhas serão mantidas.'
      : personal.some((p) => p.id === c.source_id)
        ? 'Remover esta ficha da campanha? O que foi alterado nela será perdido. A ficha pessoal continua salva.'
        : 'Remover esta ficha da campanha? A ficha pessoal original não existe mais; tudo será perdido.';
    if (confirm(question))
      safe(async () => {
        await unwrap(db.from('characters').delete().eq('id', c.id));
        M(null);
        N(c.campaign_id ? 'Ficha removida da campanha.' : 'Ficha excluída.');
      });
  };
  function sheetRoll(c, mode, key, kind) {
    safe(async () => {
      const combat = cid && battle?.state?.active;
      const inCampaign = !!cid && c.campaign_id === cid;
      if (combat && inCampaign) {
        const i = battle.state.tokens.findIndex((t) => t.characterId === c.id);
        if (i < 0) throw Error('Adicione a ficha ao combate primeiro.');
        await rpc('battle_command', {
          p_campaign: cid,
          p_revision: battle.revision,
          p_type: 'act',
          p_payload: { index: i, kind, mode, key },
        });
      } else {
        const id = await rpc('roll_sheet', {
          p_character: c.id,
          p_campaign: inCampaign ? cid : null,
          p_mode: mode,
          p_key: key,
        });
        if (!inCampaign && cid) {
          const r = await unwrap(db.from('rolls').select('*').eq('id', id).single());
          animate(r);
        }
      }
    });
  }
  function freeRoll(e) {
    e.preventDefault();
    safe(() =>
      rpc('roll_dice', {
        p_campaign: cid || null,
        p_label: rollForm.label,
        p_count: +rollForm.count,
        p_faces: +rollForm.faces,
        p_bonus: +rollForm.bonus,
        p_private: rollForm.private,
      }),
    );
  }
  const card = (c) => (
    <article className="hunter-card" key={c.id}>
      <Avatar profile={profiles[c.owner]} fallback={c.name} size={66} />
      <div>
        <small>
          {c.campaign_id
            ? campaigns.find((a) => a.id === c.campaign_id)?.name || 'Compartilhada'
            : 'Ficha pessoal'}
        </small>
        <h3>{c.name}</h3>
        <p>
          Nível {c.sheet.level || 1} · {c.sheet.nen || 'Sem categoria'}
        </p>
      </div>
      <button onClick={() => openSheet(c)}>Abrir ficha →</button>
    </article>
  );
  const formRecord = (
    <form
      className="stack record-form"
      onSubmit={(e) => {
        e.preventDefault();
        safe(async () => {
          const { id, ...v } = record;
          await unwrap(
            id
              ? db.from('records').update(v).eq('id', id)
              : db.from('records').insert({ ...v, campaign_id: cid }),
          );
          M(null);
          N('Registro salvo.');
        });
      }}
    >
      <label>
        Tipo
        <select value={record.kind} onChange={(e) => REC({ ...record, kind: e.target.value })}>
          {Object.entries(kinds).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Nome
        <input
          required
          maxLength={100}
          value={record.title}
          onChange={(e) => REC({ ...record, title: e.target.value })}
        />
      </label>
      <label>
        Descrição
        <textarea
          rows="5"
          value={record.body}
          onChange={(e) => REC({ ...record, body: e.target.value })}
        />
      </label>
      {record.kind === 'map' && (
        <label>
          URL pública da imagem
          <input
            type="url"
            value={record.data?.url || ''}
            onChange={(e) => REC({ ...record, data: { ...record.data, url: e.target.value } })}
          />
        </label>
      )}
      {['npc', 'beast'].includes(record.kind) && (
        <div className="fields">
          {[
            ['hp', 'Pontos de vida', 10],
            ['speed', 'Deslocamento (casas)', 6],
            ['attackBonus', 'Bônus de ataque', 0],
          ].map(([k, n, d]) => (
            <label key={k}>
              {n}
              <input
                type="number"
                min={k === 'attackBonus' ? -100 : 0}
                max={k === 'attackBonus' ? 100 : 9999}
                value={record.data?.[k] ?? d}
                onChange={(e) => REC({ ...record, data: { ...record.data, [k]: +e.target.value } })}
              />
            </label>
          ))}
        </div>
      )}
      <label className="inline">
        <input
          type="checkbox"
          checked={record.visible}
          onChange={(e) => REC({ ...record, visible: e.target.checked })}
        />
        Revelar aos jogadores
      </label>
      <button className="primary" disabled={busy}>
        Salvar registro
      </button>
    </form>
  );
  const showRecord = (r) => {
    REC(
      r || {
        ...emptyRecord,
        kind: tab === 'Bestiário' ? 'beast' : tab === 'Escudo do Mestre' ? 'note' : 'npc',
      },
    );
    M({ type: 'record' });
  };
  const listRecords = (filter) => {
    const a = records.filter(filter);
    return a.length ? (
      a.map((r) => (
        <article className="dossier-card" key={r.id}>
          <small>
            {kinds[r.kind]} {gm && (r.visible ? ' · Revelado' : ' · Privado')}
          </small>
          <h3>{r.title}</h3>
          <p className="pre">{r.body}</p>
          {gm && (
            <div className="row">
              <button onClick={() => showRecord(r)}>Editar</button>
              <button
                onClick={() =>
                  safe(() =>
                    unwrap(db.from('records').update({ visible: !r.visible }).eq('id', r.id)),
                  )
                }
              >
                {r.visible ? 'Ocultar' : 'Revelar'}
              </button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm('Excluir registro?'))
                    safe(() => unwrap(db.from('records').delete().eq('id', r.id)));
                }}
              >
                Excluir
              </button>
            </div>
          )}
        </article>
      ))
    ) : (
      <Empty title="Nenhum registro ainda" />
    );
  };
  const map = records.find((r) => r.kind === 'map' && r.visible && r.data?.url);
  const board = (
    <div className="map-frame">
      <div
        className={'worldmap ' + (gm && mapChar ? 'placing' : '')}
        onClick={(e) => {
          if (!gm || !mapChar) return;
          const b = e.currentTarget.getBoundingClientRect();
          safe(() =>
            unwrap(
              db.from('positions').upsert({
                campaign_id: cid,
                character_id: mapChar,
                x: Math.max(0, Math.min(100, ((e.clientX - b.left) * 100) / b.width)),
                y: Math.max(0, Math.min(100, ((e.clientY - b.top) * 100) / b.height)),
              }),
            ),
          );
        }}
      >
        <img
          src={map?.data.url || asset('assets/mapa-mundi.png')}
          alt="Mapa do mundo"
          onError={(e) => {
            if (!e.currentTarget.src.endsWith('/assets/mapa-mundi.png'))
              e.currentTarget.src = asset('assets/mapa-mundi.png');
          }}
        />
        {positions.map((p, i) => (
          <span
            key={p.character_id}
            className="pin"
            style={{
              left: p.x + '%',
              top: p.y + '%',
              '--pin-color': ['#0a5267', '#a63b28', '#6a368e', '#19744b'][i % 4],
            }}
          >
            ● {shared.find((c) => c.id === p.character_id)?.name || 'Hunter'}
          </span>
        ))}
      </div>
    </div>
  );
  if (!configured)
    return <div className="loading-screen">Configure o arquivo .env conforme o README.</div>;
  if (!ready)
    return (
      <div className="loading-screen">
        <span className="spinner" />
        Conectando…
      </div>
    );
  if (!session) return <Auth />;
  const tabs = cid
    ? [...campaignTabs, ...(gm ? ['Bestiário', 'Escudo do Mestre'] : [])]
    : personalTabs;
  const owned = campaigns.filter((c) => c.owner === uid).length;
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand3" onClick={leave}>
          ✦ HUNTER LEGACY<small>ASSOCIAÇÃO DE HUNTERS</small>
        </button>
        <nav aria-label="Navegação principal">
          {tabs.map((t) => (
            <button
              key={t}
              aria-current={tab === t ? 'page' : undefined}
              className={tab === t ? 'active' : ''}
              onClick={() => navigate(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="account row">
          <span
            className={'online3 ' + (online ? 'connected' : '')}
            title={online ? 'Canal Realtime conectado' : 'Canal Realtime não conectado'}
          >
            <i />
            {online ? 'Online' : 'Reconectando'}
          </span>
          <button className="profile-trigger" onClick={() => M({ type: 'profile' })}>
            <Avatar profile={myProfile} fallback="Hunter" size={34} />
            <span>{myProfile?.nickname || 'Meu perfil'}</span>
          </button>
          <button className="quiet" onClick={() => db.auth.signOut()}>
            Sair
          </button>
        </div>
      </header>
      <main className="app-main">
        <div className={'context-bar ' + (cid ? 'in-campaign' : '')}>
          <div className="row">
            {cid && <button onClick={leave}>← Minhas campanhas</button>}
            <div>
              <small>{cid ? 'VOCÊ ESTÁ NA CAMPANHA' : 'ÁREA PESSOAL · FORA DE CAMPANHA'}</small>
              <strong>{cid ? campaign?.name || 'Campanha' : tab}</strong>
              {cid && <span className="role-pill">{gm ? 'Mestre' : 'Jogador'}</span>}
            </div>
          </div>
          <div className="row">
            <button onClick={() => LO((v) => !v)}>
              ⚄ {cid ? 'Log de rolagens' : 'Minhas rolagens'}
            </button>
            {tab !== 'Início' && !cid && (
              <button onClick={() => navigate('Início')}>← Voltar ao início</button>
            )}
            {cid && tab !== 'Campanha' && (
              <button onClick={() => navigate('Campanha')}>← Voltar à campanha</button>
            )}
          </div>
        </div>
        {error && (
          <div className="error feedback" role="alert">
            <span>{error}</span>
            <button onClick={() => X('')}>Fechar</button>
          </div>
        )}
        {notice && (
          <div className="notice feedback" role="status">
            <span>{notice}</span>
            <button onClick={() => N('')}>Fechar</button>
          </div>
        )}
        <div className="page3" key={cid + tab}>
          {tab === 'Início' && !cid && (
            <>
              <section className="home-welcome">
                <div>
                  <span className="eyebrow">SEU ESPAÇO PESSOAL</span>
                  <h1>Bem-vindo, {myProfile?.nickname || 'Hunter'}.</h1>
                  <p>Escolha uma campanha para entrar ou continue criando seu personagem.</p>
                  <div className="row">
                    <button
                      className="primary"
                      disabled={owned >= 2}
                      onClick={() => {
                        NA('');
                        M({ type: 'create' });
                      }}
                    >
                      + Criar campanha
                    </button>
                    <button
                      onClick={() => {
                        CO('');
                        M({ type: 'join' });
                      }}
                    >
                      Entrar com convite
                    </button>
                  </div>
                </div>
                <div className="welcome-count">
                  <span>
                    Campanhas criadas <b>{owned}/2</b>
                  </span>
                  <span>
                    Fichas pessoais <b>{personal.length}/5</b>
                  </span>
                </div>
              </section>
              <div className="section-head">
                <div>
                  <h2>Minhas campanhas</h2>
                  <p className="muted">
                    Entre em uma campanha para acessar combate, equipe e buscas.
                  </p>
                </div>
              </div>
              <div className="campaign-cards">
                {campaigns.map((c) => (
                  <article className="campaign-card" key={c.id}>
                    <div className="campaign-art">
                      <span>✦</span>
                    </div>
                    <div>
                      <small>{c.owner === uid ? 'MESTRE' : 'JOGADOR'}</small>
                      <h3>{c.name}</h3>
                      <button className="primary" onClick={() => enter(c.id)}>
                        Entrar na campanha →
                      </button>
                      {c.owner === uid && (
                        <button
                          className="quiet danger"
                          onClick={() => {
                            if (
                              confirm(
                                'Excluir campanha e seus registros? As fichas serão mantidas.',
                              )
                            )
                              safe(() => unwrap(db.from('campaigns').delete().eq('id', c.id)));
                          }}
                        >
                          Excluir campanha
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!campaigns.length && (
                <Empty title="Sua primeira expedição">
                  <p>Crie uma campanha ou entre pelo convite do mestre.</p>
                </Empty>
              )}
              <section className="personal-shortcut">
                <div>
                  <h2>Minhas fichas</h2>
                  <p>Crie e guarde seus personagens independentemente de campanhas.</p>
                </div>
                <button onClick={() => navigate('Fichas')}>Ver biblioteca de fichas →</button>
              </section>
            </>
          )}
          {tab === 'Campanha' && cid && (
            <>
              <section className="campaign-hero">
                <span className="eyebrow">CAMPANHA ATUAL</span>
                <h1>{campaign?.name}</h1>
                <p>
                  {gm
                    ? 'Você está narrando esta campanha.'
                    : 'Você está participando como jogador.'}
                </p>
                <div className="row">
                  <button className="primary" onClick={() => navigate('Combate')}>
                    ⚔ Abrir combate
                  </button>
                  <button onClick={() => navigate('Fichas')}>Ver equipe</button>
                  <button onClick={() => navigate('Buscas')}>Explorar buscas</button>
                </div>
              </section>
              {gm && invite && (
                <div className="invite-box">
                  <div>
                    <small>CONVIDE JOGADORES</small>
                    <code>{invite}</code>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(invite);
                        N('Convite copiado.');
                      } catch {
                        X('Copie o código manualmente.');
                      }
                    }}
                  >
                    Copiar código
                  </button>
                </div>
              )}
              <section className="panel">
                <h2>Equipe da campanha</h2>
                <div className="hunter-grid">{shared.map(card)}</div>
                {!shared.length && (
                  <Empty title="Nenhuma ficha compartilhada">
                    <button onClick={() => navigate('Fichas')}>Escolher uma ficha</button>
                  </Empty>
                )}
              </section>
              <section className="panel">
                <h2>Missões</h2>
                {listRecords((r) => r.kind === 'quest')}
              </section>
            </>
          )}
          {tab === 'Fichas' && (
            <section className="sheets-page">
              <div className="section-head">
                <div>
                  <span className="eyebrow">REGISTROS DE PERSONAGEM</span>
                  <h1>{cid ? 'Equipe e fichas' : 'Minhas fichas'}</h1>
                  <p className="muted">
                    Clique para abrir em modo leitura. {personal.length}/5 fichas pessoais salvas.
                  </p>
                </div>
                <button className="primary" disabled={personal.length >= 5} onClick={createSheet}>
                  + Nova ficha
                </button>
              </div>
              {cid && (
                <>
                  <h2>Na campanha</h2>
                  <div className="hunter-grid">{shared.map(card)}</div>
                  {!shared.length && <Empty title="Nenhum personagem na campanha" />}
                  <h2>Minha biblioteca pessoal</h2>
                  <p className="muted">
                    Abra uma ficha e use “Exportar para campanha”. A pessoal continua salva aqui.
                  </p>
                </>
              )}
              <div className="hunter-grid">{personal.map(card)}</div>
              {!personal.length && (
                <Empty title="Nenhuma ficha pessoal">
                  <button className="primary" onClick={createSheet}>
                    Criar primeira ficha
                  </button>
                </Empty>
              )}
              {!cid && exported.length > 0 && (
                <>
                  <h2>Minhas fichas em campanhas</h2>
                  <div className="hunter-grid">{exported.map(card)}</div>
                </>
              )}
            </section>
          )}
          {tab === 'Combate' &&
            cid &&
            (battle?.campaign_id === cid ? (
              <Combat
                key={cid}
                battle={battle}
                gm={gm}
                characters={shared}
                profiles={profiles}
                uid={uid}
                records={records}
                busy={busy}
                command={command}
                openSheet={openSheet}
                rollNPC={(index, kind, label) => command('act', { index, kind, label })}
              />
            ) : (
              <Empty title="Carregando combate">
                <button onClick={() => refreshRef.current?.()}>Atualizar</button>
              </Empty>
            ))}
          {tab === 'Buscas' && cid && (
            <section className="search3">
              <div className="section-head">
                <div>
                  <span className="eyebrow">ATLAS E DOSSIÊS</span>
                  <h1>Informações de buscas</h1>
                </div>
                {gm && (
                  <button className="primary" onClick={() => showRecord()}>
                    + Novo registro
                  </button>
                )}
              </div>
              <div className="map-layout">
                <section className="panel">
                  <h2>Mapa da campanha</h2>
                  {gm && (
                    <label>
                      Posicionar personagem
                      <select value={mapChar} onChange={(e) => MC(e.target.value)}>
                        <option value="">Selecione um personagem</option>
                        {shared.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {board}
                  <p className="muted">
                    {gm
                      ? 'Escolha um personagem e clique no mapa.'
                      : 'Posições controladas pelo mestre.'}
                  </p>
                </section>
                <section className="panel">
                  <h2>Registros descobertos</h2>
                  {listRecords((r) => !['beast', 'note'].includes(r.kind))}
                </section>
              </div>
            </section>
          )}
          {cid && gm && ['Bestiário', 'Escudo do Mestre'].includes(tab) && (
            <section className="dossiers">
              <div className="section-head">
                <div>
                  <span className="eyebrow">EXCLUSIVO DO MESTRE</span>
                  <h1>{tab}</h1>
                </div>
                <button className="primary" onClick={() => showRecord()}>
                  + Novo registro
                </button>
              </div>
              <div className="dossier-grid">
                {listRecords((r) => (tab === 'Bestiário' ? r.kind === 'beast' : true))}
              </div>
            </section>
          )}
          {tab === 'Biblioteca' && <Library />}
          {tab === 'Catálogo' && (
            <section className="panel">
              <h1>Catálogo de regras</h1>
              <p className="muted">Índice inicial · informações ainda sujeitas a revisão.</p>
              <div className="row">
                <select value={catalog} onChange={(e) => CAT(e.target.value)}>
                  {Object.keys(catalogs).map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                <input
                  placeholder="Buscar no catálogo"
                  value={query}
                  onChange={(e) => Q(e.target.value)}
                />
              </div>
              <div className="dossier-grid">
                {(catalogs[catalog] || [])
                  .filter((x) => JSON.stringify(x).toLowerCase().includes(query.toLowerCase()))
                  .map((x, i) => (
                    <article className="entry" key={x.id || i}>
                      <strong>{x.name || x.id}</strong>
                      <p>
                        {x.source} · {x.page || '—'}
                      </p>
                    </article>
                  ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <footer>
        <span>✦ HUNTER LEGACY · Projeto de fãs</span>
        <span>
          <a href={asset('termos.html')}>Termos</a> ·{' '}
          <a href={asset('privacidade.html')}>Privacidade</a>
        </span>
        <span>v0.6.1 · {cid ? campaign?.name : 'Área pessoal'}</span>
      </footer>
      {modal?.type === 'profile' && (
        <Profile
          profile={myProfile}
          uid={uid}
          onClose={close}
          onSaved={() => refreshRef.current?.()}
        />
      )}{' '}
      {modal?.type === 'sheet' && selectedChar && (
        <Sheet
          key={selectedChar.id + String(modal.drawer)}
          character={selectedChar}
          profile={profiles[selectedChar.owner]}
          canEdit={selectedChar.owner === uid || (!!gm && selectedChar.campaign_id === cid)}
          isOwner={selectedChar.owner === uid}
          exportedTo={exported
            .filter((c) => c.source_id === selectedChar.id)
            .map((c) => c.campaign_id)}
          isNew={selectedChar.id === 'new'}
          onClose={close}
          onSave={saveSheet}
          onRoll={sheetRoll}
          onShare={shareSheet}
          onDelete={deleteSheet}
          campaigns={campaigns}
          drawer={modal.drawer}
          token={selectedToken}
          busy={busy}
          combatActive={sheetCombat}
          allowedKinds={allowedKinds}
          canRoll={
            selectedChar.id !== 'new' &&
            (selectedChar.owner === uid || (!!gm && selectedChar.campaign_id === cid))
          }
        />
      )}
      {['create', 'join'].includes(modal?.type) && (
        <Modal
          title={modal.type === 'create' ? 'Criar campanha' : 'Entrar por convite'}
          onClose={close}
        >
          <form
            className="stack record-form"
            onSubmit={(e) => {
              e.preventDefault();
              safe(async () => {
                const id =
                  modal.type === 'create'
                    ? await rpc('create_campaign', { p_name: name.trim() })
                    : await rpc('join_campaign', { p_code: code.trim() });
                await refreshRef.current?.();
                M(null);
                N('Campanha disponível. Clique para entrar.');
              });
            }}
          >
            {modal.type === 'create' ? (
              <label>
                Nome da campanha
                <input required maxLength={100} value={name} onChange={(e) => NA(e.target.value)} />
                <small>Você pode criar até 2 campanhas.</small>
              </label>
            ) : (
              <label>
                Código de convite
                <input required value={code} onChange={(e) => CO(e.target.value)} />
              </label>
            )}
            <button className="primary" disabled={busy}>
              {modal.type === 'create' ? 'Criar campanha' : 'Aceitar convite'}
            </button>
          </form>
        </Modal>
      )}
      {modal?.type === 'record' && (
        <Modal title="Registro de campanha" onClose={close}>
          {formRecord}
        </Modal>
      )}
      {logOpen && (
        <aside className="log-drawer">
          <header className="row">
            <h2>Log de rolagens</h2>
            <button onClick={() => LO(false)} aria-label="Fechar log">
              ×
            </button>
          </header>
          <form className="dice-form" onSubmit={freeRoll}>
            <label>
              Nome
              <input
                required
                maxLength={100}
                value={rollForm.label}
                onChange={(e) => RF({ ...rollForm, label: e.target.value })}
              />
            </label>
            <div className="fields">
              <label>
                Dados
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={rollForm.count}
                  onChange={(e) => RF({ ...rollForm, count: e.target.value })}
                />
              </label>
              <label>
                Faces
                <select
                  value={rollForm.faces}
                  onChange={(e) => RF({ ...rollForm, faces: e.target.value })}
                >
                  {[2, 3, 4, 6, 8, 10, 12, 20, 100].map((n) => (
                    <option key={n} value={n}>
                      d{n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Bônus
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={rollForm.bonus}
                  onChange={(e) => RF({ ...rollForm, bonus: e.target.value })}
                />
              </label>
            </div>
            {cid && (
              <label className="inline">
                <input
                  type="checkbox"
                  checked={rollForm.private}
                  onChange={(e) => RF({ ...rollForm, private: e.target.checked })}
                />
                Privada (você e mestre)
              </label>
            )}
            <button className="primary" disabled={busy}>
              ⚄ Rolar dados livres
            </button>
            <small>Rolagem livre não consome ações nem aplica efeitos.</small>
          </form>
          <div className="roll-list">
            {rolls.map((r) => (
              <article key={r.id}>
                <small>
                  {new Date(r.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {profiles[r.user_id]?.nickname || 'Hunter'}
                  {r.private ? ' · Privada' : ''}
                </small>
                <strong>{r.label}</strong>
                <span>
                  {r.expression} · [{r.dice?.join(', ')}]
                </span>
                <b>{r.total}</b>
              </article>
            ))}
          </div>
        </aside>
      )}
      {modal && (error || notice) && (
        <div
          role={error ? 'alert' : 'status'}
          className={'modal-feedback ' + (error ? 'error' : 'notice')}
        >
          <span>{error || notice}</span>
          <button
            onClick={() => {
              X('');
              N('');
            }}
          >
            ×
          </button>
        </div>
      )}
      <DiceToast roll={toast} onClose={() => TO(null)} />
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
