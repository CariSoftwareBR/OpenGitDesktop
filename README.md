# OpenGitDesktop

**Português** · [English](README.en.md) · [Español](README.es.md)

### O cliente Git que trabalha com você — não no seu lugar.

Imagine abrir o repositório, olhar o diff, pedir *“cria uma branch, faz o commit e abre o PR”*… e ver cada passo acontecer **só depois que você aprova**.

Isso é o **OpenGitDesktop**: um cliente Git de verdade para Windows, macOS e Linux — com o fluxo completo do dia a dia e um assistente de IA que executa ações reais no repositório, sob o seu comando.

Sem terminal obrigatório. Sem agente solto no seu histórico. Só velocidade com controle.

---

## A ideia

Há ótimos clientes Git. Há ótimos agentes de IA. Quase nenhum junta as duas coisas do jeito certo.

| Só GUI | Só agente | **OpenGitDesktop** |
|---|---|---|
| Você clica em tudo | A IA faz sozinha | Você conversa — e **aprova** cada ação |
| Seguro, mas lento | Rápido, mas arriscado | Rápido **e** seguro |

O diferencial não é “ter IA”. É **tool-calling com aprovação humana obrigatória**: a IA propõe branch, commit, push, stash, PR… e nada toca o repositório até você dizer sim.

---

## Fluxo completo — do clone ao merge

### Repositórios
Abra, clone (por URL ou direto do GitHub) ou crie do zero. Recentes sempre à mão. Login com **OAuth Device Flow** ou **Personal Access Token** — funciona em github.com e GitHub Enterprise.

### Changes
Stage, unstage e discard por arquivo. Diff nítido. Commit com mensagem escrita por você — ou gerada pela IA a partir do que realmente mudou.

### History & branches
Navegue o log, veja o que cada commit alterou, troque de branch, crie novas, mescle e resolva conflitos sem sair do app.

### Stash & sync
Guarde trabalho em andamento, recupere quando precisar. Fetch, pull, push e publicar branch se adaptam ao estado ahead/behind/upstream.

### Pull Requests
Liste, crie, revise arquivos e comentários, mescle, feche ou reabra — tudo integrado à conta GitHub autenticada.

### Chat de IA
Painel lateral ou flutuante. Fale em linguagem natural. A IA lê o estado do repo e propõe ferramentas reais — cada uma com preview e aprovação antes de rodar.

### No seu idioma
Interface, mensagens de erro e respostas da IA seguem o idioma do sistema — **Português (Brasil)**, **English** ou **Español** — e dá para trocar a qualquer momento em Configurações.

---

## O assistente, de perto

Não é um chatbot decorativo. É um operador supervisionado do seu Git.

**Ele pode:**
- Criar, trocar e mesclar branches
- Gerar mensagem e fazer commit
- Push, pull e fetch
- Stash / stash pop
- Listar e criar pull requests
- Ajudar a revisar e mesclar PRs (com skills dedicadas)

**Ele não pode:**
- Escrever no repositório sem a sua aprovação
- Agir em vários repos ao mesmo tempo — opera só no que está aberto
- Guardar suas chaves fora da máquina: API keys e tokens ficam no cofre do SO (`safeStorage`)

Escolha o provedor: **OpenAI**, **Claude**, **OpenRouter**, **Ollama** ou qualquer endpoint local compatível com OpenAI. A GUI completa funciona mesmo sem configurar IA nenhuma — o assistente é acelerador, não dependência.

---

## Autenticação GitHub que simplifica a vida

Dois caminhos, lado a lado:

1. **OAuth Device Flow** — “Continuar com GitHub”, confirma o código em `github.com/login/device`, pronto.
2. **Personal Access Token** — para github.com ou Enterprise Server.

O token vale para a API **e** para o `git` CLI (clone/fetch/pull/push HTTPS). Sem configurar Credential Manager à parte para remotes GitHub. SSH continua usando a config do sistema, intacta.

Credenciais criptografadas via Credential Manager / Keychain / libsecret — nunca gravadas no repo. O token fica no processo main: a interface nunca o recebe, só pede as operações. Detalhes de escopos, isolamento e revogação em [GitWeb/README.md](GitWeb/README.md#autenticação-github).

> **Os binários das releases ainda não são assinados.** O Windows vai mostrar o aviso do SmartScreen e o macOS vai barrar pelo Gatekeeper na primeira execução. O auto-updater verifica o hash SHA-512 publicado junto da release, mas não há cadeia de assinatura de código — se isso é inaceitável para você, compile a partir do fonte.

---

## Stack

| Área | Tecnologia |
|---|---|
| Desktop | Electron |
| UI | React · TypeScript · Zustand · Tailwind · lucide-react |
| Build | electron-vite · electron-builder |
| Git | CLI do sistema (`child_process` no main) |
| GitHub | REST API + OAuth Device Flow / PAT |
| IA | OpenAI · Claude · OpenRouter · Ollama · local |
| Segurança | Electron `safeStorage` |

```text
GitWeb/src/
├─ main/       → git, credenciais, IPC, settings, device flow
├─ preload/    → bridge tipada para o renderer
├─ shared/     → tipos compartilhados e traduções (i18n/)
└─ renderer/   → views, stores, GitHub client, tools de IA
```

---

## Começar em 30 segundos

**Requisitos:** Node.js 20+ e Git no `PATH`.

```bash
cd GitWeb
npm install
npm run dev
```

### Empacotar

```bash
npm run build        # bundle em out/
npm run build:win    # Windows (.exe / NSIS)
npm run build:mac    # macOS (.dmg / .zip)
npm run build:linux  # Linux (.AppImage / .deb)
```

> No Windows, gerar o instalador NSIS localmente pede **Modo de Desenvolvedor** (links simbólicos). O app em `npm run dev` ou `dist/win-unpacked/` roda normalmente sem isso.

Documentação técnica mais profunda: [`GitWeb/README.md`](GitWeb/README.md).

---

## Em que acreditamos

1. **Você manda.** Toda ação da IA no Git passa por aprovação explícita.
2. **IA é opcional.** O cliente Git precisa ser excelente sozinho.
3. **Local-first.** Tokens e chaves ficam na sua máquina, no cofre do sistema.
4. **Git de verdade.** Usamos o Git instalado no sistema — o mesmo que você confia no terminal.

---

## Contribuir

Issues e Pull Requests são bem-vindos. Leia o [guia de contribuição](CONTRIBUTING.md) e o [Código de Conduta](CODE_OF_CONDUCT.md). Falhas de segurança seguem o [`SECURITY.md`](SECURITY.md).

---

## Licença

MIT — livre para usar, estudar, modificar e distribuir.

Feito por [CariSoftwareBR](https://github.com/CariSoftwareBR).

---

<p align="center">
  <strong>Abra o repo. Peça o próximo passo. Aprove. Empurre.</strong><br/>
  <em>Git, no ritmo da conversa — com você sempre no controle.</em>
</p>
