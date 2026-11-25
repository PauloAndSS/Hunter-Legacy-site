-- Hunter Legacy v0.5 | Fotos de perfil vindas do Discord. Execute o arquivo INTEIRO.
-- Pré-requisito: etapas de supabase/v03_corrigido/ já executadas.
-- Não apaga arquivos do Storage: esvazie o bucket "avatars" em Storage, no painel.
begin;

-- Encerra o envio de fotos.
drop policy if exists hunter_avatar_insert on storage.objects;
drop policy if exists hunter_avatar_update on storage.objects;

-- Remove referências às fotos antigas.
update public.profiles
set avatar_url = null
where avatar_url is not null
  and avatar_url !~ '^https://cdn\.discordapp\.com/(avatars|embed/avatars)/';

-- Daqui em diante, só fotos do Discord.
alter table public.profiles drop constraint if exists profiles_avatar_discord;
alter table public.profiles add constraint profiles_avatar_discord check (
  avatar_url is null
  or avatar_url ~ '^https://cdn\.discordapp\.com/(avatars|embed/avatars)/'
);

commit;
select 'Fotos do Discord ativadas' as status;
