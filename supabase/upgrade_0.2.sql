-- Hunter Legacy 0.2: executar no banco existente, depois de setup.sql.
-- Sem DROP, TRUNCATE ou alterações em registros de campanha.
begin;
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
commit;
-- Verificação: deve retornar true, true, false, false.
select has_table_privilege('authenticated','public.characters','SELECT') as fichas_leitura,
       has_table_privilege('authenticated','public.characters','INSERT') as fichas_criacao,
       has_table_privilege('anon','public.characters','SELECT') as anon_leitura,
       has_table_privilege('authenticated','public.battles','UPDATE') as combate_escrita_direta;
