-- Hunter Legacy v0.6.1 | Permite editar a ficha da campanha com o combate ativo.
-- Pré-requisito: upgrade_0.6_fichas.sql. Execute o arquivo INTEIRO. Não altera nenhuma ficha.
-- Continua valendo: só o dono e o mestre editam, e ficha com token não pode sair da campanha.
begin;

create or replace function public.guard_hunter_sheet() returns trigger
language plpgsql security definer set search_path = '' as $hunter_v061_1$
declare
  s jsonb;
  changed boolean;
begin
  -- Ficha pessoal, ou campanha que está sendo excluída.
  if old.campaign_id is null
    or not exists (select 1 from public.campaigns where id = old.campaign_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  changed = tg_op = 'DELETE';
  if tg_op = 'UPDATE' then
    changed = new.campaign_id is distinct from old.campaign_id;
  end if;
  if changed then
    select state into s from public.battles where campaign_id = old.campaign_id for update;
    if exists (
      select 1 from jsonb_array_elements(coalesce(s -> 'tokens', '[]'::jsonb)) t
      where t ->> 'characterId' = old.id::text
    ) then
      raise exception 'Remova o token do combate antes de desvincular ou excluir a ficha.';
    end if;
    if tg_op = 'UPDATE' then
      delete from public.positions where character_id = old.id and campaign_id = old.campaign_id;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$hunter_v061_1$;

revoke execute on function public.guard_hunter_sheet() from public, anon;

commit;
select 'Edição durante o combate ativada' as status;
