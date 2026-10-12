import Task from '#models/task'
import User from '#models/user'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * Lo que una tarea enseña de su responsable. Cubre los tres scenarios del
 * requisito «Lo que cada tarea muestra de su responsable» de
 * `openspec/specs/tasks/spec.md`: nombre e iniciales para identificarlo, nada
 * más de su cuenta, y una cuenta sin nombre que sigue siendo representable.
 */
test.group('Tasks | responsable', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const today = '2026-10-11'

  async function tareaDe(fullName: string | null) {
    const user = await User.create({ fullName, email: 'ada@example.com', password: 'secreto123' })
    const task = await Task.create({
      title: 'Revisar el informe',
      status: 'pending',
      assigneeId: user.id,
    })

    return { user, task }
  }

  /**
   * El `assignee` de la tarea que trae una respuesta, venga suelta o como
   * primera (y única) de la lista.
   */
  function responsable(response: { body(): any }) {
    const data = response.body().data
    return (Array.isArray(data) ? data[0] : data).assignee
  }

  test('el responsable llega identificable por su nombre y sus iniciales', async ({
    client,
    assert,
  }) => {
    const { user, task } = await tareaDe('Ada Lovelace')

    const lista = await client.get('/api/v1/tasks').loginAs(user)
    const suelta = await client.get(`/api/v1/tasks/${task.id}`).qs({ today }).loginAs(user)

    lista.assertStatus(200)
    suelta.assertStatus(200)

    for (const assignee of [responsable(lista), responsable(suelta)]) {
      assert.equal(assignee.fullName, 'Ada Lovelace')
      assert.equal(assignee.initials, 'AL')
    }
  })

  test('ninguna respuesta con tareas expone el email ni otro dato de la cuenta', async ({
    client,
    assert,
  }) => {
    const { user, task } = await tareaDe('Ada Lovelace')

    const respuestas = {
      'GET /tasks': await client.get('/api/v1/tasks').loginAs(user),
      'GET /tasks/:id': await client.get(`/api/v1/tasks/${task.id}`).qs({ today }).loginAs(user),
      'POST /tasks': await client.post('/api/v1/tasks').json({ title: 'Otra' }).loginAs(user),
      'PATCH /tasks/:id/status': await client
        .patch(`/api/v1/tasks/${task.id}/status`)
        .json({ status: 'in_progress' })
        .loginAs(user),
      'PUT /tasks/:id/due-date': await client
        .put(`/api/v1/tasks/${task.id}/due-date`)
        .json({ today, dueDate: null })
        .loginAs(user),
    }

    // Se recogen todas antes de comparar para que un fallo diga en qué rutas
    // se escapa la cuenta, y no solo en la primera.
    const clavesPorRuta = Object.fromEntries(
      Object.entries(respuestas).map(([ruta, response]) => [
        ruta,
        Object.keys(responsable(response)).sort(),
      ])
    )

    const esperadas = ['fullName', 'id', 'initials']
    assert.deepEqual(
      clavesPorRuta,
      Object.fromEntries(Object.keys(respuestas).map((ruta) => [ruta, esperadas]))
    )
  })

  test('un responsable sin nombre llega con el nombre nulo y con iniciales', async ({
    client,
    assert,
  }) => {
    const { user, task } = await tareaDe(null)

    const lista = await client.get('/api/v1/tasks').loginAs(user)
    const suelta = await client.get(`/api/v1/tasks/${task.id}`).qs({ today }).loginAs(user)

    lista.assertStatus(200)
    suelta.assertStatus(200)

    for (const assignee of [responsable(lista), responsable(suelta)]) {
      assert.isNull(assignee.fullName)
      assert.isString(assignee.initials)
      assert.isNotEmpty(assignee.initials)
    }
  })
})
