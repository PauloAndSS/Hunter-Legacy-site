-- Hunter Legacy v0.3 | Etapa 3/3. Execute o arquivo INTEIRO.
-- Pré-requisito: setup.sql e upgrade_0.2.sql já executados.
-- RLS já está configurada pelo projeto; não acrescente ALTER TABLE automáticos.
begin;
create or replace function public.battle_command(p_campaign uuid,p_revision bigint,p_type text,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $hunter_v03_7$declare s jsonb; rev bigint; idx int; tok jsonb; nx int;ny int; cost int; remaining int; gm boolean; r int; n int; label text; roll int; bonus int; aura_cost int; action_kind text; details jsonb; actor_sheet jsonb; actor_name text;begin
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
else raise exception 'Comando não permitido';end if;update public.battles set state=s,revision=rev+1 where campaign_id=p_campaign;end;
$hunter_v03_7$;
revoke execute on function public.enforce_hunter_limits(),public.guard_hunter_sheet(),public.hunter_roll_details(jsonb,text,text),public.roll_sheet(uuid,uuid,text,text),public.roll_dice(uuid,text,integer,integer,integer,boolean),public.battle_command(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.roll_sheet(uuid,uuid,text,text),public.roll_dice(uuid,text,integer,integer,integer,boolean),public.battle_command(uuid,bigint,text,jsonb) to authenticated;
-- Adicionar publicação apenas se ainda não existir.
do $hunter_v03_8$declare t text;begin foreach t in array array['profiles','campaigns','members','characters','records','battles','rolls','positions'] loop if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;end loop;end;
$hunter_v03_8$;
commit;
select has_table_privilege('authenticated','public.profiles','SELECT') as perfil_leitura,has_function_privilege('authenticated','public.roll_sheet(uuid,uuid,text,text)','EXECUTE') as rolagem_ficha,has_table_privilege('authenticated','public.battles','UPDATE') as combate_escrita_direta;
