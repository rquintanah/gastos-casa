import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Gasto } from '../../core/modelos';
import { RELOJ } from '../../core/reloj';
import { GastosPage } from './gastos-page';

const COMIDA = { id: 2, nombre: 'Comida' };
const NOVIEMBRE: Gasto[] = [
  { id: 2, fecha: '2026-11-02', importe: 10.5, categoria: COMIDA, nota: 'pan' },
  { id: 1, fecha: '2026-11-01', importe: 20, categoria: COMIDA, nota: null },
];
const OCTUBRE: Gasto[] = [{ id: 3, fecha: '2026-10-20', importe: 7.25, categoria: COMIDA, nota: 'cena' }];

const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('GastosPage · aviso de guardado en otro mes', () => {
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
    http.expectOne('/api/categorias').flush([COMIDA]);
    gastosDelMes('2026-11').flush(NOVIEMBRE);
    resumenDe('2026-11');
    await refrescar();
  });

  afterEach(() => http.verify());

  const gastosDelMes = (mes: string) =>
    http.expectOne((r) => r.url === '/api/gastos' && r.method === 'GET' && r.params.get('mes') === mes);
  const resumenDe = (mes: string) =>
    http.expectOne((r) => r.url === '/api/gastos/resumen' && r.params.get('mes') === mes).flush([]);

  async function refrescar(): Promise<void> {
    await fixture.whenStable();
    await tick();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const aviso = () => html.querySelector('app-aviso-otro-mes') as HTMLElement;
  const textoAviso = () => (aviso().textContent ?? '').replace(/\s+/g, ' ').trim();
  const botonAviso = (texto: string) =>
    Array.from(aviso().querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === texto) as
      | HTMLButtonElement
      | undefined;

  function rellenar(fecha: string): void {
    const f = html.querySelector('input[type=date]') as HTMLInputElement;
    f.value = fecha;
    f.dispatchEvent(new Event('input'));
    const imp = html.querySelector('input[type=number]') as HTMLInputElement;
    imp.value = '12.50';
    imp.dispatchEvent(new Event('input'));
    const sel = html.querySelector('select') as HTMLSelectElement;
    sel.selectedIndex = 1;
    sel.dispatchEvent(new Event('change'));
  }

  async function enviar(): Promise<void> {
    (html.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await tick();
  }

  /** Alta con la fecha dada; el servidor responde bien y la página recarga el mes mostrado. */
  async function altaOk(fecha: string, mesMostrado = '2026-11', gastos: Gasto[] = NOVIEMBRE): Promise<void> {
    rellenar(fecha);
    await enviar();
    http.expectOne({ method: 'POST', url: '/api/gastos' }).flush({ id: 9, fecha, importe: 12.5, categoria: COMIDA, nota: null });
    await tick();
    gastosDelMes(mesMostrado).flush(gastos);
    await refrescar();
    resumenDe(mesMostrado);
    await refrescar();
  }

  it('el aviso es una región role="status" presente desde el inicio, aunque vacía', () => {
    expect(aviso().getAttribute('role')).toBe('status');
    expect(aviso().textContent?.trim()).toBe('');
  });

  it('un alta en otro mes muestra «Guardado en octubre 2026» y el botón «Ver octubre 2026»', async () => {
    await altaOk('2026-10-05');

    expect(textoAviso()).toContain('Guardado en octubre 2026');
    expect(botonAviso('Ver octubre 2026')).toBeDefined();
    expect(html.querySelector('.etiqueta')?.textContent).toContain('noviembre 2026');
  });

  it('una edición que mueve el gasto a otro mes también avisa', async () => {
    (html.querySelector('tbody tr .secundario') as HTMLButtonElement).click();
    await refrescar();
    const f = html.querySelector('input[type=date]') as HTMLInputElement;
    f.value = '2026-09-10';
    f.dispatchEvent(new Event('input'));
    await enviar();
    http.expectOne({ method: 'PUT', url: '/api/gastos/2' }).flush({ ...NOVIEMBRE[0], fecha: '2026-09-10' });
    await tick();
    gastosDelMes('2026-11').flush([NOVIEMBRE[1]]);
    await refrescar();
    resumenDe('2026-11');
    await refrescar();

    expect(textoAviso()).toContain('Guardado en setiembre 2026');
    expect(botonAviso('Ver setiembre 2026')).toBeDefined();
  });

  it('guardar en el mismo mes no muestra aviso', async () => {
    await altaOk('2026-11-03');

    expect(textoAviso()).toBe('');
    expect(aviso().querySelector('button')).toBeNull();
  });

  it('pulsar «Ver …» cambia de mes, pide sus datos y el aviso desaparece', async () => {
    await altaOk('2026-10-05');

    botonAviso('Ver octubre 2026')!.click();
    await tick();
    fixture.detectChanges();
    gastosDelMes('2026-10').flush(OCTUBRE);
    resumenDe('2026-10');
    await refrescar();

    expect(html.querySelector('.etiqueta')?.textContent).toContain('octubre 2026');
    expect(html.textContent).toContain('cena');
    expect(textoAviso()).toBe('');
  });

  it('«×» cierra el aviso sin cambiar de mes', async () => {
    await altaOk('2026-10-05');

    botonAviso('×')!.click();
    await tick();
    fixture.detectChanges();

    expect(textoAviso()).toBe('');
    expect(html.querySelector('.etiqueta')?.textContent).toContain('noviembre 2026');
  });

  it('cambiar de mes con el selector limpia el aviso', async () => {
    await altaOk('2026-10-05');

    (html.querySelector('button[aria-label="Mes anterior"]') as HTMLButtonElement).click();
    await tick();
    fixture.detectChanges();
    gastosDelMes('2026-10').flush(OCTUBRE);
    resumenDe('2026-10');
    await refrescar();

    expect(textoAviso()).toBe('');
  });

  it('un guardado fallido no muestra aviso', async () => {
    rellenar('2026-10-05');
    await enviar();
    http
      .expectOne({ method: 'POST', url: '/api/gastos' })
      .flush({ detail: 'x' }, { status: 500, statusText: 'Server Error' });
    await refrescar();

    expect(textoAviso()).toBe('');
    expect(html.querySelector('[role=alert]')).not.toBeNull();
  });

  it('un nuevo guardado en el mismo mes limpia el aviso anterior', async () => {
    await altaOk('2026-10-05');
    expect(textoAviso()).toContain('Guardado en octubre 2026');

    await altaOk('2026-11-03');

    expect(textoAviso()).toBe('');
  });

  it('un nuevo guardado en otro mes reemplaza el aviso anterior', async () => {
    await altaOk('2026-10-05');
    await altaOk('2026-09-05');

    expect(textoAviso()).toContain('Guardado en setiembre 2026');
    expect(textoAviso()).not.toContain('octubre');
  });

  it('un nuevo guardado fallido limpia el aviso anterior', async () => {
    await altaOk('2026-10-05');

    rellenar('2026-10-06');
    await enviar();
    http.expectOne({ method: 'POST', url: '/api/gastos' }).flush(null, { status: 0, statusText: 'Unknown' });
    await refrescar();

    expect(textoAviso()).toBe('');
  });
});
