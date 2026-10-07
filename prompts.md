# Prompts

Aquí van **todos los prompts que lanzaste** para hacer el ejercicio, en el orden en que los
lanzaste, con el modelo y la herramienta de cada uno.

Esto no es papeleo. Lo que se revisa es **cómo pediste las cosas**, no solo lo que salió: un
resultado flojo con un prompt bueno y un resultado flojo con un prompt vago necesitan feedback
distinto, y sin este archivo no se distinguen.

## Cómo rellenarlo

- Un apartado `## Prompt N` por cada prompt.
- **Pega el prompt tal cual lo lanzaste**, dentro del bloque de código, aunque ocupe diez líneas
  y aunque tenga faltas. No lo reescribas para que quede bien: el que arreglaste mentalmente
  después no es el que lanzaste.
- Incluye también los que **no funcionaron**. Suelen ser los más útiles de leer.
- `Modelo` y `Herramienta` en todos. Si cambiaste de una a otra a mitad, se nota aquí.

Borra el ejemplo de abajo cuando escribas el primero.

---

## Prompt 1

**Modelo:** Opus 5.5 medium
**Herramienta:** Claude Code

```
Este es el ejemplo. Bórralo.

Crea un documento llamado especificaciones-pvj.md con las especificaciones de este proyecto.
dividelo en 2 grupos principale Backend y frontend.
Cada funcionalidad que encuentrs describelas con el siguiente formato:
La etiqueta : "## Purpose" para definir una capacidad.
La etiqueta : "### Requirements" para agrupar los requisitos.
La etiqueta : "### Requirement" para definir un requisito del sistema.
    - Cada requisito debe contener:
        - "### Scenario: " para describir un escenario con el formato:
            "**WHEN**" para describir un escenario 
            "**THEN**" para especificar lo que pasa cuando ocurre el esnecario especifico.

El documento debe estár en espeñol, salvo las etiquetas especificadas.
Se debe decribir lo que actualemente hace el sistema.
Se deven evitar supuestos o mejoras.

```

**Qué salió:** 
EL documento especificaciones-pvj.md
