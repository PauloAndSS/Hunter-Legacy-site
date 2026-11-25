-- Hunter Legacy v0.3 | Etapa 2/3. Execute o arquivo INTEIRO.
-- Pré-requisito: setup.sql e upgrade_0.2.sql já executados.
-- RLS já está configurada pelo projeto; não acrescente ALTER TABLE automáticos.
begin;
-- Rolagens pessoais privadas e rolagens compartilhadas por campanha.
alter table public.rolls alter column campaign_id drop not null;
drop policy if exists roll_read on public.rolls;
create policy roll_read on public.rolls for select to authenticated using((campaign_id is null and user_id=auth.uid()) or (campaign_id is not null and public.is_member(campaign_id) and (not private or public.is_gm(campaign_id) or user_id=auth.uid())));
create or replace function public.roll_dice(p_campaign uuid,p_label text,p_count integer,p_faces integer,p_bonus integer,p_private boolean default false) returns uuid language plpgsql security definer set search_path='' as $hunter_v03_4$declare a jsonb='[]';v int;t int=p_bonus;r uuid;begin
 if auth.uid() is null or (p_campaign is not null and not public.is_member(p_campaign)) then raise exception 'Sem acesso';end if;
 if p_count is null or p_faces is null or p_bonus is null or p_count not between 1 and 50 or p_faces not in(2,3,4,6,8,10,12,20,100) or p_bonus not between -100 and 100 then raise exception 'Dados inválidos';end if;
 for i in 1..p_count loop v=1+floor(random()*p_faces)::int;a=a||to_jsonb(v);t=t+v;end loop;
 insert into public.rolls(campaign_id,user_id,label,expression,dice,total,private) values(p_campaign,auth.uid(),left(coalesce(p_label,'Rolagem livre'),100),p_count||'d'||p_faces||case when p_bonus>=0 then '+' else '' end||p_bonus,a,t,p_campaign is null or coalesce(p_private,false)) returning id into r;return r;
end;
$hunter_v03_4$;
-- Cálculo de bônus no servidor, com valores cadastrados na ficha.
create or replace function public.hunter_roll_details(p_sheet jsonb,p_mode text,p_key text) returns jsonb language plpgsql immutable set search_path='' as $hunter_v03_5$
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
end;
$hunter_v03_5$;
create or replace function public.roll_sheet(p_character uuid,p_campaign uuid,p_mode text,p_key text) returns uuid language plpgsql security definer set search_path='' as $hunter_v03_6$
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
end;
$hunter_v03_6$;
revoke execute on function public.hunter_roll_details(jsonb,text,text),public.roll_sheet(uuid,uuid,text,text),public.roll_dice(uuid,text,integer,integer,integer,boolean) from public,anon;
grant execute on function public.roll_sheet(uuid,uuid,text,text),public.roll_dice(uuid,text,integer,integer,integer,boolean) to authenticated;
commit;
select 'Etapa 2 concluída' as status;
