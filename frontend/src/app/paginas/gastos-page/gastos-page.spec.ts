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

  async function cargarNoviembre(): Promise<void> {
    http.expectOne('/api/categorias').flush([COMIDA]);
    gastosDelMes('2026-11').flush(NOVIEMBRE);
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
    await refrescar();

    expect(filas().length).toBe(0);
    expect(html.textContent).toContain('No hay gastos en octubre 2026');
  });

  it('«Mes siguiente» está deshabilitado en el mes actual y se habilita en meses pasados', async () => {
    await cargarNoviembre();
    expect(boton('Mes siguiente').disabled).toBe(true);

    await pulsar('Mes anterior');
    gastosDelMes('2026-10').flush(OCTUBRE);
    await refrescar();
    expect(boton('Mes siguiente').disabled).toBe(false);

    await pulsar('Mes siguiente');
    gastosDelMes('2026-11').flush(NOVIEMBRE);
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
    fixture.detectChanges();

    expect(filas().length).toBe(1);
    expect(html.textContent).not.toContain('pan');
    expect(total().replace(/\s/g, '')).toContain('20.00');
  });

  it('si falla la carga de un mes muestra el error', async () => {
    await cargarNoviembre();

    await pulsar('Mes anterior');
    gastosDelMes('2026-10').flush(null, { status: 0, statusText: 'Unknown' });
    await refrescar();
    fixture.detectChanges();

    expect(html.querySelector('[role=alert]')?.textContent).toContain('No se pudo conectar');
  });

  it('tras un error de red al cambiar de mes no muestra los gastos del mes anterior', async () => {
    await cargarNoviembre();

    await pulsar('Mes anterior');
    gastosDelMes('2026-10').flush(null, { status: 0, statusText: 'Unknown' });
    await refrescar();

    expect(html.querySelector('.etiqueta')?.textContent).toContain('octubre 2026');
    expect(html.textContent).not.toContain('pan'); // gasto de noviembre
    expect(html.textContent).not.toContain('No hay gastos en octubre 2026'); // sería engañoso
    expect(html.querySelector('[role=alert]')).not.toBeNull();
  });
});
