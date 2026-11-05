# Plan: resumen del mes por categoría (issue #4)

## Objetivo
Junto a la lista de gastos, un bloque «Resumen de <mes>» con una barra horizontal por categoría (solo las que
tienen gastos), de mayor a menor importe, con importe en soles y porcentaje que suma 100 %. La API gana
`GET /api/gastos/resumen?mes=AAAA-MM`, calculado en PostgreSQL con `SUM`/`COUNT ... GROUP BY`.
Reutiliza `RangoMes` (backend) y `MesSeleccionado` (frontend) del #3.

## Alcance / Fuera de alcance
**Dentro**
- Backend: endpoint nuevo, consulta agregada, `400` coherente con `errores.mes` del #3.
- Frontend: cálculo de porcentajes (resto mayor), estado del resumen con signals, molécula de barra, organismo
  del bloque, cableado en la página y refresco tras cambiar de mes / crear / editar / borrar.
- Tests backend y frontend.

**Fuera**
- Guardar el mes en la URL (ver decisión D1: se propone **no** hacerlo aquí).
- Resumen de «todos los meses» o de un rango; comparación entre meses; tabla aparte de totales (la propia lista
  de barras ya muestra categoría + importe + % en texto).
- Cambios de esquema de BD (no hacen falta: la consulta usa `ix_gasto_fecha`).
- Librerías de gráficas (barras con HTML/CSS) y cambios en `styles.css` global.
- Todo lo del #5 (exportar CSV).

## Diseño

### Contrato de API (endpoint nuevo, aditivo)
| Método | Ruta | Query | Response |
|---|---|---|---|
| GET | `/api/gastos/resumen` | `mes=AAAA-MM` | `200 application/json` `[ResumenCategoria]` |
| GET | `/api/gastos/resumen` | `mes=AAAA-MM` de un mes sin gastos o **futuro** | `200 []` (igual que `GET /api/gastos?mes=`, decisión 1 del #3) |
| GET | `/api/gastos/resumen` | **sin `mes`** o `mes=` vacío | `400 application/problem+json`, `errores.mes = "El mes es obligatorio"` |
| GET | `/api/gastos/resumen` | `mes` mal formado (`2026-13`, `2026-1`, `202611`, `nov-2026`, `2026-11-01`, `abc`) | `400`, `errores.mes = "El mes debe tener el formato AAAA-MM, por ejemplo 2026-11"` (ya lo hace `handleTypeMismatch`) |
| GET | `/api/gastos/resumen` | año fuera de `0001..9999` (`-0001-01`, `10000-01`) | `400`, `errores.mes = "El mes debe estar entre 0001-01 y 9999-12"` (ya lo hace `RangoMes.de`) |

`ResumenCategoria` (un elemento por categoría **con al menos un gasto** en el mes):
```json
[
  { "categoria": { "id": 1, "nombre": "Vivienda" }, "total": 1234.50, "cantidad": 2 },
  { "categoria": { "id": 2, "nombre": "Comida" },   "total": 80.00,   "cantidad": 5 },
  { "categoria": { "id": 5, "nombre": "Ocio" },     "total": 80.00,   "cantidad": 1 }
]
```
- `total`: número JSON con **exactamente 2 decimales** (`80.00`, no `80`), suma de `importe` del mes. `> 0` siempre.
- `cantidad`: entero `>= 1`, número de gastos.
- **Orden**: `total desc`, y ante empate `categoria.nombre asc` (mismo criterio alfabético que `GET /api/categorias`).
  El frontend **no reordena**: confía en el orden de la API.
- No hay campo de porcentaje: se calcula en el frontend (decisión D3). No hay total del mes: es la suma de `total`
  (y ya lo muestra la lista).

Cuerpo del `400` (mismo formato que el #3):
```json
{
  "type": "about:blank",
  "title": "Datos inválidos",
  "status": 400,
  "detail": "Revisa los campos marcados en 'errores'.",
  "instance": "/api/gastos/resumen",
  "errores": { "mes": "El mes es obligatorio" }
}
```

**`mes` obligatorio (decisión D2).** Un «resumen de todos los tiempos» no lo pide ningún criterio y no tiene
pantalla. Se implementa con `@RequestParam(required = false)` + comprobación en el **servicio** que lanza
`DatoInvalidoException("mes", "El mes es obligatorio")`. Así:
- el `400` sale por el manejador que ya existe (`datoInvalido`) con el formato `errores.mes`;
- `mes=` vacío (Spring lo convierte en `null`) y sin `mes` dan el mismo error;
- **no se toca `ManejadorErrores`**, que es justo el archivo donde chocaría con el #5 (ver «Coordinación con #5»).
  La alternativa (`required = true` + sobrescribir `handleMissingServletRequestParameter`) es más «Spring», pero
  la tendrían que añadir #4 y #5 a la vez en el mismo archivo.

**Ruta `/api/gastos/resumen` frente a `/api/gastos/{id}`.** Spring MVC elige el patrón más específico (literal
antes que variable) aunque estén en controllers distintos, así que `resumen` no cae en `obtener(Long id)`. Se cubre
con un test (si fallara daría `400 errores.id`).

### Backend (`com.rquintanah.gastoscasa`) — todo en archivos **nuevos**, paquete nuevo `resumen`
Para no tocar `GastoController`, `GastoService` ni `GastoRepository` (los tocará el #5), el resumen vive en su
propio paquete con su propia capa `controller → service → repository`.

**`resumen/ResumenCategoriaDto.java`** (DTO de respuesta, `record`):
```java
public record ResumenCategoriaDto(CategoriaDto categoria, BigDecimal total, long cantidad) { }
```

**`resumen/ResumenRepository.java`** — repositorio de solo lectura sobre la entidad `Gasto`
(`extends org.springframework.data.repository.Repository<Gasto, Long>`, sin métodos de escritura):
```java
/** Una fila por categoría con gastos en [desde, hasta): total y número de gastos. Orden: total desc, nombre asc. */
@Query("""
        select new com.rquintanah.gastoscasa.resumen.ResumenCategoriaDto(
                 new com.rquintanah.gastoscasa.categoria.CategoriaDto(c.id, c.nombre), sum(g.importe), count(g))
        from Gasto g join g.categoria c
        where g.fecha >= :desde and g.fecha < :hasta
        group by c.id, c.nombre
        order by sum(g.importe) desc, c.nombre asc""")
List<ResumenCategoriaDto> resumirEntreFechas(@Param("desde") LocalDate desde, @Param("hasta") LocalDate hasta);
```
Nota para `backend-java`: si Hibernate 7 no admite el `new` anidado en la proyección, usar un `record` interno
de fila plana `(Short categoriaId, String nombre, BigDecimal total, Long cantidad)` y mapear a
`ResumenCategoriaDto` en el servicio. Lo importante del contrato: **una sola consulta** con `SUM`, `COUNT`,
`GROUP BY` y `ORDER BY` en la BD; nada de agregar en Java.

**`resumen/ResumenService.java`** (`@Service @Transactional(readOnly = true)`):
```java
/** @throws DatoInvalidoException("mes", "El mes es obligatorio") si mes es null. */
public List<ResumenCategoriaDto> resumir(YearMonth mes)
```
- `mes == null` → `DatoInvalidoException("mes", MENSAJE_MES_OBLIGATORIO)`.
- `RangoMes.de(mes)` (ya valida el año) → `resumirEntreFechas(desde, hasta)`.
- Normaliza `total` con `setScale(2, RoundingMode.UNNECESSARY)`: PostgreSQL devuelve `SUM(NUMERIC(12,2))` con
  escala 2, pero así el contrato «2 decimales» no depende del driver.

**`resumen/ResumenController.java`** — sin lógica:
```java
@RestController
@RequestMapping("/api/gastos/resumen")
public class ResumenController {
    @GetMapping
    public List<ResumenCategoriaDto> resumir(@RequestParam(name = "mes", required = false) YearMonth mes) {
        return resumenService.resumir(mes);
    }
}
```

### Frontend (`frontend/src/app`)

**`core/porcentajes.ts`** — función pura (método del **resto mayor** / Hamilton, decisión D3):
```ts
/**
 * Reparte 100 puntos porcentuales ENTEROS en proporción a los importes. La suma es siempre 100
 * (o [] si no hay importes). Aritmética entera en céntimos: sin errores de coma flotante.
 * Empates de resto: gana el que va antes en la lista (la API ya viene ordenada por importe desc, nombre asc).
 */
export function porcentajesRestoMayor(importes: readonly number[]): number[];
```
Algoritmo: `c_i = Math.round(importe_i * 100)`, `T = Σ c_i`; `base_i = floor(c_i * 100 / T)`,
`resto_i = (c_i * 100) % T`; se suma 1 a los `100 − Σ base_i` elementos con mayor `resto_i` (empate → menor índice).
Todo son enteros seguros: `c_i * 100` < 2^53 hasta totales de ~9·10^11 soles.

**`core/resumen-api.ts`** (archivo nuevo para no tocar `gastos-api.ts` ni `modelos.ts`, que puede tocar el #5):
```ts
export interface ResumenCategoria { categoria: Categoria; total: number; cantidad: number; }

@Injectable({ providedIn: 'root' })
export class ResumenApi {
  obtener(mes: Mes): Observable<ResumenCategoria[]>;   // GET /api/gastos/resumen?mes=…
}
```

**`core/gastos-store.ts`** — único cambio en un archivo compartido del core: una señal de «cambios»:
```ts
private readonly _cambios = signal(0);
/** Se incrementa tras cada alta, edición o borrado con éxito. Otros estados (resumen) la escuchan para refrescarse. */
readonly cambios: Signal<number> = this._cambios.asReadonly();
```
- `guardar()`: `_cambios.update(n => n + 1)` justo después de que `crear`/`actualizar` responda OK (antes de
  `pedirGastos()`, para que el resumen se refresque aunque falle la recarga de la lista).
- `borrar()`: igual, tras el `DELETE` OK.

Por qué así (refresco **sin duplicar lógica**): la página no tiene que acordarse de llamar al resumen en cada acción
(tres sitios), y el resumen no depende de cómo cambia `gastos()` por dentro (ese signal se vacía al cambiar de mes y
no cambia si falla la recarga). Un único evento explícito, emitido en el único sitio donde ocurren las mutaciones.

**`core/resumen-store.ts`** (nuevo, `@Injectable()` **sin** `providedIn`: se provee en la página, vive con ella):
```ts
export interface BarraResumen { categoria: Categoria; total: number; cantidad: number; porcentaje: number; }

@Injectable()
export class ResumenStore {
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  /** Filas de la API (en su orden) con el porcentaje entero ya repartido. */
  readonly barras: Signal<BarraResumen[]>;   // computed(() => … porcentajesRestoMayor(filas.map(f => f.total)))
  /** Pide el resumen del mes seleccionado. */
  cargar(): Promise<void>;
}
```
- En el constructor, un `effect` que lee `periodo.mes()` y `gastosStore.cambios()` y llama
  `untracked(() => void this.cargar())`. El primer disparo carga el mes actual. Cambiar de mes o mutar un gasto
  → una petición.
- Respuestas fuera de orden: un contador de petición (`++secuencia`); solo se aplica la respuesta de la **última**
  petición (con el mismo mes puede haber dos seguidas, p. ej. editar dos veces rápido, así que comparar el mes no basta).
- Al cambiar de mes se vacían las barras antes de pedir (no mostrar el resumen de otro mes con el título nuevo).
  En un refresco del mismo mes se mantienen las barras actuales hasta que llega la respuesta (sin parpadeo).
- Errores: reutiliza `mensajeDeError` exportado de `gastos-store.ts` (solo se importa, no se modifica).

**Molécula nueva `moleculas/barra-categoria/`** (`.ts`, `.html`, `.css`, `.spec.ts`), presentacional:
```ts
selector: 'app-barra-categoria'
readonly nombre = input.required<string>();
readonly total = input.required<number>();
readonly porcentaje = input.required<number>();   // entero 0..100
readonly cantidad = input.required<number>();
```
- Línea 1: nombre (izquierda) · `<app-importe-pen>` + `«42 %»` (derecha, `tabular-nums`). Línea 2: la barra a todo
  el ancho. Funciona igual en ~400 px porque no hay columnas.
- Barra: `<div class="pista" aria-hidden="true"><div class="relleno" [style.width.%]="porcentaje()"></div></div>`.
  Ancho = **porcentaje sobre el total del mes** (coincide con el texto). Con `porcentaje() > 0` un ancho mínimo de
  `2px` para que no desaparezca; con `0 %` (posible con resto mayor en categorías muy pequeñas) la pista queda vacía.
- `title`/texto accesible: el nombre, el importe y el % ya son texto visible; la barra es decorativa. `cantidad` se
  muestra como texto secundario («2 gastos» / «1 gasto»).
- Colores: un **único color** para todas las barras (`var(--primario)` sobre `var(--borde)`), así que el color no
  distingue nada; la categoría la da el texto (criterio de accesibilidad). Variables locales en el `.css` del componente
  (`--barra: var(--primario)`, `--barra-pista: var(--borde)`), **sin tocar `styles.css`**: el modo oscuro sale gratis de
  las variables globales. `@media (forced-colors: active)`: `relleno { background: CanvasText }` para que se vea en alto
  contraste.
- Porcentaje como texto plano `` `${p} %` `` (no `Intl` percent, que varía entre motores ICU y rompería los tests).

**Organismo nuevo `organismos/resumen-mes/`** (`.ts`, `.html`, `.css`, `.spec.ts`), presentacional:
```ts
selector: 'app-resumen-mes'
readonly etiquetaMes = input.required<string>();      // 'noviembre 2026'
readonly barras = input.required<BarraResumen[]>();
readonly cargando = input(false);
readonly error = input<string | null>(null);
```
- `<h2>Resumen de {{ etiquetaMes() }}</h2>`.
- `error` → `<p class="aviso error" role="alert">`. `cargando` y sin barras → «Cargando…».
- Sin barras, sin carga y sin error → `<p class="vacio">Sin gastos este mes</p>` (ningún elemento de barra).
- Con barras → `<ol class="barras">` con un `<li><app-barra-categoria …/></li>` por fila, `track barra.categoria.id`.
  Lista ordenada porque el orden (de mayor a menor) tiene significado.

**Página `gastos-page`** (cambios mínimos y localizados):
- `gastos-page.ts`: `providers: [ResumenStore]`, `protected readonly resumen = inject(ResumenStore)` y añadir
  `ResumenMes` a `imports`. Nada más (el `effect` del resumen vive en `ResumenStore`, no en la página).
- `gastos-page.html`: añadir **al final** del archivo una tercera sección
  `<section class="panel resumen"><app-resumen-mes [etiquetaMes]="periodo.etiqueta()" [barras]="resumen.barras()" [cargando]="resumen.cargando()" [error]="resumen.error()" /></section>`
  y añadir la clase `lista` a la sección de la lista (`<section class="panel lista">`). **No se toca la cabecera**
  (`<header class="cabecera">`), que es donde irá el botón del #5.
- `gastos-page.css`: rejilla con áreas. Escritorio: `"formulario lista" / "resumen lista"` (el resumen debajo del
  formulario, a la izquierda, **junto a la lista**); `.lista { grid-row: span 2 }` vía `grid-area`. Móvil (≤ 760 px,
  breakpoint actual): una columna en el orden formulario → resumen → lista.

Rutas: sin cambios.

### Datos
Sin cambios de esquema ni migraciones. La consulta filtra por rango de `fecha` (usa `ix_gasto_fecha`) y agrupa
como mucho 6 categorías. Rollback: revertir el PR.

## Coordinación con el #5 (exportar CSV, en paralelo en `../gastos-casa--exportar-csv`, rama `feat/exportar-csv`)
Ninguna de las dos ramas tiene aún cambios sobre `main` (782fb31). Para minimizar conflictos:

| Archivo | #4 (este plan) | Recomendación para #5 |
|---|---|---|
| `gasto/GastoController.java`, `GastoService.java`, `GastoRepository.java` | **No los toca** (paquete `resumen/` nuevo) | Libre de usarlos |
| `gasto/RangoMes.java` | Solo lo usa | Solo usarlo; no cambiar su firma |
| `error/ManejadorErrores.java` | **No lo toca** | Mismo patrón para `mes` obligatorio (`DatoInvalidoException("mes", "El mes es obligatorio")` en el servicio) → mismo mensaje y sin tocar el archivo |
| `backend/.../GastoApiTest.java` | **No lo toca** (tests en `resumen/ResumenApiTest.java`) | Libre (o un `ExportApiTest` nuevo) |
| `core/gastos-api.ts`, `core/modelos.ts` | **No los toca** | Libre |
| `core/gastos-store.ts` (+ spec) | Añade `cambios` | Evitar tocarlo (el CSV no necesita estado) |
| `paginas/gastos-page/gastos-page.html` | Clase `lista` en la 2.ª sección + 3.ª sección al final | Botón solo dentro de `<header class="cabecera">`, idealmente un `<a [href]="…" download>` sin componente nuevo |
| `paginas/gastos-page/gastos-page.ts` | `providers`, `inject`, `imports` | Si no añade componentes, no toca `imports` (es la línea donde chocaríamos) |
| `paginas/gastos-page/gastos-page.css` | Rejilla con áreas | Solo estilos de la cabecera/botón |
| `paginas/gastos-page/gastos-page.spec.ts` | Atender las peticiones de resumen en el helper `cargarNoviembre()` + `it` nuevos al final | `it` nuevos al final. **Conflicto probable pero trivial**: quien fusione segundo hace `rebase` y añade al spec las peticiones del otro |

Mensaje literal compartido (para que los dos endpoints respondan igual): `"El mes es obligatorio"`. Cuando ambos estén
fusionados, si se quiere, un `refactor:` pequeño puede llevar esa constante a un único sitio (p. ej. `RangoMes`).

## Tareas
| # | Tarea | Subagente | Archivos | Depende de |
|---|---|---|---|---|
| 1 | Paquete `resumen`: DTO, repositorio con la consulta agregada, servicio (mes obligatorio, escala 2), controller | backend-java | `backend/src/main/java/com/rquintanah/gastoscasa/resumen/ResumenCategoriaDto.java`, `ResumenRepository.java`, `ResumenService.java`, `ResumenController.java` (todos nuevos) | — |
| 2 | Tests backend: `ResumenApiTest` (API contra PostgreSQL) y `ResumenServiceTest` (unitario) | backend-java | `backend/src/test/java/com/rquintanah/gastoscasa/resumen/ResumenApiTest.java`, `ResumenServiceTest.java` (nuevos) | 1 |
| 3 | `porcentajesRestoMayor` + spec | frontend-angular | `frontend/src/app/core/porcentajes.ts`, `porcentajes.spec.ts` (nuevos) | contrato de este plan |
| 4 | `ResumenApi` + `ResumenStore` + spec; señal `cambios` en `GastosStore` + casos en su spec | frontend-angular | `core/resumen-api.ts`, `core/resumen-store.ts`, `core/resumen-store.spec.ts` (nuevos); `core/gastos-store.ts`, `core/gastos-store.spec.ts` | 3 |
| 5 | Molécula `barra-categoria` + organismo `resumen-mes` + specs | frontend-angular | `moleculas/barra-categoria/*`, `organismos/resumen-mes/*` (nuevos) | 3 (solo el tipo `BarraResumen` de 4; se puede acordar antes) |
| 6 | Cablear en `gastos-page` (providers, sección, rejilla) | frontend-angular | `paginas/gastos-page/gastos-page.ts`, `.html`, `.css` | 4, 5 |
| 7 | Actualizar `gastos-page.spec.ts` (peticiones de resumen) y tests de integración de la página; verificación de criterios de aceptación (incluido ~400 px y claro/oscuro) | qa | `paginas/gastos-page/gastos-page.spec.ts` | 2, 6 |

**En paralelo:** backend (1–2) y frontend (3–6) desde el inicio, contra el contrato de arriba. Dentro del frontend,
**4 y 5 en paralelo** tras 3 (el tipo `BarraResumen` queda fijado en este plan).

## Pruebas necesarias
**Backend — `ResumenApiTest`** (`@SpringBootTest` + Testcontainers + `@Transactional`, como `GastoApiTest`; datos
creados con `POST /api/gastos` y fechas fijas pasadas):
- Agregación: en `2026-02` gastos Vivienda 1000.00 + 234.50, Comida 10.25 + 30.25 + 39.50, Ocio 80.00; más gastos
  en `2026-01-31` y `2026-03-01` que **no** cuentan → exactamente 3 filas: Vivienda `1234.50`/2, Comida `80.00`/3,
  Ocio `80.00`/1.
- Orden y empate: Comida y Ocio empatan en `80.00` → Comida antes que Ocio (`nombre asc`).
- 2 decimales literales en el JSON: el cuerpo contiene `"total":80.00` y `"total":1234.50` (como el test de
  `importe` del esqueleto).
- Solo categorías con gastos: Transporte, Salud y Otros no aparecen.
- Mes sin gastos → `200 []`. Mes futuro (`YearMonth.now().plusMonths(1)`) → `200 []`.
- Sin `mes` y con `mes=` vacío → `400`, `title = "Datos inválidos"`, `$.errores.mes = "El mes es obligatorio"`.
- `@ParameterizedTest` de `mes` inválido (`2026-13`, `2026-00`, `2026-1`, `202611`, `nov-2026`, `2026-11-01`, `abc`,
  `-0001-01`, `10000-01`) → `400` con `$.errores.mes` no nulo.
- `GET /api/gastos/resumen?mes=2026-02` no lo atiende `/{id}` (no hay `$.errores.id`; es `200` con array).
- Tras editar un gasto a otra categoría/mes y tras borrarlo, el resumen cambia en consecuencia (un caso).

**Backend — `ResumenServiceTest`** (unitario, repositorio simulado como en `GastoServiceTest`):
- `resumir(null)` lanza `DatoInvalidoException` con campo `mes` y no llama al repositorio.
- Un `total` con escala 1 o 0 del repositorio sale con escala 2.

**Frontend** (Vitest, `RELOJ` = `() => new Date(2026, 10, 15)`):
- `porcentajes.spec`: `[]` → `[]`; `[5]` → `[100]`; `[1, 1, 1]` → `[34, 33, 33]`; `[0.01, 999.99]` → `[0, 100]`;
  `[50, 50]` → `[50, 50]`; `[1234.5, 80, 80]` → suma 100 y orden de desempate por índice; repartos ya exactos no se
  tocan; bucle con 200 listas pseudoaleatorias (semilla fija) → siempre suma 100 y cada valor difiere < 1 del exacto.
- `resumen-store.spec`: al crearse pide `GET /api/gastos/resumen?mes=2026-11`; `periodo.ir('2026-10')` → pide
  `mes=2026-10` y vacía las barras mientras tanto; incrementar `cambios` (vía `GastosStore.guardar`/`borrar`) → vuelve
  a pedir el mismo mes; de dos peticiones solapadas solo se aplica la última; error HTTP → `error()` con el mensaje
  de `mensajeDeError`; `barras()` incluye `porcentaje` y conserva el orden de la API.
- `gastos-store.spec` (añadir): `cambios` sube en 1 tras crear, editar y borrar con éxito; no sube si la API falla.
- `barra-categoria.spec`: muestra nombre, `S/ 1,234.50`, `42 %` y «2 gastos»/«1 gasto»; el relleno tiene
  `width: 42%`; la pista es `aria-hidden`.
- `resumen-mes.spec`: título «Resumen de noviembre 2026»; respeta el orden recibido; sin barras → «Sin gastos este mes»
  y **ningún** `app-barra-categoria`; con `error` → `role="alert"`; con `cargando` y sin barras → «Cargando…».
- `gastos-page.spec` (qa): la carga inicial pide categorías, gastos y resumen de `2026-11` y muestra las barras;
  «Mes anterior» pide gastos **y** resumen de `2026-10`; mes vacío → «Sin gastos este mes»; tras crear, editar y
  borrar se vuelve a pedir el resumen. Los `it` existentes se adaptan para atender la petición de resumen.

**Manual (Raul):** `docker compose up -d --build`, crear gastos de varias categorías (incluido un empate), comprobar
orden, importes, que los % suman 100, el refresco al crear/editar/borrar y al cambiar de mes, un mes vacío, la vista a
~400 px (DevTools) y el modo oscuro del sistema.

## Riesgos y decisiones abiertas
**D1. Mes en la URL (`/gastos?mes=AAAA-MM`) — recomendación: NO en este issue; issue aparte después de #4 y #5.**
- El motivo que lo justificaba en el #3 era que el resumen tuviera **vista propia**. Con este plan el resumen vive en
  la misma página, así que ese motivo desaparece.
- Hacerlo ahora obliga a cambiar `MesSeleccionado` (inicializarlo desde la URL, sincronizarla al navegar, validar
  `?mes=` mal formado o futuro contra `maximo`) y `app.config.ts`/rutas, mientras el #5 depende de ese mismo servicio
  en paralelo: alto riesgo de conflicto y de comportamiento distinto en cada rama.
- Lo que se gana (recargar sin perder el mes, enlace/marcador, botón Atrás) es real pero menor para un uso personal.
  Si Raul lo quiere, propongo abrir un issue «mes en la URL» tras fusionar #4 y #5; el cambio queda acotado a
  `MesSeleccionado` + rutas, sin tocar la API.

**D2. `mes` obligatorio en `/resumen`** (`400 errores.mes = "El mes es obligatorio"`), comprobado en el servicio para no
tocar `ManejadorErrores` (choque con #5). Diferente a `GET /api/gastos`, donde sin `mes` se devuelven todos: allí era
compatibilidad hacia atrás; aquí el endpoint es nuevo. Alternativa: sin `mes` → resumen de todos los meses (no lo
pide nadie y no tiene pantalla).

**D3. Porcentajes enteros con resto mayor, calculados en el frontend.** Enteros («42 %») porque es lo legible en
~400 px; resto mayor porque garantiza suma 100 con el mínimo error por fila (< 1 punto). Consecuencia: una categoría
muy pequeña puede mostrar «0 %» (p. ej. S/ 0.50 en un mes de S/ 2,000); se acepta porque su importe sigue visible.
Alternativa: 1 decimal (mismo algoritmo con 1000 unidades). En el frontend porque es presentación y el contrato del
issue no incluye porcentaje.

**D4. Empate de importes → `nombre asc`** (determinista, coherente con la lista de categorías).

**D5. Ancho de barra = % sobre el total del mes** (coincide con el texto). Alternativa: relativo a la categoría
mayor (barras más largas, pero el ancho ya no «es» el porcentaje).

Otros riesgos:
- **Proyección JPQL anidada** (`new … CategoriaDto(…)` dentro de `new …`): puede no estar soportada; plan B descrito
  en el diseño (fila plana + mapeo en el servicio).
- **Doble petición en la carga inicial**: lista y resumen se piden por separado (2 GET en vez de 1). Aceptable en local;
  lo exige el criterio de «calculado en la BD».
- **Coherencia lista/resumen**: son dos peticiones; si una falla, cada bloque muestra su propio error. Sin
  transacción común (no hace falta para uso de una sola persona).
- **Conflicto con #5** en `gastos-page.*` y su spec: acotado por la tabla de coordinación; quien fusione segundo
  hace `rebase`. Conviene pasar esa tabla a quien planifica el #5.
- Sin dependencias nuevas. **Sin ADR**: no hay librería, patrón ni servicio nuevo (el paquete `resumen` sigue el
  `controller → service → repository` existente).

## ¿Requiere aprobación humana? **SÍ**
Requiere aprobación humana: **SÍ** — añade un endpoint a la **API pública** (`GET /api/gastos/resumen` con su `400`),
regla 4 del `CLAUDE.md` y nota técnica del issue #4. No toca esquema de BD, seguridad/autenticación ni datos
personales. Puntos a confirmar: **D1** (mes en la URL: no, issue aparte), **D2** (`mes` obligatorio), **D3**
(porcentajes enteros con resto mayor), **D4** (empate por nombre) y **D5** (ancho = % del total).

**Aprobado por Raul el 2026-11-04:** D1–D5 tal como están propuestas.
