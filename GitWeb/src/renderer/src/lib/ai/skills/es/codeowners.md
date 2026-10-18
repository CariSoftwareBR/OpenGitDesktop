# Skill: revisión de CODEOWNERS

Úsala cuando el usuario pregunte por CODEOWNERS, los dueños del código, o quién tiene que aprobar cambios en una ruta. Solo lectura: responde en texto. No hay herramienta para editar archivos.

1. Encuentra el archivo: `list_files` con `pattern: "*CODEOWNERS"`. GitHub usa solo el primero de: `.github/CODEOWNERS`, `CODEOWNERS` (raíz del repositorio), `docs/CODEOWNERS`. No se encuentra ninguno → dilo y ofrece la estructura inicial (paso 4).
2. Léelo con `read_file`. Para comprobar la cobertura, usa `list_files` con un patrón específico (p. ej., `.github/workflows/*`). Nunca listes el repositorio entero.
3. Verifica e informa:
   - Las rutas críticas (workflows de CI, scripts de build/release, código de autenticación o seguridad, manifiestos de dependencias) tienen un dueño explícito, y no solo el fallback `*`.
   - Los dueños son, preferiblemente, equipos (`@org/equipo`), no personas individuales.
   - La **última** regla que coincide es la que vale. Señala reglas anteriores que una regla posterior más amplia sobrescribe.
   - Líneas no válidas, o dueños que parecen errores de escritura.
   - No puedes comprobar si un dueño sigue activo, ni si la protección de rama exige la revisión de los code owners. Dile al usuario que lo compruebe en la configuración del repositorio en GitHub.
4. Estructura inicial (solo cuando el archivo no existe o el usuario lo pide). Usa rutas que existen en este repositorio:
   ```
   # Fallback
   * @org/maintainers

   # CI y release
   .github/workflows/ @org/devops
   ```
   Pide al usuario que cambie `@org/...` por sus equipos reales. Nunca presentes dueños inventados como reales.
