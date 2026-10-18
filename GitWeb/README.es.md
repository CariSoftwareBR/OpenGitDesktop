# OpenGitDesktop

[Português](README.md) · [English](README.en.md) · **Español**

Cliente Git multiplataforma (Windows, macOS, Linux), inspirado en GitDesktop — la versión WinUI 3 (solo Windows) de este mismo proyecto. Esta es una app nueva e independiente; GitDesktop se sigue manteniendo en paralelo, fuera de este repositorio.

## Stack

| Área | Tecnología |
|---|---|
| Shell de escritorio | Electron |
| UI | React + TypeScript + Zustand |
| Iconos | lucide-react |
| Build/dev | electron-vite (Vite) |
| Empaquetado | electron-builder |
| Git | Git CLI (vía `child_process.spawn` en el proceso principal) |
| GitHub | REST API (en el proceso principal) + OAuth Device Flow o PAT, ambos usados también para autenticar el `git` CLI |
| IA | OpenAI, Claude, OpenRouter, Ollama o un endpoint local compatible con OpenAI |
| Credenciales | `safeStorage` de Electron (Credential Manager / Keychain / libsecret) |

## Requisitos

- Node.js 20+
- Git instalado y disponible en el `PATH`

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build        # genera el bundle (out/)
npm run build:win    # empaqueta para Windows (.exe vía NSIS)
npm run build:mac    # empaqueta para macOS (.dmg/.zip)
npm run build:linux  # empaqueta para Linux (.AppImage/.deb)
```

El empaquetado multiplataforma real corre en CI (`.github/workflows/gitweb-build.yml`, matriz Windows/macOS/Linux). En local, generar el instalador `.exe` (NSIS) en Windows requiere el Modo de desarrollador habilitado (Configuración → Sistema → Para desarrolladores) — sin él, la herramienta de empaquetado no puede crear los enlaces simbólicos que usa internamente. La app funciona normalmente aun sin eso (`npm run dev` o el `.exe` generado en `dist/win-unpacked/`).

## Release

**Automático:** cada push a `main`/`master` que cambia `GitWeb/` genera una release **patch** (ej.: 0.1.0 → 0.1.1), sube la tag y publica los instaladores (Windows/macOS/Linux) en la GitHub Release. El workflow es `.github/workflows/gitweb-auto-release.yml`.

**Manual** (minor/major, o forzar un patch en local):

```bash
npm run release:minor   # o :major / :patch
```

Esto incrementa la versión, hace push de la tag y el workflow `.github/workflows/gitweb-release.yml` publica la Release.

## Estructura

```text
src/
├─ main/          # proceso principal (Node) — git, credenciales, diálogos, IPC, settings
├─ preload/       # contextBridge — API tipada expuesta al renderer
├─ shared/        # tipos compartidos entre main/preload/renderer
│  └─ i18n/       # idiomas y diccionarios de traducción (pt-BR, en, es)
└─ renderer/
   └─ src/
      ├─ views/       # Initial, Changes, History, Stashes, PullRequests, AiChat
      ├─ components/  # TopBar, DiffViewer, ConflictResolver
      ├─ store/       # estado global (zustand): repo, pull requests, IA
      └─ lib/         # github.ts (REST), ai/ (providers, tools, commit message, skills/)
```

## Funcionalidades

- Abrir, clonar (URL o inicio de sesión en GitHub vía OAuth Device Flow/PAT con listado de repositorios) y crear repositorios; lista de recientes.
- Cambios: stage/unstage/descarte por archivo, diff, commit, generación de la descripción del commit por IA.
- Historial: log de commits, archivos modificados, diff por commit.
- Ramas: cambiar, crear, fusionar (con un editor básico de resolución de conflictos cuando hace falta).
- Stash: crear, aplicar, pop, descartar — conectado a la navegación principal.
- Sincronización: fetch/pull/push/publicar rama que se adapta al estado ahead/behind/upstream.
- Pull Requests: inicio de sesión con OAuth Device Flow (GitHub.com) o PAT (GitHub.com o Enterprise), listar, crear, ver archivos/comentarios, fusionar, cerrar/reabrir.
- Chat de IA con herramientas (crear/cambiar/fusionar rama, commit, push/pull/fetch, stash, listar/crear PR) con aprobación humana antes de cada acción.
- Interfaz, mensajes del proceso principal y respuestas de la IA en portugués (Brasil), inglés o español — sigue el idioma del sistema por defecto y se puede cambiar al instante en Configuración.
- Temas claro/oscuro automáticos (según la preferencia del sistema) y soporte de alto contraste (Windows High Contrast Mode / `prefers-contrast`).

## Autenticación con GitHub

OpenGitDesktop ofrece dos métodos de inicio de sesión con GitHub, lado a lado — ninguno sustituye al otro:

- **OAuth Device Flow** (por defecto, solo `github.com`): haces clic en "Continuar con GitHub", confirmas un código de un solo uso en `github.com/login/device` y la app recibe el token. Requiere un OAuth App registrado con Device Flow habilitado, cuyo `client_id` está en `GitWeb/src/main/githubDeviceFlow.ts` (o en la variable de entorno `GITWEB_GITHUB_OAUTH_CLIENT_ID`, para quien compile desde el código fuente y quiera usar su propio OAuth App).
- **Personal Access Token**: obligatorio para GitHub Enterprise Server (Device Flow exigiría un OAuth App propio por instancia), disponible también en `github.com`.

El token resultante — de cualquiera de los dos métodos — se guarda cifrado vía `safeStorage` (`GitWeb/src/main/credentials.ts`) y se usa tanto para las llamadas REST de la API como para autenticar las operaciones del `git` CLI (clone/fetch/pull/push) sobre HTTPS, mediante un `http.extraHeader` aplicado solo por invocación (nunca grabado en `.git/config`). Eso elimina la necesidad de configurar aparte el Git Credential Manager para repositorios de GitHub. Los remotes SSH siguen usando la configuración SSH del sistema, sin cambios.

### Scopes solicitados

Device Flow pide `repo` y `workflow`. `repo` da lectura y escritura en todos los repositorios públicos y privados a los que llega la cuenta — es el scope más pequeño que GitHub ofrece para un cliente Git de uso general, ya que los OAuth Apps no tienen granularidad por repositorio. GitHub exige `workflow` para enviar commits que modifiquen archivos en `.github/workflows/`; sin él, el `git push` se rechaza en esos casos. La pantalla de inicio de sesión muestra los dos scopes antes de que autorices.

### Cómo se aísla el token

El token **nunca** llega al proceso de renderizado. Todas las llamadas a la API de GitHub corren en el proceso main (`GitWeb/src/main/githubApi.ts`), que resuelve el token del almacén en cada llamada; el renderer solo envía `host`/`owner`/`repo` por IPC y recibe objetos ya mapeados. El `Content-Security-Policy` del renderer usa `connect-src 'self'`, así que ni siquiera hay adónde filtrarlo. El almacén expuesto al renderer (`window.api.secrets`) solo acepta claves con el prefijo `GitWeb/AI/` — las claves de los proveedores de IA —, y cada handler IPC valida el origen del frame que lo llamó.

### Nunca escribas un código de device flow que no generaste tú

El `client_id` es público por naturaleza en Device Flow — cualquiera puede iniciar un inicio de sesión con el mismo
`client_id` (GitHub CLI tiene exactamente la misma característica). El ataque que esto permite es el *device code
phishing*: alguien inicia el flujo, te manda el código de ocho caracteres y te pide que lo confirmes en
`github.com/login/device`. La pantalla de GitHub mostrará "OpenGitDesktop" normalmente, pero quien recibe el token es el
atacante. Un cliente público no tiene cómo impedirlo. La regla es simple: **solo escribe un código que el propio
OpenGitDesktop acabe de mostrar en tu pantalla.**

### Cerrar sesión no revoca la autorización

Cerrar sesión borra el token de esta máquina, pero la autorización del OAuth App sigue activa en tu cuenta. Revocarla desde la app exigiría un *client secret*, que un cliente público de Device Flow no puede guardar. Por eso, después de cerrar sesión la app muestra el enlace a `github.com/settings/connections/applications/<client_id>`, donde revocas el acceso de verdad.

## Diferencias conocidas respecto a GitDesktop (WinUI)

- El chat de IA opera en el repositorio actual; no hay un modo "global" que abarque varios repositorios.
- El tool-calling nativo se trata de forma unificada (schema compatible con OpenAI para OpenAI/OpenRouter/Ollama/local + Anthropic Messages API para Claude), sin el fallback textual adicional que la app WinUI usa para los providers que rechazan `tools`.

## Estado

Todas las fases planificadas (bootstrap, pantallas principales, stash/conflictos, GitHub+PRs, IA, pulido/empaquetado, CI) están implementadas y pasan `npm run typecheck` + `npm run build`. Probado manualmente con un repositorio real.
