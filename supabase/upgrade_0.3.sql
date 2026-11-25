-- Hunter Legacy 0.3. Execute após setup.sql + upgrade_0.2.sql, no SQL Editor.
-- Migração transacional. Não apaga campanhas, contas ou fichas existentes.
begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null check(char_length(btrim(nickname)) between 2 and 32),
 avatar_url text check(avatar_url is null or length(avatar_url)<=1000)
);
alter table public.profiles enable row level security;
create or replace function public.can_read_profile(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid()=p_id or exists(select 1 from public.members a join public.members b using(campaign_id) where a.user_id=auth.uid() and b.user_id=p_id)
$$;
drop policy if exists profile_read on public.profiles;
create policy profile_read on public.profiles for select to authenticated using(public.can_read_profile(id));
drop policy if exists profile_insert on public.profiles;
create policy profile_insert on public.profiles for insert to authenticated with check(id=auth.uid());
drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
revoke all on public.profiles from public,anon,authenticated;
grant select,insert,update on public.profiles to authenticated;
revoke execute on function public.can_read_profile(uuid) from public,anon;
grant execute on function public.can_read_profile(uuid) to authenticated;
-- Um único arquivo por usuário, limite também no Storage.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',true,98304,array['image/webp']) on conflict(id) do update set public=true,file_size_limit=98304,allowed_mime_types=array['image/webp'];
drop policy if exists hunter_avatar_insert on storage.objects;
create policy hunter_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp');
drop policy if exists hunter_avatar_update on storage.objects;
create policy hunter_avatar_update on storage.objects for update to authenticated using(bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp') with check(bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp');
drop policy if exists hunter_avatar_select on storage.objects;
create policy hunter_avatar_select on storage.objects for select to authenticated using(bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp');
-- Evita que excluir uma campanha apague as fichas pessoais.
alter table public.characters drop constraint if exists characters_campaign_id_fkey;
alter table public.characters add constraint characters_campaign_id_fkey foreign key(campaign_id) references public.campaigns(id) on delete set null;
drop policy if exists campaign_delete_own on public.campaigns;
create policy campaign_delete_own on public.campaigns for delete to authenticated using(owner=auth.uid());
grant delete on public.campaigns to authenticated;
-- Limites por proprietário, inclusive via REST. Serializa inserções concorrentes.
create or replace function public.enforce_hunter_limits() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then if new.owner is distinct from old.owner then raise exception 'Não é permitido transferir a propriedade'; end if; return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(tg_table_name||new.owner::text,0));
 if tg_table_name='campaigns' then
  if (select count(*) from public.campaigns where owner=new.owner)>=2 then raise exception 'Limite de 2 campanhas criadas por conta.';end if;
 elsif (select count(*) from public.characters where owner=new.owner)>=5 then raise exception 'Limite de 5 fichas por conta.';end if;
 return new;
end$$;
drop trigger if exists hunter_campaign_limit on public.campaigns;
create trigger hunter_campaign_limit before insert or update on public.campaigns for each row execute function public.enforce_hunter_limits();
drop trigger if exists hunter_character_limit on public.characters;
create trigger hunter_character_limit before insert or update on public.characters for each row execute function public.enforce_hunter_limits();
-- Não permitir edição de ficha em combate ativo, nem retirar um token existente por edição de vínculo.
create or replace function public.guard_hunter_sheet() returns trigger language plpgsql security definer set search_path='' as $$
declare s jsonb; changed boolean;begin
 if old.campaign_id is null then if tg_op='DELETE' then return old;else return new;end if;end if;
 -- A exclusão da campanha preserva a ficha via SET NULL.
 if not exists(select 1 from public.campaigns where id=old.campaign_id) then if tg_op='DELETE' then return old;else return new;end if;end if;
 select state into s from public.battles where campaign_id=old.campaign_id for update;
 if tg_op='DELETE' then changed=true;else changed=new.campaign_id is distinct from old.campaign_id;end if;
 if changed and exists(select 1 from jsonb_array_elements(coalesce(s->'tokens','[]'::jsonb)) t where t->>'characterId'=old.id::text) then raise exception 'Remova o token do combate antes de desvincular ou excluir a ficha.';end if;
 if tg_op='UPDATE' then
  if coalesce((s->>'active')::boolean,false) and (new.sheet is distinct from old.sheet or new.name is distinct from old.name) then raise exception 'Pause o combate para editar esta ficha.';end if;
  if changed then delete from public.positions where character_id=old.id and campaign_id=old.campaign_id;end if;
  return new;
 end if;return old;
end$$;
drop trigger if exists hunter_guard_sheet on public.characters;
create trigger hunter_guard_sheet before update or delete on public.characters for each row execute function public.guard_hunter_sheet();
-- Rolagens pessoais privadas e rolagens compartilhadas por campanha.
alter table public.rolls alter column campaign_id drop not null;
drop policy if exists roll_read on public.rolls;
create policy roll_read on public.rolls for select to authenticated using((campaign_id is null and user_id=auth.uid()) or (campaign_id is not null and public.is_member(campaign_id) and (not private or public.is_gm(campaign_id) or user_id=auth.uid())));
create or replace function public.roll_dice(p_campaign uuid,p_label text,p_count integer,p_faces integer,p_bonus integer,p_private boolean default false) returns uuid language plpgsql security definer set search_path='' as $$declare a jsonb='[]';v int;t int=p_bonus;r uuid;begin
 if auth.uid() is null or (p_campaign is not null and not public.is_member(p_campaign)) then raise exception 'Sem acesso';end if;
 if p_count is null or p_faces is null or p_bonus is null or p_count not between 1 and 50 or p_faces not in(2,3,4,6,8,10,12,20,100) or p_bonus not between -100 and 100 then raise exception 'Dados inválidos';end if;
 for i in 1..p_count loop v=1+floor(random()*p_faces)::int;a=a||to_jsonb(v);t=t+v;end loop;
 insert into public.rolls(campaign_id,user_id,label,expression,dice,total,private) values(p_campaign,auth.uid(),left(coalesce(p_label,'Rolagem livre'),100),p_count||'d'||p_faces||case when p_bonus>=0 then '+' else '' end||p_bonus,a,t,p_campaign is null or coalesce(p_private,false)) returning id into r;return r;
end$$;
-- Cálculo de bônus no servidor, com valores cadastrados na ficha.
create or replace function public.hunter_roll_details(p_sheet jsonb,p_mode text,p_key text) returns jsonb language plpgsql immutable set search_path='' as $$
declare a text; b int; proficiency int; lev int; label text; k jsonb; training int; action_kind text; skill_map constant jsonb := '{"atletismo": {"attribute": "Força", "name": "Atletismo"}, "acrobacia": {"attribute": "Agilidade", "name": "Acrobacia"}, "furtividade": {"attribute": "Agilidade", "name": "Furtividade"}, "pilotagem": {"attribute": "Agilidade", "name": "Pilotagem"}, "prestigitacao": {"attribute": "Agilidade", "name": "Prestigitação"}, "ciencia": {"attribute": "Sabedoria", "name": "Ciência"}, "historia": {"attribute": "Sabedoria", "name": "História"}, "investigacao": {"attribute": "Sabedoria", "name": "Investigação"}, "medicina": {"attribute": "Sabedoria", "name": "Medicina"}, "natureza": {"attribute": "Sabedoria", "name": "Natureza"}, "sobrevivencia": {"attribute": "Sabedoria", "name": "Sobrevivência"}, "tecnologia": {"attribute": "Sabedoria", "name": "Tecnologia"}, "atuacao": {"attribute": "Presença", "name": "Atuação"}, "enganacao": {"attribute": "Presença", "name": "Enganação"}, "intimidacao": {"attribute": "Presença", "name": "Intimidação"}, "persuasao": {"attribute": "Presença", "name": "Persuasão"}, "provocacao": {"attribute": "Presença", "name": "Provocação"}, "nen": {"attribute": "Espírito", "name": "Nen"}, "intuicao": {"attribute": "Espírito", "name": "Intuição"}, "percepcao": {"attribute": "Espírito", "name": "Percepção"}, "sobrenatural": {"attribute": "Espírito", "name": "Sobrenatural"}, "sorte": {"attribute": "Espírito", "name": "Sorte"}}'::jsonb;
begin
 lev=greatest(1,least(30,coalesce((p_sheet->>'level')::int,1)));
 proficiency=case when lev<=20 then 2+(lev-1)/4 else greatest(0,least(20,coalesce((p_sheet->>'proficiency')::int,6))) end;
 if p_mode='attack' then b=coalesce((p_sheet->>'attackBonus')::int,0);label='Ataque';
 elsif p_mode='technique' then
  if p_key is null or p_key!~'^[0-9]{1,3}$' then raise exception 'Técnica inválida';end if;
  k=p_sheet->'techniques'->(p_key::int);if k is null then raise exception 'Técnica inexistente';end if;
  b=coalesce((k->>'bonus')::int,0);label=coalesce(k->>'name','Técnica');action_kind=k->>'kind';if action_kind is null or action_kind not in('action','power','bonus','reaction') then raise exception 'Tipo de técnica inválido';end if;
 else
  if p_mode='skill' then k=skill_map->p_key;if k is null then raise exception 'Perícia inválida';end if;a=k->>'attribute';label=k->>'name';training=greatest(0,least(2,coalesce((p_sheet->'skillTraining'->>p_key)::int,0)));
  elsif p_mode in('attribute','save') then a=p_key;label=case when p_mode='save' then 'Salvaguarda: ' else '' end||a;training=case when p_mode='save' and coalesce((p_sheet->'saves'->>a)::boolean,false) then 1 else 0 end;
  else raise exception 'Rolagem inválida';end if;
  if a is null or a not in('Força','Agilidade','Constituição','Sabedoria','Espírito','Presença') then raise exception 'Atributo inválido';end if;
  b=floor((greatest(1,least(30,coalesce((p_sheet->'attributes'->>a)::int,10)))-10)/2.0)::int+training*proficiency;
 end if;
 return jsonb_build_object('bonus',greatest(-100,least(100,b)),'label',left(label,80),'kind',action_kind);
end$$;
create or replace function public.roll_sheet(p_character uuid,p_campaign uuid,p_mode text,p_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.characters%rowtype; d jsonb; s jsonb;begin
 if auth.uid() is null then raise exception 'Login obrigatório';end if;
 select * into c from public.characters where id=p_character;if not found then raise exception 'Ficha inexistente';end if;
 if p_campaign is null then if c.owner<>auth.uid() then raise exception 'Ficha privada';end if;
 else
  if not public.is_member(p_campaign) or c.campaign_id is distinct from p_campaign or (c.owner<>auth.uid() and not public.is_gm(p_campaign)) then raise exception 'Ficha não autorizada';end if;
  select state into s from public.battles where campaign_id=p_campaign for update;
  if coalesce((s->>'active')::boolean,false) then raise exception 'Use a ficha no combate ativo.';end if;
 end if;
 d=public.hunter_roll_details(c.sheet,p_mode,p_key);
 return public.roll_dice(p_campaign,c.name||': '||(d->>'label'),1,20,(d->>'bonus')::int,false);
end$$;
create or replace function public.battle_command(p_campaign uuid,p_revision bigint,p_type text,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$declare s jsonb; rev bigint; idx int; tok jsonb; nx int;ny int; cost int; remaining int; gm boolean; r int; n int; label text; roll int; bonus int; aura_cost int; action_kind text; details jsonb; actor_sheet jsonb; actor_name text;begin
if not public.is_member(p_campaign) then raise exception 'Sem acesso';end if;gm=public.is_gm(p_campaign);select state,revision into s,rev from public.battles where campaign_id=p_campaign for update;if rev is null or p_revision is null or rev<>p_revision then raise exception 'Estado desatualizado; tente novamente';end if;
if p_type='configure' and gm then s=p_payload;
elsif p_type='move' then
idx=(p_payload->>'index')::int;tok=s->'tokens'->idx;nx=(p_payload->>'x')::int;ny=(p_payload->>'y')::int;
if idx is null or idx<0 or nx is null or ny is null or tok is null or nx not between 0 and 11 or ny not between 0 and 7 then raise exception 'Movimento inválido';end if;
if not gm and (not coalesce((s->>'active')::boolean,false) or not coalesce((s->>'moveAllowed')::boolean,false) or idx<>(s->>'turn')::int or not exists(select 1 from public.characters where id=(tok->>'characterId')::uuid and owner=auth.uid() and campaign_id=p_campaign)) then raise exception 'Movimento não autorizado';end if;
if exists(select 1 from jsonb_array_elements(s->'tokens') with ordinality as e(t,i) where i<>idx+1 and (t->>'x')::int=nx and (t->>'y')::int=ny) then raise exception 'Casa ocupada';end if;
cost=abs(nx-(tok->>'x')::int)+abs(ny-(tok->>'y')::int);remaining=coalesce((tok->>'remaining')::int,0);if not gm and cost>remaining then raise exception 'Deslocamento insuficiente';end if;
tok=tok||jsonb_build_object('x',nx,'y',ny,'remaining',greatest(0,remaining-cost));s=jsonb_set(s,array['tokens',idx::text],tok);
elsif p_type='next' and gm then n=jsonb_array_length(s->'tokens');if n=0 then raise exception 'Sem participantes';end if;idx=((s->>'turn')::int+1)%n;s=s||jsonb_build_object('turn',idx,'round',(s->>'round')::int+case when idx=0 then 1 else 0 end,'moveAllowed',false,'reactionFor',null);tok=s->'tokens'->idx;tok=tok||jsonb_build_object('remaining',coalesce((tok->>'speed')::int,6),'action',true,'power',true,'reaction',true,'bonus',false);s=jsonb_set(s,array['tokens',idx::text],tok);
elsif p_type='act' then idx=(p_payload->>'index')::int;tok=s->'tokens'->idx;action_kind=p_payload->>'kind';if idx is null or idx<0 or action_kind is null or tok is null or not coalesce((s->>'active')::boolean,false) or action_kind not in('action','power','reaction','bonus') then raise exception 'Ação inválida';end if;if not gm and not exists(select 1 from public.characters where id=(tok->>'characterId')::uuid and owner=auth.uid() and campaign_id=p_campaign) then raise exception 'Personagem não autorizado';end if;if action_kind='reaction' then if coalesce((s->>'reactionFor')::int,-1)<>idx then raise exception 'Sem gatilho autorizado';end if;elsif idx<>(s->>'turn')::int then raise exception 'Fora do turno';end if;if not coalesce((tok->>action_kind)::boolean,false) then raise exception 'Ação indisponível';end if;if tok->>'characterId' is not null then
 select sheet,name into actor_sheet,actor_name from public.characters where id=(tok->>'characterId')::uuid and campaign_id=p_campaign;
 if not found then raise exception 'Ficha não está na campanha';end if;
 if coalesce(p_payload->>'mode','attack')='attack' and action_kind not in('action','reaction') then raise exception 'Ataque padrão exige ação normal ou reação autorizada';end if;
 details=public.hunter_roll_details(actor_sheet,coalesce(p_payload->>'mode','attack'),coalesce(p_payload->>'key',''));
 if details->>'kind' is not null and details->>'kind'<>action_kind then raise exception 'Selecione o tipo de ação exigido pela técnica';end if;
 bonus=(details->>'bonus')::int;label=details->>'label';
 else bonus=greatest(-100,least(100,coalesce((tok->>'attackBonus')::int,0)));label=left(coalesce(p_payload->>'label','Ação'),80);end if;
 roll=1+floor(random()*20)::int;tok=jsonb_set(tok,array[action_kind],'false');s=jsonb_set(s,array['tokens',idx::text],tok);if action_kind='reaction' then s=jsonb_set(s,'{reactionFor}','null');end if;insert into public.rolls(campaign_id,user_id,label,expression,dice,total) values(p_campaign,auth.uid(),(tok->>'name')||': '||label,'1d20 + ('||bonus||')',jsonb_build_array(roll),roll+bonus);
else raise exception 'Comando não permitido';end if;update public.battles set state=s,revision=rev+1 where campaign_id=p_campaign;end$$;

revoke execute on function public.enforce_hunter_limits(),public.guard_hunter_sheet(),public.hunter_roll_details(jsonb,text,text),public.roll_sheet(uuid,uuid,text,text),public.roll_dice(uuid,text,integer,integer,integer,boolean),public.battle_command(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.roll_sheet(uuid,uuid,text,text),public.roll_dice(uuid,text,integer,integer,integer,boolean),public.battle_command(uuid,bigint,text,jsonb) to authenticated;
-- Adicionar publicação apenas se ainda não existir.
do $$declare t text;begin foreach t in array array['profiles','campaigns','members','characters','records','battles','rolls','positions'] loop if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;end loop;end$$;
commit;
select has_table_privilege('authenticated','public.profiles','SELECT') as perfil_leitura,has_function_privilege('authenticated','public.roll_sheet(uuid,uuid,text,text)','EXECUTE') as rolagem_ficha,has_table_privilege('authenticated','public.battles','UPDATE') as combate_escrita_direta;
