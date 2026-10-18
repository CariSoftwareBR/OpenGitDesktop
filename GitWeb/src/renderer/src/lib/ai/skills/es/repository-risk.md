# Skill: análisis de riesgo del repositorio (por el historial)

Úsala cuando el usuario pregunte por los riesgos del repositorio, hotspots, bus factor, salud del proyecto, o quiera una visión general de un repositorio desconocido antes de un cambio grande. Solo lectura — nada de aquí modifica el repositorio.

1. `list_commits` con `limit: 100` (el máximo). Cada línea es `hash  fecha  autor  resumen`.
2. En esa lista, cuenta:
   - **Autores:** commits por autor. Una persona con más de ~60% = riesgo de concentración de conocimiento. Cuenta los bots (dependabot, etc.) aparte y menciónalos.
   - **Ritmo:** commits por mes. Señala una caída del 50% o más, o un declive constante.
   - **Apagar incendios:** mensajes con revert, revierte, hotfix, rollback o emergencia. Alrededor de uno cada dos semanas o más = releases inestables.
   - **Correcciones:** mensajes con corrige, corregido, arregla, fix, bug o broken.
3. Hotspots (opcional): `read_commit` con `include_diff: "false"` en hasta 10 de los commits de corrección más recientes, una llamada por respuesta. Los archivos que aparecen en varias correcciones son hotspots.
4. Informa en secciones cortas: Autores · Ritmo · Incendios · Hotspots (si se ejecutó el paso 3) · Confianza y salvedades.
5. Incluye siempre las salvedades: solo se leyeron los últimos 100 commits de la rama actual; el squash merge distorsiona la autoría; los mensajes de commit desordenados debilitan la detección de correcciones. Los recuentos aproximados sirven — di que son aproximados. No conviertas señales débiles en conclusiones fuertes.
