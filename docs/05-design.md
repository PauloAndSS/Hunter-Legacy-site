# Direção visual e UX

- Referências locais: design/referencia.png e design/conceito.png.
- Conceito é ilustrativo, não especificação de regras.
- Corrigir classes fictícias e recursos do mockup para a terminologia oficial.
- Não usar artes ou logos da franquia em publicação sem autorização.

## Design tokens propostos

- Fundo #142D25; verde painel #244638; papel #F3E9CB; papel secundário #E4DBB8; dourado #D6B66B; azul #263D61; tinta #21352C; perigo #A84040; aura #8062AC.
- Serif editorial para títulos (Lora ou equivalente), sans legível para texto (Inter), mono para números (IBM Plex Mono).
- Bordas 1px, raio 4–8px, grid de espaçamento 4/8/16/24, contraste WCAG AA a verificar.
- Evitar textura pesada sobre texto e fontes minúsculas.
- Status não apenas por cor.

## Layout desktop

- Topo com Painel, Fichas, Mesa, Buscas, Bestiário e Escudo (últimos dois apenas mestre).
- Painel em três colunas: 260px missões, centro flexível com banner e fichas, 300px mapa e caderno.
- Combate possui rota dedicada em tela cheia: iniciativa esquerda, canvas central, ações direita, log inferior recolhível.
- O dashboard é resumo, não comprimir a mesa inteira.
- Escudo privado em página independente.
- No mobile, abas e drawers; ficha e log responsivos; canvas com zoom e pan por toque.

## Ficha

- Abas correspondentes à planilha: Valores, Categoria/Métodos, Personalização/Inventário, Hatsu, Princípios de Nen.
- Cabeçalho com retrato, nome, nível, categoria, classe Hunter.
- PV, PVE e PA separados, fichas de salvaguardas e perícias, CD/CR, deslocamento terra/voo/nado, testes de morte, exaustão, recursos.
- Mostrar derivados com origem e override marcado.
- Wizard com resumo e confirmação, salvamento automático de rascunho.

## Buscas e escudo

- Mapa de mundo com pins coloridos e nomes, lista lateral, seleção de NPC/artefato/local.
- Estado de descoberta e visibilidade por registro.
- Escudo em abas: notas, NPCs, encontros, bestiário, regras rápidas, revelações e rolagens privadas.
- Prévia 'como jogador' usando projeção pública real.

## Interações

- Desabilitar ação indisponível com explicação; destacar turno ativo, saldo de deslocamento e reação disponível; feedback de comando pendente/aceito/rejeitado; reconexão bloqueia comandos críticos até snapshot.
- Atalhos de teclado, foco visível, alternativa ao drag (selecionar token e destino), confirmação para revelar segredo e encerrar combate.
- Preferir SVG e imagens WebP/AVIF otimizadas, lazy load; respeitar reduced motion.
