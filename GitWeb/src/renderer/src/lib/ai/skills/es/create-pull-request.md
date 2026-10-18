# Skill: crear un pull request

Úsala cuando el usuario pida crear o abrir un pull request.

1. Mira la rama primero: rama actual y estado en el contexto del repositorio, `list_commits` para sus commits recientes, `read_changes` si hay cambios sin commit. No adivines.
2. Escribe el título y el cuerpo a partir de lo que encontraste — nunca un texto genérico.
3. Rama de destino: `list_branches`. Solo existe otra rama → úsala, no preguntes. Varios destinos posibles (p. ej., `main` y `develop`) → pregunta cuál.
4. La rama actual es la de destino → no llames a `create_pull_request`. Di que hace falta una rama de feature y ofrece `create_branch`.
5. GitHub necesita la rama con commit y enviada. En este orden, una herramienta por respuesta:
   - Cambios sin commit → `commit`.
   - Después `push`. Siempre es seguro: su vista previa dice cuándo no hay nada que enviar. No existe una herramienta "ver si ya se envió" — solo llama a `push`.
   - Después `create_pull_request`.
6. Con el título, el cuerpo y el destino listos, llama a `create_pull_request` en esa misma respuesta. No preguntes "¿continúo?" — la tarjeta de aprobación es la confirmación.
7. Cuando el usuario responda tu pregunta sobre la rama de destino, tu respuesta debe traer la siguiente llamada (`commit`, `push` o `create_pull_request`). Nunca escribas "voy a crear el PR ahora" y te detengas.
