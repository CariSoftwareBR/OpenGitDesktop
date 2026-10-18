# OpenGitDesktop

[Português](README.md) · [English](README.en.md) · **Español**

### El cliente Git que trabaja contigo — no en tu lugar.

Imagina abrir el repositorio, mirar el diff, pedir *“crea una rama, haz el commit y abre el PR”*… y ver cada paso suceder **solo después de que tú lo apruebas**.

Eso es **GitWeb**: un cliente Git de verdad para Windows, macOS y Linux — con el flujo completo del día a día y un asistente de IA que ejecuta acciones reales en el repositorio, bajo tus órdenes.

Sin terminal obligatoria. Sin agentes sueltos en tu historial. Solo velocidad con control.

---

## La idea

Hay excelentes clientes Git. Hay excelentes agentes de IA. Casi ninguno une ambas cosas de la forma correcta.

| Solo GUI | Solo agente | **GitWeb** |
|---|---|---|
| Haces clic en todo | La IA lo hace sola | Conversas — y **apruebas** cada acción |
| Seguro, pero lento | Rápido, pero arriesgado | Rápido **y** seguro |

La diferencia no es “tener IA”. Es **tool-calling con aprobación humana obligatoria**: la IA propone rama, commit, push, stash, PR… y nada toca el repositorio hasta que dices que sí.

---

## Flujo completo — del clone al merge

### Repositorios
Abre, clona (por URL o directamente desde GitHub) o crea desde cero. Los recientes siempre a mano. Inicia sesión con **OAuth Device Flow** o **Personal Access Token** — funciona en github.com y GitHub Enterprise.

### Cambios
Stage, unstage y descarte por archivo. Diff nítido. Commit con un mensaje escrito por ti — o generado por la IA a partir de lo que realmente cambió.

### Historial y ramas
Navega el log, mira qué cambió cada commit, cambia de rama, crea nuevas, fusiona y resuelve conflictos sin salir de la app.

### Stash y sincronización
Guarda el trabajo en curso y recupéralo cuando lo necesites. Fetch, pull, push y publicar rama se adaptan al estado ahead/behind/upstream.

### Pull Requests
Lista, crea, revisa archivos y comentarios, fusiona, cierra o reabre — todo integrado con la cuenta de GitHub autenticada.

### Chat de IA
Panel lateral o flotante. Habla en lenguaje natural. La IA lee el estado del repo y propone herramientas reales — cada una con vista previa y aprobación antes de ejecutarse.

### Tu idioma
La interfaz, los mensajes de error y las respuestas de la IA siguen el idioma del sistema — **Português (Brasil)**, **English** o **Español** — y puedes cambiarlo cuando quieras en Configuración.

---

## El asistente, de cerca

No es un chatbot decorativo. Es un operador supervisado de tu Git.

**Puede:**
- Crear, cambiar y fusionar ramas
- Generar el mensaje y hacer commit
- Push, pull y fetch
- Stash / stash pop
- Listar y crear pull requests
- Ayudar a revisar y fusionar PRs (con skills dedicadas)

**No puede:**
- Escribir en el repositorio sin tu aprobación
- Actuar en varios repos a la vez — opera solo en el que está abierto
- Guardar tus claves fuera de la máquina: API keys y tokens quedan en el almacén del SO (`safeStorage`)

Elige el proveedor: **OpenAI**, **Claude**, **OpenRouter**, **Ollama** o cualquier endpoint local compatible con OpenAI. La GUI completa funciona incluso sin configurar ninguna IA — el asistente es un acelerador, no una dependencia.

---

## Autenticación con GitHub que simplifica la vida

Dos caminos, lado a lado:

1. **OAuth Device Flow** — “Continuar con GitHub”, confirma el código en `github.com/login/device`, listo.
2. **Personal Access Token** — para github.com o Enterprise Server.

El token sirve para la API **y** para el `git` CLI (clone/fetch/pull/push por HTTPS). Sin configurar el Credential Manager aparte para remotes de GitHub. SSH sigue usando la configuración del sistema, intacta.

Credenciales cifradas vía Credential Manager / Keychain / libsecret — nunca grabadas en el repo. El token queda en el proceso main: la interfaz nunca lo recibe, solo pide las operaciones. Detalles de scopes, aislamiento y revocación en [GitWeb/README.es.md](GitWeb/README.es.md#autenticación-con-github).

> **Los binarios de las releases aún no están firmados.** Windows mostrará el aviso de SmartScreen y macOS lo bloqueará con Gatekeeper en la primera ejecución. El auto-updater verifica el hash SHA-512 publicado junto con la release, pero no hay cadena de firma de código — si eso es inaceptable para ti, compila desde el código fuente.

---

## Stack

| Área | Tecnología |
|---|---|
| Escritorio | Electron |
| UI | React · TypeScript · Zustand · Tailwind · lucide-react |
| Build | electron-vite · electron-builder |
| Git | CLI del sistema (`child_process` en main) |
| GitHub | REST API + OAuth Device Flow / PAT |
| IA | OpenAI · Claude · OpenRouter · Ollama · local |
| Seguridad | Electron `safeStorage` |

```text
GitWeb/src/
├─ main/       → git, credenciales, IPC, settings, device flow
├─ preload/    → puente tipado para el renderer
├─ shared/     → tipos compartidos y traducciones (i18n/)
└─ renderer/   → vistas, stores, cliente de GitHub, tools de IA
```

---

## Empieza en 30 segundos

**Requisitos:** Node.js 20+ y Git en el `PATH`.

```bash
cd GitWeb
npm install
npm run dev
```

### Empaquetar

```bash
npm run build        # bundle en out/
npm run build:win    # Windows (.exe / NSIS)
npm run build:mac    # macOS (.dmg / .zip)
npm run build:linux  # Linux (.AppImage / .deb)
```

> En Windows, generar el instalador NSIS localmente requiere el **Modo de desarrollador** (enlaces simbólicos). La app con `npm run dev` o en `dist/win-unpacked/` funciona normalmente sin eso.

Documentación técnica más detallada: [`GitWeb/README.es.md`](GitWeb/README.es.md).

---

## En qué creemos

1. **Tú mandas.** Toda acción de la IA en Git pasa por una aprobación explícita.
2. **La IA es opcional.** El cliente Git tiene que ser excelente por sí solo.
3. **Local-first.** Tokens y claves quedan en tu máquina, en el almacén del sistema.
4. **Git de verdad.** Usamos el Git instalado en el sistema — el mismo en el que confías en la terminal.

---

## Contribuir

Issues y Pull Requests son bienvenidos. Lee la [guía de contribución](CONTRIBUTING.md) (en portugués) y el [Código de Conducta](CODE_OF_CONDUCT.md). Las fallas de seguridad siguen el [`SECURITY.md`](SECURITY.md).

---

## Licencia

MIT — libre para usar, estudiar, modificar y distribuir.

Hecho por [CariSoftwareBR](https://github.com/CariSoftwareBR).

---

<p align="center">
  <strong>Abre el repo. Pide el siguiente paso. Aprueba. Empuja.</strong><br/>
  <em>Git, al ritmo de la conversación — contigo siempre al mando.</em>
</p>
