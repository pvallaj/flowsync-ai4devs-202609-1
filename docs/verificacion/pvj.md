# Matriz de trazabilidad: «Lo que cada tarea muestra de su responsable»

Alcance: **solo** el requisito «Lo que cada tarea muestra de su responsable» de [openspec/specs/tasks/spec.md](../../openspec/specs/tasks/spec.md#L97-L114) (idéntico al de [`add-task-list`](../../openspec/changes/archive/2026-08-13-add-task-list/specs/tasks/spec.md#L93-L110), ya archivado).

> El sistema SHALL acompañar cada tarea del nombre y las iniciales de su responsable, lo justo para identificarlo en la lista, y NO SHALL exponer junto a la tarea ningún otro dato de esa cuenta, en particular su email.

Tests revisados: todo [backend/tests/](../../backend/tests/). Solo existen los cuatro ficheros de [backend/tests/functional/auth/](../../backend/tests/functional/auth/); no hay `tests/unit/`, ningún test llama a `/api/v1/tasks` y el frontend no tiene runner de tests.

## Matriz

| Escenario | Test que lo cubre | Estado | Qué faltó para decidir |
|---|---|---|---|
| **Responsable identificable** — se obtiene una tarea cuyo responsable se llama "Ada Lovelace" → su `assignee` trae el nombre y sus iniciales | Ninguno. [initials.spec.ts](../../backend/tests/functional/auth/initials.spec.ts) comprueba las iniciales `AL` de "Ada Lovelace", pero en la respuesta de `POST /auth/login`, no en el `assignee` de una tarea. | ❌ No está cubierto | — |
| **La tarea no filtra datos de cuenta** — se obtiene cualquier tarea, suelta o en la lista → su `assignee` no incluye el email ni otro dato de acceso | Ninguno. | ❌ No está cubierto | — |
| **Responsable sin nombre** — el responsable se registró sin nombre → su nombre llega nulo y sus iniciales siguen llegando | Ninguno. [initials.spec.ts](../../backend/tests/functional/auth/initials.spec.ts) («sin nombre, las iniciales salen del email») cubre el cálculo de iniciales de una cuenta sin nombre, pero vía login, no vía tarea. | ❌ No está cubierto | — |

**Resumen:** 3 escenarios · 0 cubiertos · 3 no cubiertos · 0 «no lo sé».

## Observación: el segundo escenario no solo carece de test, el código lo incumple

Leyendo el código para buscar la cobertura aparece un fallo que un test del segundo escenario detectaría:

- [task_transformer.ts](../../backend/app/transformers/task_transformer.ts) serializa el `assignee` con `UserTransformer`, que incluye `email`, `createdAt` y `updatedAt` ([user_transformer.ts](../../backend/app/transformers/user_transformer.ts)). Lo usan `GET /api/v1/tasks` (la lista), `POST /api/v1/tasks` y `PATCH /api/v1/tasks/:id/status` ([tasks_controller.ts](../../backend/app/controllers/tasks_controller.ts), [task_statuses_controller.ts](../../backend/app/controllers/task_statuses_controller.ts)). El cambio entró en `0aa5af7 refactor(tasks): reutilizar UserTransformer y no duplicar la forma del usuario`.
- Solo `GET /api/v1/tasks/:id` y `PATCH /api/v1/tasks/:id/due-date` usan [task_detail_transformer.ts](../../backend/app/transformers/task_detail_transformer.ts), que sí recorta el `assignee` a `id`, `fullName` e `initials` mediante [task_assignee_transformer.ts](../../backend/app/transformers/task_assignee_transformer.ts).

El [design.md de `add-task-list`](../../openspec/changes/archive/2026-08-13-add-task-list/design.md) ya avisaba de este riesgo: «la regresión más probable —que el responsable acabe filtrando el email al cliente— no la va a detectar nada automático».

## Tests que harían falta

Un fichero `backend/tests/functional/tasks/assignee.spec.ts`, aislado con `testUtils.db().withGlobalTransaction()` como los de `auth`:

1. **Responsable identificable:** crear una cuenta "Ada Lovelace" y una tarea suya; comprobar que `assignee.fullName === 'Ada Lovelace'` y `assignee.initials === 'AL'` en `GET /tasks` y en `GET /tasks/:id`.
2. **No filtra datos de cuenta:** en las respuestas de `GET /tasks`, `GET /tasks/:id`, `POST /tasks`, `PATCH /tasks/:id/status` y `PATCH /tasks/:id/due-date`, comprobar que las claves de `assignee` son exactamente `id`, `fullName` e `initials`. Hoy fallaría en `GET /tasks`, `POST /tasks` y `PATCH /tasks/:id/status`, las tres que usan `TaskTransformer`.
3. **Responsable sin nombre:** crear una cuenta sin `fullName` y una tarea suya; comprobar que `assignee.fullName` es `null` y que `assignee.initials` no está vacío.
