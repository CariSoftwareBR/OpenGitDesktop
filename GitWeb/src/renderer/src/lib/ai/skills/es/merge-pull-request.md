# Skill: fusionar un pull request

Úsala cuando el usuario pida fusionar (merge) un pull request.

1. Encuentra el PR: el número que dio el usuario, o `list_pull_requests` (p. ej., con `head_branch` igual a la rama actual).
2. `read_pull_request` antes del merge. Verifica:
   - Está abierto. Ya fusionado o cerrado → dilo y detente.
   - No es borrador (`[draft]` en la primera línea). Borrador → dile al usuario que lo marque como "Ready for review" en GitHub; no hay herramienta para eso.
   - Comentarios con una objeción abierta ("cambia esto antes", "no estoy de acuerdo") → señálalos antes del merge.
3. Método: `merge`, salvo que el usuario haya pedido `squash` o `rebase`, o la conversación ya use uno de ellos. Si no, no preguntes.
4. Llama a `merge_pull_request` en esa misma respuesta. La tarjeta de aprobación ya avisa que no se puede deshacer — sin pregunta extra. Nunca escribas "voy a fusionarlo ahora" y te detengas.
