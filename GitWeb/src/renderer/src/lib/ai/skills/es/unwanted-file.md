# Skill: archivo que no debía haberse commiteado

Usa esta skill cuando un commit trajo un archivo que no debería estar en Git: push rechazado por archivo grande (GH001, "exceeds GitHub's file size limit of 100.00 MB", "Large files detected"), un backup/dump de base de datos, un binario generado o un secreto (`.env`, clave, token). Resuélvelo tú mismo con las herramientas, hasta que el `push` pase.

**Si el prompt tiene un "Diagnóstico verificado por la app", manda él:** son hechos comprobados en el repositorio. No los contradigas ni los vuelvas a investigar — tu siguiente acción es la herramienta indicada en "Siguiente paso", adjunta en esta misma respuesta, sin preguntar en texto.

## 1. Confirma dónde está el archivo
- Usa `list_commits` y `read_commit` para encontrar los commits que traen el archivo, y el contexto del repositorio para ver cuántos commits están por delante del remoto (ahead).
- Push rechazado = nada de ese push llegó al remoto. Si el archivo solo aparece en los commits por delante, **no existe historial remoto que reescribir**.
- Si el archivo ya no está en el disco (borrado), la única copia está en el commit. Avísalo al usuario antes de deshacer el commit.

## 2. Corrige, una herramienta cada vez
1. `undo_last_commit` — repite hasta pasar el último commit que trajo el archivo. Los cambios vuelven al stage, no se pierde nada.
2. `ignore_files` con la ruta del archivo — lo saca del stage y lo añade a `.gitignore`; el archivo sigue en el disco.
3. `commit`.
4. `push`.

Antes de cada herramienta, di en una frase qué hace y adjunta la llamada en la misma respuesta — la tarjeta de aprobación es la pregunta de sí/no.

## 3. Qué no hacer
- Un commit nuevo borrando el archivo **no** lo resuelve: el push envía todos los commits, incluido el que añadió el archivo.
- No sugieras Git LFS para un backup, dump o binario generado. Solo si el usuario dice que el archivo realmente tiene que quedarse en el repositorio.
- Nunca `filter-branch`, `filter-repo`, BFG, `reset --hard` ni force push — ni siquiera como paso manual.
- Nunca inventes pantallas, menús ni configuraciones de GitHub (no existe "eliminar archivo grande" en la configuración del repositorio).

## 4. Si el archivo ya está en el remoto
`undo_last_commit` lo rechazará. No intentes limpiar el historial remoto.
- **Secreto:** di que debe tratarse como filtrado y **revocarse/cambiarse** en el servicio de origen; después `ignore_files` + `commit` + `push` para dejar de versionarlo. Nunca repitas el valor del secreto.
- **Archivo grande ya aceptado por el remoto:** `ignore_files` + `commit` + `push` para que salga de las próximas versiones. Explica que sigue en el historial antiguo y que sacarlo de ahí exige reescribir el historial, algo fuera de este chat.
