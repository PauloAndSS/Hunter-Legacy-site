# Roadmap e qualidade

- Estimativa inicial, não compromisso: 8–12 semanas de trabalho individual parcial para MVP, dependendo da experiência e do volume de automação.
- Priorizar fatias verticais.

| Etapa | Entrega                                                 | Aceite                                                             |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| 0     | regras, revisão dos JSON, design system, ambiente local | versão congelada e amostras conferidas                             |
| 1     | Auth, mesas, convites, RLS                              | usuário não acessa outra mesa                                      |
| 2     | ficha e compartilhamento                                | criação, edição e vínculo persistidos; cálculos validados com XLSX |
| 3     | log, rolagens servidor, busca e pins                    | duas sessões recebem mudanças e segredos não vazam                 |
| 4     | grade, tokens, turnos, autorização e reconexão          | combate simples entre mestre e dois jogadores                      |
| 5     | ataque, reação, aura, bestiário e escudo                | gasto atômico, gatilhos e revelação testados                       |
| 6     | piloto, acessibilidade, performance e deploy            | sessão real, checklist de segurança e backup                       |

## Backlog pós MVP

- Hatsu avançado, todos efeitos e condições, progressão épica, ataque combinado automatizado, fog-of-war sofisticado, importação/exportação PDF, biblioteca de mapas, histórico replay, modo offline de leitura.
- Não prometer automação integral antes de validar catálogos.

## Estratégia de testes

- Vitest para regras puras e fixtures de dados; pgTAP ou SQL de integração para RLS e RPC, inclusive chamadas REST maliciosas;
- Playwright com contextos independentes mestre/jogador/outro usuário.
- Testar refresh, expiração, convite reutilizado, revogação, acesso de asset e canal, comandos concorrentes e log.
- Testes de acessibilidade de teclado e contraste.
- Meta inicial (não medida): confirmação remota p95 < 500 ms em região próxima e 6 jogadores; medir com rede real.
- Canvas 30–60 fps durante pan em hardware-alvo.
- Monitorar mensagens, storage, egress e conexões; não presumir que plano gratuito sempre comportará uso.
- Deploy Next.js em hospedagem compatível, Supabase gerenciado; revisar preços/limites no momento do deploy.

## Definition of done

- Código revisado, migração reproduzível, tipos gerados, testes de autorização e regras, documentação atualizada, sem secrets, erros tratados, acessibilidade e aceitação do mestre.
- Catálogo só vira automatizado depois de validação contra manual e exemplos de ficha.
