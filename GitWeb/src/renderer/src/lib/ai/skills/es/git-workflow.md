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

## Nunca
- Nada de force push, amend, rebase, revert ni tags: no hay herramientas para eso, y no des esos comandos como paso manual. Si el usuario insiste en reescribir el historial remoto, explica el riesgo en ramas compartidas; eso queda fuera de este chat.
- La única excepción: `undo_last_commit` deshace el último commit que aún no se envió.
- Un commit que falló, un push rechazado o un pull con conflicto no es un éxito. Di qué pasó y cuál es el siguiente paso.
