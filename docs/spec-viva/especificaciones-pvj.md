# Especificaciones de FlowSync

Este documento describe el comportamiento **actual** de FlowSync tal y como está implementado en el código (`backend/` y `frontend/`). No recoge funcionalidades planificadas ni mejoras: solo lo que el sistema hace hoy.

---

# Backend

API HTTP construida con AdonisJS 7, Lucid y SQLite. Escucha en `http://localhost:3333` y expone sus rutas de negocio bajo el prefijo `/api/v1`.

## Purpose: Registro de cuentas

Permitir que una persona cree una cuenta de usuario y obtenga en la misma operación un token de acceso con el que usar la API.

### Requirements

### Requirement: Alta de usuario mediante `POST /api/v1/auth/signup`

El endpoint es público (no requiere autenticación). Recibe `fullName`, `email`, `password` y `passwordConfirmation`, crea el usuario, emite un token de acceso y responde con el usuario y el token envueltos en `{ data: ... }`.

### Scenario: Registro con datos válidos

- **WHEN** se envía `fullName` (texto o `null`), un `email` válido y no registrado de hasta 254 caracteres, un `password` de entre 8 y 32 caracteres y un `passwordConfirmation` idéntico al `password`
- **THEN** se crea un registro en la tabla `users`, se genera un token de acceso para ese usuario y la respuesta es `{ data: { user, token } }`, donde `user` tiene la forma descrita en «Representación del usuario» y `token` es el valor en claro del token

### Scenario: Registro sin nombre

- **WHEN** se envía `fullName: null` junto con el resto de campos válidos
- **THEN** el usuario se crea con `fullName` nulo y la respuesta se comporta igual que en un registro válido

### Scenario: Email ya registrado

- **WHEN** se envía un `email` que ya existe en la columna `email` de la tabla `users`
- **THEN** la validación falla con la regla `database.unique` sobre el campo `email`, la respuesta es un error 422 y no se crea ningún usuario

### Scenario: Email con formato inválido o demasiado largo

- **WHEN** el `email` no tiene formato de email o supera los 254 caracteres
- **THEN** la respuesta es un error 422 con la regla `email` o `maxLength` sobre el campo `email`

### Scenario: Contraseña fuera de rango

- **WHEN** el `password` tiene menos de 8 o más de 32 caracteres
- **THEN** la respuesta es un error 422 con la regla `minLength` o `maxLength` sobre el campo `password`

### Scenario: Confirmación de contraseña distinta

- **WHEN** `passwordConfirmation` no coincide con `password`
- **THEN** la respuesta es un error 422 con la regla `sameAs` sobre el campo `passwordConfirmation`

### Scenario: Campo obligatorio ausente

- **WHEN** falta en el cuerpo `email`, `password`, `passwordConfirmation` o la clave `fullName`
- **THEN** la respuesta es un error 422 con la regla `required` sobre el campo ausente

### Requirement: Almacenamiento seguro de la contraseña

La contraseña se guarda con hash (scrypt, coste 16384, blockSize 8, paralelización 1) gracias al mixin `withAuthFinder` del modelo `User`.

### Scenario: Persistencia de la contraseña

- **WHEN** se crea un usuario con una contraseña
- **THEN** la columna `password` de `users` almacena el hash de la contraseña, no el texto en claro

---

## Purpose: Inicio de sesión

Permitir que un usuario existente se autentique con email y contraseña y obtenga un nuevo token de acceso.

### Requirements

### Requirement: Autenticación mediante `POST /api/v1/auth/login`

El endpoint es público. Recibe `email` y `password`, verifica las credenciales contra la tabla `users` y emite un token de acceso nuevo.

### Scenario: Credenciales correctas

- **WHEN** se envía el `email` y la `password` de un usuario existente
- **THEN** se crea un nuevo token de acceso para ese usuario y la respuesta es `{ data: { user, token } }`

### Scenario: Credenciales incorrectas

- **WHEN** el `email` no corresponde a ningún usuario o la `password` no coincide
- **THEN** `User.verifyCredentials` lanza el error de credenciales inválidas y la respuesta es un error 400, sin emitir ningún token

### Scenario: Email inválido en el login

- **WHEN** el `email` no tiene formato de email o supera los 254 caracteres
- **THEN** la respuesta es un error 422 con la regla correspondiente sobre el campo `email`

### Scenario: Campos ausentes en el login

- **WHEN** falta `email` o `password` en el cuerpo
- **THEN** la respuesta es un error 422 con la regla `required` sobre el campo ausente

### Scenario: Varios inicios de sesión

- **WHEN** un mismo usuario inicia sesión más de una vez
- **THEN** cada inicio de sesión crea un token distinto en `auth_access_tokens` y los anteriores siguen siendo válidos

---

## Purpose: Consulta del perfil

Permitir que un usuario autenticado obtenga sus propios datos.

### Requirements

### Requirement: Perfil mediante `GET /api/v1/account/profile`

El endpoint está protegido por el middleware `auth` (guard `api`, token de acceso en la cabecera `Authorization: Bearer <token>`).

### Scenario: Petición con token válido

- **WHEN** se llama al endpoint con un token de acceso válido
- **THEN** la respuesta es `{ data: user }` con los datos del usuario dueño del token

### Scenario: Petición sin token o con token inválido

- **WHEN** se llama al endpoint sin cabecera `Authorization` o con un token que no existe en `auth_access_tokens`
- **THEN** la respuesta es un error 401

---

## Purpose: Cierre de sesión

Permitir que un usuario autenticado invalide el token con el que está haciendo la petición.

### Requirements

### Requirement: Logout mediante `POST /api/v1/account/logout`

El endpoint está protegido por el middleware `auth`. Elimina de la base de datos el token de acceso usado en la petición.

### Scenario: Logout con token válido

- **WHEN** se llama al endpoint con un token de acceso válido
- **THEN** se borra ese token de `auth_access_tokens` y la respuesta es `{ message: 'Logged out successfully' }` (sin envoltorio `data`)

### Scenario: Uso del token tras el logout

- **WHEN** después del logout se usa el mismo token en una ruta protegida
- **THEN** la respuesta es un error 401

### Scenario: Otros tokens del usuario

- **WHEN** el usuario tiene otros tokens emitidos en inicios de sesión distintos y cierra sesión con uno de ellos
- **THEN** solo se elimina el token usado en la petición; los demás siguen siendo válidos

### Scenario: Logout sin autenticación

- **WHEN** se llama al endpoint sin token o con un token inválido
- **THEN** la respuesta es un error 401

---

## Purpose: Autenticación de peticiones

Determinar en cada petición si hay un usuario autenticado y bloquear las rutas protegidas cuando no lo hay.

### Requirements

### Requirement: Comprobación silenciosa en todas las rutas

El middleware `silent_auth_middleware` se ejecuta en todas las rutas registradas y llama a `auth.check()` sin bloquear la petición.

### Scenario: Ruta pública con o sin token

- **WHEN** se llama a una ruta pública (por ejemplo `POST /api/v1/auth/login`) con o sin token
- **THEN** la petición continúa con normalidad, sin error de autenticación

### Requirement: Protección del grupo `/api/v1/account`

Las rutas `profile` y `logout` del grupo `/api/v1/account` aplican el middleware `auth`, que usa el guard por defecto `api` (tokens de acceso opacos almacenados en `auth_access_tokens`).

### Scenario: Acceso a una ruta protegida

- **WHEN** se llama a una ruta del grupo `/api/v1/account` sin un token de acceso válido
- **THEN** la petición se rechaza con un error 401 y no se ejecuta el controlador

### Requirement: Tokens de acceso

Los tokens se generan con `DbAccessTokensProvider` asociado al modelo `User`, se guardan con hash en `auth_access_tokens` y el valor en claro solo se devuelve en la respuesta de signup o login. No se configura caducidad para los tokens.

### Scenario: Borrado de un usuario

- **WHEN** se elimina un usuario de la tabla `users`
- **THEN** sus tokens en `auth_access_tokens` se borran en cascada (`onDelete('CASCADE')`)

---

## Purpose: Representación del usuario

Definir qué datos del usuario se exponen en las respuestas de la API.

### Requirements

### Requirement: Transformación con `UserTransformer`

Toda respuesta que incluye un usuario lo pasa por `UserTransformer`, que expone únicamente `id`, `fullName`, `email`, `createdAt`, `updatedAt` e `initials`.

### Scenario: Datos expuestos

- **WHEN** se devuelve un usuario en signup, login o perfil
- **THEN** el objeto contiene solo `id`, `fullName`, `email`, `createdAt`, `updatedAt` e `initials`, y nunca la contraseña

### Requirement: Cálculo de las iniciales

El getter `initials` del modelo `User` se calcula a partir de `fullName` (separado por espacios) o, si no hay nombre, del `email` (separado por `@`).

### Scenario: Nombre con dos o más palabras

- **WHEN** `fullName` es, por ejemplo, `"Ada Lovelace"`
- **THEN** `initials` es la primera letra de la primera palabra más la primera letra de la segunda, en mayúsculas (`"AL"`)

### Scenario: Nombre de una sola palabra

- **WHEN** `fullName` es, por ejemplo, `"Ada"`
- **THEN** `initials` son los dos primeros caracteres de esa palabra en mayúsculas (`"AD"`)

### Scenario: Usuario sin nombre

- **WHEN** `fullName` es nulo o vacío y el email es, por ejemplo, `"ada@example.com"`
- **THEN** `initials` es la primera letra de la parte local más la primera letra del dominio, en mayúsculas (`"AE"`)

---

## Purpose: Formato de las respuestas HTTP

Garantizar una estructura de respuesta homogénea en JSON.

### Requirements

### Requirement: Envoltorio `data`

El método `ctx.serialize()`, inyectado por `providers/api_provider.ts`, envuelve el payload en `{ data: ... }`. Ofrece además `serialize.withoutWrapping()` para responder sin envoltorio.

### Scenario: Respuesta serializada

- **WHEN** un controlador responde con `serialize(...)` (signup, login, perfil)
- **THEN** el cuerpo de la respuesta es `{ data: <payload> }`

### Requirement: Respuestas siempre en JSON

El middleware `force_json_response_middleware` fija la cabecera `Accept: application/json` en todas las peticiones, incluidas las que no coinciden con ninguna ruta.

### Scenario: Error de validación o de autenticación

- **WHEN** una petición produce un error (validación, credenciales, autenticación)
- **THEN** el error se devuelve en formato JSON; los errores de validación incluyen una lista `errors` con `message`, `rule`, `field` y `meta` cuando aplica

### Requirement: Ruta raíz

La ruta `GET /` está definida fuera del prefijo `/api/v1`.

### Scenario: Petición a la raíz

- **WHEN** se hace `GET /`
- **THEN** la respuesta es `{ hello: 'world' }`

---

## Purpose: Política CORS

Controlar qué orígenes pueden llamar a la API desde un navegador.

### Requirements

### Requirement: CORS según el entorno

CORS está habilitado con métodos `GET`, `HEAD`, `POST`, `PUT`, `PATCH` y `DELETE`, credenciales permitidas, cabeceras de petición reflejadas y caché de preflight de 90 segundos.

### Scenario: Entorno de desarrollo

- **WHEN** la aplicación corre en modo desarrollo
- **THEN** se acepta cualquier origen

### Scenario: Entorno de producción

- **WHEN** la aplicación corre en producción
- **THEN** la lista de orígenes permitidos está vacía y no se permite acceso cross-origin desde navegador

---

## Purpose: Persistencia de datos

Almacenar usuarios y tokens de acceso en una base de datos SQLite.

### Requirements

### Requirement: Tabla `users`

La tabla `users` tiene `id` autoincremental, `full_name` (nullable), `email` (254 caracteres, obligatorio y único), `password` (obligatorio), `created_at` (obligatorio) y `updated_at` (nullable).

### Scenario: Unicidad del email

- **WHEN** se intenta guardar un segundo usuario con un email ya existente
- **THEN** la restricción `unique` de la columna `email` lo impide

### Requirement: Tabla `auth_access_tokens`

La tabla `auth_access_tokens` guarda `tokenable_id` (referencia a `users.id`), `type`, `name`, `hash`, `abilities`, `created_at`, `updated_at`, `last_used_at` y `expires_at`.

### Scenario: Emisión de un token

- **WHEN** se emite un token en signup o login
- **THEN** se inserta una fila en `auth_access_tokens` asociada al usuario, guardando el hash del token y no su valor en claro

---

# Frontend

Aplicación React 19 + Vite servida en `http://localhost:5173`. Consume la API del backend en la URL indicada por `VITE_API_URL` (por defecto `http://localhost:3333`).

## Purpose: Cliente de la API

Centralizar en `src/lib/api.ts` toda la comunicación con el backend y traducir sus errores a mensajes en castellano.

### Requirements

### Requirement: Peticiones al backend

Cada petición se envía a `VITE_API_URL` (o `http://localhost:3333` si no está definida) con `Accept: application/json`; añade `Content-Type: application/json` cuando hay cuerpo y `Authorization: Bearer <token>` cuando se proporciona un token. Las respuestas exitosas de signup, login y perfil se devuelven ya sin el envoltorio `{ data }`.

### Scenario: Respuesta correcta

- **WHEN** el backend responde con un código de éxito
- **THEN** la función correspondiente (`signup`, `login`, `getProfile`) devuelve el contenido de `data`, y `logout` resuelve sin valor

### Scenario: Backend inaccesible

- **WHEN** `fetch` falla porque no se puede conectar con el servidor
- **THEN** se lanza un `ApiError` con estado `0` y el mensaje «No se pudo conectar con el servidor. Comprueba que el backend está arrancado.»

### Scenario: Respuesta no JSON

- **WHEN** el backend responde con un cuerpo que no es JSON
- **THEN** el cuerpo se trata como `null` y el error se construye solo a partir del código de estado

### Requirement: Traducción de errores a `ApiError`

Las respuestas de error se convierten en un `ApiError` con `message` listo para mostrar, `status` y `fieldErrors` (un mensaje por campo).

### Scenario: Error 401

- **WHEN** el backend responde 401
- **THEN** el mensaje es «Tu sesión ha caducado. Vuelve a iniciar sesión.»

### Scenario: Error 400

- **WHEN** el backend responde 400
- **THEN** el mensaje es «El email o la contraseña no son correctos.»

### Scenario: Error 422 con errores de validación

- **WHEN** el backend responde 422 con una lista `errors`
- **THEN** `fieldErrors` contiene, para cada campo, la traducción del primer error recibido sobre ese campo, y `message` es la traducción del primer error de la lista

### Scenario: Otro error

- **WHEN** el backend responde con cualquier otro código de error (o un 422 sin lista de errores)
- **THEN** el mensaje es «Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.»

### Requirement: Traducción de reglas de validación

Cada regla de VineJS se traduce a una frase en castellano usando una etiqueta por campo: «el nombre», «el email», «la contraseña», «la confirmación de la contraseña» (o «el campo» si no se reconoce).

### Scenario: Email duplicado

- **WHEN** el error tiene la regla `database.unique` sobre `email`
- **THEN** el mensaje es «Ese email ya está registrado. Inicia sesión en su lugar.»

### Scenario: Valor único duplicado en otro campo

- **WHEN** el error tiene la regla `database.unique` sobre un campo distinto de `email`
- **THEN** el mensaje es «Ya existe un registro con <etiqueta>.»

### Scenario: Contraseñas distintas

- **WHEN** el error tiene la regla `sameAs`
- **THEN** el mensaje es «Las contraseñas no coinciden.»

### Scenario: Email inválido

- **WHEN** el error tiene la regla `email`
- **THEN** el mensaje es «Introduce una dirección de email válida.»

### Scenario: Campo obligatorio

- **WHEN** el error tiene la regla `required`
- **THEN** el mensaje es «Falta rellenar <etiqueta>.»

### Scenario: Longitud mínima o máxima

- **WHEN** el error tiene la regla `minLength` o `maxLength`
- **THEN** el mensaje es «<etiqueta> debe tener al menos <min> caracteres.» o «<etiqueta> no puede superar los <max> caracteres.»

### Scenario: Regla no contemplada

- **WHEN** el error tiene cualquier otra regla
- **THEN** el mensaje es «Revisa <etiqueta>.»

---

## Purpose: Gestión de la sesión

Mantener en el cliente el estado de autenticación del usuario (`AuthProvider`) y exponerlo a toda la aplicación mediante `useAuth()`.

### Requirements

### Requirement: Estado de la sesión

El contexto expone `user`, `token`, `status` (`loading`, `authenticated` o `anonymous`), `sessionError` y las acciones `login`, `signup` y `logout`. `useAuth()` lanza un error si se usa fuera de `<AuthProvider>`.

### Scenario: Arranque sin token guardado

- **WHEN** la aplicación arranca y no existe la clave `flowsync.token` en `localStorage`
- **THEN** el estado inicial es `anonymous` y no se hace ninguna petición al backend

### Scenario: Uso de `useAuth` fuera del proveedor

- **WHEN** un componente llama a `useAuth()` fuera de `<AuthProvider>`
- **THEN** se lanza el error «useAuth debe usarse dentro de <AuthProvider>»

### Requirement: Inicio de sesión y registro

Tras un `login` o `signup` correcto, el token se guarda en `localStorage` bajo `flowsync.token` y la sesión pasa a `authenticated`.

### Scenario: Login o registro correcto

- **WHEN** `api.login` o `api.signup` devuelven `{ user, token }`
- **THEN** se guarda el token en `localStorage`, se actualizan `user` y `token`, `status` pasa a `authenticated` y `sessionError` se limpia

### Scenario: Login o registro fallido

- **WHEN** `api.login` o `api.signup` lanzan un error
- **THEN** la sesión no cambia y el error se propaga al formulario que hizo la llamada

### Requirement: Rehidratación de la sesión

Si al arrancar hay un token guardado, el estado inicial es `loading` y el token se valida contra `GET /api/v1/account/profile`.

### Scenario: Token guardado válido

- **WHEN** el backend devuelve el perfil para el token guardado
- **THEN** se cargan `user` y `token` y `status` pasa a `authenticated`

### Scenario: Token guardado rechazado

- **WHEN** el backend responde 401 al validar el token guardado
- **THEN** se borra el token de `localStorage`, `status` pasa a `anonymous` y `sessionError` queda como «Tu sesión ha caducado. Vuelve a iniciar sesión.»

### Scenario: Backend caído o error del servidor durante la rehidratación

- **WHEN** la validación del token falla por un motivo distinto de un 401 (sin conexión, error 500…)
- **THEN** el token se conserva en `localStorage`, `user` y `token` quedan vacíos en memoria, `status` pasa a `anonymous` y `sessionError` toma el mensaje del `ApiError` (o «No hemos podido restaurar tu sesión.» si el error no es un `ApiError`)

### Requirement: Cierre de sesión

`logout` cierra primero la sesión local y después avisa al backend.

### Scenario: Cierre de sesión

- **WHEN** se llama a `logout`
- **THEN** se borra el token de `localStorage`, `user` y `token` quedan a `null`, `status` pasa a `anonymous`, `sessionError` se limpia y se llama a `POST /api/v1/account/logout` con el token anterior

### Scenario: Fallo del backend al cerrar sesión

- **WHEN** la llamada a `POST /api/v1/account/logout` falla
- **THEN** el error se ignora y la sesión local queda cerrada igualmente

---

## Purpose: Navegación y protección de rutas

Decidir qué pantalla se muestra en función de la URL y del estado de la sesión.

### Requirements

### Requirement: Rutas de la aplicación

La aplicación define `/login` y `/register` como rutas solo públicas, `/profile` como ruta protegida, y redirige cualquier otra ruta a `/profile`.

### Scenario: Ruta desconocida

- **WHEN** se navega a una ruta no definida (incluida `/`)
- **THEN** se redirige a `/profile` reemplazando la entrada del historial

### Requirement: Ruta protegida (`ProtectedRoute`)

### Scenario: Sesión en carga

- **WHEN** se accede a `/profile` mientras `status` es `loading`
- **THEN** se muestra un cargador a pantalla completa con el texto accesible «Cargando…»

### Scenario: Sin sesión

- **WHEN** se accede a `/profile` con `status` `anonymous`
- **THEN** se redirige a `/login`

### Scenario: Con sesión

- **WHEN** se accede a `/profile` con `status` `authenticated`
- **THEN** se muestra la pantalla de perfil

### Requirement: Ruta solo pública (`PublicOnlyRoute`)

### Scenario: Sesión en carga en una ruta pública

- **WHEN** se accede a `/login` o `/register` mientras `status` es `loading`
- **THEN** se muestra el cargador a pantalla completa

### Scenario: Usuario ya autenticado

- **WHEN** se accede a `/login` o `/register` con `status` `authenticated`
- **THEN** se redirige a `/profile`

### Scenario: Usuario anónimo

- **WHEN** se accede a `/login` o `/register` con `status` `anonymous`
- **THEN** se muestra la pantalla solicitada

---

## Purpose: Manejo de errores en formularios

Gestionar el estado de envío de los formularios de autenticación y repartir los errores entre un aviso general y cada campo (`useAuthForm`).

### Requirements

### Requirement: Estado de envío

### Scenario: Envío en curso

- **WHEN** se envía un formulario
- **THEN** `isSubmitting` pasa a `true` y se limpian los errores anteriores

### Scenario: Envío correcto

- **WHEN** la acción del formulario termina sin error
- **THEN** el estado vuelve a su valor inicial (sin carga y sin errores)

### Requirement: Reparto de errores

### Scenario: Todos los errores pertenecen a campos visibles

- **WHEN** el `ApiError` tiene errores por campo y todos corresponden a campos que la pantalla muestra
- **THEN** cada error se muestra bajo su campo y no se muestra aviso general

### Scenario: Algún error pertenece a un campo no visible o no hay errores por campo

- **WHEN** el `ApiError` incluye errores de campos que la pantalla no muestra, o no trae errores por campo
- **THEN** se muestran bajo su campo los errores de los campos visibles y además se muestra el `message` del error como aviso general

### Scenario: Error que no es `ApiError`

- **WHEN** la acción lanza un error que no es un `ApiError`
- **THEN** se muestra el aviso general «Algo ha ido mal. Inténtalo de nuevo.»

### Requirement: Errores detectados en cliente

### Scenario: Fallo local en un campo

- **WHEN** la pantalla llama a `failWith(campo, mensaje)`
- **THEN** se muestra ese mensaje bajo el campo indicado, sin aviso general y sin llamar al backend

---

## Purpose: Pantalla de registro

Permitir crear una cuenta desde `/register`.

### Requirements

### Requirement: Formulario de registro

La pantalla, con el título «Crea tu cuenta» dentro del marco «FlowSync», muestra los campos «Nombre completo (opcional)», «Email», «Contraseña» (con la ayuda «Entre 8 y 32 caracteres.») y «Repite la contraseña», un botón «Crear cuenta» y un enlace «Inicia sesión» a `/login`. El formulario desactiva la validación nativa del navegador (`noValidate`).

### Scenario: Contraseñas distintas en cliente

- **WHEN** se envía el formulario con «Contraseña» y «Repite la contraseña» distintas
- **THEN** se muestra «Las contraseñas no coinciden.» bajo «Repite la contraseña» y no se llama al backend

### Scenario: Envío del registro

- **WHEN** se envía el formulario con las contraseñas iguales
- **THEN** se llama a `signup` con el nombre recortado de espacios (o `null` si queda vacío), el email, la contraseña y su confirmación, y el botón muestra «Creando cuenta…» desactivado mientras dura la petición

### Scenario: Registro correcto

- **WHEN** el backend acepta el registro
- **THEN** se inicia la sesión y, al pasar a `authenticated`, la ruta solo pública redirige a `/profile`

### Scenario: Errores del backend en el registro

- **WHEN** el backend rechaza el registro
- **THEN** los errores se muestran según «Manejo de errores en formularios»; un error de contraseña sustituye a la ayuda «Entre 8 y 32 caracteres.»

---

## Purpose: Pantalla de inicio de sesión

Permitir entrar con una cuenta existente desde `/login`.

### Requirements

### Requirement: Formulario de inicio de sesión

La pantalla, con el título «Inicia sesión» dentro del marco «FlowSync», muestra los campos «Email» y «Contraseña», un botón «Entrar» y un enlace «Crea una» a `/register`. El formulario desactiva la validación nativa del navegador (`noValidate`).

### Scenario: Envío del login

- **WHEN** se envía el formulario
- **THEN** se llama a `login` con el email y la contraseña, y el botón muestra «Entrando…» desactivado mientras dura la petición

### Scenario: Login correcto

- **WHEN** el backend acepta las credenciales
- **THEN** se inicia la sesión y la ruta solo pública redirige a `/profile`

### Scenario: Credenciales incorrectas en pantalla

- **WHEN** el backend responde 400
- **THEN** se muestra el aviso «El email o la contraseña no son correctos.»

### Scenario: Sesión anterior perdida

- **WHEN** se llega al login con un `sessionError` (token rechazado o backend inaccesible durante la rehidratación) y no hay error del intento actual
- **THEN** se muestra el `sessionError` como aviso; si hay un error del intento actual, se muestra ese en su lugar

---

## Purpose: Pantalla de perfil

Mostrar los datos del usuario autenticado en `/profile` y permitirle cerrar sesión.

### Requirements

### Requirement: Datos del perfil

La pantalla muestra un círculo con las `initials` del usuario, su `fullName` (o «Sin nombre» si es nulo), su `email` y la fila «Miembro desde» con `createdAt` formateado en `es-ES` con estilo de fecha largo.

### Scenario: Usuario con nombre

- **WHEN** el usuario autenticado tiene `fullName`
- **THEN** se muestra su nombre como título de la tarjeta

### Scenario: Usuario sin nombre

- **WHEN** el usuario autenticado tiene `fullName` nulo
- **THEN** se muestra «Sin nombre» como título de la tarjeta

### Requirement: Cierre de sesión desde el perfil

### Scenario: Pulsar «Cerrar sesión»

- **WHEN** se pulsa el botón «Cerrar sesión»
- **THEN** el botón pasa a «Cerrando sesión…» desactivado, se ejecuta `logout` y, al quedar la sesión `anonymous`, la ruta protegida redirige a `/login`
