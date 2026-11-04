# Plan: esqueleto de gastos-casa

## Objetivo
Dejar un esqueleto que compile, pase los tests y se levante con `docker compose up -d`. Incluye el primer
caso de uso real: **registrar, listar, editar y borrar gastos** con categorías fijas.
Es la base sobre la que se harán los issues de la Fase 5 (filtro por mes, gráfica y exportar a CSV).

## Alcance / Fuera de alcance
**Dentro**
- `backend/`: Spring Boot con API REST de gastos y categorías, migraciones y tests.
- `frontend/`: Angular con una página que lista los gastos y un formulario para crearlos y editarlos.
- `docker-compose.yml` con PostgreSQL, backend y frontend, publicados **solo en 127.0.0.1**.
- `.env.example`, `.gitignore` completo y `README.md` con cómo arrancar.
- Ajuste de `ci.yml` si hace falta para que el CI termine en verde.

**Fuera** (issues de la Fase 5 o posteriores)
- Filtro por mes, resumen mensual, gráfica y exportación a CSV.
- Login, despliegue en servidor y edición de categorías.
- Paginación: el piloto tendrá pocos gastos. Se lista todo ordenado por fecha descendente, y paginar
  queda como mejora si hace falta.

## Diseño

### Versiones (comprobadas el 2026-11-04)
| Pieza | Versión | Motivo |
|---|---|---|
| Java | 17 | Decisión del stack |
| Spring Boot | **4.2.0-RC1** (decisión de Raul, 2026-11-04) | Versión candidata: pasar a 4.2.0 en cuanto salga la versión final. Trae Spring Framework 7.1.0-RC1, Hibernate 7.4, Jackson 3.1, Flyway 12.11, Testcontainers 2.0.5 y JUnit 6.1 |
| Angular | **22.2.x** (CLI 22.2.5 instalado) | Standalone, signals y zoneless por defecto |
| PostgreSQL | **17-alpine** | Versión madura; 18 es muy reciente y no hace falta para el piloto |
| Node en CI | `lts/*` (ya en `ci.yml`) | Angular 22 acepta Node ^22.22.3, ^24.15 o >= 26 |

### Backend (`backend/`, paquete `com.rquintanah.gastoscasa`)
Dependencias (Spring Boot 4 divide la autoconfiguración en módulos, cada uno con su starter):
- `spring-boot-starter-webmvc`, `-data-jpa`, `-validation`, `-flyway` y `-actuator` (solo `health`).
- `flyway-database-postgresql` y el driver `org.postgresql:postgresql`.
- Tests: `spring-boot-starter-webmvc-test`, `-data-jpa-test`, `spring-boot-testcontainers` y
  `org.testcontainers:testcontainers-postgresql` + `testcontainers-junit-jupiter` (2.x: el contenedor es
  `org.testcontainers.postgresql.PostgreSQLContainer`) con `@ServiceConnection`.
- JSON con Jackson 3 (paquete `tools.jackson`). Si hiciera falta configurarlo, que no se cuelen imports de `com.fasterxml.jackson.databind`.

Estructura por capas (regla 5): `controller → service → repository`. Los DTO son `record`.

| Método | Ruta | Request | Response |
|---|---|---|---|
| GET | `/api/categorias` | — | `200 [CategoriaDto{id, nombre}]` ordenado por nombre |
| GET | `/api/gastos` | — | `200 [GastoDto{id, fecha, importe, categoria{id,nombre}, nota}]` ordenado por fecha desc, id desc |
| GET | `/api/gastos/{id}` | — | `200 GastoDto` · `404` |
| POST | `/api/gastos` | `GastoRequest{fecha, importe, categoriaId, nota?}` | `201 GastoDto` + `Location` · `400` |
| PUT | `/api/gastos/{id}` | `GastoRequest` | `200 GastoDto` · `400` · `404` |
| DELETE | `/api/gastos/{id}` | — | `204` · `404` |

Validación de `GastoRequest` con Bean Validation:
- `fecha` obligatoria y no posterior a hoy (`@PastOrPresent`).
- `importe` obligatorio, `@DecimalMin(value="0.01")` y `@Digits(integer=10, fraction=2)`.
- `categoriaId` obligatorio y debe existir; si no existe, la respuesta es `400`.
- `nota` opcional, como máximo 500 caracteres.

Errores con `ProblemDetail` (RFC 9457) en un `@RestControllerAdvice`: `400` con los campos inválidos y `404`.

Importes: `BigDecimal` en todo el backend; en JSON salen como número con 2 decimales.
Las fechas son ISO `yyyy-MM-dd` (`LocalDate`) y no se usa zona horaria.

### Frontend (`frontend/`, creado con `ng new`)
- Rutas: `/` redirige a `/gastos`.
- Componentes (atomic design):
  - Átomo `importe-pen`: formatea en soles con `Intl`/`CurrencyPipe` y `es-PE`.
  - Molécula `gasto-form`: formulario reactivo con las mismas validaciones que el backend.
  - Organismo `gastos-tabla`: tabla con las acciones editar y borrar.
  - Página `gastos-page`.
- Estado con signals en `GastosStore` (servicio): `gastos`, `categorias`, `cargando` y `error`.
  Llamadas con `HttpClient`, sin NgRx.
- Desarrollo: `ng serve` con `proxy.conf.json` (`/api` → `http://localhost:8080`), así que no hace falta CORS.
- Lint con `angular-eslint` (`ng add`), porque `ci.yml` ejecuta `npm run lint`. Tests con el runner por defecto de Angular 22.
- Sin librerías de componentes: CSS propio y sencillo. Ver decisión abierta 3.

### Datos
Migraciones con **Flyway** en `backend/src/main/resources/db/migration`.

`V1__esquema_inicial.sql`:
```sql
CREATE TABLE categoria (
  id      SMALLINT PRIMARY KEY,
  nombre  VARCHAR(50) NOT NULL UNIQUE
);
CREATE TABLE gasto (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha         DATE NOT NULL,
  importe       NUMERIC(12,2) NOT NULL CHECK (importe > 0),
  categoria_id  SMALLINT NOT NULL REFERENCES categoria(id),
  nota          VARCHAR(500),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_gasto_fecha ON gasto (fecha DESC);
```
`V2__categorias_iniciales.sql`: inserta (1 Vivienda), (2 Comida), (3 Transporte), (4 Salud), (5 Ocio) y (6 Otros).

**Rollback:** Flyway Community no tiene `undo`. Como es la primera versión y no hay datos reales, el
rollback consiste en `docker compose down -v` (borra el volumen) o en `DROP TABLE gasto, categoria, flyway_schema_history;`.
A partir de aquí, cada migración nueva lleva su script de rollback manual en el plan.

`spring.jpa.hibernate.ddl-auto=validate`: Hibernate comprueba el esquema y nunca lo crea.

### Docker
- `backend/Dockerfile` multietapa: compila con Maven y ejecuta en un JRE 17 con un usuario sin privilegios.
- `frontend/Dockerfile` multietapa: compila con Node y sirve con nginx, que hace de proxy de `/api` → `backend:8080`.
- `docker-compose.yml`:
  - `db`: `postgres:17-alpine`, con volumen con nombre y `healthcheck`. **No publica el puerto por defecto**;
    hay un perfil opcional `dev` que lo publica en `127.0.0.1:5432` para `ng serve` y `./mvnw spring-boot:run`.
  - `backend`: espera a `db` sano y publica `127.0.0.1:8080`.
  - `frontend`: publica `127.0.0.1:4200` → nginx.
  - Credenciales desde `.env` (fuera de git). `.env.example` lleva `POSTGRES_DB`, `POSTGRES_USER` y
    `POSTGRES_PASSWORD=cambia-esto`.

### `.gitignore` (lo que falta hoy)
`.env`, `.env.*` excepto `!.env.example`, `backend/target/`, `frontend/node_modules/`, `frontend/dist/`,
`frontend/.angular/`, `*.log`, `.idea/`, `.vscode/` (salvo lo compartible) y `*.iml`.

## Tareas
| # | Tarea | Subagente | Archivos | Depende de |
|---|---|---|---|---|
| 1 | `.gitignore` completo, `.env.example`, `README.md` | devops | raíz | — |
| 2 | Proyecto Spring Boot + Maven wrapper + `application.yml` | backend-java | `backend/` | 1 |
| 3 | Migraciones V1 y V2 | datos | `backend/src/main/resources/db/migration/` | 2 |
| 4 | Entidades, repositorios, servicios, controllers, DTO y manejo de errores | backend-java | `backend/src/main/java/...` | 3 |
| 5 | Tests backend: servicio (unitario) + controller y repositorio con Testcontainers | backend-java / qa | `backend/src/test/...` | 4 |
| 6 | Proyecto Angular + angular-eslint + proxy | frontend-angular | `frontend/` | 1 |
| 7 | Store, servicio HTTP, componentes y página de gastos + tests | frontend-angular | `frontend/src/app/...` | 6 (contrato de esta sección) |
| 8 | Dockerfiles + `docker-compose.yml` | devops | raíz, `backend/`, `frontend/` | 4, 7 |
| 9 | Ajustar `ci.yml` si hace falta (por ejemplo, `chmod +x mvnw`) | devops | `.github/workflows/ci.yml` | 5, 7 |

Pueden ir en paralelo: **2–5** (backend) y **6–7** (frontend), porque ambos trabajan contra el contrato de la tabla de endpoints.

## Pruebas necesarias
- **Backend:**
  - Crear un gasto válido devuelve `201`.
  - Cada regla de validación devuelve `400` con su campo: importe 0, importe negativo, 3 decimales, fecha futura, categoría inexistente y nota de 501 caracteres.
  - `404` en GET, PUT y DELETE de un id inexistente.
  - El orden del listado es correcto.
  - Flyway aplica V1 y V2 contra PostgreSQL 17 real (Testcontainers) y `ddl-auto=validate` pasa.
- **Frontend:**
  - El store carga gastos y categorías.
  - El formulario bloquea un importe ≤ 0 y una fecha futura.
  - `importe-pen` formatea `1234.5` como `S/ 1,234.50`.
- **Manual (Raul):** `docker compose up -d` y abrir `http://localhost:4200`, crear, editar y borrar un gasto, y comprobar que sigue ahí tras `docker compose restart`.
- **CI:** el PR termina en verde con `mvnw verify` y lint, test y build del frontend.

## Riesgos y decisiones abiertas
1. **Spring Boot 4.2.0-RC1 (versión candidata), elegido por Raul.** Puede tener bugs, y la documentación
   o los ejemplos de terceros pueden estar todavía en 3.x. Si un fallo viene de la RC, se anota en el
   cerebro y se consulta antes de rodearlo. Cuando salga 4.2.0, se abre un PR solo para cambiar la versión.
2. **Paquete Java:** `com.rquintanah.gastoscasa`.
3. **Estilos:** CSS propio y mínimo, sin Angular Material, para no añadir dependencias (regla 7).
4. **Testcontainers en WSL** usa Docker Desktop, que ya funciona. En CI `ubuntu-latest` trae Docker, pero suma alrededor de 1 minuto por ejecución (en un repo público es gratis).
5. **Arreglo en la plantilla:** `equipo/.gitignore.agregar` no incluía `.env`. Se añadieron `.env`, `.env.*`,
   `!.env.example` y certificados y claves (aprobado y probado el 2026-11-04).
6. **ADR:** Flyway + Testcontainers es la primera decisión de arquitectura, así que se registra en
   `cerebro/decisiones/ADR-2026-11-04-flyway-testcontainers.md` cuando apruebes este plan.

## ¿Requiere aprobación humana? **SÍ** — ✅ APROBADO por Raul el 2026-11-04 (con Spring Boot 4.2.0-RC1)
Motivo: crea el **esquema de base de datos** inicial y el **contrato de la API REST** (regla 4).
