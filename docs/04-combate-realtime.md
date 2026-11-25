# Motor de combate e sincronização

## Regras de origem

- Livro do Jogador pp. 7–8: d20 + modificadores, CD em testes/salvaguardas, CR em ataques; vantagem escolhe maior e desvantagem menor de dois d20; regra específica prevalece.
- pp. 195–196: iniciativa por teste de Agilidade, surpresa pode impor desvantagem, ação e ação de poder por turno, bônus somente se característica permitir, reação por gatilho e recuperação no começo do próximo turno próprio.
- pp. 197–208: distinguir combate com aura e sem aura, deslocamento, ações, ataque, dano e cura.
- A ficha tem PV, PVE, PA, armadura, aura gerada/gasta, testes de morte.
- Não tratar PVE como HP comum: perda depende do evento e exceções. p. 63: ataque combinado cria rodada especial sem movimento e com regras próprias; implementar depois do MVP ou resolver manualmente.

## Máquina de estados

- PREPARACAO → INICIATIVA → ATIVO → PAUSADO → ATIVO → ENCERRADO.
- Durante ATIVO: turno aberto → comando → eventual janela de reação → resolução → turno aberto/encerrado.
- Janela mantém comando pendente, ordem determinística de reação definida pelo mestre; jogador pode passar; mestre pode fechar janela.
- Reação não é permissão genérica fora do turno.
- Bloquear avanço durante resolução pendente; mestre pode cancelar com auditoria.

## Movimento (regra de produto)

- Mestre autoriza token e turno específico.
- Jogador solicita caminho, servidor calcula custo (não aceita custo do cliente), testa limites, terreno, ocupação, alcance e saldo.
- Sem permissão ou fora do turno rejeita.
- Mestre pode mover qualquer token por comando de override com motivo.
- Revogar ao fim do turno.
- Grade em metros configurável; diagonais/terreno devem ser conferidos no livro antes de automação.
- No MVP, mestre pode confirmar caminho excepcional.
- Preview local de drag; gravar somente posição final aprovada.

## Ataques e técnicas

- Selecionar ação, arma/técnica aprovada, alvo(s).
- Validar turno ou gatilho de reação, orçamento, alcance, condições, custo PA, proficiência e restrições.
- Motor sorteia dados do lado servidor (fonte aleatória segura, limites de quantidade/faces e rejeição de viés), nunca aceita resultado do cliente.
- Resolve ataque vs CR ou salvaguarda vs CD.
- Dano somente quando autorizado pelo resultado; não revelar CR secreta via payload.
- Aplicar custo, dano e efeito atomicamente.
- Para regras sem implementação, abrir confirmação do mestre, sem inventar fórmula.
- Não presumir que todo ataque é 2d6 como no mockup.
- Registrar dados brutos, valor selecionado, modificadores e resultado.
- Rolagens ocultas geram somente evento privado.

## Protocolo de comando

```text
{ requestId: UUID, encounterId: UUID, expectedRevision: 42,
  type: 'MOVE_TOKEN', payload: { tokenId: UUID, path: [{x:2,y:3},{x:3,y:3}] } }
```

1. RPC valida identidade/vínculo; trava encounter FOR UPDATE; verifica requestId já processado (retorna resposta anterior autorizada), revisão e estado.
2. Aplica regras usando dados persistidos; atualiza recursos, token e orçamento, grava log/evento, incrementa revision; tudo na mesma transação.
3. Commit; trigger envia somente envelope seguro, sem OLD/NEW de tabela privada, para canal autorizado. Em erro rollback total.
4. Cliente deduplica por seq/requestId e busca snapshot/projeção se detectar lacuna, revisão divergente ou reconexão. Assinar canal antes de obter snapshot, bufferizar eventos e descartar seq anteriores. Revalidar no foco e após falha. Não usar Broadcast como fonte durável.

## Canais

- `campaign:<id>:public` para membros ativos; `campaign:<id>:gm` para mestres; se necessário `campaign:<id>:user:<uid>` para destinatário.
- Private true; autorização RLS em realtime.messages; bloquear publicação arbitrária pelo jogador, salvo Presence separado.
- Broadcast com invalidação mínima (id/revisão de conteúdo que já é visível, ou refresh genérico); servidor entrega conteúdo autorizado via RLS.
- Membership revogada exige revalidação/remoção da sessão; não confiar em autorização em cache para dados sensíveis.
- Presence indica online apenas; não decide turno.
- Sem dados privados em Presence.

## Hatsu

- Manual Shingen-Ryu: manifestação focada/versátil, técnicas comuns/auxiliares, graus, custos, restrições, redutores, sobrecarga, requisitos de categoria, proficiência.
- Workflow rascunho → revisão → aprovado → versão arquivada.
- Primeira manifestação tem exceções de treinamento; não generalizar.
- DSL effect_spec com operações permitidas damage/heal/apply_condition/modify_resource/manual, alvos e duração; sem eval.
- Mestre confirma condições narrativas.
- Validar custo e limites por versão; não tornar catálogo incompleto executável.

## Testes críticos

Comando repetido não gasta PA duas vezes; corrida simultânea só aceita revisão válida; jogador não força dado, não move token de outro nem fora da vez; reação fora da janela falha; reação reinicia no próprio turno; rolagem secreta não chega a canal público; reconexão durante turno restaura estado; falha parcial não grava dano; avanço bloqueado durante reação; ataque combinado fica manual até testado.
