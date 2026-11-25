# Hunter Legacy — Mesa RPG (v0.6)

Mesa virtual para o RPG **Hunter Legacy**: fichas, campanhas, combate em tempo real e biblioteca.
Feita com React, Vite e Supabase.

### ▶ [Acessar o site](https://pauloandss.github.io/Hunter-Legacy-site/)

---

## Sumário

1. [Recursos](#recursos)
2. [Executar localmente](#executar-localmente)
3. [Configurar o Supabase](#configurar-o-supabase)
4. [Publicação no GitHub Pages](#publicação-no-github-pages)
5. [Como usar](#como-usar)
6. [Tabuleiro (v0.4)](#tabuleiro-v04)
7. [Organização do código](#organização-do-código)
8. [Testes](#testes)
9. [Estado do projeto](#estado-do-projeto)
10. [Créditos](#créditos)

---

## Recursos

| Área           | O que oferece                                                     |
| -------------- | ----------------------------------------------------------------- |
| **Campanhas**  | Até 2 campanhas próprias; participação por convite não conta      |
| **Fichas**     | Até 5 por usuário, com rolagens, edição e cópia para campanhas    |
| **Combate**    | Tabuleiro, tokens, iniciativa, turnos, ações, reações e condições |
| **Buscas**     | Mapa, NPCs, artefatos, locais e pistas revelados pelo mestre      |
| **Biblioteca** | Leitor de PDF em páginas duplas, com zoom e navegação             |
| **Perfil**     | Nickname e foto do Discord                                        |

---

## Executar localmente

**Requisito:** Node.js 22 (recomendado).

1. Clone o repositório e instale as dependências:

   ```bash
   git clone https://github.com/PauloAndSS/Hunter-Legacy-site.git
   cd Hunter-Legacy-site
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha:

   ```dotenv
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICAVEL
   ```

3. Inicie e abra <http://localhost:5173>:

   ```bash
   npm run dev
   ```

> [!WARNING]
> Nunca use `sb_secret_...`, `service_role` ou a senha do banco no frontend.
> Se uma chave secreta foi exposta, revogue-a no painel do Supabase.

### Comandos

| Comando                | Função                           |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento      |
| `npm run build`        | Build de produção em `dist/`     |
| `npm run preview`      | Visualiza o build localmente     |
| `npm test`             | Testes de geometria do tabuleiro |
| `npm run format`       | Formata o código e os documentos |
| `npm run format:check` | Verifica a formatação            |

---

## Configurar o Supabase

> [!IMPORTANT]
> **Se a v0.3 já funciona no seu Supabase, não execute nenhum SQL novo.**
> O cenário da v0.4 usa a chave `shapes` de `battles.state` e a RPC `battle_command` já existente.

### Banco novo

Execute, nesta ordem, em **Dashboard → SQL Editor → New query**:

1. `supabase/setup.sql`
2. `supabase/upgrade_0.2.sql`
3. Os três arquivos de `supabase/v03_corrigido/`, em ordem numérica

### Banco existente (anterior à v0.3)

1. Faça um backup e confirme que está no projeto correto.
2. Execute os três arquivos de `supabase/v03_corrigido/` em ordem, cada um inteiro e em uma consulta
   distinta. Cada etapa roda em uma transação.
3. **Não** reexecute `setup.sql`. Se houver erro, resolva antes de seguir para o frontend.

A última consulta deve retornar:

| Campo                    | Valor   |
| ------------------------ | ------- |
| `perfil_leitura`         | `true`  |
| `rolagem_ficha`          | `true`  |
| `combate_escrita_direta` | `false` |

A migração preserva campanhas e fichas. Contas acima da cota mantêm seus registros, mas só poderão
criar novos quando ficarem abaixo dela.

### Fotos de perfil

As fotos vêm do Discord e não ocupam o Storage. Depois das etapas acima, execute
`supabase/upgrade_0.5_discord.sql`, que encerra o envio de fotos e limpa as referências antigas.

### Fichas de campanha

Em seguida, execute `supabase/upgrade_0.6_fichas.sql`. Ele separa a ficha da campanha da ficha pessoal
e permite que o mestre edite a da campanha. Nenhuma ficha é apagada. Por fim, execute
`supabase/upgrade_0.6.1_edicao_combate.sql`, que libera a edição durante o combate.

### Login com o Discord

1. No [Discord Developer Portal](https://discord.com/developers/applications), crie uma aplicação.
2. Em **OAuth2 → Redirects**, adicione `https://SEU-PROJETO.supabase.co/auth/v1/callback` e salve.
3. Copie o **Client ID** e o **Client Secret**.
4. No Supabase, em **Authentication → Sign In / Providers → Discord**, ative o provedor, cole os dois
   valores e salve. O Client Secret nunca entra no código nem no GitHub.

### Authentication

- Mantenha o login anônimo **desabilitado** e **Confirm email habilitado**. O Supabase une contas de
  mesmo e-mail; sem confirmação, alguém poderia registrar o e-mail de outra pessoa antes dela.
- O site entra somente pelo Discord.
- Em **URL Configuration**, configure:

  | Campo             | Valor                                                                         |
  | ----------------- | ----------------------------------------------------------------------------- |
  | **Site URL**      | `https://pauloandss.github.io/Hunter-Legacy-site/`                            |
  | **Redirect URLs** | `https://pauloandss.github.io/Hunter-Legacy-site/` e `http://localhost:5173/` |

A migração também adiciona as tabelas necessárias ao Realtime.

---

## Publicação no GitHub Pages

Cada push na branch `main` executa
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): verifica a formatação, roda os
testes, gera o build e publica o site.

Para publicar em um fork:

1. Em **Settings → Pages**, escolha **Source: GitHub Actions**.
2. Em **Settings → Secrets and variables → Actions → Variables**, crie `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` (a chave **publicável**).
3. Faça um push na `main` ou execute o workflow manualmente.

O `.env` nunca é versionado. A URL e a chave publicável ficam visíveis no site compilado; quem
protege os dados são as políticas RLS do banco.

---

## Como usar

### Navegação

- Após entrar ou recarregar, a tela é sempre a **área pessoal**. Selecione uma campanha
  explicitamente.
- A barra superior informa a área ou campanha, o nome, o papel e a página.
- **Online** indica que o canal Realtime está inscrito; **Reconectando** indica ausência dessa
  confirmação. A atualização periódica é um fallback, não presença de todos os jogadores.

### Campanhas

- Crie até 2 campanhas próprias. Participar por convite não consome esse limite.
- Excluir uma campanha pede confirmação, apaga seus registros de sessão e preserva as fichas
  (desvinculadas).

### Fichas

- Até 5 fichas pessoais por usuário e até 5 por jogador em cada campanha.
- Exportar cria uma **cópia** na campanha. A ficha pessoal continua salva e não muda.
- **Para exportar:** abra a ficha pessoal → **Exportar para campanha**. Cada ficha pode ir para várias
  campanhas, uma vez em cada.
- Na campanha, **o dono e o mestre** editam a cópia. Se os dois editarem ao mesmo tempo, o segundo a
  salvar é avisado e nada é sobrescrito.
- Só o dono pode remover a ficha da campanha.
- Se a campanha for excluída, as cópias viram fichas pessoais, mesmo acima do limite de 5.
- Remova o token do combate antes de remover a ficha da campanha. Ela pode ser
  editada durante o combate; PV e condições do encontro continuam no token.
- A ficha abre em leitura com rolagens; a edição é explícita.
- **Conteúdo:** PV, PVE e PA atuais e máximos, resistência, nível, seis atributos, perícias,
  salvaguardas, técnicas e notas.
- **Fórmulas:** modificador e proficiência 1–20 do livro, com maestria em perícias.
- **Manual:** níveis épicos e bônus de ataque e técnicas. As progressões completas de espécie e Nen
  não são automatizadas.

### Perfil

- A conta é criada no primeiro acesso com o Discord, com nickname e foto de lá.
- Para mudar o nickname, clique no avatar no cabeçalho.
- Para atualizar a foto, troque-a no Discord, saia e entre de novo.
- Todos os tokens da conta usam essa foto e esse nickname. O nome do personagem continua na ficha e
  na iniciativa.

### Combate

- O mestre adiciona fichas, NPCs avulsos e registros de NPC ou bestiário.
- Selecione um token para abrir a ficha lateral (personagens). O NPC é identificado pelo nome.
- O mestre edita PV e condições no painel; as barras e abreviações sincronizam via Supabase.
- Os PV do encontro são snapshots do token, independentes da ficha. O mestre precisa reconciliar os
  PV ao fim da sessão.
- **Iniciativa:** manual.
- **Por turno:** uma ação normal e uma de poder; ação bônus quando liberada; reação com gatilho
  autorizado.
- **Movimento:** o jogador move seu personagem somente no seu turno e com autorização do mestre.
- **Ações:** selecione o tipo na ficha. Técnicas personalizadas usam seu tipo cadastrado; o ataque
  padrão é ação normal ou reação autorizada.
- **Servidor:** a RPC deriva modificadores da ficha, verifica turno e propriedade e registra o d20.
  Rolagens livres não executam ações.
- **Mestre:** arbitra dano, custo de aura, condições, vantagens e efeitos. A animação não determina o
  resultado; o log guarda o valor do banco.

### Biblioteca

- Escolha a capa, abra o livro e folheie páginas duplas com setas, número da página ou zoom.
- O PDF.js renderiza apenas duas páginas por vez e preserva o PDF original para leitura alternativa.
- Em celular, a dupla pode exigir rolagem horizontal.
- Os PDFs são acessíveis por URL mesmo sem autenticação.

---

## Tabuleiro (v0.4)

O grid lógico é de 12 × 8, com 1,5 m por casa. A câmera se move livremente e o zoom vai de 18% a
350%. O mapa não é infinito.

| Ferramenta                              | Como usar                                                       |
| --------------------------------------- | --------------------------------------------------------------- |
| **Zoom**                                | Scroll do mouse ou `+` / `−`                                    |
| **Enquadrar**                           | Retorna à visão geral                                           |
| **Ampliar**                             | Maximiza o tabuleiro                                            |
| **Câmera**                              | Arraste o fundo, use a mão ou mantenha `Espaço` pressionado     |
| **Selecionar**                          | Arraste um token e solte na casa desejada                       |
| **Régua, Área e Cone**                  | Clique e arraste; mova o corpo ou as alças para ajustar         |
| **Círculo, Retângulo e Linha** (mestre) | Clique e arraste para criar; edite nome e cor no painel e salve |
| **Abrir ficha**                         | Selecione um token, inclusive no tabuleiro ampliado             |

**Detalhes**

- O mestre move qualquer token; jogadores movem apenas o próprio, durante seu turno e com
  autorização. A RPC valida casas e deslocamento.
- O servidor usa custo Manhattan; a régua visual mede distância euclidiana.
- Régua, área e cone são locais: não são enviados aos outros jogadores nem validam acerto ou linha de
  visão. A abertura visual do cone é de 90°.
- Os objetos são desenhos de cenário, não bloqueios automáticos de movimento. São persistidos e
  sincronizados após soltar ou salvar, com limite de 100 na interface.
- Reiniciar o encontro preserva os objetos; exclua-os individualmente se necessário.
- As fotos dos jogadores são círculos de tamanho fixo no mundo. NPCs exibem o nome; ambos exibem PV
  e condições.

---

## Organização do código

```text
src/
├── main.jsx                    Sessão, contexto de campanha, consultas e navegação
├── rules.js                    Catálogos, fórmulas e normalização da ficha
├── db.js                       Cliente Supabase
├── assets.js                   Caminhos de arquivos públicos
├── discord.js                  Nome e foto vindos do Discord
├── style.css, v03.css          Estilos
├── components/
│   ├── Auth.jsx                Entrada com o Discord
│   ├── Sheet.jsx               Ficha, criação, edição e rolagens
│   ├── Combat.jsx              Combate e iniciativa
│   ├── BattleCanvas.jsx        Tabuleiro e ferramentas de medida
│   ├── boardGeometry.js        Geometria do tabuleiro
│   ├── Profile.jsx             Nickname e foto do Discord
│   ├── Library.jsx             Leitura de PDFs com PDF.js
│   └── UI.jsx                  Modal, avatar e animação do dado
└── data/                       Catálogos de regras em JSON

public/      Imagens e livros
supabase/    Scripts SQL: RLS, Storage, cotas, rolagens e combate
tests/       Testes de geometria e perfil
docs/        Documentação de produto e arquitetura
```

### Documentação

- [Termos de serviço](https://pauloandss.github.io/Hunter-Legacy-site/termos.html)
- [Política de privacidade](https://pauloandss.github.io/Hunter-Legacy-site/privacidade.html)
- [Produto e requisitos](docs/01-produto.md)
- [Arquitetura](docs/02-arquitetura.md)
- [Banco e segurança](docs/03-banco-supabase.md)
- [Combate e Realtime](docs/04-combate-realtime.md)
- [Direção visual](docs/05-design.md)
- [Roadmap e testes](docs/06-roadmap-testes.md)
- [Catálogos e fontes](docs/07-catalogos-e-fontes.md)

---

## Testes

`npm test` valida a geometria do tabuleiro e a leitura do perfil do Discord.

### Roteiro de aceitação (duas contas)

1. **Entrada.** Confirme que nenhuma campanha abre automaticamente e que o cabeçalho indica Área
   pessoal.
2. **Campanhas.** Crie duas e tente uma terceira. Confirme que o banco também recusa, não apenas a
   interface. Entre por convite com a segunda conta.
3. **Fichas.** Crie cinco e confirme que a sexta é recusada. Altere um atributo, role uma perícia e
   compare o resultado com a fórmula do livro e o log. Exportar deve manter a ficha na biblioteca sem
   consumir nova vaga.
4. **Combate.** Com dois navegadores, adicione fichas, NPC e criatura. Verifique que o jogador não
   move token alheio nem o próprio fora do turno. Teste ação, reação, PV, condições, régua, círculo e
   cone. Recarregue, reentre e confira o estado persistido.
5. **Discord.** Entre com o Discord e confira a foto no cabeçalho, nas fichas e nos tokens. Troque a
   foto no Discord, reentre e confira. Teste o nickname.
6. **Biblioteca.** Abra cada PDF, navegue, vá a uma página e use o zoom. Teste o PDF original caso o
   navegador não renderize o livro.
7. **Privacidade.** Rolagem privada, nota privada e registros ocultos não podem ser lidos por outro
   jogador; ficha sem campanha não pode ser lida por outro usuário. Nunca use `service_role` neste
   teste.
8. **Build.** Rode `npm run build` e confira os logs do navegador e do SQL Editor. Se a migração
   falhar, envie o erro integral, sem credenciais.

---

## Estado do projeto

A automação abrange rolagens, controle de turnos e persistência, não o motor completo de Hunter
Legacy. O roteiro de aceitação com duas contas ainda precisa ser executado para homologar a
integração com o Supabase.

---

## Créditos

O sistema **Hunter Legacy** é criação de Caio Mascarenhas e colaboradores, inspirado em
_Hunter x Hunter_, de Yoshihiro Togashi. Os livros, textos e ilustrações pertencem aos seus
respectivos autores.
