# Plan: exportar los gastos del mes a CSV (issue #5)

## Objetivo
Un enlace-botón «Exportar CSV» junto al selector de mes descarga `gastos-AAAA-MM.csv` con los gastos del mes elegido,
listo para abrir en Excel (español) o Google Sheets. La API gana `GET /api/gastos/export?mes=AAAA-MM`; el CSV se
genera en el backend, sin dependencias nuevas, con escape RFC 4180 y neutralización de fórmulas (inyección CSV).
Reutiliza `RangoMes` (backend) y `MesSeleccionado` (frontend) del #3.

## Alcance / Fuera de alcance
**Dentro**
- Backend: endpoint nuevo en un paquete propio `exportar/` (`controller → service`), escritor CSV puro y testeable,
  consulta de los gastos del mes en orden cronológico, `400` coherente con `errores.mes` de #3/#4.
- Refactor mínimo: el mensaje `"El mes es obligatorio"` pasa a `RangoMes` y lo usan resumen y exportación
  (lo anunciaba el plan del #4).
- Frontend: función pura que construye URL y nombre de archivo; enlace en la cabecera de la lista de `gastos-page`.
- Tests backend (escape, fórmulas, BOM, cabeceras HTTP, mes vacío, 400) y frontend (el enlace apunta al mes elegido).

**Fuera**
- Exportar varios meses, un rango o «todo»; otros formatos (XLSX, JSON); elegir columnas o separador.
- Columna de id o de categoría por id; totales al pie del CSV.
- Línea `sep=;` (ver riesgo R1: rompe el BOM en Excel).
- Cambios de esquema de BD, de `ManejadorErrores`, de nginx o del proxy de desarrollo (no hacen falta, ver «Infra»).
- Mes en la URL de la app (issue #11).

## Diseño

### Contrato de API (endpoint nuevo, aditivo)
| Método | Ruta | Query | Respuesta |
|---|---|---|---|
| GET | `/api/gastos/export` | `mes=AAAA-MM` (con o sin gastos, también futuro) | `200`, cuerpo CSV (abajo) |
| GET | `/api/gastos/export` | sin `mes` o `mes=` vacío | `400 application/problem+json`, `errores.mes = "El mes es obligatorio"` |
| GET | `/api/gastos/export` | `mes` mal formado (`2026-13`, `2026-1`, `202611`, `nov-2026`, `2026-11-01`, `abc`) | `400`, `errores.mes = "El mes debe tener el formato AAAA-MM, por ejemplo 2026-11"` (ya lo hace `handleTypeMismatch`) |
| GET | `/api/gastos/export` | año fuera de `0001..9999` (`-0001-01`, `10000-01`) | `400`, `errores.mes = "El mes debe estar entre 0001-01 y 9999-12"` (ya lo hace `RangoMes.de`) |

El `400` tiene exactamente el mismo cuerpo `ProblemDetail` que `GET /api/gastos/resumen` (`title: "Datos inválidos"`,
`instance: "/api/gastos/export"`). Comportamiento idéntico al resumen (decisión D2 del #4): `mes` obligatorio,
comprobado en el **servicio** con `DatoInvalidoException("mes", RangoMes.MENSAJE_OBLIGATORIO)`.

Cabeceras del `200`:
```
Content-Type: text/csv;charset=UTF-8
Content-Disposition: attachment; filename="gastos-2026-11.csv"
```
- Spring serializa `MediaType` **sin espacio** tras `;` (`text/csv;charset=UTF-8`). Es equivalente al
  `text/csv; charset=UTF-8` del issue (RFC 9110 permite espacios opcionales). Los tests comparan con
  `MediaType.parseMediaType(...)`/`isCompatibleWith` + `charset == UTF-8`, **no** como cadena literal.
- `Content-Disposition` se construye con `ContentDisposition.attachment().filename("gastos-" + mes + ".csv").build()`.
  El nombre solo puede contener dígitos y `-` (el `YearMonth` ya validado por `RangoMes`, `toString()` → `AAAA-MM`
  con año de 4 cifras): no hay inyección de cabeceras. No se usa `filename*` (no hay caracteres no ASCII).
- **No** se declara `produces = "text/csv"` en el `@GetMapping`: así el `400` puede negociar `application/problem+json`
  con el `Accept` del navegador y no salta un `406`. El tipo se fija en el `ResponseEntity`.
- `Cache-Control: no-store` (opcional, recomendado por `seguridad`: datos personales en caché del navegador). Ver D6.

Cuerpo del CSV (bytes, UTF-8):
```
<EF BB BF>fecha;categoria;importe;nota\r\n
2026-11-01;Vivienda;1234.50;Alquiler\r\n
2026-11-02;Comida;45.50;\r\n
2026-11-02;Comida;12.00;"pan; leche y ""huevos"""\r\n
2026-11-03;Ocio;20.00;"'=HYPERLINK(""http://x"")"\r\n
```
Reglas (todas verificables en tests):
1. **BOM** `EF BB BF` al inicio, una sola vez, antes de la cabecera.
2. **Cabecera** literal `fecha;categoria;importe;nota`, siempre (también en mes vacío).
3. **Fin de línea** `\r\n` (RFC 4180), también tras la última fila. Mes vacío ⇒ cuerpo = BOM + cabecera + `\r\n`.
4. **Orden**: `fecha asc, id asc` (cronológico, el natural en una hoja de cálculo; ver D1). La lista de la app
   sigue en `desc`.
5. **fecha**: `LocalDate.toString()` → `AAAA-MM-DD`. Sin comillas ni neutralización (la genera el código).
6. **categoria**: nombre de la categoría, pasado por el mismo escritor de campos de texto que la nota (D3).
7. **importe**: `importe.setScale(2, RoundingMode.UNNECESSARY).toPlainString()` → punto decimal, 2 decimales, sin
   separador de miles ni notación científica (`45.5` → `45.50`, `9999999999.99` tal cual). Sin neutralizar: siempre
   es `> 0`, nunca empieza por `-`, y neutralizarlo lo convertiría en texto en Excel.
8. **nota**: `null` ⇒ campo vacío (sin comillas). Si no, primero **neutralización**, después **escape**:
   - Neutralización: si el primer carácter es `=`, `+`, `-` o `@` (más `\t` y `\r` si se aprueba D4) se antepone `'`.
   - Escape: si el valor (ya neutralizado) contiene `;`, `"`, `\r`, `\n` **o `,`** (D5) se rodea de `"` y cada `"`
     interior se duplica (`""`). Si no, va tal cual.
   - El orden importa: `=1+1;x` → `'=1+1;x` → `"'=1+1;x"`. Neutralizar después de entrecomillar dejaría la `'`
     fuera de las comillas y rompería el campo.
9. Codificación de todo el cuerpo: UTF-8 (`Café`, `ñandú`, `€` se leen bien en Excel gracias al BOM).

### Backend (`com.rquintanah.gastoscasa`)
**Paquete nuevo `exportar/`** (mismo patrón que `resumen/`):
- `exportar/CsvGastos.java` — clase final **sin Spring ni JPA**, solo funciones puras. Firma propuesta:
  ```java
  /** CSV de gastos para Excel en español: UTF-8 con BOM, separador ';', CRLF, escape RFC 4180 y neutralización de fórmulas. */
  final class CsvGastos {
      static final String CABECERA = "fecha;categoria;importe;nota";
      static byte[] generar(List<GastoDto> gastos);   // BOM + cabecera + filas, UTF-8
      static String campoTexto(String valor);          // null → "", neutraliza y escapa
  }
  ```
  `generar` usa `StringBuilder` y `getBytes(StandardCharsets.UTF_8)` con el BOM delante (`'﻿'` al inicio del
  `StringBuilder` o los 3 bytes concatenados; el test comprueba los bytes). Volumen previsto: decenas o cientos de
  filas al mes (nota de 500 caracteres como máximo): en memoria sin problema, no hace falta *streaming*.
- `exportar/ExportarService.java` — `@Service @Transactional(readOnly = true)`. `exportarMes(YearMonth mes)`:
  `null` ⇒ `DatoInvalidoException("mes", RangoMes.MENSAJE_OBLIGATORIO)`; `RangoMes.de(mes)`; lee con el repositorio;
  mapea a `GastoDto` dentro de la transacción; devuelve un `record ArchivoCsv(String nombre, byte[] contenido)`
  (`nombre = "gastos-" + mes + ".csv"`). Así el controller no tiene lógica: solo arma la respuesta.
- `exportar/ArchivoCsv.java` — `record ArchivoCsv(String nombre, byte[] contenido)` (o anidado en el servicio).
- `exportar/ExportarController.java` — `@RestController @RequestMapping("/api/gastos/export")`,
  `@GetMapping ResponseEntity<byte[]> exportar(@RequestParam(name = "mes", required = false) YearMonth mes)`;
  pone `contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))`, `Content-Disposition` y (si D6)
  `Cache-Control: no-store`. `ByteArrayHttpMessageConverter` escribe el `byte[]` sin tocarlo.

**Cambios en archivos existentes**
- `gasto/GastoRepository.java` — método nuevo (no se cambia `buscarEntreFechas`):
  ```java
  /** Gastos con fecha en [desde, hasta), en orden cronológico (para exportar). */
  @EntityGraph(attributePaths = "categoria")
  @Query("select g from Gasto g where g.fecha >= :desde and g.fecha < :hasta order by g.fecha asc, g.id asc")
  List<Gasto> buscarEntreFechasCronologico(@Param("desde") LocalDate desde, @Param("hasta") LocalDate hasta);
  ```
  `ExportarService` depende de `GastoRepository` (paquete `gasto`); es lectura y evita duplicar la entidad.
- `gasto/RangoMes.java` — **añade** `public static final String MENSAJE_OBLIGATORIO = "El mes es obligatorio";`
  (sin cambiar firmas).
- `resumen/ResumenService.java` — `MENSAJE_MES_OBLIGATORIO` pasa a valer `RangoMes.MENSAJE_OBLIGATORIO` (o se elimina
  y se usa directamente; sus tests comprueban el literal, que no cambia).
- **No se toca** `ManejadorErrores`, `GastoController` ni `GastoService`.

**Ruta `/api/gastos/export` frente a `/api/gastos/{id}`**: igual que `/resumen`, el patrón literal gana a la
variable. Test que lo cubre (si fallara daría `400 errores.id`).

### Frontend (`frontend/src/app`)
**Decisión de descarga (D2): enlace `<a [href] download>`, no `HttpClient` + `Blob`.**
- Sin JavaScript de descarga, sin `URL.createObjectURL`/`revokeObjectURL`, sin cargar el archivo en memoria;
  el navegador usa el `Content-Disposition` del backend. Mismo origen en Docker (nginx `/api/`) y en `ng serve`
  (`proxy.conf.json`), así que `download` funciona.
- Coste: si el backend falla (caído o `400`), la página no muestra el error con su aviso habitual; el navegador
  enseña una descarga fallida o el JSON del error. El frontend siempre manda un `mes` válido (`MesSeleccionado`
  ya valida), así que el `400` no se da desde la UI. Aceptable en uso local personal.

**Archivos**
- `core/exportar-csv.ts` (nuevo) — funciones puras:
  ```ts
  /** '/api/gastos/export?mes=2026-11' */
  export function urlExportarCsv(mes: Mes): string;
  /** 'gastos-2026-11.csv' */
  export function nombreArchivoCsv(mes: Mes): string;
  ```
  `urlExportarCsv` usa `encodeURIComponent(mes)` por higiene (con un `Mes` válido no cambia nada).
- `core/exportar-csv.spec.ts` (nuevo).
- `paginas/gastos-page/gastos-page.ts` — dos `computed` a partir de `periodo.mes()`: `urlCsv` y `archivoCsv`.
  **No** cambia `imports` ni `providers` (no hay componente nuevo).
- `paginas/gastos-page/gastos-page.html` — dentro de `<header class="cabecera">` de la sección `lista`, tras
  `<app-selector-mes>`:
  `<a class="boton secundario exportar" [href]="urlCsv()" [attr.download]="archivoCsv()" [attr.aria-label]="'Exportar CSV de ' + periodo.etiqueta()">Exportar CSV</a>`.
  Siempre activo (un mes vacío también descarga, con solo la cabecera).
- `paginas/gastos-page/gastos-page.css` — estilo del enlace como botón secundario (los estilos globales de
  `styles.css` son para `button`, no para `a`): reutilizar las mismas variables CSS; foco visible; legible en
  claro/oscuro y a ~400 px (la cabecera ya hace `flex-wrap`).
- **Atomic design**: no se crea átomo. Es un único uso, sin lógica ni entradas propias; si aparece un segundo enlace
  de descarga, se extrae `atomos/enlace-descarga`. (Se puede revisar si Raul prefiere el átomo ya.)
- Sin estado nuevo: no se toca `GastosStore`, `GastosApi`, `ResumenStore` ni `modelos.ts`.

### Datos
Sin cambios de esquema ni migraciones. La consulta usa `ix_gasto_fecha` (rango `>= / <`). Sin rollback de datos;
el rollback del código es revertir el PR.

### Infra
- nginx (`location /api/`) pasa las cabeceras del backend tal cual; `add_header ... always` del bloque `server` solo
  añade `nosniff` y `Referrer-Policy` (compatibles: el `Content-Type` es correcto). Sin `gzip` configurado. No se toca.
- `proxy.conf.json` ya cubre `/api`. No se toca.

## Tareas
| # | Tarea | Subagente | Archivos | Depende de |
|---|---|---|---|---|
| 1 | `CsvGastos` (BOM, cabecera, CRLF, formato de fecha/importe, `campoTexto` con neutralización + escape) y su test unitario | backend-java | `backend/src/main/java/com/rquintanah/gastoscasa/exportar/CsvGastos.java`, `backend/src/test/java/com/rquintanah/gastoscasa/exportar/CsvGastosTest.java` (nuevos) | aprobación de D3–D5 |
| 2 | `RangoMes.MENSAJE_OBLIGATORIO` + uso en `ResumenService`; `GastoRepository.buscarEntreFechasCronologico` | backend-java | `gasto/RangoMes.java`, `resumen/ResumenService.java`, `gasto/GastoRepository.java` | — |
| 3 | `ArchivoCsv`, `ExportarService`, `ExportarController` (cabeceras, sin `produces`) | backend-java | `exportar/ArchivoCsv.java`, `exportar/ExportarService.java`, `exportar/ExportarController.java` (nuevos) | 1, 2 |
| 4 | Tests backend: `ExportarApiTest` (PostgreSQL con Testcontainers) y `ExportarServiceTest` (unitario, `mes` nulo/fuera de rango) | backend-java | `backend/src/test/java/com/rquintanah/gastoscasa/exportar/ExportarApiTest.java`, `ExportarServiceTest.java` (nuevos) | 3 |
| 5 | `urlExportarCsv` / `nombreArchivoCsv` + spec | frontend-angular | `frontend/src/app/core/exportar-csv.ts`, `exportar-csv.spec.ts` (nuevos) | contrato de este plan |
| 6 | Enlace «Exportar CSV» en la cabecera de la lista + estilos | frontend-angular | `paginas/gastos-page/gastos-page.ts`, `.html`, `.css` | 5 |
| 7 | Casos nuevos en `gastos-page.spec.ts` (al final) y verificación de criterios de aceptación, incluida la prueba manual en Excel/Sheets (R1) | qa | `frontend/src/app/paginas/gastos-page/gastos-page.spec.ts` | 4, 6 |
| 8 | Auditoría de inyección CSV, cabeceras y exposición de datos | seguridad | lectura de `exportar/*` y del enlace | 4, 6 |
| 9 | CHANGELOG/README (endpoint y botón) | documentador | `CHANGELOG.md`, `README.md` | 7, 8 |

**En paralelo:** backend (1–4) y frontend (5–6) desde el inicio, contra el contrato de arriba. Dentro del backend,
**1 y 2 en paralelo**.

## Pruebas necesarias
Comandos: `./mvnw -q test` (en `backend/`, necesita Docker) y `npm run test -- --watch=false` + `npm run lint` (en `frontend/`).

**`CsvGastosTest` (unitario, sin Spring)**
- Lista vacía ⇒ bytes exactos `EF BB BF` + `fecha;categoria;importe;nota\r\n`.
- Los 3 primeros bytes son el BOM y el BOM aparece una sola vez.
- Fila simple: `2026-11-02;Comida;45.50;pan\r\n`; nota `null` ⇒ `...;45.50;\r\n`.
- Importe: `45.5` → `45.50`, `12` → `12.00`, `1234.5` → `1234.50`, `9999999999.99` sin notación científica ni miles.
- Escape (parametrizado): `a;b` → `"a;b"`; `di "hola"` → `"di ""hola"""`; `línea1\nlínea2` y `\r\n` → entre comillas
  con el salto intacto; `1,5 kg` → `"1,5 kg"` (si D5); texto normal sin comillas.
- Neutralización (parametrizado): `=1+1`, `+51 999`, `-20 %`, `@SUM(A1)` → `'` delante; (si D4) `\tx`, `\rx` también.
  Una nota con `=` en medio (`a=b`) no se toca.
- Combinado: `=HYPERLINK("http://x";"y")` → `"'=HYPERLINK(""http://x"";""y"")"` (neutraliza y luego escapa).
- `campoTexto` se aplica a la categoría (con un nombre de categoría ficticio `=X` en el test unitario).
- UTF-8: `Café ñandú` produce los bytes UTF-8 esperados.
- Volver a leer el CSV generado con un parser mínimo del propio test (o comprobación por líneas) confirma 4 campos
  por fila en todos los casos anteriores.

**`ExportarApiTest` (MockMvcTester + PostgreSQL)**
- `200`, `Content-Type` compatible con `text/csv` y `charset=UTF-8`; `Content-Disposition` = `attachment; filename="gastos-2026-02.csv"`
  (comparar con `ContentDisposition.parse`: tipo `attachment` y `filename` exacto).
- Cuerpo: BOM + cabecera + solo las filas del mes pedido (un gasto del 31 del mes anterior y otro del día 1 del
  siguiente **no** salen), en orden `fecha asc, id asc` (dos gastos el mismo día salen por id).
- Nota con `;`, comillas y salto de línea guardada vía `POST /api/gastos` y exportada correctamente.
- Nota `=1+1` guardada vía API ⇒ `'=1+1` en el CSV.
- Mes sin gastos y mes futuro ⇒ `200` con solo BOM + cabecera.
- `400` con `errores.mes` para: sin `mes`, `mes=` vacío, los mal formados de la tabla y `-0001-01`/`10000-01`
  (mismos mensajes literales que el resumen).
- `GET /api/gastos/export` no cae en `/{id}` (no responde `errores.id`).
- `400` con `Accept: text/csv,*/*` sigue siendo `application/problem+json` (no `406`).

**`ExportarServiceTest`**: `mes` nulo ⇒ `DatoInvalidoException` con campo `mes`; nombre de archivo `gastos-2026-11.csv`.
Los tests existentes de `ResumenApiTest`/`ResumenServiceTest` siguen verdes sin cambios (el literal no cambia).

**Frontend**
- `exportar-csv.spec.ts`: `urlExportarCsv('2026-11')` = `/api/gastos/export?mes=2026-11`; `nombreArchivoCsv('2026-01')` = `gastos-2026-01.csv`.
- `gastos-page.spec.ts` (casos nuevos al final, reutilizando `cargarNoviembre()`):
  - Hay un enlace con texto «Exportar CSV», `href` que termina en `/api/gastos/export?mes=2026-11` y `download="gastos-2026-11.csv"`.
  - Tras pulsar «Mes anterior» (y atender la petición de octubre y su resumen), el enlace pasa a `?mes=2026-10` y `gastos-2026-10.csv`.
  - Con el mes sin gastos el enlace sigue presente.
  - **No** se hace `click()` sobre el enlace (jsdom no implementa la navegación y ensucia la salida); se verifica el
    atributo. `HttpTestingController.verify()` confirma que el enlace no lanza peticiones `HttpClient`.

**Manual (qa, con datos ficticios, stack aparte `-p gastos-pr`)**: descargar el CSV, abrirlo con doble clic en Excel
de Raul y en Google Sheets (Archivo › Importar). Comprobar acentos, 4 columnas, nota con `;`/salto de línea en una
sola celda, `'=1+1` como texto y no como fórmula, importe reconocido como número.

### Criterios de aceptación verificables
| Criterio del issue | Cómo se verifica |
|---|---|
| Botón descarga `gastos-AAAA-MM.csv` del mes elegido | `gastos-page.spec.ts` (`href`/`download` siguen al mes) + `Content-Disposition` en `ExportarApiTest` + manual |
| Columnas `fecha;categoria;importe;nota`, fecha `AAAA-MM-DD`, importe con punto y 2 decimales | `CsvGastosTest` y `ExportarApiTest` |
| UTF-8 con BOM y separador `;` | bytes del BOM en ambos tests + prueba manual en Excel |
| Notas con `;`, comillas o saltos de línea no rompen el archivo | `CsvGastosTest` parametrizado + `ExportarApiTest` extremo a extremo |
| Nota que empiece por `=`, `+`, `-`, `@` sale con `'` | `CsvGastosTest` + `ExportarApiTest` |
| Mes sin gastos ⇒ solo cabecera | `CsvGastosTest` (bytes exactos) + `ExportarApiTest` |
| `GET /api/gastos/export?mes=AAAA-MM` con `Content-Type` y `Content-Disposition` | `ExportarApiTest` |

## Riesgos y decisiones abiertas
**Decisiones para Raul**

**D1. Orden de las filas: `fecha asc, id asc` (cronológico).** En una hoja se lee de arriba abajo y se suele
añadir al final; la pantalla usa `desc` porque lo reciente importa más. Alternativa: el mismo orden que la lista (`desc`),
reutilizando `buscarEntreFechas` sin método nuevo.

**D2. Descarga con `<a [href] download>`** (ver diseño). Alternativa: `HttpClient` + `Blob` + `createObjectURL`,
que permite mostrar el error en la página y deshabilitar el botón mientras descarga, a cambio de más código, cargar
el archivo en memoria y un test con `HttpTestingController` + mock de `URL.createObjectURL`.

**D3. La neutralización/escape se aplica también a `categoria`**, aunque hoy es una lista fija: coste cero, y
el `CLAUDE.md` contempla hacerla editable en un issue futuro (sería otra vía de inyección). `fecha` e `importe`
**no** se neutralizan: los genera el código y son siempre `AAAA-MM-DD` y `> 0`.

**D4. Ampliación respecto al issue: neutralizar también `\t` (0x09) y `\r` (0x0D) iniciales**, como recomienda OWASP
(«CSV Injection»). Hoy casi no se pueden dar (`notaLimpia` hace `strip()` al guardar), pero una fila insertada
directamente en la BD o un cambio futuro sí los dejaría pasar. Coste cero. **Recomendación: SÍ.**
Fuera de esta propuesta: variantes de ancho completo (`＝`, `＋`), que Excel no interpreta como fórmula en CSV.

**D5. Ampliación menor: entrecomillar también los campos con `,`**, además de `;`, `"`, `\r`, `\n`. RFC 4180 lo
permite (comillas siempre son válidas) y evita que Google Sheets o Excel con separador de lista `,` partan la nota
si adivinan mal el separador. **Recomendación: SÍ.**

**D6. `Cache-Control: no-store` en la respuesta.** Evita que el navegador guarde una copia de datos personales en su
caché. Inocuo para la descarga. **Recomendación: SÍ** (lo confirmará `seguridad`).

**D7. Sin átomo nuevo para el enlace** (único uso). Alternativa: `atomos/enlace-descarga` ya.

**Riesgos**
- **R1. Configuración regional de Excel.** Excel abre un CSV con doble clic usando el **separador de listas** de
  Windows. En `es-ES` es `;` y la coma es decimal; en **`es-PE` el decimal es `.` y el separador de listas suele ser
  `,`**: con doble clic, todo podría caer en una sola columna. El issue fija `;` y punto decimal, y este plan lo
  respeta. La alternativa `sep=;` en la primera línea hace que Excel **ignore el BOM** (acentos rotos) y aparece como
  fila en Sheets, así que se descarta. Mitigación: prueba manual en el Excel de Raul (tarea 7); si falla con doble
  clic, se documenta en el README «Datos › Desde texto/CSV» (detecta `;` y UTF-8) o Raul decide otro separador en un
  issue aparte.
- **R2. `'` visible.** En CSV, Excel muestra el apóstrofo como parte del texto (`'-20 % descuento`). Es lo que pide
  el issue y lo que recomienda OWASP; se asume.
- **R3. `Content-Type` sin espacio** (`text/csv;charset=UTF-8`): equivalente según RFC; los tests no comparan la cadena.
- **R4. Error de descarga poco visible** con el enlace (D2): aceptable en local.
- **R5. Rendimiento**: todo en memoria; con el volumen de un mes personal no es un problema. Si algún día se exporta
  «todo», pasar a `StreamingResponseBody`.
- **R6. Datos personales**: el CSV contiene gastos reales al usarse; los tests y ejemplos usan datos ficticios
  (repo público). La app sigue solo en `localhost`; el endpoint no añade exposición nueva respecto a `GET /api/gastos`.
- Sin dependencias nuevas (no Commons CSV ni OpenCSV: el escape necesario son ~20 líneas con tests exhaustivos).
  **Sin ADR**: no hay librería, patrón ni servicio nuevo.

## ¿Requiere aprobación humana? **SÍ**
Requiere aprobación humana: **SÍ** — añade un endpoint a la **API pública** (`GET /api/gastos/export` con sus
cabeceras y su `400`) y es un punto sensible de **seguridad** (inyección CSV), regla 4 del `CLAUDE.md` y nota técnica
del issue #5. No toca esquema de BD ni autenticación. Expone datos personales del usuario solo hacia él mismo, en
`localhost`. Puntos a confirmar: **D1** (orden cronológico), **D2** (enlace `download`), **D3** (neutralizar también
categoría), **D4** (`\t` y `\r`, ampliación del issue), **D5** (entrecomillar `,`, ampliación menor),
**D6** (`Cache-Control: no-store`) y **D7** (sin átomo), además de aceptar el riesgo **R1**.

**Aprobado por Raul el 2026-11-04**, con D1–D7 tal como se recomiendan y el riesgo R1 aceptado (se mitiga con la prueba manual de la tarea 7).
