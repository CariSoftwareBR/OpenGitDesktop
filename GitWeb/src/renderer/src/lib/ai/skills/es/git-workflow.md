# Skill: Git del día a día (commit, push, pull, ramas, stash)

Úsala cuando el usuario pida commit, push, pull, crear o cambiar de rama, stash, o corregir su nombre/email de Git.

## Antes de actuar
- Lee primero el contexto del repositorio: rama, ahead/behind del upstream, líneas de estado.
- ¿Necesitas el diff? Llama a `read_changes`. Nunca describas cambios que no has visto.
- `read_changes` no muestra archivos nuevos (`??` en el estado). Ábrelos con `read_file` antes del commit — como máximo 5, y omite binarios y archivos muy grandes.

## Commit
- Llama a `commit`. Escribe el mensaje solo — no escribas uno.
- Nada en stage → `commit` añade todo al stage. Si los cambios mezclan trabajos sin relación, avisa y sugiere añadir al stage un grupo cada vez en la pestaña Cambios. Si no, haz el commit.
- El diff parece tener un secreto (`.env`, clave privada, token de API, contraseña) → no hagas el commit. Cita el archivo, nunca repitas el valor, y pregunta al usuario qué hacer.
- Archivos todavía en conflicto → primero `resolve_conflict` en cada archivo, después `commit`.
- "Author identity unknown" / "Please tell me who you are" → `get_git_identity`, después `set_git_identity`. Pregunta "¿local o global?" solo si el usuario no lo dijo.

## Rama principal
En `main`/`master`: avisa una vez y ofrece `create_branch`. Si el usuario quiere seguir en ella, continúa — no vuelvas a preguntar.

## Push
- Rama por detrás del upstream, o no estás seguro → `check_incoming_commits` antes.
- Hay commits nuevos en el remoto → `pull`, después `push`.
- Push rechazado (non-fast-forward) → `pull`, después `push` otra vez.

## Pull
- Cambios sin commit → ofrece `stash` (o `commit`) antes.
- El pull terminó en conflicto → `resolve_conflict` en cada archivo, después `commit`.

## Ramas
- Nombre = prefijo + palabras en minúsculas unidas por `-`. Prefijos: `feature/`, `fix/`, `refactor/`, `docs/`, `hotfix/` (p. ej., `feature/wizard-pr`).
- Cambios sin commit antes de `switch_branch` → ofrece `stash`; `stash_pop` los recupera después.

## Mostrar en vez de listar
- Preguntas sobre dónde está algo ("¿de dónde salió esta rama de main?", "¿este fix ya está en la release?") → encuentra el commit (`list_commits`/`read_commit`) y llama a `show_in_history`: el usuario lo ve resaltado en el grafo y tú recibes en qué ramas y tags ya está.
- "¿Por qué esta línea está así?" / "¿quién tocó este archivo?" → `explain_file_history` (con `line` cuando haya una línea).

## Tags y versiones
- Versión nueva → `create_tag` (queda local) y, solo si el usuario quiere publicarlo, `push_tag`. Nunca envíes todos los tags a la vez.
- Notas de versión / changelog → `prepare_release_notes` y escribe las notas en Markdown en la respuesta, con el formato que pide la herramienta.

## Reorganizar commits locales
- Combinar WIPs, reordenar, renombrar o descartar commits que todavía NO se enviaron → `reorganize_local_commits` con el plan completo (todos los commits locales, del más antiguo al más nuevo). El usuario aprueba viendo el antes y el después.
- Los commits ya enviados nunca entran: la herramienta los rechaza. No ofrezcas reescribir lo que ya está en el remoto.

## Nunca
- Nada de force push, amend, rebase de commits enviados ni revert desde el chat, y no des esos comandos como paso manual. Si el usuario insiste en reescribir el historial remoto, explica el riesgo en ramas compartidas; eso queda fuera de este chat.
- Excepciones seguras, solo para lo que aún no se envió: `undo_last_commit` (deshace el último commit) y `reorganize_local_commits`.
- Un commit que falló, un push rechazado o un pull con conflicto no es un éxito. Di qué pasó y cuál es el siguiente paso.
