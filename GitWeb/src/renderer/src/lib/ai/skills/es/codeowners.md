# Skill: revisión de CODEOWNERS

Úsala cuando el usuario pregunte por CODEOWNERS, los dueños del código, o quién tiene que aprobar cambios en una ruta. Es un análisis de solo lectura — responde en texto; no hay herramienta para editar archivos.

1. **Encuentra el archivo.** Llama a `list_files` con `pattern: "**/CODEOWNERS"`. GitHub solo tiene en cuenta `.github/CODEOWNERS`, `CODEOWNERS` en la raíz del repositorio o `docs/CODEOWNERS` (el primero que encuentre, en ese orden). Si no existe ninguno, dilo y ofrece una estructura inicial (paso 4).
2. **Léelo** con `read_file`. Para comprobar si las rutas importantes están cubiertas, usa `list_files` con patrones específicos (p. ej., `.github/workflows/*`) — no listes el repositorio entero.
3. **Verifica e informa:**
   - Las rutas críticas (workflows de CI, scripts de build/release, código de autenticación o seguridad, manifiestos de dependencias) tienen un dueño explícito, y no solo el fallback `*`.
   - Los dueños son, preferiblemente, equipos (`@org/equipo`) en lugar de personas individuales.
   - Reglas superpuestas: el **último** patrón que coincide es el que vale — señala reglas anteriores que una regla posterior más amplia sobrescribe sin querer.
   - Líneas no válidas o dueños que parecen errores de escritura.
   No puedes verificar si un dueño sigue activo, ni si la protección de rama exige la revisión de los code owners — dile al usuario que lo compruebe en la configuración del repositorio en GitHub.
4. **Estructura inicial** (solo cuando el archivo no existe o el usuario lo pide), usando rutas que existen de verdad en este repositorio:
   ```
   # Fallback
   * @org/maintainers

   # CI y release
   .github/workflows/ @org/devops
   ```
   Pide al usuario que cambie `@org/...` por los equipos reales — nunca presentes dueños inventados como si fueran reales.
