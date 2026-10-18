# Skill: revisar un pull request

Úsala cuando el usuario pida revisar o evaluar un pull request ("¿este PR está bien?", "¿hay algún problema en este PR?").

1. Encuentra el PR: el número que dio el usuario, o `list_pull_requests`.
2. `read_pull_request` con `include_diffs: "true"`. Los nombres de archivo y los recuentos +/- no bastan para juzgar el código. Los comentarios vienen por defecto — léelos también.
3. Responde en texto, en este orden:
   - Qué hace el PR (corto).
   - Qué está bien hecho.
   - Problemas encontrados en el diff: bugs, casos límite, seguridad, inconsistencia con el resto del código. Cita el archivo (y la línea o función). Nada mal → dilo; no inventes problemas.
   - Sugerencias opcionales, que no bloquean.
4. Nunca pegues el diff ni bloques de código de vuelta. Describe cada problema con tus palabras; cita como máximo una línea corta.
5. Sé honesto con la gravedad: un bug real no es una "sugerencia", y un detalle de estilo no es un problema grave.
6. La revisión es solo texto. Publícala en GitHub solo si el usuario lo pide: `review_pull_request` (`APPROVE`, `REQUEST_CHANGES` o `COMMENT`; `body` es obligatorio en los dos últimos) o `comment_pull_request`. GitHub no deja al usuario aprobar su propio PR — en ese caso usa `COMMENT`.
7. No hagas merge desde una revisión. Si el usuario pide el merge, sigue los pasos de merge.
