# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Añadido

- Filtro por mes: `GET /api/gastos?mes=AAAA-MM` devuelve solo los gastos de ese mes. Sin `mes` se mantiene el comportamiento anterior (todos los gastos).
- Selector de mes en la pantalla de gastos. Empieza en el mes actual, permite ir al anterior y al siguiente, y no avanza más allá del mes actual.
- Mensaje «No hay gastos en <mes>» cuando el mes elegido no tiene gastos.
- `GET /api/gastos?mes=…` responde `400` con `ProblemDetail` y `errores.mes` si el mes está mal formado o el año está fuera de `0001..9999`.
- `GET /api/gastos/resumen?mes=AAAA-MM` devuelve el total y el número de gastos por categoría del mes, de mayor a menor importe. Un mes sin gastos responde `[]`. Sin `mes` o con `mes` mal formado responde `400` con `errores.mes`.
- Bloque «Resumen de <mes>» en la pantalla de gastos: una barra por categoría con gastos, con su importe, su número de gastos y su porcentaje (los porcentajes suman 100 %). Se actualiza al cambiar de mes y al crear, editar o borrar un gasto.
- Aviso al guardar un gasto (alta o edición) cuya fecha cae en otro mes del que se ve: «Guardado en <mes>.» con un botón para ir a ese mes. Si ese mes es posterior al último seleccionable, el aviso pide recargar la página. Se cierra con «×», al cambiar de mes o al iniciar otro guardado.
- `GET /api/gastos/export?mes=AAAA-MM` descarga los gastos del mes en CSV (`gastos-AAAA-MM.csv`): UTF-8 con BOM, separador `;`, fin de línea CRLF y columnas `fecha;categoria;importe;nota`. Sin `mes` o con `mes` mal formado responde `400` con `errores.mes`.
- Botón «Exportar CSV» junto al selector de mes en la pantalla de gastos. Descarga el mes elegido, también cuando no tiene gastos (solo cabecera).
- Las notas y categorías que empiezan por `=`, `+`, `-`, `@`, tabulador o retorno de carro llevan un `'` delante en el CSV para que Excel y Google Sheets no las traten como fórmulas. Las que contienen `;`, `,`, comillas o saltos de línea van entre comillas.

### Cambiado

- `GET /api/gastos/{id}` con un id no numérico responde `400` con `errores.id` («Valor no válido»). Antes, el `400` era genérico.
- Al guardar un gasto, la lista se recarga con el mes elegido.
- Pantalla de gastos: el resumen va bajo el formulario, junto a la lista. En móvil, el orden es formulario, resumen y lista.

## [0.1.0] - 2026-11-04

- Esqueleto inicial (PR #1): CRUD de gastos con categorías fijas (Vivienda, Comida, Transporte, Salud, Ocio, Otros).
- Stack: Spring Boot 4.2.0-RC1, Angular 22 y PostgreSQL 17.
- Docker Compose con los puertos publicados solo en `127.0.0.1`.
- Acciones del CI actualizadas para usar Node 24 (PR #2).
