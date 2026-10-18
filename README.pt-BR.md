<div align="center">

<img src="docs/readme/hero-pt-BR.svg" alt="OpenGitDesktop — o cliente Git que trabalha com você, não no seu lugar" width="100%">

<br>
<br>

[English](README.md) · **Português** · [Español](README.es.md)

<br>

[![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/CariSoftwareBR/OpenGitDesktop/releases)
[![macOS](https://img.shields.io/badge/macOS-compilar%20do%20c%C3%B3digo-000000?style=for-the-badge&logo=apple&logoColor=white)](GitWeb/README.md)
[![Linux](https://img.shields.io/badge/Linux-AppImage%20%7C%20deb-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/CariSoftwareBR/OpenGitDesktop/releases)
<br>
[![Releases](https://img.shields.io/badge/download-releases-479ffa?style=flat-square&logo=github)](https://github.com/CariSoftwareBR/OpenGitDesktop/releases)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-4ebe96?style=flat-square)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)](GitWeb/README.md)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](GitWeb/README.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](GitWeb/README.md)

</div>

<br>

<h2 align="center">🚀 Instale com uma frase</h2>

<p align="center">Cole isto no Claude Code, Codex, Cursor ou qualquer agente de IA. Ele baixa a release certa para o seu sistema e instala.</p>

<img src="docs/readme/install-pt-BR.svg" alt="Seu agente de IA instala o OpenGitDesktop: Git pronto, release baixada, instalado, app aberto" width="100%">

**Peça ao seu agente:**

```text
Instale este app: https://github.com/CariSoftwareBR/OpenGitDesktop
```

<p align="center"><sub>Prefere fazer à mão? O <a href="INSTALL.md"><b>INSTALL.md</b></a> tem cada passo para Windows, Linux e macOS.</sub></p>

> **Agentes de IA:** instalem a release pronta seguindo o [INSTALL.md](INSTALL.md#install) exatamente, sem fazer perguntas ao usuário. Não clonem nem compilem o código-fonte.

<br>

<h2 align="center">🎬 Veja funcionando</h2>

<p align="center">Peça em linguagem natural. O assistente propõe uma ação Git real. <b>Nada acontece até você clicar em Aprovar.</b></p>

<p align="center">
<img src="docs/readme/demo-pt-BR.gif" alt="Pedindo ao assistente para criar uma branch, aprovando a ação e navegando no histórico e nos pull requests" width="100%">
</p>

<br>

<h2 align="center">🧭 Como funciona</h2>

<img src="docs/readme/flow-pt-BR.svg" alt="1. Peça em linguagem natural · 2. A IA propõe ações Git reais · 3. Você aprova com prévia completa · 4. O Git executa na sua máquina" width="100%">

Existem ótimos clientes Git. Existem ótimos agentes de IA. Quase nenhum junta os dois do jeito certo.

| | Só GUI | Só agente | **OpenGitDesktop** |
|---|:---:|:---:|:---:|
| **Quem age** | Você clica em tudo | A IA faz sozinha | Você conversa — e **aprova** cada ação |
| **Velocidade** | 🐢 Lento | ⚡ Rápido | ⚡ Rápido |
| **Segurança** | ✅ Seguro | ⚠️ Arriscado | ✅ Seguro |

A diferença não é “ter IA”. É **tool-calling com aprovação humana obrigatória**: a IA propõe branch, commit, push, stash, PR… e nada toca no repositório até você dizer sim.

<br>

<h2 align="center">💙 Por que você vai gostar</h2>

<table>
<tr>
<td width="33%" valign="top">

### 🛡️ Você no comando
Toda ação da IA mostra uma prévia e espera o **Aprovar**. Nada de agente solto no seu histórico.

</td>
<td width="33%" valign="top">

### 🔁 O fluxo completo
Clone, stage por hunk, commit, branch, merge, conflitos, stash, push — do clone ao merge.

</td>
<td width="33%" valign="top">

### 🐙 Pull Requests integrados
Liste, crie, revise arquivos e comentários, aprove, faça merge, feche ou reabra — ao lado do código.

</td>
</tr>
<tr>
<td valign="top">

### ✍️ IA que ajuda, não sequestra
Mensagem de commit a partir do que mudou, “Explicar diff”, rascunho e revisão de PR — tudo opcional.

</td>
<td valign="top">

### 🔐 Local-first
Tokens e chaves de API ficam no cofre do sistema (`safeStorage`). A interface nem vê o seu token do GitHub.

</td>
<td valign="top">

### 🌍 Fala a sua língua
Português (Brasil), English e Español — interface, erros e respostas da IA. Temas escuro, claro e alto contraste.

</td>
</tr>
</table>

<br>

<h2 align="center">🖼️ Faça o tour</h2>

<table>
<tr>
<td width="50%" valign="top">
<img src="docs/readme/screenshots/pt-BR/changes.png" alt="Tela de Alterações com arquivos em stage e um diff">
<p align="center"><b>Alterações</b><br><sub>Stage por arquivo ou por hunk, diff nítido, mensagem de commit pela IA.</sub></p>
</td>
<td width="50%" valign="top">
<img src="docs/readme/screenshots/pt-BR/ai-approval.png" alt="O assistente de IA propondo uma branch e aguardando aprovação">
<p align="center"><b>Assistente supervisionado</b><br><sub>Cada ação proposta mostra exatamente o que vai rodar. Aprove ou cancele.</sub></p>
</td>
</tr>
<tr>
<td valign="top">
<img src="docs/readme/screenshots/pt-BR/history.png" alt="Tela de Histórico com lista de commits e diff">
<p align="center"><b>Histórico</b><br><sub>Busque no log, inspecione qualquer commit, crie branch a partir dele ou reverta.</sub></p>
</td>
<td valign="top">
<img src="docs/readme/screenshots/pt-BR/pull-requests.png" alt="Pull request com descrição, arquivos e comentários">
<p align="center"><b>Pull Requests</b><br><sub>Revise arquivos, comente, aprove e faça merge sem sair do app.</sub></p>
</td>
</tr>
<tr>
<td valign="top">
<img src="docs/readme/screenshots/pt-BR/stash.png" alt="Tela de Stash com trabalho guardado">
<p align="center"><b>Stash</b><br><sub>Guarde o trabalho em andamento, veja a prévia e traga de volta com detecção de conflito.</sub></p>
</td>
<td valign="top">
<img src="docs/readme/screenshots/pt-BR/changes-light.png" alt="Tela de Alterações no tema claro">
<p align="center"><b>Tema claro</b><br><sub>Segue o sistema — ou escolha escuro, claro ou alto contraste nas Configurações.</sub></p>
</td>
</tr>
</table>

<br>

<h2 align="center">🤖 O assistente, de perto</h2>

<p align="center">Não é um chatbot decorativo. É um operador supervisionado do seu Git.</p>

<table>
<tr>
<td width="50%" valign="top">

#### ✅ Pode
- Criar, trocar e mesclar branches
- Gerar a mensagem e fazer commit
- Push, pull e fetch
- Stash / stash pop
- Listar e criar pull requests
- Ajudar a revisar e mesclar PRs (skills dedicadas)
- Explicar um diff, um commit ou um erro

</td>
<td width="50%" valign="top">

#### 🚫 Não pode
- Escrever no repositório sem a sua aprovação
- Agir em vários repos ao mesmo tempo — só no que está aberto
- Enviar suas chaves para fora: API keys e tokens ficam no cofre do sistema
- Virar dependência — a GUI completa funciona sem nenhuma IA configurada

</td>
</tr>
</table>

<img src="docs/readme/providers-pt-BR.svg" alt="Funciona com OpenAI, Claude, OpenRouter, Ollama ou qualquer endpoint compatível com OpenAI" width="100%">

<br>

<h2 align="center">🔐 Login no GitHub que simplesmente funciona</h2>

| | |
|---|---|
| **OAuth Device Flow** | Clique em “Continuar com GitHub”, confirme o código em `github.com/login/device` — pronto. |
| **Personal Access Token** | Para github.com ou GitHub Enterprise Server. |

O token serve para a API **e** para o `git` CLI (clone/fetch/pull/push por HTTPS) — sem configurar o Credential Manager à parte para remotes do GitHub. SSH continua usando a configuração do sistema, intacta.

Credenciais criptografadas via Credential Manager / Keychain / libsecret, nunca gravadas no repo. O token fica no processo main: a interface nunca o recebe, só pede as operações. Escopos, isolamento e revogação em [GitWeb/README.md](GitWeb/README.md#autenticação-github).

<br>

<h2 align="center">🚀 Comece agora</h2>

**Baixe** o instalador em [**Releases**](https://github.com/CariSoftwareBR/OpenGitDesktop/releases) — `.exe` para Windows, `.AppImage` / `.deb` para Linux. O app se atualiza sozinho. No **macOS**, por enquanto, compile a partir do código (`npm run build:mac`). Passo a passo para cada sistema: [**INSTALL.md**](INSTALL.md).

> [!WARNING]
> **Os binários das releases ainda não são assinados.** O Windows mostra o aviso do SmartScreen na primeira execução. O auto-updater confere o hash SHA-512 publicado em cada release, mas não há cadeia de assinatura de código — se isso for inaceitável para você, compile a partir do código-fonte.

**Ou compile a partir do código** — você precisa de Node.js 20+ e Git no `PATH`:

```bash
git clone https://github.com/CariSoftwareBR/OpenGitDesktop.git
cd OpenGitDesktop/GitWeb
npm install
npm run dev
```

<details>
<summary><b>📦 Gerar instaladores</b></summary>
<br>

```bash
npm run build        # bundle em out/
npm run build:win    # Windows (.exe / NSIS)
npm run build:mac    # macOS (.dmg / .zip)
npm run build:linux  # Linux (.AppImage / .deb)
```

No Windows, gerar o instalador NSIS localmente exige o **Modo de Desenvolvedor** (links simbólicos). O app em `npm run dev` ou em `dist/win-unpacked/` roda normalmente sem isso.

</details>

<br>

<h2 align="center">🧱 Por dentro</h2>

<details>
<summary><b>Stack e estrutura do projeto</b></summary>
<br>

| Área | Tecnologia |
|---|---|
| Desktop | Electron |
| UI | React · TypeScript · Zustand · Tailwind · lucide-react |
| Build | electron-vite · electron-builder |
| Git | Git CLI do sistema (`child_process` no main) |
| GitHub | REST API + OAuth Device Flow / PAT |
| IA | OpenAI · Claude · OpenRouter · Ollama · local |
| Segurança | `safeStorage` do Electron |

```text
GitWeb/src/
├─ main/       → git, credenciais, IPC, settings, device flow
├─ preload/    → ponte tipada para o renderer
├─ shared/     → tipos compartilhados e traduções (i18n/)
└─ renderer/   → telas, stores, cliente GitHub, tools de IA
```

Documentação técnica mais profunda: [`GitWeb/README.md`](GitWeb/README.md).

</details>

<br>

<h2 align="center">❓ Perguntas</h2>

<details>
<summary><b>Preciso de um provedor de IA para usar?</b></summary>
<br>
Não. O cliente Git é completo sozinho. O assistente é um acelerador que você pode ligar depois nas Configurações.
</details>

<details>
<summary><b>A IA pode alterar meu repositório sozinha?</b></summary>
<br>
Não. Toda ação que escreve — branch, commit, push, stash, merge, PR — aparece como um card com prévia e espera você clicar em <b>Aprovar</b>.
</details>

<details>
<summary><b>Onde ficam meus tokens e chaves de API?</b></summary>
<br>
No cofre do sistema operacional (Credential Manager, Keychain ou libsecret), via <code>safeStorage</code> do Electron. Nunca no repositório, nunca em texto puro.
</details>

<details>
<summary><b>Dá para usar a IA totalmente offline?</b></summary>
<br>
Sim — aponte para o <b>Ollama</b> ou qualquer endpoint local compatível com OpenAI e nada sai da sua máquina.
</details>

<details>
<summary><b>Qual Git ele usa?</b></summary>
<br>
O instalado no seu sistema — o mesmo Git em que você confia no terminal, com sua configuração, hooks e chaves SSH.
</details>

<br>

<h2 align="center">🧭 No que acreditamos</h2>

<table>
<tr>
<td align="center" width="25%"><h3>🎛️</h3><b>Você no comando</b><br><sub>Toda ação da IA no Git passa por aprovação explícita.</sub></td>
<td align="center" width="25%"><h3>🧩</h3><b>IA é opcional</b><br><sub>O cliente Git precisa ser excelente sozinho.</sub></td>
<td align="center" width="25%"><h3>🏠</h3><b>Local-first</b><br><sub>Tokens e chaves ficam na sua máquina, no cofre do sistema.</sub></td>
<td align="center" width="25%"><h3>🌳</h3><b>Git de verdade</b><br><sub>O Git instalado no seu sistema, não uma reimplementação.</sub></td>
</tr>
</table>

<br>

<div align="center">

### 🤝 Contribuindo

Issues e Pull Requests são bem-vindos. Leia o [guia de contribuição](CONTRIBUTING.md) e o [Código de Conduta](CODE_OF_CONDUCT.md).<br>
Problemas de segurança seguem o [`SECURITY.md`](SECURITY.md).

<br>

**Abra o repo. Peça o próximo passo. Aprove. Push.**<br>
<sub>Git no ritmo de uma conversa — com você sempre no controle.</sub>

<br>
<br>

<sub>[MIT](LICENSE) · Feito por [CariSoftwareBR](https://github.com/CariSoftwareBR)</sub>

</div>
