# Estado actual de FlowSync

Resumen de las capacidades ya construidas (rama base `s2/start`, 2026-09-27).

Lo que existe hoy es **solo autenticación**: registro, login, perfil y logout. Todavía no hay nada del dominio de gestión de tareas: ni tareas, ni equipos, ni proyectos, ni asignaciones.

## Modelo de datos (SQLite)

### `users`

Migración: [`backend/database/migrations/1761885935168_create_users_table.ts`](../backend/database/migrations/1761885935168_create_users_table.ts)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | integer, autoincremental | clave primaria |
| `full_name` | string | opcional |
| `email` | string(254) | obligatorio y **único** |
| `password` | string | se guarda con hash |
| `created_at` / `updated_at` | timestamp | |

### `auth_access_tokens`

Migración: [`backend/database/migrations/1768620764696_create_access_tokens_table.ts`](../backend/database/migrations/1768620764696_create_access_tokens_table.ts)

- `tokenable_id` apunta a `users.id`; si se borra el usuario, se borran sus tokens.
- Otras columnas: `type`, `name`, `hash`, `abilities`, `last_used_at`, `expires_at` (opcional).

### Modelo `User`

Fichero: [`backend/app/models/user.ts`](../backend/app/models/user.ts)

- Extiende el esquema generado y añade el login por email y password (`withAuthFinder`) y los access tokens (`DbAccessTokensProvider`).
- Tiene un campo calculado `initials`: las iniciales del nombre, o del email si no hay nombre.
- No tiene relaciones con otras tablas.

## Endpoints (`/api/v1`)

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| GET | `/` (fuera de `/api/v1`) | no | Devuelve `{ hello: 'world' }` (ruta de prueba) |
| POST | `/auth/signup` | no | Crea el usuario y devuelve `{ user, token }` |
| POST | `/auth/login` | no | Comprueba las credenciales y devuelve `{ user, token }` |
| GET | `/account/profile` | Bearer | Devuelve el usuario autenticado |
| POST | `/account/logout` | Bearer | Revoca el token actual |

- **Validación** ([`backend/app/validators/user.ts`](../backend/app/validators/user.ts)):
  - Email válido de máximo 254 caracteres, y único al registrarse.
  - Password de 8 a 32 caracteres, con `passwordConfirmation` que debe coincidir.
  - `fullName` puede ser `null`.
- **Respuestas:** van envueltas en `{ data }` y el usuario sale por `UserTransformer` con `id, fullName, email, initials, createdAt, updatedAt`.
- **Excepción:** `logout` devuelve `{ message }` directamente, sin pasar por `serialize()`, así que se sale de la convención del proyecto.

## Frontend (React 19 + Vite + Tailwind v4 + shadcn/ui)

- **Páginas:**
  - `/login` y `/register`: solo para usuarios sin sesión.
  - `/profile`: requiere sesión.
  - Cualquier otra ruta redirige a `/profile`.
- **Autenticación** ([`frontend/src/auth/`](../frontend/src/auth/)):
  - El token se guarda en `localStorage` bajo la clave `flowsync.token`.
  - Al arrancar, la sesión se recupera llamando a `GET /account/profile`.
  - Hay hooks `useAuth` y `useAuthForm`.
- **Cliente de API** ([`frontend/src/lib/api.ts`](../frontend/src/lib/api.ts)):
  - Expone `signup`, `login`, `getProfile` y `logout`.
  - Traduce los errores de validación a `ApiError`, con mensajes en castellano y errores por campo.
- **Tipos** ([`frontend/src/lib/types.ts`](../frontend/src/lib/types.ts)): copian a mano lo que devuelve el backend; no se usa el registro Tuyau generado.
- **Componentes UI:** `alert`, `button`, `card`, `input`, `label`, más `auth-layout`, `field-error` y `full-screen-loader`.

## Lo que falta

- **Tests:** no hay ninguno. En el backend solo existe `tests/bootstrap.ts` y en el frontend no hay runner de tests.
- **Tokens:** se crean sin fecha de expiración.
- **Sesión web:** el guard `web` está configurado pero no se usa.
- **Dominio:** no hay modelos, rutas ni pantallas de tareas o equipos.
