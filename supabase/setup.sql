-- Execute once in a new Supabase project. All data scoped by campaign.
create table public.campaigns(id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100), owner uuid not null references auth.users(id), created_at timestamptz default now());
create table public.members(campaign_id uuid references public.campaigns on delete cascade,user_id uuid references auth.users(id),primary key(campaign_id,user_id));
create table public.invites(campaign_id uuid primary key references public.campaigns on delete cascade, code uuid unique not null default gen_random_uuid());
create table public.characters(id uuid primary key default gen_random_uuid(),owner uuid not null default auth.uid() references auth.users(id),campaign_id uuid references public.campaigns on delete cascade,name text not null, sheet jsonb not null default '{}', created_at timestamptz default now());
create table public.records(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.campaigns on delete cascade,kind text not null check(kind in ('npc','artifact','location','quest','map','beast','note')),title text not null,body text not null default '', visible boolean not null default false, data jsonb not null default '{}');
create table public.battles(campaign_id uuid primary key references public.campaigns on delete cascade,state jsonb not null default '{"active":false,"round":1,"turn":0,"tokens":[],"moveAllowed":false,"reactionFor":null}',revision bigint not null default 0);
create table public.rolls(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.campaigns on delete cascade,user_id uuid not null references auth.users(id),label text not null, expression text not null,dice jsonb not null,total integer not null, private boolean not null default false, created_at timestamptz not null default now());
create table public.positions(campaign_id uuid references public.campaigns on delete cascade,character_id uuid references public.characters on delete cascade,x numeric not null check(x between 0 and 100),y numeric not null check(y between 0 and 100),primary key(campaign_id,character_id));
create function public.is_gm(c uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.campaigns where id=c and owner=auth.uid())$$;
create function public.is_member(c uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.members where campaign_id=c and user_id=auth.uid())$$;
alter table public.campaigns enable row level security; alter table public.members enable row level security; alter table public.invites enable row level security; alter table public.characters enable row level security; alter table public.records enable row level security; alter table public.battles enable row level security; alter table public.rolls enable row level security; alter table public.positions enable row level security;
create policy campaign_read on public.campaigns for select to authenticated using(public.is_member(id));
create policy member_read on public.members for select to authenticated using(public.is_member(campaign_id));
create policy invite_read on public.invites for select to authenticated using(public.is_gm(campaign_id));
create policy character_read on public.characters for select to authenticated using(owner=auth.uid() or public.is_member(campaign_id));
create policy character_insert on public.characters for insert to authenticated with check(owner=auth.uid() and (campaign_id is null or public.is_member(campaign_id)));
create policy character_update on public.characters for update to authenticated using(owner=auth.uid()) with check(owner=auth.uid() and (campaign_id is null or public.is_member(campaign_id)));
create policy character_delete on public.characters for delete to authenticated using(owner=auth.uid());
create policy records_read on public.records for select to authenticated using(public.is_gm(campaign_id) or (public.is_member(campaign_id) and visible));
create policy records_write on public.records for all to authenticated using(public.is_gm(campaign_id)) with check(public.is_gm(campaign_id));
create policy battle_read on public.battles for select to authenticated using(public.is_member(campaign_id));
create policy roll_read on public.rolls for select to authenticated using(public.is_member(campaign_id) and (not private or public.is_gm(campaign_id) or user_id=auth.uid()));
create policy positions_read on public.positions for select to authenticated using(public.is_member(campaign_id));
create policy positions_write on public.positions for all to authenticated using(public.is_gm(campaign_id)) with check(public.is_gm(campaign_id) and exists(select 1 from public.characters c where c.id=character_id and c.campaign_id=positions.campaign_id));
create function public.create_campaign(p_name text) returns uuid language plpgsql security definer set search_path='' as $$declare c uuid;begin if auth.uid() is null then raise exception 'Login obrigatório';end if;insert into public.campaigns(name,owner) values(p_name,auth.uid()) returning id into c;insert into public.members values(c,auth.uid());insert into public.invites(campaign_id) values(c);insert into public.battles(campaign_id) values(c);return c;end$$;
create function public.join_campaign(p_code uuid) returns uuid language plpgsql security definer set search_path='' as $$declare c uuid;begin if auth.uid() is null then raise exception 'Login obrigatório';end if;select campaign_id into c from public.invites where code=p_code;if c is null then raise exception 'Convite inválido';end if;insert into public.members values(c,auth.uid()) on conflict do nothing;return c;end$$;
create function public.roll_dice(p_campaign uuid,p_label text,p_count integer,p_faces integer,p_bonus integer,p_private boolean default false) returns uuid language plpgsql security definer set search_path='' as $$declare a jsonb='[]';v int;t int=p_bonus;r uuid;begin if not public.is_member(p_campaign) then raise exception 'Sem acesso';end if;if p_count not between 1 and 50 or p_faces not in(2,3,4,6,8,10,12,20,100) or p_bonus not between -100 and 100 then raise exception 'Dados inválidos';end if;for i in 1..p_count loop v=1+floor(random()*p_faces)::int;a=a||to_jsonb(v);t=t+v;end loop;insert into public.rolls(campaign_id,user_id,label,expression,dice,total,private) values(p_campaign,auth.uid(),left(p_label,100),p_count||'d'||p_faces||case when p_bonus>=0 then '+' else '' end||p_bonus,a,t,p_private) returning id into r;return r;end$$;
-- GM controls encounter state; players may only move their own current token, with explicit permission.
create function public.battle_command(p_campaign uuid,p_revision bigint,p_type text,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$declare s jsonb; rev bigint; idx int; tok jsonb; nx int;ny int; cost int; remaining int; gm boolean; r int; n int; label text; roll int; bonus int; aura_cost int; action_kind text;begin
if not public.is_member(p_campaign) then raise exception 'Sem acesso';end if;gm=public.is_gm(p_campaign);select state,revision into s,rev from public.battles where campaign_id=p_campaign for update;if rev<>p_revision then raise exception 'Estado desatualizado; tente novamente';end if;
if p_type='configure' and gm then s=p_payload;
elsif p_type='move' then
idx=(p_payload->>'index')::int;tok=s->'tokens'->idx;nx=(p_payload->>'x')::int;ny=(p_payload->>'y')::int;
if tok is null or nx not between 0 and 11 or ny not between 0 and 7 then raise exception 'Movimento inválido';end if;
if not gm and (not coalesce((s->>'active')::boolean,false) or not coalesce((s->>'moveAllowed')::boolean,false) or idx<>(s->>'turn')::int or not exists(select 1 from public.characters where id=(tok->>'characterId')::uuid and owner=auth.uid() and campaign_id=p_campaign)) then raise exception 'Movimento não autorizado';end if;
if exists(select 1 from jsonb_array_elements(s->'tokens') with ordinality as e(t,i) where i<>idx+1 and (t->>'x')::int=nx and (t->>'y')::int=ny) then raise exception 'Casa ocupada';end if;
cost=abs(nx-(tok->>'x')::int)+abs(ny-(tok->>'y')::int);remaining=coalesce((tok->>'remaining')::int,0);if not gm and cost>remaining then raise exception 'Deslocamento insuficiente';end if;
tok=tok||jsonb_build_object('x',nx,'y',ny,'remaining',greatest(0,remaining-cost));s=jsonb_set(s,array['tokens',idx::text],tok);
elsif p_type='next' and gm then n=jsonb_array_length(s->'tokens');if n=0 then raise exception 'Sem participantes';end if;idx=((s->>'turn')::int+1)%n;s=s||jsonb_build_object('turn',idx,'round',(s->>'round')::int+case when idx=0 then 1 else 0 end,'moveAllowed',false,'reactionFor',null);tok=s->'tokens'->idx;tok=tok||jsonb_build_object('remaining',coalesce((tok->>'speed')::int,6),'action',true,'power',true,'reaction',true,'bonus',false);s=jsonb_set(s,array['tokens',idx::text],tok);
elsif p_type='act' then idx=(p_payload->>'index')::int;tok=s->'tokens'->idx;action_kind=p_payload->>'kind';if tok is null or not coalesce((s->>'active')::boolean,false) or action_kind not in('action','power','reaction','bonus') then raise exception 'Ação inválida';end if;if not gm and not exists(select 1 from public.characters where id=(tok->>'characterId')::uuid and owner=auth.uid() and campaign_id=p_campaign) then raise exception 'Personagem não autorizado';end if;if action_kind='reaction' then if coalesce((s->>'reactionFor')::int,-1)<>idx then raise exception 'Sem gatilho autorizado';end if;elsif idx<>(s->>'turn')::int then raise exception 'Fora do turno';end if;if not coalesce((tok->>action_kind)::boolean,false) then raise exception 'Ação indisponível';end if;bonus=coalesce((tok->>'attackBonus')::int,0);roll=1+floor(random()*20)::int;label=left(coalesce(p_payload->>'label','Ação'),80);tok=jsonb_set(tok,array[action_kind],'false');s=jsonb_set(s,array['tokens',idx::text],tok);if action_kind='reaction' then s=jsonb_set(s,'{reactionFor}','null');end if;insert into public.rolls(campaign_id,user_id,label,expression,dice,total) values(p_campaign,auth.uid(),(tok->>'name')||': '||label,'1d20 + ('||bonus||')',jsonb_build_array(roll),roll+bonus);
else raise exception 'Comando não permitido';end if;update public.battles set state=s,revision=rev+1 where campaign_id=p_campaign;end$$;
revoke execute on function public.create_campaign(text),public.join_campaign(uuid),public.roll_dice(uuid,text,integer,integer,integer,boolean),public.battle_command(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.create_campaign(text),public.join_campaign(uuid),public.roll_dice(uuid,text,integer,integer,integer,boolean),public.battle_command(uuid,bigint,text,jsonb) to authenticated;
-- No direct client write policies for battles, rolls, membership or invites.
alter publication supabase_realtime add table public.characters,public.records,public.battles,public.rolls,public.positions,public.members;

-- Explicit API grants for new projects.
grant usage on schema public to authenticated;
-- RLS continua ativa. Não exponha as tabelas a usuários anônimos.
alter table public.campaigns enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.characters enable row level security;
alter table public.records enable row level security;
alter table public.battles enable row level security;
alter table public.rolls enable row level security;
alter table public.positions enable row level security;
revoke all on table public.campaigns, public.members, public.invites, public.characters, public.records, public.battles, public.rolls, public.positions from anon, public, authenticated;
grant select on table public.campaigns, public.members, public.invites, public.characters, public.records, public.battles, public.rolls, public.positions to authenticated;
grant insert, update, delete on table public.characters, public.records to authenticated;
grant insert, update on table public.positions to authenticated;
-- Funções auxiliares usadas por políticas RLS e comandos autorizados.
revoke execute on function public.is_gm(uuid), public.is_member(uuid), public.create_campaign(text), public.join_campaign(uuid), public.roll_dice(uuid,text,integer,integer,integer,boolean), public.battle_command(uuid,bigint,text,jsonb) from public, anon;
grant execute on function public.is_gm(uuid), public.is_member(uuid), public.create_campaign(text), public.join_campaign(uuid), public.roll_dice(uuid,text,integer,integer,integer,boolean), public.battle_command(uuid,bigint,text,jsonb) to authenticated;
