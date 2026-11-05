# gastos-casa

Registro de gastos personales en soles (PEN): fecha, importe, categoría y nota, con el total de lo registrado.
Proyecto piloto del equipo de desarrollo con IA. Es de uso personal y local, **sin login**: no lo expongas a internet.

## Stack
- **Backend**: Java 17, Spring Boot 4.2.0-RC1, Spring Data JPA, Flyway, PostgreSQL 17 (`backend/`)
- **Frontend**: Angular 22 (standalone, signals, zoneless), Vitest, angular-eslint (`frontend/`)
- **Infra**: Docker Compose; nginx sirve el frontend y hace de proxy de `/api`

## Arrancar con Docker
```bash
cp .env.example .env              # y cambia POSTGRES_PASSWORD
docker compose up -d --build
```
Abre http://localhost:4200. Para pararlo: `docker compose down` (los datos se quedan en el volumen `gastos-casa_datos`).

## Exportar a CSV
En la pantalla de gastos, el botón **Exportar CSV** (junto al selector de mes) descarga `gastos-AAAA-MM.csv` con los gastos del mes elegido. Lo mismo desde la API:
```bash
curl -OJ "http://localhost:4200/api/gastos/export?mes=2026-11"
```

El archivo tiene:
- **Codificación** UTF-8 con BOM (los acentos se leen bien en Excel), **separador `;`** y fin de línea CRLF.
- **Cabecera** `fecha;categoria;importe;nota` y una fila por gasto, de la fecha más antigua a la más reciente. Sin gastos, solo la cabecera.
- **Fecha** `AAAA-MM-DD` e **importe** con punto decimal y 2 decimales.
- **Entre comillas** los campos con `;`, `,`, comillas o saltos de línea (las comillas dentro se duplican).
- **Prefijo `'`** en las notas (y categorías) que empiezan por `=`, `+`, `-`, `@`, tabulador o retorno de carro. Evita que Excel o Google Sheets las ejecuten como fórmulas. El apóstrofo se ve en la celda: es esperado.

El CSV contiene tus gastos reales: no lo subas al repositorio ni lo compartas.

### Abrirlo en Excel
Si con doble clic todo cae en una sola columna, es la configuración regional: con es-PE el separador de listas suele ser `,`, no `;`. No hace falta cambiar Windows. Desde Excel:
1. Abre un libro en blanco y ve a **Datos › Desde texto/CSV**.
2. Elige `gastos-AAAA-MM.csv`.
3. En **Origen del archivo**, elige **UTF-8**; en **Delimitador**, **Punto y coma**.
4. Pulsa **Cargar**.

En Google Sheets: **Archivo › Importar › Subir**, elige el archivo y, si las columnas no se separan, indica **Punto y coma** como separador.

## Desarrollo
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db   # PostgreSQL en 127.0.0.1:5432
cd backend && ./mvnw spring-boot:run                                         # API en :8080 (lee ../.env)
cd frontend && npm ci && npm start                                           # http://localhost:4200, proxy /api → :8080
```

## Tests
```bash
cd backend && ./mvnw test                                  # necesita Docker (Testcontainers)
cd frontend && npm run lint && npm run test -- --watch=false
```

## API
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/categorias` | Categorías fijas |
| GET | `/api/gastos` | Gastos, del más reciente al más antiguo (`?mes=AAAA-MM` para filtrar por mes) |
| GET | `/api/gastos/export` | CSV de los gastos del mes (`?mes=AAAA-MM`, obligatorio): `gastos-AAAA-MM.csv` |
| GET | `/api/gastos/resumen` | Total y número de gastos por categoría del mes (`?mes=AAAA-MM`, obligatorio) |
| GET | `/api/gastos/{id}` | Un gasto |
| POST | `/api/gastos` | Crear: `{fecha, importe, categoriaId, nota?}` |
| PUT | `/api/gastos/{id}` | Editar |
| DELETE | `/api/gastos/{id}` | Borrar |

Los errores siguen el formato RFC 9457 (`ProblemDetail`); en las validaciones, el campo `errores` indica qué falló en cada campo.
Diseño completo: [`docs/planes/2026-11-04-esqueleto.md`](docs/planes/2026-11-04-esqueleto.md).
