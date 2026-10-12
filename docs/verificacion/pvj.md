# Matriz de trazabilidad: specs de OpenSpec frente a tests

Cada fila es un escenario (`#### Scenario`) de las specs vivas de OpenSpec, con el test automatizado que lo verifica y un veredicto de cobertura.

- **Fuente de los escenarios:** [openspec/specs/auth/spec.md](../../openspec/specs/auth/spec.md) y [openspec/specs/tasks/spec.md](../../openspec/specs/tasks/spec.md). Los cambios de `openspec/changes/archive/` (`add-task-list`, `add-task-due-date` y `add-task-status-filter`) ya están consolidados en esas specs. Se ha comprobado que no tienen ningún escenario que falte en ellas.
- **Fuente de los tests:** todo lo que hay en el repo, es decir, [backend/tests/functional/auth/](../../backend/tests/functional/auth/) (4 ficheros, 20 tests). No hay `backend/tests/unit/`, ni tests de `tasks`, ni runner de tests en `frontend/`.
- **Ejecución:** `node ace test` sobre el commit `77544fb` (11/10/2026) da **20 de 20 en verde**. Ningún escenario figura como cubierto por un test que falle.

## Criterio

| Estado | Significa |
|---|---|
| ✅ Cubierto | Un test automatizado que pasa comprueba **todas** las cláusulas del THEN del escenario. |
| ❌ No está cubierto | No hay ningún test, o el que hay solo comprueba una parte del THEN. En ese caso se marca como *Parcial* y la última columna dice qué falta comprobar. |
| ❓ No lo sé | Hay un test relacionado, pero con lo que dice la spec no se puede decidir si basta. La última columna explica qué falta para decidir. |

La columna **Capa** distingue los requisitos del sistema (`El sistema SHALL…`, que se verifican contra la API) de los de la interfaz (`La interfaz SHALL…`, que se verifican en el frontend).

## Resumen

| Capability | Capa | Escenarios | ✅ Cubierto | ❌ No está cubierto | ❓ No lo sé |
|---|---|---:|---:|---:|---:|
| `auth` | API | 22 | 12 | 9 (todos parciales) | 1 |
| `auth` | UI | 23 | 0 | 23 | 0 |
| `tasks` | API | 68 | 0 | 68 | 0 |
| `tasks` | UI | 56 | 0 | 56 | 0 |
| **Total** | | **169** | **12 (7 %)** | **156** | **1** |

Lo que sale del análisis:

1. **`tasks` no tiene ningún test.** Sus 124 escenarios están sin cubrir, y entre ellos hay reglas de negocio críticas: cuándo una tarea está vencida (`today`, el «vencer hoy no es estar vencida»), el filtro por estado, que el `422` se distinga de la lista vacía y que la lista no lleve el vencimiento.
2. **La interfaz no tiene ningún test.** Los 79 escenarios de UI de las dos capabilities están sin cubrir porque `frontend/` no tiene runner.
3. **En `auth`/API, varios tests se quedan cortos frente a la spec.** El patrón más repetido es comprobar el `field` del error de validación sin comprobar su `rule` (A04, A05, A06). Además, en A08 la aserción de «no se emite token» mira la raíz del cuerpo en vez de `data.token`, así que no puede fallar.
4. **El único «no lo sé» (A09) es una ambigüedad de la spec, no del test.** Hay que decidir si «indistinguible» incluye el tiempo de respuesta.

## Capability `auth` ([openspec/specs/auth/spec.md](../../openspec/specs/auth/spec.md))

| # | Requisito | Escenario | Capa | Test que lo cubre | Estado | Qué falta / observaciones |
|---|---|---|---|---|---|---|
| A01 | Registro de una cuenta nueva | Registro correcto | API | [signup.spec.ts:18](../../backend/tests/functional/auth/signup.spec.ts#L18) «registrarse devuelve la cuenta y un token que ya sirve» | ❌ No está cubierto | Parcial: comprueba `email`, `fullName`, `initials` y que el token autentica, pero no que `user` traiga `id`, `createdAt` y `updatedAt`. |
| A02 | Registro de una cuenta nueva | Cuenta sin nombre | API | [signup.spec.ts:43](../../backend/tests/functional/auth/signup.spec.ts#L43) «una cuenta puede quedarse sin nombre» | ✅ Cubierto |  |
| A03 | Validación de los datos de registro | Contraseña demasiado corta | API | [signup.spec.ts:68](../../backend/tests/functional/auth/signup.spec.ts#L68) «una contraseña corta se rechaza y no crea cuenta» | ✅ Cubierto |  |
| A04 | Validación de los datos de registro | La confirmación no coincide | API | [signup.spec.ts:81](../../backend/tests/functional/auth/signup.spec.ts#L81) «la confirmación tiene que coincidir» | ❌ No está cubierto | Parcial: comprueba `422`, `field: passwordConfirmation` y que no se crea la cuenta, pero no `rule: sameAs`. |
| A05 | Validación de los datos de registro | Email con formato inválido | API | [signup.spec.ts:94](../../backend/tests/functional/auth/signup.spec.ts#L94) «un email mal formado se rechaza» | ❌ No está cubierto | Parcial: comprueba `422` y `field: email`, pero no `rule: email`. |
| A06 | Un email, una sola cuenta | Email ya registrado | API | [signup.spec.ts:106](../../backend/tests/functional/auth/signup.spec.ts#L106) «un email ya registrado no crea una segunda cuenta» | ❌ No está cubierto | Parcial: comprueba `422`, `field: email` y que la cuenta existente queda intacta, pero no `rule: database.unique`. |
| A07 | Inicio de sesión con email y contraseña | Credenciales correctas | API | [login.spec.ts:21](../../backend/tests/functional/auth/login.spec.ts#L21) «con las credenciales correctas se emite un token que autentica» | ✅ Cubierto |  |
| A08 | Inicio de sesión con email y contraseña | Contraseña incorrecta | API | [login.spec.ts:43](../../backend/tests/functional/auth/login.spec.ts#L43) «una contraseña equivocada no emite token» | ❌ No está cubierto | Parcial: el `400` sí se comprueba, pero la aserción de «no se emite token» (`assert.notProperty(response.body(), 'token')`) mira la raíz del cuerpo, y el token viaja en `data.token`. Pasaría aunque se emitiera un token. |
| A09 | Inicio de sesión con email y contraseña | Email que no pertenece a ninguna cuenta | API | [login.spec.ts:54](../../backend/tests/functional/auth/login.spec.ts#L54) «un email desconocido responde igual que una contraseña equivocada» | ❓ No lo sé | Falta decidir qué cuenta como «indistinguible». El test compara el status y el cuerpo (`deepEqual`), pero no las cabeceras ni el tiempo de respuesta. Si el requisito incluye la enumeración de cuentas midiendo el tiempo, no está cubierto. Si solo se refiere a status y cuerpo, sí lo está. |
| A10 | Inicio de sesión con email y contraseña | Email mal formado | API | [login.spec.ts:75](../../backend/tests/functional/auth/login.spec.ts#L75) «un email mal formado se rechaza antes de comprobar credenciales» | ✅ Cubierto | Comprobar las credenciales daría `400`, así que obtener `422` demuestra que la validación va antes. |
| A11 | Consulta del perfil de la sesión activa | Perfil con token válido | API | [session.spec.ts:21](../../backend/tests/functional/auth/session.spec.ts#L21) «el perfil devuelve la cuenta del token presentado» | ✅ Cubierto |  |
| A12 | Cierre de sesión | Cierre de sesión correcto | API | [session.spec.ts:53](../../backend/tests/functional/auth/session.spec.ts#L53) «cerrar sesión invalida el token usado» | ✅ Cubierto |  |
| A13 | Cierre de sesión | El token revocado ya no vale | API | [session.spec.ts:53](../../backend/tests/functional/auth/session.spec.ts#L53) «cerrar sesión invalida el token usado» | ✅ Cubierto |  |
| A14 | Cierre de sesión | Las demás sesiones siguen abiertas | API | [session.spec.ts:70](../../backend/tests/functional/auth/session.spec.ts#L70) «cerrar una sesión no cierra las demás de la misma cuenta» | ✅ Cubierto | Este test no comprueba la respuesta del logout de la primera sesión. Que ese token quede revocado lo garantiza el test anterior. |
| A15 | Protección de los recursos de cuenta | Petición sin credenciales | API | [session.spec.ts:35](../../backend/tests/functional/auth/session.spec.ts#L35) «sin cabecera de autorización no se devuelve nada de la cuenta» | ❌ No está cubierto | Parcial: comprueba el `401`, pero no que el cuerpo no contenga datos de la cuenta. |
| A16 | Protección de los recursos de cuenta | Token inventado | API | [session.spec.ts:43](../../backend/tests/functional/auth/session.spec.ts#L43) «un token inventado no abre las rutas de cuenta» | ❌ No está cubierto | Parcial: el escenario dice «cualquier ruta de `/api/v1/account`» y solo se prueba `GET /profile`. Falta `POST /logout`. |
| A17 | Protección de los recursos de cuenta | El registro y el login son públicos | API | [session.spec.ts:87](../../backend/tests/functional/auth/session.spec.ts#L87) «el registro y el login siguen siendo públicos» (signup) + [login.spec.ts:21](../../backend/tests/functional/auth/login.spec.ts#L21) «con las credenciales correctas se emite un token que autentica» (login, sin cabecera) | ✅ Cubierto |  |
| A18 | Forma de las respuestas de la API | JSON aunque el cliente pida HTML | API | — | ❌ No está cubierto | Ningún test envía `Accept: text/html`. |
| A19 | Forma de las respuestas de la API | La contraseña nunca sale | API | [signup.spec.ts:55](../../backend/tests/functional/auth/signup.spec.ts#L55) «la contraseña nunca sale en la respuesta» | ❌ No está cubierto | Parcial: solo se comprueba en el registro. El escenario también exige el login y la consulta del perfil. |
| A20 | Iniciales de la cuenta | Nombre de dos palabras | API | [initials.spec.ts:15](../../backend/tests/functional/auth/initials.spec.ts#L15) «un nombre de dos palabras da la inicial de cada una» | ✅ Cubierto |  |
| A21 | Iniciales de la cuenta | Nombre de una sola palabra | API | [initials.spec.ts:20](../../backend/tests/functional/auth/initials.spec.ts#L20) «un nombre de una palabra da sus dos primeras letras» | ✅ Cubierto |  |
| A22 | Iniciales de la cuenta | Cuenta sin nombre | API | [initials.spec.ts:21](../../backend/tests/functional/auth/initials.spec.ts#L21) «sin nombre, las iniciales salen del email» | ✅ Cubierto |  |
| A23 | Pantalla de registro | Alta correcta | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A24 | Pantalla de registro | Las contraseñas no coinciden | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A25 | Pantalla de registro | Nombre vacío | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A26 | Pantalla de inicio de sesión | Entrada correcta | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A27 | Pantalla de inicio de sesión | Credenciales incorrectas | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A28 | Pantalla de inicio de sesión | Ir a crear cuenta | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A29 | Errores comprensibles en los formularios de acceso | Error atribuible a un campo visible | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A30 | Errores comprensibles en los formularios de acceso | Error sin campo en pantalla | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A31 | Pantalla de perfil | Perfil de una cuenta con nombre | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A32 | Pantalla de perfil | Perfil de una cuenta sin nombre | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A33 | Cierre de sesión desde la interfaz | Cierre de sesión normal | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A34 | Cierre de sesión desde la interfaz | El servidor no responde al cerrar sesión | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A35 | Persistencia de la sesión entre visitas | Recarga con sesión válida | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A36 | Persistencia de la sesión entre visitas | Nueva visita sin sesión previa | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A37 | Recuperación de una sesión que ya no vale | El servidor rechaza la sesión recordada | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A38 | Recuperación de una sesión que ya no vale | Un error de acceso nuevo tapa al anterior | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A39 | Aviso cuando el servidor no está disponible | Backend apagado al intentar entrar | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A40 | Aviso cuando el servidor no está disponible | Backend apagado al arrancar con sesión guardada | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A41 | Acceso a las pantallas según el estado de la sesión | Perfil sin sesión | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A42 | Acceso a las pantallas según el estado de la sesión | Acceso con sesión ya abierta | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A43 | Acceso a las pantallas según el estado de la sesión | Dirección desconocida | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A44 | Acceso al perfil desde el resto de la aplicación | Llegar al perfil | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| A45 | Acceso al perfil desde el resto de la aplicación | Volver de vuelta | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |

## Capability `tasks` ([openspec/specs/tasks/spec.md](../../openspec/specs/tasks/spec.md))

| # | Requisito | Escenario | Capa | Test que lo cubre | Estado | Qué falta / observaciones |
|---|---|---|---|---|---|---|
| T01 | Creación de una tarea con solo el título | Alta con el título como único dato | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T02 | Creación de una tarea con solo el título | La tarea nace a nombre de quien la crea | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T03 | Creación de una tarea con solo el título | La tarea nace pendiente | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T04 | Creación de una tarea con solo el título | No se admite fijar responsable ni estado al crear | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T05 | Ninguna tarea sin título | Título ausente o vacío | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T06 | Ninguna tarea sin título | Título de solo espacios | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T07 | Ninguna tarea sin título | Espacios en los extremos | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T08 | Aviso ante un título demasiado largo | Título en el límite | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T09 | Aviso ante un título demasiado largo | Título que se pasa de largo | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T10 | Una sola lista compartida del espacio | Sin filtro no es «todas» | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T11 | Una sola lista compartida del espacio | El contenido no depende de quién mira | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T12 | Una sola lista compartida del espacio | Las tareas ajenas también salen | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T13 | Una sola lista compartida del espacio | Orden de la lista | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T14 | Una sola lista compartida del espacio | La lista llega entera | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T15 | Una sola lista compartida del espacio | Pedir la lista no cambia nada | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T16 | Lo que cada tarea muestra de su responsable | Responsable identificable | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T17 | Lo que cada tarea muestra de su responsable | La tarea no filtra datos de cuenta | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T18 | Lo que cada tarea muestra de su responsable | Responsable sin nombre | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T19 | Tres estados fijos | Un estado que no existe | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T20 | Tres estados fijos | El catálogo de estados no se toca | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. El escenario afirma que algo no existe en toda la aplicación: conviene verificarlo también revisando el código y las rutas. |
| T21 | Cambio de estado de cualquier tarea | Cambio de estado correcto | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T22 | Cambio de estado de cualquier tarea | Cambiar una tarea de otra persona | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T23 | Cambio de estado de cualquier tarea | Vuelta atrás desde hecho | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T24 | Cambio de estado de cualquier tarea | Cambiar el estado no toca nada más | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T25 | Cambio de estado de cualquier tarea | Tarea inexistente | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T26 | Las tareas exigen sesión | Listar sin haber entrado | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T27 | Las tareas exigen sesión | Escribir sin haber entrado | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T28 | Las tareas exigen sesión | Ver la lista no pide nada más que la sesión | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T29 | Pantalla de la lista del equipo | Lista con tareas | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T30 | Pantalla de la lista del equipo | Lo hecho no ocupa sitio | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T31 | Pantalla de la lista del equipo | Saber en qué anda cada uno | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T32 | Pantalla de la lista del equipo | Responsable sin nombre | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T33 | Pantalla de la lista del equipo | Llegar a la lista sin sesión | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T34 | El espacio sin tareas | Todavía no hay nada | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T35 | El espacio sin tareas | La primera tarea llena el espacio | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T36 | El espacio sin tareas | Vacío que no es un espacio vacío | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T37 | Crear una tarea desde la lista | Apuntar algo en un gesto | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T38 | Crear una tarea desde la lista | El formulario no pide nada más | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). El escenario afirma que algo no existe en toda la aplicación: conviene verificarlo también revisando el código y las rutas. |
| T39 | Crear una tarea desde la lista | El campo queda listo para la siguiente | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T40 | Aviso al intentar crear sin un título válido | Intento sin escribir nada | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T41 | Aviso al intentar crear sin un título válido | Solo espacios | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T42 | Aviso al intentar crear sin un título válido | Título demasiado largo | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T43 | Cambiar el estado desde la propia fila | Cambio sin salir de la lista | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T44 | Cambiar el estado desde la propia fila | Los únicos destinos posibles | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T45 | Cambiar el estado desde la propia fila | También en las tareas de otros | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T46 | Cambiar el estado desde la propia fila | El cambio no cuela | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T47 | Una sola vista de tareas, sin señales de presencia | No hay lista personal | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). El escenario afirma que algo no existe en toda la aplicación: conviene verificarlo también revisando el código y las rutas. |
| T48 | Una sola vista de tareas, sin señales de presencia | El estado es la única dimensión | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). El escenario afirma que algo no existe en toda la aplicación: conviene verificarlo también revisando el código y las rutas. |
| T49 | Una sola vista de tareas, sin señales de presencia | El filtro es una lente mía | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T50 | Una sola vista de tareas, sin señales de presencia | Sin señales de presencia | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). El escenario afirma que algo no existe en toda la aplicación: conviene verificarlo también revisando el código y las rutas. |
| T51 | Una sola vista de tareas, sin señales de presencia | La lista no adelanta el vencimiento | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T52 | Una sola vista de tareas, sin señales de presencia | La pantalla de una tarea no reúne tareas | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). El escenario afirma que algo no existe en toda la aplicación: conviene verificarlo también revisando el código y las rutas. |
| T53 | Fecha de vencimiento opcional | Una tarea nace sin fecha | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T54 | Fecha de vencimiento opcional | La creación no acepta fecha ni aunque se envíe | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T55 | Fecha de vencimiento opcional | La fecha es un día, no un instante | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T56 | Fecha de vencimiento opcional | Sin fecha se dice explícitamente | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T57 | Fijar, cambiar y retirar la fecha de vencimiento | Poner una fecha a una tarea que no tenía | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T58 | Fijar, cambiar y retirar la fecha de vencimiento | Cambiar la fecha por otra | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T59 | Fijar, cambiar y retirar la fecha de vencimiento | Quitar la fecha | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T60 | Fijar, cambiar y retirar la fecha de vencimiento | Una fecha ya pasada se acepta | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T61 | Fijar, cambiar y retirar la fecha de vencimiento | Una fecha que no existe se rechaza | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T62 | Fijar, cambiar y retirar la fecha de vencimiento | Fijar la fecha de una tarea ajena | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T63 | Fijar, cambiar y retirar la fecha de vencimiento | Tocar la fecha no toca nada más | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T64 | Fijar, cambiar y retirar la fecha de vencimiento | Tarea inexistente | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T65 | Cuándo una tarea está vencida | Fecha del día anterior | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T66 | Cuándo una tarea está vencida | Vencer hoy todavía no es estar vencida | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T67 | Cuándo una tarea está vencida | Fecha futura | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T68 | Cuándo una tarea está vencida | Sin fecha no se vence nunca | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T69 | Cuándo una tarea está vencida | Darla por hecha la deja de vencer | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T70 | Cuándo una tarea está vencida | Una tarea hecha con la fecha pasada | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T71 | Cuándo una tarea está vencida | Aplazar resuelve el vencimiento | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T72 | El día de referencia lo pone quien mira | Dos husos, dos lecturas, ambas correctas | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T73 | El día de referencia lo pone quien mira | Una tarea vence sola al pasar la medianoche | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T74 | El día de referencia lo pone quien mira | Falta el día de referencia | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T75 | El día de referencia lo pone quien mira | Día de referencia que no vale | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T76 | Consulta de una tarea suelta | Tarea existente | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T77 | Consulta de una tarea suelta | Tarea que no existe | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T78 | Consulta de una tarea suelta | Consultar una tarea ajena | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T79 | Consulta de una tarea suelta | Consultar sin haber entrado | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T80 | Consulta de una tarea suelta | Mirar una tarea no la cambia | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T81 | La lista no lleva el vencimiento | La lista calla sobre el vencimiento | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T82 | La lista no lleva el vencimiento | La lista no pide día de referencia | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T83 | Pantalla de una tarea | Abrir una tarea desde la lista | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T84 | Pantalla de una tarea | Volver a la lista | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T85 | Pantalla de una tarea | Abrir una tarea sin sesión | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T86 | Pantalla de una tarea | Abrir una tarea que no existe | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T87 | Poner y quitar la fecha desde la pantalla de la tarea | Indicar una fecha | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T88 | Poner y quitar la fecha desde la pantalla de la tarea | El cambio ya está guardado | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T89 | Poner y quitar la fecha desde la pantalla de la tarea | Quitar la fecha en un gesto | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T90 | Poner y quitar la fecha desde la pantalla de la tarea | La fecha de una tarea de otra persona | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T91 | Poner y quitar la fecha desde la pantalla de la tarea | El cambio no cuela | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T92 | Aviso ante una fecha que no vale | Fecha imposible o incompleta | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T93 | Aviso ante una fecha que no vale | El aviso no es un callejón sin salida | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T94 | La señal de tarea vencida | Una tarea vencida se anuncia | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T95 | La señal de tarea vencida | La señal no es solo un color | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T96 | La señal de tarea vencida | Vencer hoy no se anuncia | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T97 | La señal de tarea vencida | Una tarea hecha no se anuncia vencida | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T98 | No tener fecha no se penaliza | Una tarea sin fecha en la lista | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T99 | No tener fecha no se penaliza | Una tarea sin fecha abierta | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T100 | Acotar la lista por estado | Filtrar por un estado concreto | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T101 | Acotar la lista por estado | Lo hecho sigue siendo consultable | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T102 | Acotar la lista por estado | Un solo estado por petición | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. El escenario afirma que algo no existe en toda la aplicación: conviene verificarlo también revisando el código y las rutas. |
| T103 | Acotar la lista por estado | Acotar no cambia nada | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T104 | Acotar la lista por estado | Acotar sin haber entrado | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T105 | Un filtro válido sin resultados es una lista vacía legítima | Nadie tiene nada en curso | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T106 | Un filtro válido sin resultados es una lista vacía legítima | El espacio entero está vacío | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T107 | Un estado que no existe se rechaza, no se responde vacío | Estado inventado | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T108 | Un estado que no existe se rechaza, no se responde vacío | El error no se confunde con la ausencia | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T109 | Un estado que no existe se rechaza, no se responde vacío | El estado inventado no pasa a existir | API | — | ❌ No está cubierto | La capability `tasks` no tiene ningún test. |
| T110 | El control para acotar la lista | Las opciones disponibles | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T111 | El control para acotar la lista | Elegir un estado sustituye al anterior | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T112 | El control para acotar la lista | Quitar el filtro devuelve a la vista por defecto | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T113 | El control para acotar la lista | Sin ratón | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T114 | El control para acotar la lista | Un estado que no es ninguno de los tres | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T115 | El filtro se pide en la dirección de la lista | La vista acotada se comparte | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T116 | El filtro se pide en la dirección de la lista | Atrás deshace el filtro | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T117 | El filtro se pide en la dirección de la lista | El filtro no se guarda | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T118 | Una lista sin filas no significa siempre lo mismo | Se ha pedido un estado que no existe | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T119 | Una lista sin filas no significa siempre lo mismo | Filtro válido sin resultados | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T120 | Una lista sin filas no significa siempre lo mismo | No queda nada abierto, pero sí hay tareas hechas | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T121 | Una lista sin filas no significa siempre lo mismo | El vacío del filtro no se lee como vacío del espacio | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T122 | Lo que sale de la vista no se pierde | Marcar como hecho saca la tarea de la vista por defecto | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T123 | Lo que sale de la vista no se pierde | La tarea sigue estando | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
| T124 | Lo que sale de la vista no se pierde | Crear con un filtro puesto | UI | — | ❌ No está cubierto | El frontend no tiene runner de tests (ni unitarios ni e2e). |
