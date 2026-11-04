# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Añadido

- Filtro por mes: `GET /api/gastos?mes=AAAA-MM` devuelve solo los gastos de ese mes. Sin `mes` se mantiene el comportamiento anterior (todos los gastos).
- Selector de mes en la pantalla de gastos. Empieza en el mes actual, permite ir al anterior y al siguiente, y no avanza más allá del mes actual.
- Mensaje «No hay gastos en <mes>» cuando el mes elegido no tiene gastos.
- `GET /api/gastos?mes=…` responde `400` con `ProblemDetail` y `errores.mes` si el mes está mal formado o el año está fuera de `0001..9999`.

### Cambiado

- `GET /api/gastos/{id}` con un id no numérico responde `400` con `errores.id` («Valor no válido»). Antes, el `400` era genérico.
- Al guardar un gasto, la lista se recarga con el mes elegido.

## [0.1.0] - 2026-11-04

- Esqueleto inicial (PR #1): CRUD de gastos con categorías fijas (Vivienda, Comida, Transporte, Salud, Ocio, Otros).
- Stack: Spring Boot 4.2.0-RC1, Angular 22 y PostgreSQL 17.
- Docker Compose con los puertos publicados solo en `127.0.0.1`.
- Acciones del CI actualizadas para usar Node 24 (PR #2).
