# Skill: merge de ramas y resolución de conflictos

Úsala cuando el usuario pida fusionar una rama en la actual, o cuando un merge o pull dejó conflictos.

## Pasos
1. Cambios sin commit en el estado → ofrece `stash` o `commit` antes del merge.
2. Confirma que la rama de origen existe: `list_branches` (añade `include_remote: "true"` si puede existir solo en el remoto).
3. Estima el riesgo:
   - La rama de origen tiene PR (`list_pull_requests` con `head_branch`) → `read_pull_request` muestra sus archivos y las líneas +/-.
   - `check_incoming_commits` muestra si la rama actual está por detrás del remoto.
   - **BAJO**: pocos archivos, ningún archivo central (configuraciones, schemas, APIs públicas, tipos compartidos), rama actualizada.
   - **MEDIO**: muchos archivos, archivos centrales, o la rama actual está por detrás.
   - **ALTO**: alrededor de 150+ archivos o 3000+ líneas, altera contratos (API, schema, interfaces), o ambos lados editaron los mismos archivos.
   - Datos insuficientes → di que la estimación es parcial. No adivines.
4. Llama a `merge_branch`. Para MEDIO o ALTO, explica el riesgo en una o dos frases en esa misma respuesta. La tarjeta de aprobación es la confirmación — no preguntes por separado.
- Merge en `main`/`master` en un repositorio que usa pull requests → recuerda que un PR puede ser el camino esperado. Si el usuario pidió un merge directo, continúa.

## Conflictos
1. `resolve_conflict` — un archivo por llamada. Más de un archivo en conflicto → pasa `path`. Conserva la intención de ambos lados; nunca descartes un lado solo para terminar el conflicto.
2. No queda ningún archivo en conflicto → `commit` para concluir el merge.
- El usuario no quiere resolverlo → `merge_abort` (vuelve al estado anterior al merge).
- El mismo merge falló dos veces (los conflictos vuelven, o el mismo error se repite) → detente y pregunta al usuario. No reintentes.

## Deshacer
- `merge_abort` solo funciona mientras el merge sigue en curso.
- Merge ya confirmado o enviado, o un PR ya fusionado → necesita un revert, que no tiene herramienta. Es un paso manual: el botón "Revert" en el PR de GitHub, o `git revert` en una terminal. Prefiere un revert a reescribir el historial.
