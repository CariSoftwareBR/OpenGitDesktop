# OpenGitDesktop

**Português** · [English](README.en.md) · [Español](README.es.md)

Cliente Git multiplataforma (Windows, macOS, Linux), inspirado no GitDesktop — a versão WinUI 3 (só Windows) deste mesmo projeto. Este é um app novo e independente; o GitDesktop continua sendo mantido em paralelo, fora deste repositório.

## Stack

| Área | Tecnologia |
|---|---|
| Shell desktop | Electron |
| UI | React + TypeScript + Zustand |
| Ícones | lucide-react |
| Build/dev | electron-vite (Vite) |
| Empacotamento | electron-builder |
| Git | Git CLI (via `child_process.spawn` no processo principal) |
| GitHub | REST API (no processo principal) + OAuth Device Flow ou PAT, ambos também usados para autenticar o `git` CLI |
| IA | OpenAI, Claude, OpenRouter, Ollama ou endpoint local compatível com OpenAI |
| Credenciais | `safeStorage` do Electron (Credential Manager / Keychain / libsecret) |

## Requisitos

- Node.js 20+
- Git instalado e disponível no `PATH`

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build        # gera o bundle (out/)
npm run build:win    # empacota para Windows (.exe via NSIS)
npm run build:mac    # empacota para macOS (.dmg/.zip)
npm run build:linux  # empacota para Linux (.AppImage/.deb)
```

Empacotamento multiplataforma real roda via CI (`.github/workflows/gitweb-build.yml`, matrix Windows/macOS/Linux). Localmente, gerar o instalador `.exe` (NSIS) no Windows requer o Modo de Desenvolvedor habilitado (Configurações → Sistema → Para desenvolvedores) — sem isso, a ferramenta de empacotamento não consegue criar os links simbólicos que usa internamente. O app roda normalmente mesmo sem isso (`npm run dev` ou o `.exe` gerado em `dist/win-unpacked/`).

## Release

**Automático:** todo push em `main`/`master` que altera `GitWeb/` gera um release **patch** (ex.: 0.1.0 → 0.1.1), sobe a tag e publica os instaladores (Windows/macOS/Linux) na GitHub Release. O workflow é `.github/workflows/gitweb-auto-release.yml`.

**Manual** (minor/major, ou forçar um patch localmente):

```bash
npm run release:minor   # ou :major / :patch
```

Isso bumpa a versão, faz push da tag e o workflow `.github/workflows/gitweb-release.yml` publica a Release.

## Estrutura

```text
src/
├─ main/          # processo principal (Node) — git, credenciais, diálogos, IPC, settings
├─ preload/       # contextBridge — API tipada exposta ao renderer
├─ shared/        # tipos compartilhados entre main/preload/renderer
│  └─ i18n/       # idiomas e dicionários de tradução (pt-BR, en, es)
└─ renderer/
   └─ src/
      ├─ views/       # Initial, Changes, History, Stashes, PullRequests, AiChat
      ├─ components/  # TopBar, DiffViewer, ConflictResolver
      ├─ store/       # estado global (zustand): repo, pull requests, IA
      └─ lib/         # github.ts (REST), ai/ (providers, tools, commit message, skills/)
```

## Funcionalidades

- Abrir, clonar (URL ou login GitHub via OAuth Device Flow/PAT com listagem de repositórios) e criar repositórios; lista de recentes.
- Changes: stage/unstage/discard por arquivo, diff, commit, geração de descrição de commit por IA.
- History: log de commits, arquivos alterados, diff por commit.
- Branches: trocar, criar, mesclar (com editor básico de resolução de conflitos quando houver).
- Stash: criar, aplicar, pop, descartar — conectado à navegação principal.
- Sync: fetch/pull/push/publicar branch adaptativo conforme o estado ahead/behind/upstream.
- Pull Requests: login com OAuth Device Flow (GitHub.com) ou PAT (GitHub.com ou Enterprise), listar, criar, ver arquivos/comentários, mesclar, fechar/reabrir.
- Chat de IA com ferramentas (criar/trocar/mesclar branch, commit, push/pull/fetch, stash, listar/criar PR) com fluxo de aprovação humana antes de cada ação.
- Interface, mensagens do processo principal e respostas da IA em português (Brasil), inglês ou espanhol — segue o idioma do sistema por padrão e pode ser trocado na hora em Configurações.
- Temas claro/escuro automáticos (via preferência do sistema) e suporte a alto contraste (Windows High Contrast Mode / `prefers-contrast`).

## Autenticação GitHub

OpenGitDesktop oferece dois métodos de login com o GitHub, lado a lado — nenhum substitui o outro:

- **OAuth Device Flow** (padrão, só `github.com`): clica em "Continuar com GitHub", confirma um código de uso único em `github.com/login/device` e o app recebe o token. Requer um OAuth App registrado com Device Flow habilitado, cujo `client_id` fica em `GitWeb/src/main/githubDeviceFlow.ts` (ou na variável de ambiente `GITWEB_GITHUB_OAUTH_CLIENT_ID` para quem builda a partir do fonte e quiser usar seu próprio OAuth App).
- **Personal Access Token**: obrigatório para GitHub Enterprise Server (Device Flow exigiria um OAuth App próprio por instância), disponível também em `github.com`.

O token resultante — de qualquer um dos dois métodos — é salvo criptografado via `safeStorage` (`GitWeb/src/main/credentials.ts`) e usado tanto para as chamadas REST da API quanto para autenticar as operações do `git` CLI (clone/fetch/pull/push) sobre HTTPS, via um `http.extraHeader` aplicado só por invocação (nunca gravado em `.git/config`). Isso elimina a necessidade de configurar separadamente o Git Credential Manager para repositórios GitHub. Remotes SSH continuam usando a configuração SSH do sistema, sem alteração.

### Escopos pedidos

O Device Flow pede `repo` e `workflow`. `repo` dá leitura e escrita em todos os repositórios públicos e privados que a conta alcança — é o menor escopo que o GitHub oferece para um cliente Git de uso geral, já que não existe granularidade por repositório em OAuth Apps. `workflow` é exigido pelo GitHub para enviar commits que alterem arquivos em `.github/workflows/`; sem ele o `git push` é rejeitado nesses casos. A tela de login mostra os dois escopos antes de você autorizar.

### Como o token é isolado

O token **nunca** chega ao processo de renderização. Todas as chamadas à API do GitHub rodam no processo main (`GitWeb/src/main/githubApi.ts`), que resolve o token do cofre a cada chamada; o renderer só envia `host`/`owner`/`repo` por IPC e recebe objetos já mapeados. O `Content-Security-Policy` do renderer usa `connect-src 'self'`, então nem há para onde vazar. O cofre exposto ao renderer (`window.api.secrets`) aceita apenas chaves com prefixo `GitWeb/AI/` — as chaves de provedores de IA —, e todo handler IPC valida a origem do frame que o chamou.

### Nunca digite um código de device flow que você não gerou

O `client_id` é público por natureza do Device Flow — qualquer pessoa pode iniciar um login usando o mesmo
`client_id` (o GitHub CLI tem exatamente a mesma característica). O ataque que isso viabiliza é *device code
phishing*: alguém inicia o fluxo, te manda o código de oito caracteres e pede para você confirmá-lo em
`github.com/login/device`. A tela do GitHub vai mostrar "OpenGitDesktop" normalmente, mas quem recebe o token é o
atacante. Não há como um cliente público impedir isso. A regra é simples: **só digite um código que o próprio
OpenGitDesktop acabou de exibir na sua tela.**

### Sair não revoga a autorização

Sair apaga o token desta máquina, mas a autorização do OAuth App continua ativa na sua conta. Revogá-la pelo app exigiria um *client secret*, que um cliente público de Device Flow não pode guardar. Por isso, depois do logout o app mostra o link para `github.com/settings/connections/applications/<client_id>`, onde você revoga o acesso de verdade.

## Diferenças conhecidas em relação ao GitDesktop (WinUI)

- Chat de IA opera no repositório atual; não há um modo "global" cruzando múltiplos repositórios.
- Tool-calling nativo é tratado de forma unificada (schema OpenAI-compatível para OpenAI/OpenRouter/Ollama/local + Anthropic Messages API para Claude), sem o fallback textual adicional que o app WinUI usa para providers que rejeitam `tools`.

## Status

Todas as fases planejadas (bootstrap, telas core, stash/conflitos, GitHub+PRs, IA, polish/empacotamento, CI) estão implementadas e passam em `npm run typecheck` + `npm run build`. Testado manualmente contra um repositório real.
