# Skill: archivo que no debía haberse commiteado

Úsala cuando un commit trajo un archivo que no debería estar en Git: push rechazado por archivo grande (GH001, "exceeds GitHub's file size limit of 100.00 MB", "Large files detected"), un backup/dump de base de datos, un binario generado, o un secreto (`.env`, clave, token). Resuélvelo tú mismo con las herramientas, hasta que el `push` pase.

**Un "Diagnóstico verificado por la app" en el prompt es un hecho.** No lo contradigas ni lo vuelvas a comprobar. Tu siguiente acción es la herramienta indicada en "Siguiente paso", adjunta en esta misma respuesta, sin preguntar en texto.

## 1. Encuentra el archivo
- `list_commits`, después `read_commit` en los commits por delante del remoto, para ver cuáles traen el archivo. El contexto del repositorio muestra cuántos commits están por delante (ahead).
- Un push rechazado no envió nada. Si el archivo solo está en commits por delante del remoto, no existe historial remoto que reescribir.
- El archivo ya no está en el disco → la única copia está en el commit. Avisa al usuario antes de deshacerlo.

## 2. Corrige — una herramienta por respuesta
1. `undo_last_commit` — una vez por commit, del más nuevo al más antiguo, hasta deshacer el commit más antiguo que trae el archivo. Los cambios vuelven al stage; no se pierde nada.
2. `ignore_files` con la ruta del archivo — lo saca del stage y lo añade a `.gitignore`. El archivo sigue en el disco.
3. `commit`.
4. `push`.

Antes de cada herramienta, di en una frase qué hace y adjunta la llamada en esa misma respuesta. La tarjeta de aprobación es la pregunta de sí/no.

## 3. Nunca
- Un commit nuevo que borra el archivo **no** lo resuelve: el push envía todos los commits, incluido el que añadió el archivo.
- Nada de Git LFS para un backup, dump o binario generado — solo si el usuario dice que el archivo tiene que quedarse en el repositorio.
- Nada de `filter-branch`, `filter-repo`, BFG, `reset --hard` ni force push, ni siquiera como paso manual.
- No inventes pantallas ni configuraciones de GitHub (no existe una configuración "eliminar archivo grande").

## 4. El archivo ya está en el remoto
`undo_last_commit` lo rechazará. No intentes limpiar el historial remoto.
- **Secreto:** di que debe tratarse como filtrado y revocarse/cambiarse donde se emitió. Después `ignore_files` + `commit` + `push` para dejar de versionarlo. Nunca repitas el valor.
- **Archivo grande que el remoto ya aceptó:** `ignore_files` + `commit` + `push`, para que salga de las próximas versiones. Explica que sigue en el historial antiguo y que sacarlo de ahí exige reescribir el historial, fuera de este chat.
