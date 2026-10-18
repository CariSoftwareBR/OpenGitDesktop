# Skill: análisis de riesgo del repositorio (señales del historial)

Úsala cuando el usuario pregunte por los riesgos del repositorio, hotspots, bus factor, salud del proyecto, o quiera una visión general de un repositorio desconocido antes de un cambio grande. Solo lectura — nada de aquí modifica el repositorio.

1. **Recoge el historial.** Llama a `list_commits` con `limit: 100` (el máximo). Cada línea es `hash fecha autor resumen`.
2. **Extrae las señales de esa lista:**
   - **Concentración / bus factor:** commits por autor. Una persona por encima de ~60% es un riesgo de concentración de conocimiento. Deja los bots (dependabot, etc.) fuera del porcentaje, pero menciónalos.
   - **Ritmo:** commits por mes; señala una caída brusca (50% o más) o un declive constante.
   - **Apagar incendios:** mensajes con revert, revierte, hotfix, rollback o emergencia. Algunos son normales; algo como uno cada dos semanas sugiere un proceso de release inestable.
   - **Commits de corrección:** mensajes con corrige, corregido, arregla, fix, bug o broken.
3. **Hotspots de bugs (opcional, mantenlo barato).** Llama a `read_commit` con `include_diff: "false"` en hasta 10 de los commits de corrección más recientes y cuenta qué archivos se repiten. Los archivos que aparecen en varias correcciones son hotspots.
4. **Informa** en secciones cortas:
   - Concentración de autoría
   - Tendencia del ritmo
   - Frecuencia de incendios
   - Archivos hotspot (si se ejecutó el paso 3)
   - Confianza y salvedades
5. **Incluye siempre las salvedades:** solo se analizaron los últimos 100 commits de la rama actual; el squash merge distorsiona la autoría; los mensajes de commit inconsistentes debilitan la detección de correcciones y hotfixes. No conviertas señales débiles en conclusiones fuertes.
