-- Hunter Legacy v0.6 | Ficha da campanha separada da ficha pessoal. Execute o arquivo INTEIRO.
-- Pré-requisito: upgrade_0.5_discord.sql já executado. Pode ser executado mais de uma vez.
-- Não apaga fichas. As fichas hoje vinculadas a campanhas ganham uma cópia pessoal.
begin;

-- revision: evita que o dono e o mestre sobrescrevam a edição um do outro.
alter table public.characters add column if not exists revision bigint not null default 0;

-- source_id: ficha pessoal que deu origem à ficha da campanha (só na primeira execução).
do $hunter_v06_1$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'characters' and column_name = 'source_id'
  ) then
    return;
  end if;
  alter table public.characters
    add column source_id uuid references public.characters(id) on delete set null;

  -- As cópias não contam como fichas novas do jogador.
  alter table public.characters disable trigger hunter_character_limit;
  with originals as (
    select id, gen_random_uuid() as personal_id, owner, name, sheet, created_at
    from public.characters
    where campaign_id is not null
  ), copies as (
    insert into public.characters(id, owner, name, sheet, created_at)
    select personal_id, owner, name, sheet, created_at from originals
  )
  update public.characters c
  set source_id = o.personal_id
  from originals o
  where c.id = o.id;
  alter table public.characters enable trigger hunter_character_limit;
end;
$hunter_v06_1$;

create unique index if not exists characters_campaign_source
  on public.characters(campaign_id, source_id);

-- Numera cada edição.
create or replace function public.bump_hunter_revision() returns trigger
language plpgsql set search_path = '' as $hunter_v06_2$
begin
  if new.name is distinct from old.name or new.sheet is distinct from old.sheet then
    new.revision = old.revision + 1;
  end if;
  return new;
end;
$hunter_v06_2$;
drop trigger if exists hunter_revision on public.characters;
create trigger hunter_revision before update on public.characters
  for each row execute function public.bump_hunter_revision();

-- Limites: 2 campanhas, 5 fichas pessoais e 5 fichas por jogador em cada campanha.
create or replace function public.enforce_hunter_limits() returns trigger
language plpgsql security definer set search_path = '' as $hunter_v06_3$
begin
  if tg_op = 'UPDATE' then
    if new.owner is distinct from old.owner then
      raise exception 'Não é permitido transferir a propriedade';
    end if;
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || new.owner::text, 0));
  if tg_table_name = 'campaigns' then
    if (select count(*) from public.campaigns where owner = new.owner) >= 2 then
      raise exception 'Limite de 2 campanhas criadas por conta.';
    end if;
  elsif (
    select count(*) from public.characters c
    where c.owner = new.owner
      and c.campaign_id is not distinct from (to_jsonb(new) ->> 'campaign_id')::uuid
  ) >= 5 then
    raise exception '%', case
      when to_jsonb(new) ->> 'campaign_id' is null then 'Limite de 5 fichas pessoais por conta.'
      else 'Limite de 5 fichas por jogador nesta campanha.'
    end;
  end if;
  return new;
end;
$hunter_v06_3$;

-- O jogador cria apenas fichas pessoais; a da campanha nasce de export_sheet.
drop policy if exists character_insert on public.characters;
create policy character_insert on public.characters for insert to authenticated
  with check (owner = auth.uid() and campaign_id is null);

-- Editam: o dono e, se a ficha estiver na campanha, o mestre dela.
drop policy if exists character_update on public.characters;
create policy character_update on public.characters for update to authenticated
  using (owner = auth.uid() or (campaign_id is not null and public.is_gm(campaign_id)))
  with check (owner = auth.uid() or (campaign_id is not null and public.is_gm(campaign_id)));

-- Só nome e conteúdo são editáveis: ninguém muda dono, campanha, origem ou revisão.
revoke insert, update on table public.characters from authenticated;
grant insert (name, sheet, campaign_id) on table public.characters to authenticated;
grant update (name, sheet) on table public.characters to authenticated;

-- Copia a ficha pessoal para a campanha, sem alterar a original.
create or replace function public.export_sheet(p_character uuid, p_campaign uuid) returns uuid
language plpgsql security definer set search_path = '' as $hunter_v06_4$
declare
  c public.characters%rowtype;
  r uuid;
begin
  if auth.uid() is null or not coalesce(public.is_member(p_campaign), false) then
    raise exception 'Sem acesso';
  end if;
  select * into c from public.characters where id = p_character and owner = auth.uid();
  if not found then
    raise exception 'Ficha não autorizada';
  end if;
  if c.campaign_id is not null then
    raise exception 'Exporte a partir da ficha pessoal.';
  end if;
  insert into public.characters(owner, campaign_id, source_id, name, sheet)
  values (c.owner, p_campaign, c.id, c.name, c.sheet)
  on conflict (campaign_id, source_id) do nothing
  returning id into r;
  if r is null then
    raise exception 'Esta ficha já está na campanha.';
  end if;
  return r;
end;
$hunter_v06_4$;

revoke execute on function public.bump_hunter_revision(), public.enforce_hunter_limits(),
  public.export_sheet(uuid, uuid) from public, anon;
grant execute on function public.export_sheet(uuid, uuid) to authenticated;

commit;
select 'Fichas da campanha ativadas' as status;
