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
| GET | `/api/gastos` | Gastos, del más reciente al más antiguo |
| GET | `/api/gastos/{id}` | Un gasto |
| POST | `/api/gastos` | Crear: `{fecha, importe, categoriaId, nota?}` |
| PUT | `/api/gastos/{id}` | Editar |
| DELETE | `/api/gastos/{id}` | Borrar |

Los errores siguen el formato RFC 9457 (`ProblemDetail`); en las validaciones, el campo `errores` indica qué falló en cada campo.
Diseño completo: [`docs/planes/2026-11-04-esqueleto.md`](docs/planes/2026-11-04-esqueleto.md).
