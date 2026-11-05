import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GastosStore } from './gastos-store';
import { MesSeleccionado } from './mes-seleccionado';
import { RELOJ } from './reloj';
import { ResumenCategoria } from './resumen-api';
import { ResumenStore } from './resumen-store';

const VIVIENDA = { id: 1, nombre: 'Vivienda' };
const COMIDA = { id: 2, nombre: 'Comida' };
const OCIO = { id: 5, nombre: 'Ocio' };
const FILAS: ResumenCategoria[] = [
  { categoria: VIVIENDA, total: 1234.5, cantidad: 2 },
  { categoria: COMIDA, total: 80, cantidad: 5 },
  { categoria: OCIO, total: 80, cantidad: 1 },
];

const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('ResumenStore', () => {
  let store: ResumenStore;
  let http: HttpTestingController;
  let periodo: MesSeleccionado;
  let gastos: GastosStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ResumenStore,
        { provide: RELOJ, useValue: () => new Date(2026, 10, 15) },
      ],
    });
    store = TestBed.inject(ResumenStore);
    periodo = TestBed.inject(MesSeleccionado);
    gastos = TestBed.inject(GastosStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const resumenDe = (mes: string) =>
    http.expectOne((r) => r.url === '/api/gastos/resumen' && r.params.get('mes') === mes);

  /** Ejecuta los efectos pendientes. */
  const efectos = () => TestBed.tick();

  it('al crearse pide el resumen del mes actual', async () => {
    efectos();
    expect(store.cargando()).toBe(true);
    resumenDe('2026-11').flush(FILAS);
    await tick();
    expect(store.cargando()).toBe(false);
    expect(store.barras().map((b) => b.categoria.nombre)).toEqual(['Vivienda', 'Comida', 'Ocio']);
  });

  it('barras incluye el porcentaje (suma 100) y conserva el orden de la API', async () => {
    efectos();
    resumenDe('2026-11').flush(FILAS);
    await tick();
    const porcentajes = store.barras().map((b) => b.porcentaje);
    expect(porcentajes).toEqual([88, 6, 6]);
    expect(porcentajes.reduce((a, b) => a + b, 0)).toBe(100);
    expect(store.barras()[0]).toEqual({ ...FILAS[0], porcentaje: 88 });
  });

  it('al cambiar de mes vacía las barras y pide el nuevo mes', async () => {
    efectos();
    resumenDe('2026-11').flush(FILAS);
    await tick();

    periodo.ir('2026-10');
    efectos();
    expect(store.barras()).toEqual([]);
    resumenDe('2026-10').flush([FILAS[1]]);
    await tick();
    expect(store.barras().map((b) => b.porcentaje)).toEqual([100]);
  });

  it('tras un alta, edición o borrado vuelve a pedir el mismo mes sin vaciar las barras', async () => {
    efectos();
    resumenDe('2026-11').flush(FILAS);
    await tick();

    const borrado = gastos.borrar(1);
    http.expectOne({ method: 'DELETE', url: '/api/gastos/1' }).flush(null, { status: 204, statusText: 'No Content' });
    await borrado;
    efectos();
    expect(store.barras().length).toBe(3);
    resumenDe('2026-11').flush([FILAS[1]]);
    await tick();
    expect(store.barras().length).toBe(1);
  });

  it('de dos peticiones solapadas solo se aplica la última', async () => {
    efectos();
    const primera = resumenDe('2026-11');
    const segunda = store.cargar();
    const ultima = resumenDe('2026-11');

    ultima.flush([FILAS[1]]);
    await segunda;
    primera.flush(FILAS); // llega tarde
    await tick();

    expect(store.barras().length).toBe(1);
    expect(store.cargando()).toBe(false);
  });

  it('el indicador de carga no se apaga hasta que terminan todas las peticiones', async () => {
    efectos();
    const primera = resumenDe('2026-11');
    const segunda = store.cargar();
    const ultima = resumenDe('2026-11');

    ultima.flush(FILAS);
    await segunda;
    expect(store.cargando()).toBe(true);
    primera.flush(FILAS);
    await tick();
    expect(store.cargando()).toBe(false);
  });

  it('muestra el mensaje de un error HTTP', async () => {
    efectos();
    resumenDe('2026-11').flush(
      { errores: { mes: 'El mes es obligatorio' } },
      { status: 400, statusText: 'Bad Request' },
    );
    await tick();
    expect(store.error()).toBe('El mes es obligatorio');
    expect(store.cargando()).toBe(false);
  });
});
