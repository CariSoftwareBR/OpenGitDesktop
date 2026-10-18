<div align="center">

<img src="docs/readme/hero-es.svg" alt="OpenGitDesktop — el cliente Git que trabaja contigo, no en tu lugar" width="100%">

<br>
<br>

[English](README.md) · [Português](README.pt-BR.md) · **Español**

<br>

[![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/CariSoftwareBR/OpenGitDesktop/releases)
[![macOS](https://img.shields.io/badge/macOS-compilar%20desde%20el%20c%C3%B3digo-000000?style=for-the-badge&logo=apple&logoColor=white)](GitWeb/README.es.md)
[![Linux](https://img.shields.io/badge/Linux-AppImage%20%7C%20deb-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/CariSoftwareBR/OpenGitDesktop/releases)
<br>
[![Releases](https://img.shields.io/badge/descargar-releases-479ffa?style=flat-square&logo=github)](https://github.com/CariSoftwareBR/OpenGitDesktop/releases)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-4ebe96?style=flat-square)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)](GitWeb/README.es.md)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](GitWeb/README.es.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](GitWeb/README.es.md)

</div>

<br>

<h2 align="center">🚀 Instálalo con una frase</h2>

<p align="center">Pega esto en Claude Code, Codex, Cursor o cualquier agente de IA. Descarga la release correcta para tu sistema y la instala.</p>

<img src="docs/readme/install-es.svg" alt="Tu agente de IA instala OpenGitDesktop: Git listo, release descargada, instalado, app abierta" width="100%">

**Pídele a tu agente:**

```text
Instala esta app: https://github.com/CariSoftwareBR/OpenGitDesktop
```

<p align="center"><sub>¿Prefieres hacerlo a mano? <a href="INSTALL.md"><b>INSTALL.md</b></a> tiene cada paso para Windows, Linux y macOS.</sub></p>

> **Agentes de IA:** instalen la release lista siguiendo [INSTALL.md](INSTALL.md#install) exactamente, sin hacer preguntas al usuario. No clonen ni compilen el código fuente.

<br>

<h2 align="center">🎬 Míralo en acción</h2>

<p align="center">Pide en lenguaje natural. El asistente propone una acción Git real. <b>Nada sucede hasta que haces clic en Aprobar.</b></p>

<p align="center">
<img src="docs/readme/demo-es.gif" alt="Pidiendo al asistente que cree una rama, aprobando la acción y navegando por el historial y los pull requests" width="100%">
</p>

<br>

<h2 align="center">🧭 Cómo funciona</h2>

<img src="docs/readme/flow-es.svg" alt="1. Pide en lenguaje natural · 2. La IA propone acciones Git reales · 3. Tú apruebas con vista previa · 4. Git ejecuta en tu máquina" width="100%">

Hay excelentes clientes Git. Hay excelentes agentes de IA. Casi ninguno une ambas cosas de la forma correcta.

| | Solo GUI | Solo agente | **OpenGitDesktop** |
|---|:---:|:---:|:---:|
| **Quién actúa** | Haces clic en todo | La IA lo hace sola | Conversas — y **apruebas** cada acción |
| **Velocidad** | 🐢 Lento | ⚡ Rápido | ⚡ Rápido |
| **Seguridad** | ✅ Seguro | ⚠️ Arriesgado | ✅ Seguro |

La diferencia no es “tener IA”. Es **tool-calling con aprobación humana obligatoria**: la IA propone rama, commit, push, stash, PR… y nada toca el repositorio hasta que dices que sí.

<br>

<h2 align="center">💙 Por qué te va a gustar</h2>

<table>
<tr>
<td width="33%" valign="top">

### 🛡️ Tú mandas
Cada acción de la IA muestra una vista previa y espera el **Aprobar**. Sin agentes sueltos en tu historial.

</td>
<td width="33%" valign="top">

### 🔁 El flujo completo
Clone, stage por hunk, commit, ramas, merge, conflictos, stash, push — del clone al merge.

</td>
<td width="33%" valign="top">

### 🐙 Pull Requests integrados
Lista, crea, revisa archivos y comentarios, aprueba, fusiona, cierra o reabre — junto a tu código.

</td>
</tr>
<tr>
<td valign="top">

### ✍️ IA que ayuda, no secuestra
Mensaje de commit a partir de lo que cambió, “Explicar diff”, borradores y revisiones de PR — todo opcional.

</td>
<td valign="top">

### 🔐 Local-first
Tokens y API keys viven en el almacén del sistema (`safeStorage`). La interfaz ni siquiera ve tu token de GitHub.

</td>
<td valign="top">

### 🌍 Habla tu idioma
Español, English y Português (Brasil) — interfaz, errores y respuestas de la IA. Temas oscuro, claro y alto contraste.

</td>
</tr>
</table>

<br>

<h2 align="center">🖼️ Haz el recorrido</h2>

<table>
<tr>
<td width="50%" valign="top">
<img src="docs/readme/screenshots/es/changes.png" alt="Vista de Cambios con archivos en stage y un diff">
<p align="center"><b>Cambios</b><br><sub>Stage por archivo o por hunk, diff nítido, mensajes de commit escritos por la IA.</sub></p>
</td>
<td width="50%" valign="top">
<img src="docs/readme/screenshots/es/ai-approval.png" alt="El asistente de IA proponiendo una rama y esperando aprobación">
<p align="center"><b>Asistente supervisado</b><br><sub>Cada acción propuesta muestra exactamente lo que se ejecutará. Aprueba o cancela.</sub></p>
</td>
</tr>
<tr>
<td valign="top">
<img src="docs/readme/screenshots/es/history.png" alt="Vista de Historial con lista de commits y diff">
<p align="center"><b>Historial</b><br><sub>Busca en el log, inspecciona cualquier commit, crea una rama desde él o reviértelo.</sub></p>
</td>
<td valign="top">
<img src="docs/readme/screenshots/es/pull-requests.png" alt="Pull request con descripción, archivos y comentarios">
<p align="center"><b>Pull Requests</b><br><sub>Revisa archivos, comenta, aprueba y fusiona sin salir de la app.</sub></p>
</td>
</tr>
<tr>
<td valign="top">
<img src="docs/readme/screenshots/es/stash.png" alt="Vista de Stash con trabajo guardado">
<p align="center"><b>Stash</b><br><sub>Guarda el trabajo en curso, revísalo y recupéralo con detección de conflictos.</sub></p>
</td>
<td valign="top">
<img src="docs/readme/screenshots/es/changes-light.png" alt="Vista de Cambios en el tema claro">
<p align="center"><b>Tema claro</b><br><sub>Sigue al sistema — o elige oscuro, claro o alto contraste en Configuración.</sub></p>
</td>
</tr>
</table>

<br>

<h2 align="center">🤖 El asistente, de cerca</h2>

<p align="center">No es un chatbot decorativo. Es un operador supervisado de tu Git.</p>

<table>
<tr>
<td width="50%" valign="top">

#### ✅ Puede
- Crear, cambiar y fusionar ramas
- Generar el mensaje y hacer commit
- Push, pull y fetch
- Stash / stash pop
- Listar y crear pull requests
- Ayudar a revisar y fusionar PRs (skills dedicadas)
- Explicar un diff, un commit o un error

</td>
<td width="50%" valign="top">

#### 🚫 No puede
- Escribir en el repositorio sin tu aprobación
- Actuar en varios repos a la vez — solo en el que está abierto
- Enviar tus claves fuera: API keys y tokens quedan en el almacén del sistema
- Volverse una dependencia — la GUI completa funciona sin IA configurada

</td>
</tr>
</table>

<img src="docs/readme/providers-es.svg" alt="Funciona con OpenAI, Claude, OpenRouter, Ollama o cualquier endpoint compatible con OpenAI" width="100%">

<br>

<h2 align="center">🔐 Inicio de sesión en GitHub que simplemente funciona</h2>

| | |
|---|---|
| **OAuth Device Flow** | Haz clic en “Continuar con GitHub”, confirma el código en `github.com/login/device` — listo. |
| **Personal Access Token** | Para github.com o GitHub Enterprise Server. |

El token sirve para la API **y** para el `git` CLI (clone/fetch/pull/push por HTTPS) — sin configurar el Credential Manager aparte para remotes de GitHub. SSH sigue usando la configuración del sistema, intacta.

Credenciales cifradas vía Credential Manager / Keychain / libsecret, nunca grabadas en el repo. El token queda en el proceso main: la interfaz nunca lo recibe, solo pide las operaciones. Scopes, aislamiento y revocación en [GitWeb/README.es.md](GitWeb/README.es.md#autenticación-con-github).

<br>

<h2 align="center">🚀 Empieza ahora</h2>

**Descarga** el instalador desde [**Releases**](https://github.com/CariSoftwareBR/OpenGitDesktop/releases) — `.exe` para Windows, `.AppImage` / `.deb` para Linux. La app se actualiza sola. En **macOS**, por ahora, compila desde el código (`npm run build:mac`). Paso a paso para cada sistema: [**INSTALL.md**](INSTALL.md).

> [!WARNING]
> **Los binarios de las releases aún no están firmados.** Windows mostrará el aviso de SmartScreen en la primera ejecución. El auto-updater verifica el hash SHA-512 publicado con cada release, pero no hay cadena de firma de código — si eso es inaceptable para ti, compila desde el código fuente.

**O compila desde el código** — necesitas Node.js 20+ y Git en el `PATH`:

```bash
git clone https://github.com/CariSoftwareBR/OpenGitDesktop.git
cd OpenGitDesktop/GitWeb
npm install
npm run dev
```

<details>
<summary><b>📦 Generar instaladores</b></summary>
<br>

```bash
npm run build        # bundle en out/
npm run build:win    # Windows (.exe / NSIS)
npm run build:mac    # macOS (.dmg / .zip)
npm run build:linux  # Linux (.AppImage / .deb)
```

En Windows, generar el instalador NSIS localmente requiere el **Modo de desarrollador** (enlaces simbólicos). La app con `npm run dev` o en `dist/win-unpacked/` funciona normalmente sin eso.

</details>

<br>

<h2 align="center">🧱 Por dentro</h2>

<details>
<summary><b>Stack y estructura del proyecto</b></summary>
<br>

| Área | Tecnología |
|---|---|
| Escritorio | Electron |
| UI | React · TypeScript · Zustand · Tailwind · lucide-react |
| Build | electron-vite · electron-builder |
| Git | Git CLI del sistema (`child_process` en main) |
| GitHub | REST API + OAuth Device Flow / PAT |
| IA | OpenAI · Claude · OpenRouter · Ollama · local |
| Seguridad | `safeStorage` de Electron |

```text
GitWeb/src/
├─ main/       → git, credenciales, IPC, settings, device flow
├─ preload/    → puente tipado para el renderer
├─ shared/     → tipos compartidos y traducciones (i18n/)
└─ renderer/   → vistas, stores, cliente de GitHub, tools de IA
```

Documentación técnica más detallada: [`GitWeb/README.es.md`](GitWeb/README.es.md).

</details>

<br>

<h2 align="center">❓ Preguntas</h2>

<details>
<summary><b>¿Necesito un proveedor de IA para usarlo?</b></summary>
<br>
No. El cliente Git es completo por sí solo. El asistente es un acelerador que puedes activar después en Configuración.
</details>

<details>
<summary><b>¿Puede la IA cambiar mi repositorio por su cuenta?</b></summary>
<br>
No. Toda acción que escribe — rama, commit, push, stash, merge, PR — aparece como una tarjeta con vista previa y espera a que hagas clic en <b>Aprobar</b>.
</details>

<details>
<summary><b>¿Dónde se guardan mis tokens y API keys?</b></summary>
<br>
En el almacén del sistema operativo (Credential Manager, Keychain o libsecret) mediante <code>safeStorage</code> de Electron. Nunca en el repositorio, nunca en texto plano.
</details>

<details>
<summary><b>¿Puedo usar la IA completamente offline?</b></summary>
<br>
Sí — apúntala a <b>Ollama</b> o a cualquier endpoint local compatible con OpenAI y nada sale de tu máquina.
</details>

<details>
<summary><b>¿Qué Git usa?</b></summary>
<br>
El instalado en tu sistema — el mismo Git en el que confías en la terminal, con tu configuración, hooks y claves SSH.
</details>

<br>

<h2 align="center">🧭 En qué creemos</h2>

<table>
<tr>
<td align="center" width="25%"><h3>🎛️</h3><b>Tú mandas</b><br><sub>Toda acción de la IA en Git pasa por una aprobación explícita.</sub></td>
<td align="center" width="25%"><h3>🧩</h3><b>La IA es opcional</b><br><sub>El cliente Git tiene que ser excelente por sí solo.</sub></td>
<td align="center" width="25%"><h3>🏠</h3><b>Local-first</b><br><sub>Tokens y claves se quedan en tu máquina, en el almacén del sistema.</sub></td>
<td align="center" width="25%"><h3>🌳</h3><b>Git de verdad</b><br><sub>El Git instalado en tu sistema, no una reimplementación.</sub></td>
</tr>
</table>

<br>

<div align="center">

### 🤝 Contribuir

Issues y Pull Requests son bienvenidos. Lee la [guía de contribución](CONTRIBUTING.md) (en portugués) y el [Código de Conducta](CODE_OF_CONDUCT.md).<br>
Los problemas de seguridad siguen [`SECURITY.md`](SECURITY.md).

<br>

**Abre el repo. Pide el siguiente paso. Aprueba. Push.**<br>
<sub>Git al ritmo de una conversación — contigo siempre al mando.</sub>

<br>
<br>

<sub>[MIT](LICENSE) · Hecho por [CariSoftwareBR](https://github.com/CariSoftwareBR)</sub>

</div>
