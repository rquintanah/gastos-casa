# Plan: filtrar gastos por mes (issue #3)

## Objetivo
Ver los gastos **de un mes concreto** (por defecto el actual) con el total de ese mes, navegando al mes
anterior/siguiente. La API gana `GET /api/gastos?mes=AAAA-MM`. El concepto «mes» (parámetro, validación,
rango de fechas y estado en el frontend) queda listo para reutilizarse en #4 (resumen) y #5 (CSV).

## Alcance / Fuera de alcance
**Dentro**
- Backend: parámetro opcional `mes` en `GET /api/gastos`, consulta por rango de fechas, `400` con `ProblemDetail`
  y `errores.mes` si está mal formado.
- Frontend: utilidades de mes, estado del mes seleccionado (servicio con signals), molécula `selector-mes`,
  lista y total del mes, mensaje «No hay gastos en <mes>».
- Tests backend y frontend de lo anterior.

**Fuera**
- #4 (resumen por categoría) y #5 (exportar CSV): solo se deja preparado lo reutilizable.
- Guardar el mes elegido en la URL (`/gastos?mes=…`) o en `localStorage` (ver decisión abierta 2).
- Cambios de esquema de BD (no hacen falta: ya existe `ix_gasto_fecha`).
- Paginación.

## Diseño

### Contrato de API (cambio aditivo, compatible hacia atrás)
| Método | Ruta | Query | Response |
|---|---|---|---|
| GET | `/api/gastos` | — | `200 [GastoDto]`, **todos** (igual que hoy) |
| GET | `/api/gastos` | `mes=` (vacío) | igual que sin `mes` (Spring convierte el texto vacío en `null`) |
| GET | `/api/gastos` | `mes=AAAA-MM` | `200 [GastoDto]` con `fecha ∈ [AAAA-MM-01, primer día del mes siguiente)`, orden `fecha desc, id desc`. Mes sin gastos o **futuro** → `200 []` |
| GET | `/api/gastos` | `mes` mal formado (`2026-13`, `2026-1`, `202611`, `nov-2026`, `2026-11-01`, `abc`) o año fuera de `0001..9999` | `400 application/problem+json` |

Cuerpo del `400` (mismo formato que los errores de `GastoRequest`):
```json
{
  "type": "about:blank",
  "title": "Datos inválidos",
  "status": 400,
  "detail": "Revisa los campos marcados en 'errores'.",
  "instance": "/api/gastos",
  "errores": { "mes": "El mes debe tener el formato AAAA-MM, por ejemplo 2026-11" }
}
```

**Mes futuro: se acepta y devuelve `[]`.** Motivos:
1. Es un filtro de lectura: un mes sin datos es una respuesta válida, no un error del cliente.
2. Rechazarlo obligaría al backend a decidir qué es «hoy». El contenedor corre en UTC y el usuario en
   `America/Lima` (UTC-5): entre las 19:00 y las 24:00 del último día del mes, el servidor ya está en el mes
   siguiente y el navegador no. El límite «no pasar del mes actual» es una regla de **UX** y vive en el frontend.
3. #4 y #5 heredan el mismo comportamiento sin casos especiales (resumen vacío, CSV solo con cabecera).

### Backend (`com.rquintanah.gastoscasa`)
**Conversión del parámetro.** `@RequestParam(name = "mes", required = false) YearMonth mes`. Spring Framework 7.1
ya trae `YearMonthFormatter` (verificado en `spring-context-7.1.0-RC1.jar`), que usa `YearMonth.parse` (ISO `uuuu-MM`).
No hace falta conversor propio ni dependencias nuevas. Un valor no convertible lanza
`MethodArgumentTypeMismatchException`.

**Nuevo `gasto/RangoMes.java`** (reutilizable por #4 y #5):
```java
/** Intervalo semiabierto [desde, hasta) de un mes; aprovecha ix_gasto_fecha. */
public record RangoMes(LocalDate desde, LocalDate hasta) {
    public static final String MENSAJE_FUERA_DE_RANGO = "El mes debe estar entre 0001-01 y 9999-12";
    /** @throws DatoInvalidoException("mes", …) si el año no está en 1..9999 (evita DateTimeException → 500). */
    public static RangoMes de(YearMonth mes) { … mes.atDay(1), mes.plusMonths(1).atDay(1) … }
}
```

**`GastoRepository`** — nuevo método (el actual `findAllByOrderByFechaDescIdDesc` se mantiene):
```java
@EntityGraph(attributePaths = "categoria")
@Query("select g from Gasto g where g.fecha >= :desde and g.fecha < :hasta order by g.fecha desc, g.id desc")
List<Gasto> buscarEntreFechas(@Param("desde") LocalDate desde, @Param("hasta") LocalDate hasta);
```

**`GastoService`** — `listar()` pasa a:
```java
/** Todos los gastos si mes es null; si no, solo los de ese mes. */
public List<GastoDto> listar(YearMonth mes)
```
(`mes == null` → `findAllByOrderByFechaDescIdDesc()`; si no → `RangoMes.de(mes)` + `buscarEntreFechas`).

**`GastoController.listar`** — sin lógica, solo pasa el parámetro:
```java
@GetMapping
public List<GastoDto> listar(@RequestParam(name = "mes", required = false) YearMonth mes) {
    return gastoService.listar(mes);
}
```

**`ManejadorErrores`** — reutilizable para cualquier `@RequestParam`/`@PathVariable` tipado:
```java
static final Map<Class<?>, String> MENSAJES_POR_TIPO = Map.of(
        YearMonth.class, "El mes debe tener el formato AAAA-MM, por ejemplo 2026-11");

@Override
protected ResponseEntity<Object> handleTypeMismatch(
        TypeMismatchException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request)
// campo = (ex instanceof MethodArgumentTypeMismatchException m) ? m.getName() : ex.getPropertyName()
// mensaje = MENSAJES_POR_TIPO.getOrDefault(ex.getRequiredType(), "Valor no válido")
// → ResponseEntity.badRequest().body(problemaValidacion(Map.of(campo, mensaje)))
```
Efecto colateral deseado: un `GET /api/gastos/abc` (id no numérico) pasa a dar `400` con `errores.id = "Valor no válido"`
en vez del `400` genérico actual. El año fuera de rango llega por `DatoInvalidoException("mes", …)`, que ya se maneja.

Nota para #4/#5: si allí `mes` es **obligatorio**, habrá que sobrescribir también
`handleMissingServletRequestParameter` con el mismo formato (`errores.mes = "El mes es obligatorio"`). No se hace ahora
porque ningún endpoint lo necesita todavía y no se podría probar por la API.

### Frontend (`frontend/src/app`)
**`core/mes.ts`** — funciones puras (un mes es un `string` `'AAAA-MM'`, igual que en la API):
```ts
export type Mes = string; // 'AAAA-MM'
export function esMes(valor: string): boolean;              // /^\d{4}-(0[1-9]|1[0-2])$/
export function mesDe(fecha: Date): Mes;                    // mes LOCAL del navegador (getFullYear/getMonth)
export function mesDeFechaIso(fecha: string): Mes;          // '2026-11-04' → '2026-11'
export function sumarMeses(mes: Mes, n: number): Mes;       // aritmética entera, sin Date: '2026-01',-1 → '2025-12'
export function etiquetaMes(mes: Mes): string;              // '2026-11' → 'noviembre 2026'
```
`etiquetaMes` usa `Intl.DateTimeFormat('es-PE', { month: 'long' })` sobre `new Date(año, mes - 1, 1)` (constructor
**local**) y concatena el año. Ojo: `'es'` con `{ month: 'long', year: 'numeric' }` da «noviembre **de** 2026», y
`new Date('2026-11')` se interpreta en UTC (en Lima sería 31 de octubre): no usar ninguna de las dos.

**`core/reloj.ts`** — `export const RELOJ = new InjectionToken<() => Date>('RELOJ', { providedIn: 'root', factory: () => () => new Date() });`
Permite fijar «hoy» en los tests sin fake timers (que romperían el `tick()` con `setTimeout` de los specs actuales).

**`core/mes-seleccionado.ts`** — estado del mes, `providedIn: 'root'` (lo compartirán #4 y #5):
```ts
@Injectable({ providedIn: 'root' })
export class MesSeleccionado {
  readonly maximo: Mes;                         // mesDe(inject(RELOJ)()) al crear el servicio
  readonly mes: Signal<Mes>;                    // asReadonly() de un signal privado; empieza en maximo
  readonly etiqueta = computed(() => etiquetaMes(this.mes()));
  readonly esMaximo = computed(() => this.mes() >= this.maximo);
  /** Cambia de mes; ignora valores mal formados y limita a maximo. */
  ir(mes: Mes): void;
}
```

**`core/gastos-api.ts`** — `listarGastos(mes?: Mes): Observable<Gasto[]>` → `GET /api/gastos` con
`params: mes ? { mes } : {}`.

**`core/gastos-store.ts`** — inyecta `MesSeleccionado`:
- `cargar()` se divide en `cargarCategorias(): Promise<void>` y `cargarGastos(): Promise<void>`.
- `cargarGastos()` pide `listarGastos(this.periodo.mes())` y **descarta la respuesta si el mes cambió** mientras
  tanto (navegación rápida: respuestas fuera de orden).
- `guardar()` recarga con `cargarGastos()`: al crear/editar con fecha de otro mes, el gasto no vuelve en la lista
  (lo filtra el backend). `borrar()` no cambia. `total` (computed) ya es el total del mes.

**Molécula nueva `moleculas/selector-mes/`** (`selector-mes.ts`, `.html`, `.css`, `.spec.ts`), presentacional:
```ts
selector: 'app-selector-mes'
readonly mes = input.required<Mes>();
readonly maximo = input.required<Mes>();
readonly cambiar = output<Mes>();
```
Plantilla: botón «‹» (`aria-label="Mes anterior"`), etiqueta `etiquetaMes(mes())` en un elemento con
`aria-live="polite"`, botón «›» (`aria-label="Mes siguiente"`, `[disabled]="mes() >= maximo()"`).

**Organismo `gastos-tabla`** — nuevo `readonly mensajeVacio = input('Todavía no hay gastos.')` en lugar del texto fijo.

**Página `gastos-page`**:
- Cabecera del panel: `<h2>Gastos</h2>` + `<app-selector-mes [mes]="periodo.mes()" [maximo]="periodo.maximo" (cambiar)="periodo.ir($event)" />`.
- `ngOnInit` → `store.cargarCategorias()`.
- En el constructor, un `effect` que lee `periodo.mes()` y llama `untracked(() => store.cargarGastos())`; también
  limpia `porBorrar`. El primer disparo carga el mes actual.
- `<app-gastos-tabla [mensajeVacio]="'No hay gastos en ' + periodo.etiqueta()" … />`.
- `gasto-form` no cambia (sigue proponiendo la fecha de hoy).

Rutas: sin cambios.

### Datos
Sin cambios de esquema ni migraciones. La consulta por rango usa `ix_gasto_fecha (fecha DESC)`. Rollback: revertir el PR.

## Tareas
| # | Tarea | Subagente | Archivos | Depende de |
|---|---|---|---|---|
| 1 | `RangoMes`, `buscarEntreFechas`, `listar(YearMonth)`, parámetro en el controller, `handleTypeMismatch` | backend-java | `gasto/RangoMes.java` (nuevo), `gasto/GastoRepository.java`, `gasto/GastoService.java`, `gasto/GastoController.java`, `error/ManejadorErrores.java` | — |
| 2 | Tests backend: `RangoMesTest` (unitario) y casos nuevos en `GastoApiTest` | backend-java | `backend/src/test/.../gasto/RangoMesTest.java` (nuevo), `GastoApiTest.java` | 1 |
| 3 | `mes.ts`, `reloj.ts`, `MesSeleccionado` + specs | frontend-angular | `core/mes.ts`, `core/mes.spec.ts`, `core/reloj.ts`, `core/mes-seleccionado.ts`, `core/mes-seleccionado.spec.ts` (nuevos) | contrato de este plan |
| 4 | Molécula `selector-mes` + spec | frontend-angular | `moleculas/selector-mes/*` (nuevos) | 3 |
| 5 | `GastosApi.listarGastos(mes)` y `GastosStore` (dividir `cargar`, descartar respuestas viejas) + actualizar spec | frontend-angular | `core/gastos-api.ts`, `core/gastos-store.ts`, `core/gastos-store.spec.ts` | 3 |
| 6 | `mensajeVacio` en `gastos-tabla` y cableado en `gastos-page` | frontend-angular | `organismos/gastos-tabla/*`, `paginas/gastos-page/*` | 4, 5 |
| 7 | Test de integración de la página + verificación de criterios de aceptación | qa | `paginas/gastos-page/gastos-page.spec.ts` (nuevo) | 2, 6 |

**En paralelo:** backend (1–2) y frontend (3–6) desde el inicio, contra el contrato de la sección «Contrato de API».
Dentro del frontend, **4 y 5 en paralelo** tras 3.

## Pruebas necesarias
**Backend** (`GastoApiTest`, con fechas fijas pasadas para no depender de hoy; usar `.param("mes", …)` en `MockMvcTester`):
- Límites de mes: gastos en `2026-01-31`, `2026-02-01`, `2026-02-15`, `2026-02-28`, `2026-03-01`; `mes=2026-02` →
  exactamente `[2026-02-28, 2026-02-15, 2026-02-01]`.
- Febrero bisiesto: `2024-02-29` aparece con `mes=2024-02` y no con `mes=2024-03`.
- Orden: dos gastos del mismo día salen por `id desc`.
- Mes sin gastos → `200 []`. Mes futuro (`YearMonth.now().plusMonths(1)`) → `200 []`.
- Sin `mes` y con `mes=` vacío → todos (el test actual de orden sigue pasando).
- `@ParameterizedTest` de `mes` inválido (`2026-13`, `2026-00`, `2026-1`, `202611`, `nov-2026`, `2026-11-01`, `abc`,
  `-0001-01`, `10000-01`) → `400`, `title = "Datos inválidos"`, `$.errores.mes` no nulo.
- `GET /api/gastos/abc` → `400` con `$.errores.id` (efecto del nuevo `handleTypeMismatch`).
- `RangoMesTest`: `2026-12` → `[2026-12-01, 2027-01-01)`; `2024-02` → hasta `2024-03-01`; año 0 o 10000 lanza
  `DatoInvalidoException` con campo `mes`.

**Frontend** (Vitest, «hoy» fijado con `RELOJ` = `() => new Date(2026, 10, 15)`):
- `mes.spec`: `mesDe(new Date(2026, 10, 30, 23, 59))` = `'2026-11'`; `sumarMeses` cruza años en ambos sentidos;
  `etiquetaMes('2026-11')` = `'noviembre 2026'`; `esMes` rechaza `'2026-13'` y `'2026-1'`.
- `mes-seleccionado.spec`: empieza en `'2026-11'`; `ir('2026-12')` se queda en `'2026-11'`; `ir('2026-10')` cambia y la
  etiqueta es «octubre 2026»; `ir('basura')` no cambia nada.
- `selector-mes.spec`: muestra la etiqueta; «Mes siguiente» deshabilitado si `mes === maximo`; los botones emiten
  `sumarMeses(mes, ±1)`.
- `gastos-store.spec` (actualizar los existentes): `GET /api/gastos?mes=2026-11`; tras `guardar` recarga **con** `mes`;
  si el mes cambia antes de que llegue la respuesta, esta se descarta; total del mes.
- `gastos-tabla.spec`: muestra `mensajeVacio` con lista vacía.
- `gastos-page.spec` (qa): carga el mes actual; «Mes anterior» pide `mes=2026-10` y muestra su total; mes vacío muestra
  «No hay gastos en octubre 2026»; tras editar un gasto a otra fecha se recarga y no aparece.

**Manual (Raul):** `docker compose up -d --build`, crear gastos en dos meses, navegar, comprobar que «›» se deshabilita
en el mes actual y que un gasto editado a otro mes desaparece de la lista.

## Riesgos y decisiones abiertas
1. **Mes futuro aceptado** en la API (`200 []`), con el límite solo en el frontend. Motivo arriba. Si prefieres `400`,
   es un cambio pequeño en `RangoMes`, pero dependería del reloj/TZ del servidor.
2. **Mes elegido solo en memoria** (servicio raíz): sobrevive a la navegación entre rutas, pero al recargar la página
   vuelve al mes actual. Pasarlo a la URL (`?mes=`) sería mejor para #4/#5 si tienen página propia; propongo decidirlo en #4.
3. **`?mes=` vacío = sin filtro** (comportamiento por defecto de Spring). Alternativa: `400`. Propongo aceptarlo.
4. **`maximo` se fija al cargar la app.** Si la pestaña queda abierta al cambiar de mes, el nuevo mes no se puede elegir
   hasta recargar. Aceptable para uso personal.
5. **Gasto creado fuera del mes visto:** según el criterio, desaparece sin más (p. ej. ves octubre y creas uno con fecha
   de hoy). Podría confundir; un aviso «Guardado en noviembre 2026» queda como mejora fuera de alcance.
6. **Zona horaria:** el backend no usa TZ (fechas `LocalDate`); «mes actual» lo decide el navegador. Existe ya una
   asimetría con `@PastOrPresent` (reloj del contenedor, UTC); no la toca este issue.
7. Sin dependencias nuevas. **Sin ADR:** no hay librería, patrón ni servicio nuevo.

## ¿Requiere aprobación humana? **SÍ** — ✅ **APROBADO por Raul el 2026-11-04**, con las decisiones 1 (mes futuro aceptado → `[]`), 2 (mes solo en memoria; se revisa en #4) y 3 (`mes=` vacío = sin filtro) tal como se proponen. Cambia el **contrato de la API pública** (`GET /api/gastos` admite `mes` y un
nuevo `400`), regla 4 del `CLAUDE.md` y nota técnica del issue #3. No toca esquema de BD, seguridad ni datos personales.
Puntos a confirmar: decisiones 1, 2 y 3.
