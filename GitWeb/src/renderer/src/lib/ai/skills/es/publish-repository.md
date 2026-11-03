# Skill: publicar el repositorio en GitHub

Úsala cuando el usuario quiera publicar, subir o crear en GitHub el repositorio local abierto. Ejemplos: "publica este proyecto en GitHub", "crea el repo en GitHub", "sube esto a GitHub como privado".

**Un "Diagnóstico verificado por la app" en el prompt es un hecho.** No lo contradigas ni lo vuelvas a verificar. Sigue su "Siguiente paso".

## 1. Comprueba antes
- **Ya tiene origin** → no crees otro repositorio. La rama se publica con `push`.
- **Sin commits** → no hay nada que enviar. Ofrece `commit` primero y publica después.
- **Cambios sin commit** → avisa que solo sube lo que está en commits y pregunta si quiere hacer commit antes.
- **Sin sesión de GitHub** → pide que inicie sesión con GitHub (botón "Publicar en GitHub" de la barra superior, o Configuración › General). No llames a la herramienta.

## 2. Publica — una herramienta, con aprobación
- `publish_repository` crea el repositorio en GitHub, lo deja como origin y envía la rama actual con upstream.
- **Visibilidad: privado por defecto.** Usa `visibility: "public"` solo si el usuario dice público, abierto u open source. Ante la duda, privado, y di que se puede hacer público después en GitHub.
- **Nombre:** el de la carpeta, salvo que el usuario pida otro. **Propietario:** su cuenta, salvo que mencione una organización.
- Antes de llamarla, di en una frase qué va a pasar (nombre, propietario, visibilidad) y adjunta la llamada en esa misma respuesta. La tarjeta de aprobación es la pregunta de sí/no.

## 3. Después
- **Éxito** → muestra el enlace del repositorio.
- **"se creó… pero el envío falló"** → el repositorio ya existe y el origin ya está configurado. No llames a `publish_repository` otra vez: usa `push`.
- **El nombre ya existe en GitHub** → sugiere otro nombre y vuelve a llamar con él.
- **Bloqueado por archivos sensibles en el historial** → explica que publicar envía todos los commits, así que hay que deshacer antes los que traen esos archivos. `undo_last_commit` solo sirve si son los últimos commits. Nunca repitas el valor de un secreto ni sugieras cambiar la verificación a "Avisar" para saltarla.

## 4. Nunca
- Crear un repositorio cuando ya existe origin.
- Elegir público sin que el usuario lo pida.
- `git remote add`, force push ni pasos manuales en la terminal. No inventes pantallas ni ajustes de GitHub.
