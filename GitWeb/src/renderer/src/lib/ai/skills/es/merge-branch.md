# Skill: merge de ramas y resolución de conflictos

Sigue estos pasos siempre que el usuario pida fusionar una rama en la actual, o cuando un merge o pull deje conflictos.

1. **Verifica el punto de partida.** Por el contexto del repositorio: rama actual, cambios pendientes, ahead/behind. Si hay cambios sin commit, ofrece `stash` o `commit` antes del merge — un merge sobre un working tree sucio es más difícil de deshacer.
2. **Confirma que la rama de origen existe** con `list_branches` (`include_remote: "true"` si puede existir solo en el remoto).
3. **Estima el riesgo antes de llamar a `merge_branch`**, con lo que muestran las herramientas:
   - Si la rama de origen tiene PR (`list_pull_requests` con `head_branch`), `read_pull_request` trae los archivos modificados y los recuentos de +/-.
   - `check_incoming_commits` indica si la rama actual está desactualizada respecto al remoto.
   Clasifica:
   - **BAJO** — pocos archivos, ningún archivo central (configuraciones, schemas, APIs públicas, tipos compartidos), rama actualizada.
   - **MEDIO** — muchos archivos, o toca archivos centrales, o la rama actual está por detrás.
   - **ALTO** — cambio muy grande (alrededor de 150+ archivos o 3000+ líneas), altera contratos (API, schema, interfaces), o ya sabes que ambos lados editaron los mismos archivos.
   Si no consigues datos suficientes, di que la estimación es parcial en lugar de adivinar. Para BAJO, simplemente llama a `merge_branch`. Para MEDIO o ALTO, explica el riesgo en una o dos frases en la misma respuesta que llama a `merge_branch` — la tarjeta de aprobación es la confirmación, no preguntes por separado.
4. **Rama principal.** Al fusionar en `main`/`master` en un repositorio que trabaja con pull requests, recuerda que un PR puede ser el camino esperado. Si el usuario ya pidió un merge directo, continúa.
5. **Si surgen conflictos:**
   - Llama a `resolve_conflict` para un archivo cada vez (pasa `path` cuando haya más de un archivo en conflicto). Preserva la intención de ambos lados — no descartes un lado solo para que el conflicto desaparezca.
   - Cuando no quede ningún archivo en conflicto, llama a `commit` para concluir el merge.
   - Si el usuario no quiere resolverlo, llama a `merge_abort` para volver al estado anterior al merge.
6. **Fallo repetido.** Si el mismo merge falla dos veces (los conflictos vuelven después de resueltos, o los errores se repiten), detente y pregunta al usuario cómo proceder — no sigas reintentando.
7. **Deshacer.** `merge_abort` solo funciona mientras el merge sigue en curso. Deshacer un merge ya confirmado o enviado (o un PR ya fusionado) exige un revert, que no tiene herramienta — explica que es un paso manual (botón "Revert" en el PR de GitHub, o `git revert` en la terminal) y prefiere revert a reescribir el historial en ramas compartidas.
