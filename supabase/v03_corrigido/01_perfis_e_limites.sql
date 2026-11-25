-- Hunter Legacy v0.3 | Etapa 1/3. Execute o arquivo INTEIRO.
-- Pré-requisito: setup.sql e upgrade_0.2.sql já executados.
-- RLS já está configurada pelo projeto; não acrescente ALTER TABLE automáticos.
begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 nickname text not null check(char_length(btrim(nickname)) between 2 and 32),
 avatar_url text check(avatar_url is null or length(avatar_url)<=1000)
);
alter table public.profiles enable row level security;
create or replace function public.can_read_profile(p_id uuid) returns boolean language sql stable security definer set search_path='' as $hunter_v03_1$
 select auth.uid()=p_id or exists(select 1 from public.members a join public.members b using(campaign_id) where a.user_id=auth.uid() and b.user_id=p_id)
$hunter_v03_1$;
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
create or replace function public.enforce_hunter_limits() returns trigger language plpgsql security definer set search_path='' as $hunter_v03_2$
begin
 if tg_op='UPDATE' then if new.owner is distinct from old.owner then raise exception 'Não é permitido transferir a propriedade'; end if; return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(tg_table_name||new.owner::text,0));
 if tg_table_name='campaigns' then
  if (select count(*) from public.campaigns where owner=new.owner)>=2 then raise exception 'Limite de 2 campanhas criadas por conta.';end if;
 elsif (select count(*) from public.characters where owner=new.owner)>=5 then raise exception 'Limite de 5 fichas por conta.';end if;
 return new;
end;
$hunter_v03_2$;
drop trigger if exists hunter_campaign_limit on public.campaigns;
create trigger hunter_campaign_limit before insert or update on public.campaigns for each row execute function public.enforce_hunter_limits();
drop trigger if exists hunter_character_limit on public.characters;
create trigger hunter_character_limit before insert or update on public.characters for each row execute function public.enforce_hunter_limits();
-- Não permitir edição de ficha em combate ativo, nem retirar um token existente por edição de vínculo.
create or replace function public.guard_hunter_sheet() returns trigger language plpgsql security definer set search_path='' as $hunter_v03_3$
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
end;
$hunter_v03_3$;
drop trigger if exists hunter_guard_sheet on public.characters;
create trigger hunter_guard_sheet before update or delete on public.characters for each row execute function public.guard_hunter_sheet();
revoke execute on function public.enforce_hunter_limits(), public.guard_hunter_sheet() from public, anon;
commit;
select 'Etapa 1 concluída' as status;
