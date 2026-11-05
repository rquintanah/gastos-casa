import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Gasto } from '../../core/modelos';
import { ResumenCategoria } from '../../core/resumen-api';
import { RELOJ } from '../../core/reloj';
import { GastosPage } from './gastos-page';

const COMIDA = { id: 2, nombre: 'Comida' };
const NOVIEMBRE: Gasto[] = [
  { id: 2, fecha: '2026-11-02', importe: 10.5, categoria: COMIDA, nota: 'pan' },
  { id: 1, fecha: '2026-11-01', importe: 20, categoria: COMIDA, nota: null },
];
const VIVIENDA = { id: 1, nombre: 'Vivienda' };
const OCIO = { id: 5, nombre: 'Ocio' };
const RESUMEN_NOV: ResumenCategoria[] = [
  { categoria: VIVIENDA, total: 1234.5, cantidad: 2 },
  { categoria: COMIDA, total: 80, cantidad: 3 },
  { categoria: OCIO, total: 80, cantidad: 1 },
];
const OCTUBRE: Gasto[] = [{ id: 3, fecha: '2026-10-20', importe: 7.25, categoria: COMIDA, nota: 'cena' }];

/** Deja avanzar las promesas pendientes hasta la siguiente petición HTTP. */
const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('GastosPage', () => {
  let fixture: ComponentFixture<GastosPage>;
  let http: HttpTestingController;
  let html: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RELOJ, useValue: () => new Date(2026, 10, 15) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GastosPage);
    html = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const gastosDelMes = (mes: string) =>
    http.expectOne((r) => r.url === '/api/gastos' && r.method === 'GET' && r.params.get('mes') === mes);

  const resumenDe = (mes: string, filas: ResumenCategoria[] = []) =>
    http.expectOne((r) => r.url === '/api/gastos/resumen' && r.params.get('mes') === mes).flush(filas);

  async function cargarNoviembre(): Promise<void> {
    http.expectOne('/api/categorias').flush([COMIDA]);
    gastosDelMes('2026-11').flush(NOVIEMBRE);
    resumenDe('2026-11');
    await refrescar();
  }

  async function refrescar(): Promise<void> {
    await fixture.whenStable();
    await tick(); // deja terminar el `finally` del store (cargando = false)
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const boton = (etiqueta: string) => html.querySelector(`button[aria-label="${etiqueta}"]`) as HTMLButtonElement;
  const filas = () => html.querySelectorAll('tbody tr');
  const total = () => html.querySelector('tfoot')?.textContent ?? '';

  async function pulsar(etiqueta: string): Promise<void> {
    boton(etiqueta).click();
    await tick();
    fixture.detectChanges();
  }

  it('carga el mes actual y las categorías, y muestra el total del mes', async () => {
    await cargarNoviembre();

    expect(html.querySelector('.etiqueta')?.textContent).toContain('noviembre 2026');
    expect(filas().length).toBe(2);
    expect(total().replace(/\s/g, '')).toContain('30.50');
  });

  it('«Mes anterior» pide el mes previo y muestra su total', async () => {
    await cargarNoviembre();

    await pulsar('Mes anterior');
    gastosDelMes('2026-10').flush(OCTUBRE);
    resumenDe('2026-10');
    await refrescar();

    expect(html.querySelector('.etiqueta')?.textContent).toContain('octubre 2026');
    expect(filas().length).toBe(1);
    expect(html.textContent).toContain('cena');
    expect(total().replace(/\s/g, '')).toContain('7.25');
    expect(html.textContent).not.toContain('pan');
  });

  it('un mes sin gastos muestra «No hay gastos en <mes>»', async () => {
    await cargarNoviembre();

    await pulsar('Mes anterior');
    gastosDelMes('2026-10').flush([]);
    resumenDe('2026-10');
    await refrescar();

    expect(filas().length).toBe(0);
    expect(html.textContent).toContain('No hay gastos en octubre 2026');
  });

  it('«Mes siguiente» está deshabilitado en el mes actual y se habilita en meses pasados', async () => {
    await cargarNoviembre();
    expect(boton('Mes siguiente').disabled).toBe(true);

    await pulsar('Mes anterior');
    gastosDelMes('2026-10').flush(OCTUBRE);
    resumenDe('2026-10');
    await refrescar();
    expect(boton('Mes siguiente').disabled).toBe(false);

    await pulsar('Mes siguiente');
    gastosDelMes('2026-11').flush(NOVIEMBRE);
    resumenDe('2026-11');
    await refrescar();
    expect(boton('Mes siguiente').disabled).toBe(true);
  });

  it('al editar un gasto a una fecha de otro mes recarga con el mes y el gasto ya no aparece', async () => {
    await cargarNoviembre();

    (html.querySelector('tbody tr .secundario') as HTMLButtonElement).click(); // Editar gasto id 2
    await refrescar();
    const fecha = html.querySelector('input[type=date]') as HTMLInputElement;
    expect(fecha.value).toBe('2026-11-02');
    fecha.value = '2026-10-05';
    fecha.dispatchEvent(new Event('input'));
    (html.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await tick();

    const put = http.expectOne({ method: 'PUT', url: '/api/gastos/2' });
    expect(put.request.body.fecha).toBe('2026-10-05');
    put.flush({ ...NOVIEMBRE[0], fecha: '2026-10-05' });
    await tick();
    gastosDelMes('2026-11').flush([NOVIEMBRE[1]]); // el backend ya no lo devuelve en noviembre
    await refrescar();
    resumenDe('2026-11'); // el alta/edición dispara un refresco del resumen
    await refrescar();

    expect(filas().length).toBe(1);
    expect(html.textContent).not.toContain('pan');
    expect(total().replace(/\s/g, '')).toContain('20.00');
  });

  it('si falla la carga de un mes muestra el error', async () => {
    await cargarNoviembre();

    await pulsar('Mes anterior');
    gastosDelMes('2026-10').flush(null, { status: 0, statusText: 'Unknown' });
    resumenDe('2026-10');
    await refrescar();
    fixture.detectChanges();

    expect(html.querySelector('[role=alert]')?.textContent).toContain('No se pudo conectar');
  });

  it('tras un error de red al cambiar de mes no muestra los gastos del mes anterior', async () => {
    await cargarNoviembre();

    await pulsar('Mes anterior');
    gastosDelMes('2026-10').flush(null, { status: 0, statusText: 'Unknown' });
    resumenDe('2026-10');
    await refrescar();

    expect(html.querySelector('.etiqueta')?.textContent).toContain('octubre 2026');
    expect(html.textContent).not.toContain('pan'); // gasto de noviembre
    expect(html.textContent).not.toContain('No hay gastos en octubre 2026'); // sería engañoso
    expect(html.querySelector('[role=alert]')).not.toBeNull();
  });

  // ---- Resumen por categoría (issue #4) ----

  const bloqueResumen = () => html.querySelector('app-resumen-mes') as HTMLElement;
  const textoResumen = () => (bloqueResumen().textContent ?? '').replace(/\s+/g, ' ');
  const barras = () => Array.from(bloqueResumen().querySelectorAll('app-barra-categoria')) as HTMLElement[];
  const nombresBarras = () => barras().map((b) => b.querySelector('.nombre')?.textContent?.trim().split(' (')[0]);
  const anchos = () => barras().map((b) => (b.querySelector('.relleno') as HTMLElement).style.width);

  async function cargarNoviembreConResumen(filas: ResumenCategoria[] = RESUMEN_NOV): Promise<void> {
    http.expectOne('/api/categorias').flush([VIVIENDA, COMIDA, OCIO]);
    gastosDelMes('2026-11').flush(NOVIEMBRE);
    resumenDe('2026-11', filas);
    await refrescar();
  }

  it('la carga inicial pide el resumen de noviembre y muestra barras en orden con % que suman 100', async () => {
    await cargarNoviembreConResumen();

    expect(bloqueResumen().querySelector('h2')?.textContent).toContain('Resumen de noviembre 2026');
    expect(nombresBarras()).toEqual(['Vivienda', 'Comida', 'Ocio']);
    const porcentajes = barras().map((b) => Number(b.querySelector('.porcentaje')?.textContent?.replace(/\D/g, '')));
    expect(porcentajes).toEqual([88, 6, 6]);
    expect(porcentajes.reduce((a, b) => a + b, 0)).toBe(100);
    expect(anchos()).toEqual(['88%', '6%', '6%']);
    const texto = textoResumen().replace(/\u00a0/g, ' ');
    expect(texto).toContain('S/ 1,234.50');
    expect(texto).toContain('2 gastos');
    expect(texto).toContain('1 gasto)');
    expect(textoResumen()).not.toContain('Sin gastos este mes');
  });

  it('el total llega como número JSON (1234.50) y se pinta como importe', async () => {
    http.expectOne('/api/categorias').flush([VIVIENDA]);
    gastosDelMes('2026-11').flush([]);
    const cuerpo = JSON.parse('[{"categoria":{"id":1,"nombre":"Vivienda"},"total":1234.50,"cantidad":2}]');
    expect(typeof cuerpo[0].total).toBe('number');
    resumenDe('2026-11', cuerpo);
    await refrescar();

    expect(textoResumen().replace(/\u00a0/g, ' ')).toContain('S/ 1,234.50');
    expect(textoResumen()).toContain('100 %');
  });

  it('un mes sin gastos muestra «Sin gastos este mes» y ninguna barra', async () => {
    await cargarNoviembreConResumen([]);

    expect(textoResumen()).toContain('Sin gastos este mes');
    expect(barras().length).toBe(0);
  });

  it('«Mes anterior» pide el resumen de octubre, no deja a la vista el de noviembre y luego lo reemplaza', async () => {
    await cargarNoviembreConResumen();

    await pulsar('Mes anterior');
    gastosDelMes('2026-10').flush(OCTUBRE);
    const pendiente = http.expectOne((r) => r.url === '/api/gastos/resumen' && r.params.get('mes') === '2026-10');
    fixture.detectChanges();
    expect(textoResumen()).toContain('Resumen de octubre 2026');
    expect(barras().length).toBe(0); // nada de noviembre bajo el título de octubre
    expect(textoResumen()).not.toContain('Vivienda');
    expect(textoResumen()).toContain('Cargando…');
    expect(textoResumen()).not.toContain('Sin gastos este mes'); // sería engañoso mientras carga

    pendiente.flush([{ categoria: COMIDA, total: 7.25, cantidad: 1 }]);
    await refrescar();
    expect(nombresBarras()).toEqual(['Comida']);
    expect(textoResumen()).toContain('100 %');
  });

  it('una respuesta tardía del resumen de otro mes se descarta', async () => {
    await cargarNoviembreConResumen();

    await pulsar('Mes anterior');
    const gOct = gastosDelMes('2026-10');
    const rOct = http.expectOne((r) => r.url === '/api/gastos/resumen' && r.params.get('mes') === '2026-10');
    await pulsar('Mes siguiente');
    const gNov = gastosDelMes('2026-11');
    const rNov = http.expectOne((r) => r.url === '/api/gastos/resumen' && r.params.get('mes') === '2026-11');

    rNov.flush([{ categoria: OCIO, total: 5, cantidad: 1 }]);
    gNov.flush(NOVIEMBRE);
    await refrescar();
    rOct.flush([{ categoria: VIVIENDA, total: 999, cantidad: 9 }]); // llega tarde
    gOct.flush(OCTUBRE);
    await refrescar();

    expect(textoResumen()).toContain('Resumen de noviembre 2026');
    expect(nombresBarras()).toEqual(['Ocio']);
    expect(textoResumen()).not.toContain('Vivienda');
  });

  it('un error de red en el resumen muestra un aviso en su bloque sin tumbar la lista ni decir «Sin gastos»', async () => {
    http.expectOne('/api/categorias').flush([COMIDA]);
    gastosDelMes('2026-11').flush(NOVIEMBRE);
    http
      .expectOne((r) => r.url === '/api/gastos/resumen')
      .flush(null, { status: 0, statusText: 'Unknown' });
    await refrescar();

    expect(bloqueResumen().querySelector('[role=alert]')?.textContent).toContain('No se pudo conectar');
    expect(textoResumen()).not.toContain('Sin gastos este mes');
    expect(textoResumen()).not.toContain('Cargando');
    expect(barras().length).toBe(0);
    expect(filas().length).toBe(2); // la lista sigue funcionando
  });

  it('tras un error del resumen, cambiar de mes lo limpia y muestra el resumen nuevo', async () => {
    http.expectOne('/api/categorias').flush([COMIDA]);
    gastosDelMes('2026-11').flush(NOVIEMBRE);
    http.expectOne((r) => r.url === '/api/gastos/resumen').flush(null, { status: 500, statusText: 'x' });
    await refrescar();
    expect(bloqueResumen().querySelector('[role=alert]')).not.toBeNull();

    await pulsar('Mes anterior');
    gastosDelMes('2026-10').flush(OCTUBRE);
    resumenDe('2026-10', [{ categoria: COMIDA, total: 7.25, cantidad: 1 }]);
    await refrescar();

    expect(bloqueResumen().querySelector('[role=alert]')).toBeNull();
    expect(nombresBarras()).toEqual(['Comida']);
  });

  async function enviarFormulario(fecha: string, importe: string, categoriaIndice: number): Promise<void> {
    const f = html.querySelector('input[type=date]') as HTMLInputElement;
    f.value = fecha;
    f.dispatchEvent(new Event('input'));
    const i = html.querySelector('input[type=number]') as HTMLInputElement;
    i.value = importe;
    i.dispatchEvent(new Event('input'));
    const sel = html.querySelector('select') as HTMLSelectElement;
    sel.value = sel.options[categoriaIndice].value;
    sel.dispatchEvent(new Event('change'));
    (html.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await tick();
  }

  it('tras crear un gasto se vuelve a pedir el resumen del mes y se pinta el nuevo', async () => {
    await cargarNoviembreConResumen([{ categoria: COMIDA, total: 30.5, cantidad: 2 }]);
    expect(nombresBarras()).toEqual(['Comida']);

    await enviarFormulario('2026-11-03', '100', 3); // Ocio
    http.expectOne({ method: 'POST', url: '/api/gastos' }).flush({ id: 9, fecha: '2026-11-03', importe: 100, categoria: OCIO, nota: null });
    await tick();
    gastosDelMes('2026-11').flush(NOVIEMBRE);
    await refrescar(); // el efecto del resumen corre con la detección de cambios
    resumenDe('2026-11', [
      { categoria: OCIO, total: 100, cantidad: 1 },
      { categoria: COMIDA, total: 30.5, cantidad: 2 },
    ]);
    await refrescar();

    expect(nombresBarras()).toEqual(['Ocio', 'Comida']);
    expect(barras().map((b) => b.querySelector('.porcentaje')?.textContent?.trim())).toEqual(['77 %', '23 %']);
  });

  it('tras editar un gasto el resumen se refresca (misma categoría, otro importe)', async () => {
    await cargarNoviembreConResumen([{ categoria: COMIDA, total: 30.5, cantidad: 2 }]);

    (html.querySelector('tbody tr .secundario') as HTMLButtonElement).click();
    await refrescar();
    const i = html.querySelector('input[type=number]') as HTMLInputElement;
    i.value = '50';
    i.dispatchEvent(new Event('input'));
    (html.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await tick();
    http.expectOne({ method: 'PUT', url: '/api/gastos/2' }).flush({ ...NOVIEMBRE[0], importe: 50 });
    await tick();
    gastosDelMes('2026-11').flush(NOVIEMBRE);
    await refrescar();
    resumenDe('2026-11', [{ categoria: COMIDA, total: 70, cantidad: 2 }]);
    await refrescar();

    expect(textoResumen().replace(/\u00a0/g, ' ')).toContain('S/ 70.00');
    expect(textoResumen()).not.toContain('S/ 30.50');
  });

  it('tras borrar un gasto el resumen se refresca y, si era el último, muestra «Sin gastos este mes»', async () => {
    await cargarNoviembreConResumen([{ categoria: COMIDA, total: 7.25, cantidad: 1 }]);

    (html.querySelector('tbody tr .peligro') as HTMLButtonElement).click();
    await refrescar();
    (html.querySelector('.confirmar .peligro') as HTMLButtonElement).click();
    await tick();
    http.expectOne({ method: 'DELETE', url: '/api/gastos/2' }).flush(null, { status: 204, statusText: 'No Content' });
    await refrescar();
    resumenDe('2026-11', []);
    await refrescar();

    expect(barras().length).toBe(0);
    expect(textoResumen()).toContain('Sin gastos este mes');
  });

  it('si falla el alta no se vuelve a pedir el resumen', async () => {
    await cargarNoviembreConResumen([{ categoria: COMIDA, total: 30.5, cantidad: 2 }]);

    await enviarFormulario('2026-11-03', '100', 1);
    http.expectOne({ method: 'POST', url: '/api/gastos' }).flush({}, { status: 500, statusText: 'x' });
    await refrescar();

    http.expectNone((r) => r.url === '/api/gastos/resumen');
    expect(nombresBarras()).toEqual(['Comida']);
  });
});
