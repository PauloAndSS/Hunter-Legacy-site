# Catálogos, importação e lacunas

- Fontes: Livro do Jogador v3.0.1 (241 páginas), Manual do Narrador v3.0 (119), Manual Shingen-Ryu fornecido como 3.0.1 (121, créditos internos indicam 3.0), ficha editável v3.0.1 de Lucco.
- Livro do Jogador pp. 8–14 criação; 15–25 espécies; 26–61 categorias; 62–87 métodos; 88–97 origens; 98–129 personalização e treino; 130–143 Nen; 144–164 classes; 165–184 atributos/técnicas/condições; 194–208 combate; 210–240 equipamentos e extras.
- Narrador pp. 39–44 PdNs, 83–86 combate/grid, 94–110 inimigos, 111–114 itens de Nen.
- Shingen-Ryu pp. 8–78 criação de Hatsu; 80–120 modelos.
- A planilha possui abas Valores, Metodos de Combate Categoria, Personalização e Inventário, Hatsu, Principios de Nen, DESCRIÇÕES, REF.

## O que foi entregue

- JSON separados com índices de nomes de classes, espécies, categorias, origens (parcial), perícias, métodos, domínios, caminhos, habilidades básicas e Nen, habilidades de caminhos e modelos de Hatsu; regras pontuais estruturadas.
- Métodos e caminhos extraídos da aba REF; podem incluir itens VIP e grafias da ficha, não liberar sem revisão.
- As listas não são transcrição completa de benefícios, custos, tabelas ou técnicas.
- Catálogos vazios sinalizam backlog explícito, não conteúdo ausente no RPG.
- Todos os registros têm automação manual até homologação.
- Não usar como seed de produção sem revisão.
- Não incluir PDFs ou textos integrais no pacote.

## Processo de importação

1. Revisar identidade, grafia, duplicatas semânticas e correspondência de páginas; preservar variantes separadas e IDs estáveis.
2. Completar prerequisites, grants, costs, effects, progression, source e review_status; nunca inferir regra faltante. Registrar divergências entre livro e planilha; livro como padrão e mestre decide exceções. Confirmar Kiriko (sumário/capítulo inclui, trecho introdutório menciona duas espécies).
3. Validar JSON Schema, referências cruzadas, limites e fixtures; aprovar por revisão humana. Importar staging em transação com checksum e versionamento. Upsert só em versão de rascunho; publicar nova versão imutável. Personagens fixam ruleset, migração explícita e auditada. Permitir catálogo customizado por mesa separado do oficial.
4. Marcar automação validada apenas depois de testes; registros desconhecidos ficam manuais. Não permitir execução de efeitos arbitrários de JSON.

## Licenças

- Hunter Legacy é material de terceiros (créditos de Caio Mascarenhas e colaboradores), inspirado em Hunter x Hunter.
- Uso privado não equivale a licença de redistribuição.
- Antes de disponibilizar publicamente, verificar autorização dos responsáveis para textos, marca, ilustrações e conteúdo; usar arte original e não redistribuir os manuais sem autorização.
- O CRIS é inspiração funcional, não copiar interface ou código.
