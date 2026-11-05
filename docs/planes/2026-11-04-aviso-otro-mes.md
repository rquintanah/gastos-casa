# Plan: aviso al guardar un gasto en otro mes (issue #8)

## Objetivo
Si se ve un mes y se **crea o edita** un gasto cuya fecha cae en **otro mes**, el gasto desaparece de la lista sin
explicación. Tras guardar con éxito, mostrar «Guardado en noviembre 2026.» con un botón para ir a ese mes.
Solo frontend: la API, el esquema y `GastosStore` no cambian.

## Alcance / Fuera de alcance
**Dentro**
- Molécula nueva `aviso-otro-mes` (presentacional) y su cableado en `gastos-page`.
- El aviso sirve para el **alta y la edición** (decisión D4).
- Tests de la molécula y de la página.

**Fuera**
- Cambiar la API, `GastosStore`, `GastosApi`, `MesSeleccionado` o `mes.ts`.
- Hacer `MesSeleccionado.maximo` dinámico (se fija al cargar la app; riesgo 4 del #3, sigue aceptado).
- Avisos tras borrar (el gasto borrado era del mes visto, así que no hay «otro mes»).
- Guardar el mes en la URL (D1 del #4: issue aparte).
- La cabecera de la lista y todo lo del #5 (exportar CSV).

## Diseño

### Lo que hay hoy (comprobado en el código)
- `GastosPage.guardar(datos)` llama a `store.guardar(datos, editando()?.id)`; si va bien, limpia el formulario.
  `store.guardar` recarga **el mes seleccionado**, así que el gasto de otro mes ya no vuelve en la lista.
- `core/mes.ts` ya tiene `mesDeFechaIso('2026-11-04') → '2026-11'` (sin `Date`, sin desfase de zona) y
  `etiquetaMes('2026-11') → 'noviembre 2026'`. Se **usan**, no se modifican.
- `MesSeleccionado.ir(mes)` recorta a `maximo` (el mes actual **al cargar la app**).
- El efecto del constructor de la página ya reacciona a `periodo.mes()` (limpia `porBorrar` y recarga). Ahí se
  limpiará también el aviso.

### ¿Puede existir un gasto con fecha futura? (comprobado)
- **Backend:** `GastoRequest.fecha` lleva `@PastOrPresent` → una fecha futura da `400`. El contenedor del backend
  corre con `TZ: America/Lima` (`docker-compose.yml`).
- **Formulario:** validador `noFutura` (compara con `hoyIso()` en cada validación) y `[max]="hoy"` en el
  `<input type="date">`.
- Conclusión: **no se puede guardar un gasto de un mes futuro**. El único caso en que el mes destino es mayor que
  `periodo.maximo` es una **pestaña abierta al cambiar de mes** (p. ej. se abre el 31/10, el 01/11 se crea un gasto
  de hoy: `maximo` sigue en `2026-10`). Ahí `periodo.ir('2026-11')` recortaría a octubre: el botón engañaría.
  → Decisión D2.

### Frontend

**Molécula nueva `moleculas/aviso-otro-mes/`** (`aviso-otro-mes.ts`, `.html`, `.css`, `.spec.ts`), presentacional,
standalone, `OnPush`, sin estado propio:
```ts
selector: 'app-aviso-otro-mes'
host: { role: 'status' }          // región viva PERMANENTE (ver D3)
readonly mes = input<Mes | null>(null);   // mes donde se guardó; null = sin aviso (host vacío)
readonly maximo = input.required<Mes>();  // como selector-mes
readonly ir = output<Mes>();
readonly cerrar = output<void>();
// protegido: navegable = computed(() => mes !== null && mes <= maximo)
```
Plantilla (con `mes` no nulo; con `null` no pinta nada dentro del host):
- Texto: «Guardado en {{ etiquetaMes(mes) }}.»
- Si `navegable`: botón `type="button"` «Ver {{ etiquetaMes(mes) }}» → `ir.emit(mes)`.
- Si no: texto «Recarga la página para ver ese mes.» y sin botón.
- Botón cerrar `type="button"`, contenido «×», `aria-label="Cerrar aviso"` → `cerrar.emit()`.
- CSS propio de la molécula: mismo aspecto que `.aviso.confirmar` de la página (flex, `gap`, `border-radius: 6px`,
  `background: var(--aviso-fondo)`), pero definido en su `.css` para no tocar `gastos-page.css` ni `styles.css`.
  Fondo, padding y margen van en un contenedor interno (`.aviso`) que solo existe con `mes` no nulo; `:host` queda
  como `display: block` sin padding ni margen, así vacío no ocupa espacio (`:host:empty` no es fiable: Angular deja
  nodos de comentario).

**Página `gastos-page`** — cambios mínimos y fuera de la cabecera:
- `gastos-page.ts`
  - Importar `AvisoOtroMes` y añadirlo a `imports` del componente.
  - Importar `Mes` y `mesDeFechaIso` de `core/mes`.
  - Signal nueva: `protected readonly guardadoEn = signal<Mes | null>(null);`
  - En el efecto existente (dentro del `untracked`): `this.guardadoEn.set(null);` → el aviso se va al cambiar de
    mes por cualquier vía (selector o el propio botón «Ver …»).
  - `guardar(datos)`:
    1. `this.guardadoEn.set(null)` antes de llamar al store (un nuevo guardado reemplaza al aviso anterior).
    2. Si `ok`: además de lo de hoy, `const mes = mesDeFechaIso(datos.fecha)`; si `mes !== this.periodo.mes()`
       → `this.guardadoEn.set(mes)`. Se compara con el mes **al terminar** (el que el usuario ve en ese momento).
    3. Si falla: no hay aviso (el error ya lo muestra `store.error()`).
- `gastos-page.html` — **una sola inserción**, en la sección del formulario, justo después de `<app-gasto-form … />`
  y antes de su `</section>` (líneas 8–9 de hoy; la cabecera del #5 empieza en la 12):
  ```html
  <app-aviso-otro-mes
    [mes]="guardadoEn()"
    [maximo]="periodo.maximo"
    (ir)="periodo.ir($event)"
    (cerrar)="guardadoEn.set(null)"
  />
  ```
  Motivo de la ubicación: es donde está la vista al pulsar «Añadir gasto»/«Guardar cambios», también en móvil
  (donde la lista queda debajo del resumen y un aviso allí no se vería), y queda lejos de la cabecera del #5.
- `gastos-page.css`: **sin cambios**.

**Estado (signals):** solo `guardadoEn` en la página. `GastosStore` no cambia: el dato necesario (`datos.fecha`) y
el resultado (`ok`) ya están en `GastosPage.guardar`, y así no se toca un archivo compartido con el #5.

### Datos
Sin cambios de esquema ni migraciones. Sin rollback de datos: revertir el PR basta.

## Decisiones para Raul (propuesta)
**D1. Cuándo desaparece el aviso** — propuesta: **sin temporizador**. Desaparece al:
(a) pulsar «×»; (b) cambiar de mes por cualquier vía (incluido «Ver …»); (c) iniciar otro guardado (si ese también
cae en otro mes, sale el aviso nuevo). No desaparece al borrar, al empezar a editar ni al cancelar la edición.
Motivo: un aviso que se va solo puede no leerse (WCAG 2.2.1, límites de tiempo) y aquí no estorba.
Alternativa: autocierre a los 8 s (añade timers y tests con fake timers).

**D2. Mes destino mayor que `maximo`** (solo pestaña abierta al cambiar de mes; un gasto futuro es imposible, ver
arriba) — propuesta: mostrar «Guardado en noviembre 2026. Recarga la página para ver ese mes.» **sin botón**.
Alternativas: (a) ocultar el aviso; (b) hacer `maximo` dinámico en `MesSeleccionado` (fuera de alcance: servicio
compartido con el #5).

**D3. Accesibilidad** — propuesta: el host de la molécula lleva `role="status"` (equivale a `aria-live="polite"` +
`aria-atomic="true"`) y está **siempre en el DOM**, vacío cuando no hay aviso; el contenido aparece dentro. Así los
lectores de pantalla lo anuncian (una región viva que se inserta ya con texto a menudo no se anuncia). **No se mueve
el foco** (polite, no interrumpe). Botón «×» con `aria-label="Cerrar aviso"`; el botón de ir lleva el mes en el texto
(«Ver noviembre 2026»), no un genérico «Ver». No se usa `role="alert"`: no es un error.

**D4. ¿También en la edición?** — propuesta: **sí**, mismo texto («Guardado en …») para alta y edición. El problema
es idéntico (editar la fecha de un gasto de noviembre a octubre lo hace desaparecer) y la lógica no distingue.

**D5. Ubicación** — propuesta: debajo del formulario (ver Diseño). Alternativa: encima de la lista, tras la cabecera
(más cerca de donde «desaparece» el gasto, pero invisible en móvil y adyacente a la cabecera del #5).

## Coordinación con el #5 (exportar CSV, en paralelo en `../gastos-casa--exportar-csv`, rama `feat/exportar-csv`)
Este plan no lee ni toca ese worktree. Base común: `main` 3762893.

| Archivo | #8 (este plan) | Riesgo de conflicto con #5 |
|---|---|---|
| `core/gastos-api.ts` | **No lo toca** | Ninguno |
| `core/gastos-store.ts` (+ spec) | **No lo toca** | Ninguno |
| `core/mes.ts`, `core/mes-seleccionado.ts` | Solo los usa | Ninguno (salvo que #5 renombre `mesDeFechaIso`/`etiquetaMes`/`maximo`: no previsto) |
| `moleculas/aviso-otro-mes/*` | **Nuevos** | Ninguno |
| `paginas/gastos-page/gastos-page.html` | 1 bloque insertado entre `<app-gasto-form … />` y su `</section>` (sección del formulario) | Bajo: #5 cambia la `<header class="cabecera">` (≥ 3 líneas sin tocar entre medias) |
| `paginas/gastos-page/gastos-page.ts` | Línea `import` nueva, `imports: [...]`, 1 signal, 1 línea en el efecto, `guardar()` | Bajo; **medio** solo en la línea `imports: [...]` si #5 añade un componente. Se resuelve uniendo ambas listas |
| `paginas/gastos-page/gastos-page.css` | **No lo toca** | Ninguno |
| `paginas/gastos-page/gastos-page.spec.ts` | **No lo toca** | Ninguno |
| `paginas/gastos-page/gastos-page-aviso.spec.ts` | **Nuevo** (tests de integración del aviso) | Ninguno textual; ver rebase paso 4 |

**Si #5 se fusiona antes que #8:**
1. No hacer `push` de `feat/aviso-otro-mes` hasta saber si #5 entra primero; si se puede, rebasar **antes** del primer
   push. El agente nunca hace `push --force` (regla 1): si la rama ya estaba publicada, avisar a Raul.
2. `git fetch origin && git rebase origin/main`.
3. Conflictos esperables: solo `gastos-page.ts` (`imports: [...]` y líneas `import` del principio) → quedarse con
   **ambos** componentes en orden alfabético. En `gastos-page.html`, si apareciera, conservar la cabecera de #5 y el
   bloque `<app-aviso-otro-mes>` de #8 en la sección del formulario.
4. Pasar **todos** los tests del frontend. Si #5 añadió peticiones HTTP en la carga de la página, el helper de
   `gastos-page-aviso.spec.ts` (copia del de `gastos-page.spec.ts`) debe atenderlas igual que el spec original
   (`http.verify()` fallaría si no). Copiar el cambio que #5 hizo en `cargarNoviembre()`.
5. `npm run lint` y `npm run build`.

**Si #8 se fusiona antes:** quien termine #5 hace lo mismo a la inversa; el único punto probable es `imports: [...]`.

## Tareas
| # | Tarea | Subagente | Archivos | Depende de |
|---|---|---|---|---|
| 1 | Molécula `aviso-otro-mes` (inputs/outputs de este plan, `role="status"` en el host, estilos propios) + spec | frontend-angular | `frontend/src/app/moleculas/aviso-otro-mes/aviso-otro-mes.ts`, `.html`, `.css`, `.spec.ts` (nuevos) | Aprobación de D1–D5 |
| 2 | Cablear en la página: signal `guardadoEn`, limpieza en el efecto, lógica en `guardar()`, inserción en la sección del formulario | frontend-angular | `frontend/src/app/paginas/gastos-page/gastos-page.ts`, `gastos-page.html` | 1 (o solo su contrato: se pueden hacer a la vez) |
| 3 | Tests de integración del aviso en un spec nuevo de la página; ejecutar toda la suite, lint y build; verificación manual guiada | qa | `frontend/src/app/paginas/gastos-page/gastos-page-aviso.spec.ts` (nuevo) | 2 |

**En paralelo:** 1 y 2 se pueden hacer a la vez contra el contrato de la molécula fijado arriba; 3 después.
Ninguna tarea de backend ni de datos.

## Pruebas necesarias
Frontend con Vitest, `RELOJ = () => new Date(2026, 10, 15)` como en los specs actuales.
**Ojo con las fechas:** el formulario valida «no futura» con el reloj **real** (`hoyIso()`), no con `RELOJ`. Usar en los
tests solo fechas claramente pasadas (`2026-10-xx`, `2026-11-01`) para que no dependan del día en que se ejecutan.

**`aviso-otro-mes.spec.ts`** (tarea 1):
- Con `mes = null`: el host existe, tiene `role="status"` y no contiene texto ni botones.
- `mes='2026-10'`, `maximo='2026-11'`: texto «Guardado en octubre 2026.»; botón «Ver octubre 2026» emite
  `ir('2026-10')`.
- `mes = maximo` (`'2026-11'`): hay botón «Ver noviembre 2026».
- `mes='2026-12'`, `maximo='2026-11'`: texto con «Recarga la página» y **ningún** botón «Ver …».
- Botón con `aria-label="Cerrar aviso"` emite `cerrar`.
- Los botones son `type="button"`.

**`gastos-page-aviso.spec.ts`** (tarea 3; setup y helpers copiados de `gastos-page.spec.ts`):
- Viendo noviembre, **crear** un gasto con fecha `2026-10-05` → tras el `POST` y la recarga, aparece «Guardado en
  octubre 2026.» dentro de `[role=status]`; el gasto no está en la lista.
- Pulsar «Ver octubre 2026» → se piden gastos **y** resumen de `2026-10`, la etiqueta del selector dice «octubre 2026»
  y el aviso desaparece (el `[role=status]` sigue en el DOM, vacío).
- Viendo noviembre, **editar** el gasto 2 a `2026-10-05` → aviso «Guardado en octubre 2026.» (D4).
- Viendo octubre («Mes anterior»), crear un gasto con fecha `2026-11-01` → aviso «Guardado en noviembre 2026.» con
  botón (noviembre = `maximo`).
- Crear un gasto del **mismo mes** que se ve (`2026-11-01` viendo noviembre) → sin aviso.
- Si el `POST` falla (`400`) → sin aviso y se ve el error de siempre.
- «×» oculta el aviso sin pedir nada al backend.
- Con el aviso visible, «Mes anterior» lo oculta.
- Con el aviso visible, un nuevo guardado del mismo mes lo quita.
- Ningún test existente cambia (`gastos-page.spec.ts` y `gastos-store.spec.ts` quedan igual y en verde).

El caso «mes destino > `maximo`» se cubre en el spec de la molécula: en la página habría que forzar un reloj real
posterior al `RELOJ`, lo que haría el test dependiente de la fecha del sistema.

**Manual (Raul):** `docker compose up -d --build`; viendo el mes actual crear un gasto del mes pasado → aviso y botón
funciona; ir a un mes pasado y crear uno de hoy → aviso; editar la fecha de un gasto a otro mes → aviso; «×» y cambiar
de mes lo quitan; vista a ~400 px (el aviso queda bajo el formulario, visible sin desplazarse); modo oscuro; con lector
de pantalla (NVDA/Narrador) se anuncia «Guardado en …» sin mover el foco.

## Riesgos y decisiones abiertas
- **D1–D5** arriba: son las decisiones a aprobar.
- **Foco tras «Ver …»:** el botón desaparece al cambiar de mes y el foco vuelve al `body`. El cambio de mes ya se
  anuncia (la etiqueta del selector tiene `aria-live="polite"`). Se acepta; si molesta, mover el foco al título de la
  lista sería un cambio pequeño posterior.
- **Comparación al terminar el guardado:** si el usuario cambia de mes mientras se guarda y acaba en el mes del gasto,
  no hay aviso (correcto: ya lo ve). Si cambia a otro distinto, el aviso se calcula contra el mes que ve al terminar.
- **Spec duplicado:** el helper de `gastos-page-aviso.spec.ts` copia ~40 líneas de `gastos-page.spec.ts` para no
  chocar con el #5. Tras fusionar ambos, un `refactor:` puede extraer los helpers comunes.
- **`maximo` fijo** (riesgo 4 del #3): D2 lo hace explícito en vez de esconderlo.
- Sin dependencias nuevas. **Sin ADR:** no hay librería, patrón ni servicio nuevo.

## ¿Requiere aprobación humana? NO
Requiere aprobación humana: **NO** — solo frontend; no toca esquema de BD, contratos de API públicos,
autenticación/autorización ni datos personales (regla 4 del `CLAUDE.md`). Aun así, conviene que Raul confirme
**D1–D5** (comportamiento visible) antes de empezar la tarea 1.

**Aprobado por Raul el 2026-11-04:** D1–D5 tal como están propuestas. Integración con el #5: si se fusiona antes, se hace `git merge origin/main` en la rama (sin rebase ni `push --force`).
