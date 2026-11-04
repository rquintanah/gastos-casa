# CLAUDE.md — Reglas del repositorio

> Reglas del **Equipo 1 · Desarrollo de Software con IA** para este repo. Estas reglas **no se negocian**:
> si una tarea choca con ellas, el agente se detiene y pregunta.

## 1. Proyecto
- Nombre: `gastos-casa` (repo público en GitHub)
- Qué hace (2 líneas): Registro de gastos personales (fecha, importe, categoría y nota).
  Muestra un resumen mensual con el total por categoría.
- Usuarios / cliente: solo Raul, en uso personal y local con `docker compose`. **Sin login ni cuentas**.
- Decisiones de dominio:
  - Moneda única: **sol peruano (PEN)**. Importes con 2 decimales, siempre mayores que 0:
    `BigDecimal` en Java, `NUMERIC(12,2)` en PostgreSQL. Nunca `double` ni `float` para dinero.
  - Categorías: **lista fija** cargada por migración (Vivienda, Comida, Transporte, Salud, Ocio, Otros).
    No se editan desde la app; hacerlo editable sería un issue aparte.
  - Al no haber autenticación, la app solo se expone en `localhost`. Añadir login o exponerla a internet
    es un cambio de seguridad y requiere un plan aprobado (regla 4).
  - Repo público: nunca commitear datos reales de gastos ni credenciales. Los datos de ejemplo son ficticios.

## 2. Stack
- Backend: Java 17, **Spring Boot 4.2.0-RC1** (decisión de Raul; pasar a 4.2.0 final cuando salga), Maven (`./mvnw`).
  Spring Boot 4 usa starters por módulo (`spring-boot-starter-webmvc`, `-flyway`, …), Jackson 3 (`tools.jackson`) y Testcontainers 2
- Frontend: Angular (standalone components, signals, zoneless, atomic design)
- Datos: PostgreSQL, sin otros almacenes. Migraciones versionadas (el arquitecto propone la herramienta en el plan del esqueleto)
- Mensajería: ninguna
- Infra: Docker + docker compose · CI: GitHub Actions · Despliegue: manual (`scripts/desplegar.sh`)

## 3. Comandos (el agente usa SOLO estos para compilar/probar)
| Acción | Comando |
|---|---|
| Compilar backend | `./mvnw -q -DskipTests package` (en `/backend`) |
| Tests backend (unitarios + API contra PostgreSQL con Testcontainers; necesita Docker) | `./mvnw -q test` (en `/backend`) |
| Frontend: instalar | `npm ci` (en `/frontend`) |
| Frontend: tests | `npm run test -- --watch=false` (en `/frontend`) |
| Frontend: lint | `npm run lint` (en `/frontend`) |
| Frontend: build | `npm run build` (en `/frontend`) |
| Levantar todo local | `docker compose up -d --build` → http://localhost:4200 (necesita `.env`, ver `.env.example`) |
| Solo la BD para desarrollo | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db` |

Nota: el repo está en `/mnt/d` (NTFS). Git no guarda allí el bit de ejecución (`core.filemode=false`): un script
nuevo se marca con `git update-index --chmod=+x <archivo>`. Arrancar el contexto de Spring en los tests es lento en
`/mnt/d` (más de 1 minuto); en CI es más rápido.

## 4. Reglas no negociables
1. **Nunca** hacer `git push` a `main`/`master`, ni `merge`, ni `push --force`. Todo entra por Pull Request y lo aprueba un humano.
2. **Nunca** leer, imprimir ni commitear secretos (`.env`, `*.pem`, `application-prod.yml`, tokens). Las credenciales van en variables de entorno / Secrets.
3. Todo cambio de comportamiento lleva test. Sin test verde no hay PR.
4. Cambios de **esquema de BD**, **contratos de API públicos** o **seguridad/autenticación** requieren plan aprobado por el humano antes de escribir código.
5. Arquitectura backend: `controller → service → repository`. Los controllers no tienen lógica de negocio. DTOs con `record`. Validación con Bean Validation.
6. Frontend: componentes standalone, estado con signals, sin `NgModule` nuevos, sin `any`.
7. No agregar dependencias nuevas sin justificarlo en el PR.
8. Commits en español, formato Conventional Commits: `feat: …`, `fix: …`, `refactor: …`, `test: …`, `docs: …`.
9. Si no estás seguro, **pregunta**. Inventar una API, una tabla o un requisito es peor que detenerse.

## 5. Cómo trabaja el equipo
- Para una funcionalidad nueva usa la skill **`nueva-feature`**. Para un bug, **`corregir-bug`**.
- Delegación: `arquitecto` planifica · `backend-java`, `frontend-angular`, `datos` construyen · `qa` prueba · `seguridad` audita · `documentador` cierra.
- Antes de abrir PR: skill **`revision-cruzada`** (Codex revisa lo que hizo Claude).
- Al terminar la sesión: skill **`cierre-sesion`** (escribe en el cerebro lo aprendido).

## 6. Memoria (segundo cerebro)
- Vault de Obsidian: `/mnt/d/ProyectosIA/software/cerebro` (en Windows: `D:\ProyectosIA\software\cerebro`).
- **Al arrancar**: lee `00-Indice.md` y las notas de `aprendizajes/` con la etiqueta de este proyecto.
- **Al terminar**: la skill `cierre-sesion` deja una nota en `sesiones/`.

## 7. Definición de terminado
- [ ] Compila y pasan todos los tests
- [ ] Lint limpio
- [ ] Revisión de `seguridad` sin hallazgos críticos
- [ ] Revisión cruzada de Codex atendida (aceptada o rechazada con razón)
- [ ] PR con descripción, cómo probar y riesgos
- [ ] Nota de sesión en el cerebro
