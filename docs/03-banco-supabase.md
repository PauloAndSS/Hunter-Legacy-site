# Modelo relacional e segurança

- Proposta de esquema lógico; não é migration executável.
- Todas tabelas de campanha possuem campaign_id (FK), timestamps e índices por campaign_id;
- FKs compostas (campaign_id,id) impedem referências cruzadas.
- UUID PK; valores de recursos inteiros com checks adequados e revisão de exceções.
- Usar JSONB somente para efeitos flexíveis e snapshots, não para relações principais.

| Tabela               | Campos essenciais / relações                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| profiles             | id = auth.users.id, display_name, avatar_path                                                             |
| campaigns            | id, owner_id, name, ruleset_id, settings                                                                  |
| campaign_members     | campaign_id, user_id, role, status; unique par                                                            |
| invitations          | campaign_id, token_hash, expires_at, uses_remaining                                                       |
| sessions             | campaign_id, title, state, started_at, ended_at                                                           |
| rulesets             | id, version, checksum, published_at                                                                       |
| catalog_entries      | ruleset_id, kind, stable_id, payload, review_status; unique tripla                                        |
| characters           | owner_id, ruleset_id, name, level, xp, revision, status                                                   |
| character_stats      | character_id, attribute, base, adjustment                                                                 |
| character_choices    | character_id, catalog_entry_id, acquired_level, details                                                   |
| character_resources  | character_id, key, current, maximum, temporary, revision                                                  |
| character_items      | character_id, catalog_entry_id nullable, quantity, custom_payload                                         |
| character_hatsu      | character_id, name, manifestation, review_status, version                                                 |
| character_techniques | hatsu_id, action_type, grade, cost, effect_spec, approval                                                 |
| character_shares     | campaign_id, character_id, player_id, visibility                                                          |
| world_maps           | campaign_id, asset_id, name, parent_id                                                                    |
| world_locations      | campaign_id, map_id, x_norm, y_norm, label                                                                |
| player_positions     | campaign_id, character_id, map_id, x_norm, y_norm, updated_at                                             |
| discoveries          | campaign_id, kind, title, public_summary, state                                                           |
| discovery_secrets    | campaign_id, discovery_id, private_payload                                                                |
| discovery_links      | campaign_id, from_id, to_id, relation                                                                     |
| visibility_grants    | campaign_id, object_id, object_type, recipient_id nullable                                                |
| gm_notes             | campaign_id, title, private_body                                                                          |
| creature_templates   | campaign_id, owner_id, private_stats, version                                                             |
| encounters           | campaign_id, session_id, state, round, active_combatant_id, revision                                      |
| combat_maps          | campaign_id, encounter_id, asset_id, columns, rows, cell_m                                                |
| combatants           | campaign_id, encounter_id, character_id or template_id, initiative, snapshot, hp, pa, pve                 |
| combatant_public     | campaign_id, combatant_id, display_name, visible_status, approved_fields                                  |
| tokens               | campaign_id, encounter_id, combatant_id, x, y, footprint, visibility                                      |
| turn_budgets         | campaign_id, combatant_id, action_used, power_used, bonus_used, reaction_used, movement_remaining         |
| movement_grants      | campaign_id, encounter_id, combatant_id, turn_id, expires_at, revoked_at                                  |
| reaction_windows     | campaign_id, encounter_id, trigger_id, eligible_actor, status, expires_at                                 |
| active_effects       | campaign_id, combatant_id, effect_key, expiry, source                                                     |
| commands             | campaign_id, encounter_id, actor_id, request_id, result; unique(actor_id,request_id)                      |
| combat_events        | campaign_id, encounter_id, seq, type, private_payload, author_id                                          |
| public_events        | campaign_id, encounter_id, seq, safe_payload                                                              |
| dice_rolls           | campaign_id, session_id, encounter_id nullable, actor_id, expression, faces, modifiers, total, visibility |
| assets               | campaign_id, storage_path, mime_type, visibility, owner_id                                                |

## RLS

- Habilitar RLS em todas tabelas expostas; default deny.
- SELECT: membro ativo e registro compartilhado; proprietário da ficha pode ler a própria; mestre só fichas vinculadas à sua mesa.
- Segredos, templates e eventos privados: somente mestre.
- Jogador não recebe colunas secretas por SELECT *: projeções em tabelas separadas, não mascaramento visual.
- Escrita direta proibida em combate, logs, memberships e grants;
- RPCs específicas.
- Helpers de membership sem recursão (security definer, search_path fixo, qualificação de schema e EXECUTE restrito).
- Toda RPC verifica auth.uid(), vínculo e propriedade, mesmo com RLS.
- Revogar EXECUTE de PUBLIC e conceder somente às roles necessárias.

- Storage privado, validação MIME/tamanho, paths isolados, políticas por mesa;
- URL assinada curta quando necessária.
- Revogar acesso não invalida necessariamente URL assinada já emitida.
- Evitar enviar mapa secreto inteiro com máscara no cliente; exportar recortes/camadas reveladas.
- Não publicar tabelas privadas no Realtime de jogadores.

## RPCs previstas

- create_campaign, accept_invite, share_character, approve_character, update_character, start_encounter, grant_movement, move_token, execute_action, respond_reaction, end_turn, override_encounter, roll_dice, reveal_discovery, revoke_discovery, update_world_position.
- Retorno mínimo autorizado; erro FORBIDDEN/STALE_REVISION/INVALID_TARGET/INSUFFICIENT_RESOURCE/NOT_YOUR_TURN/NO_GRANT.
- Eventos e logs imutáveis por clientes.

## Índices e manutenção

- Índices membership(user_id,campaign_id), events(encounter_id,seq), rolls(session_id,created_at), tokens(encounter_id), discoveries(campaign_id,kind,state).
- Paginar log e catálogo.
- Busca full text em projeção segura.
- Backup e restauração ensaiada; ambientes dev/staging/prod separados; não copiar dados pessoais para dev.
- Retenção e exportação configuráveis.
