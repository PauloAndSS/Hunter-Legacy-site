# Arquitetura e decisões técnicas

## Stack proposta

- Next.js App Router + TypeScript, React, Tailwind CSS + CSS variables, Radix/shadcn para componentes acessíveis, React Hook Form + Zod, TanStack Query para cache de consultas, Zustand para UI efêmera, React Konva para tabuleiro 2D (carregamento client-only), Supabase Auth/PostgreSQL/Storage/Realtime.
- Vitest, Playwright, Supabase CLI local, migrations SQL e CI.
- Escolha um monólito modular inicialmente, não microserviços.
- Next.js entrega páginas de consulta no servidor e ilha interativa de combate no cliente.
- Evitar renderização a cada movimento de mouse.

## Fronteiras

```text
src/app/(auth)/login
src/app/(app)/fichas/[id]
src/app/(app)/mesas/[id]/{painel,buscas,combate,bestiario,escudo,rolagens}
src/modules/{auth,campaign,character,catalog,combat,dice,world,bestiary,gm-screen}
  domain/         # entidades, value objects, regras puras
  application/    # casos de uso, interfaces/ports
  infrastructure/ # adaptadores Supabase
  presentation/   # componentes/hooks
src/shared/{ui,validation,errors,types}
supabase/{migrations,tests,seed.sql}
data/             # catálogos versionados
```

- Dependências apontam para domínio; nenhum import de Supabase em regras puras.
- Classes apenas onde protegem invariantes; funções puras para cálculo.
- Repository para leitura/persistência;
- Adapter para Realtime/Storage;
- Strategy para regras e efeitos;
- Command para operações de combate;
- State para estados de encontro e reação;
- Factory para instanciar inimigos;
- Observer para eventos recebidos.
- Não duplicar motor autoritativo no cliente: prévias são estimativas, confirmação é RPC.

## Fluxo

- Browser → Supabase Auth → query RLS para leitura; comandos críticos → RPC PostgreSQL transacional com JWT do usuário → lock do encontro, validações, alteração, evento e confirmação → Broadcast privado de invalidação → clientes buscam projeção permitida.
- Next.js route handlers para operações externas, exportações e uploads quando necessário.
- Nenhuma chave service_role no navegador.

## Domínio

- Character, CharacterSheet, Ruleset, Campaign, Membership, Encounter, Combatant, TurnBudget, ReactionWindow, Token, DiceRoll, WorldMap, Location, Discovery, CreatureTemplate, VisibilityGrant.
- IDs UUID.
- Value objects: DiceExpression, GridPosition, AuraPoints, VisibilityScope.
- Serviços: CharacterBuilder, ProgressionService, CombatCommandService, DiceService, VisibilityService.
- Não usar herança por categoria; compor características e efeitos por dados.

## ADRs

- **ADR-01:** Supabase gerenciado primeiro; migrar via Postgres dump + objetos Storage + estratégia de usuários/Auth + novo endpoint Realtime, não supor migração automática.
- **ADR-02:** persistência antes de notificação; presença não é estado.
- **ADR-03:** regras versionadas, exceções do mestre registradas.
- **ADR-04:** dados secretos separados fisicamente das projeções públicas.
- **ADR-05:** sem scripts arbitrários de habilidade; DSL declarativa allowlist e modo manual.
- **ADR-06:** sem transmissão de cada frame de drag; confirmação no drop; previews opcionais descartáveis.

## Referências técnicas

- https://nextjs.org/docs/app
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/realtime/authorization
- https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
- https://supabase.com/docs/guides/realtime/broadcast
- https://crisordemparanormal.com/ (referência funcional fornecida; conteúdo interno não acessível na consulta).
