# Produto e requisitos | Hunter Legacy

## Objetivo

- Plataforma privada de RPG digital inspirada no CRIS e na estética de dossiês Hunter.
- Mestre cria mesas, jogadores criam fichas e participam de sessões sincronizadas.
- Não implementar o produto nesta etapa.

## Escopo funcional

- Conta, perfil, recuperação de acesso, mesas, convites de uso limitado e expiração, papéis por mesa, saída/remoção, histórico de sessões.
- Fichas pessoais: rascunho, escolha de espécie, categoria (inclusive Sem Categoria), três métodos de combate, atributos, origem, personalização, evolução, classe Hunter e licença quando aplicáveis. Compartilhar mediante associação à mesa; ficha privada por padrão. Mestre pode aprovar e fazer ajustes auditados. Não confundir categoria Nen com classe Hunter.
- Buscas: CRUD de PdNs, mapas, artefatos, locais, missões, pistas e anexos; tags, pesquisa, ligação entre entidades, estados desconhecido/descoberto/concluído. Mapa fictício com coordenadas normalizadas 0..1 por imagem, não GPS. Mestre move ou autoriza movimento exploratório, e decide quem pode enxergar cada pin. Histórico por sessão.
- Mesa de combate: mapa de imagem com grade configurável em metros, tokens, zoom, pan, régua, iniciativa, turnos, ação, ação de poder, bônus, reação, condições, alcance, HP/PA/PVE, autorização de movimento, ataques e técnicas, pausa e encerramento. Mestre instancia inimigos do bestiário. Não confundir posição do mundo com posição da grade.
- Log: fórmula, dados brutos, modificadores, total, autor, alvo quando revelado, resultado, data, turno e visibilidade. Filtrar por sessão/personagem/tipo. Não permitir editar resultados; correção é evento novo. Rolagem livre fora do combate; em combate, ações são validadas.
- Bestiário: modelos privados, atributos, CR/CD, PV/PVE/PA, ações, técnicas, resistências, condições, tags e imagem; duplicar e instanciar sem alterar o modelo. Não assumir que o manual fornece bestiário completo: capítulo 3.13 ensina a criar inimigos.
- Escudo: anotações, informações de NPC, próximas cenas, fichas inimigas, encontros, tabelas, pistas e rolagens privadas. Revelação explícita por campo/registro, mesa ou destinatários. Revogar impede acesso futuro, não apaga informação já vista.

## Papéis

- Mestre: administra mesa e conteúdo privado, turnos, permissões, correções.
- Jogador: próprias fichas, consulta somente conteúdo compartilhado, comandos autorizados no combate.
- Visitante: sem acesso por padrão.
- Papel é vínculo de mesa, não atributo global.

## Critérios de aceitação

- Dois jogadores e mestre em navegadores distintos veem movimentação confirmada e log sem recarregar.
- Jogador não move token alheio nem fora do turno, não lê nota privada por API, não duplica gasto com clique duplo.
- Reconexão recupera estado correto.
- Mestre revela pista sem revelar outros campos.
- Ficha mantém versão de regras e persistência.

## Fora do MVP

- Voz/vídeo, mercado público, IA generativa, animações 3D, automação integral de Hatsu, aplicativos nativos.
- Primeiro validar uma mesa real de amigos.
