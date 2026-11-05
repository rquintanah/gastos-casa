import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GastosStore } from './gastos-store';
import { MesSeleccionado } from './mes-seleccionado';
import { Gasto } from './modelos';
import { RELOJ } from './reloj';

const COMIDA = { id: 2, nombre: 'Comida' };
const GASTOS: Gasto[] = [
  { id: 2, fecha: '2026-11-02', importe: 0.1, categoria: COMIDA, nota: null },
  { id: 1, fecha: '2026-11-01', importe: 0.2, categoria: COMIDA, nota: 'pan' },
];

/** Deja que las promesas pendientes avancen hasta la siguiente petición HTTP. */
const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('GastosStore', () => {
  let store: GastosStore;
  let http: HttpTestingController;
  let periodo: MesSeleccionado;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RELOJ, useValue: () => new Date(2026, 10, 15) },
      ],
    });
    store = TestBed.inject(GastosStore);
    periodo = TestBed.inject(MesSeleccionado);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const gastosDelMes = (mes: string) => http.expectOne((r) => r.url === '/api/gastos' && r.params.get('mes') === mes);

  it('carga las categorías', async () => {
    const carga = store.cargarCategorias();
    expect(store.cargando()).toBe(true);
    http.expectOne('/api/categorias').flush([COMIDA]);
    await carga;

    expect(store.cargando()).toBe(false);
    expect(store.categorias()).toEqual([COMIDA]);
  });

  it('carga los gastos del mes seleccionado y calcula el total sin errores de redondeo', async () => {
    const carga = store.cargarGastos();
    gastosDelMes('2026-11').flush(GASTOS);
    await carga;

    expect(store.cargando()).toBe(false);
    expect(store.gastos()).toEqual(GASTOS);
    expect(store.total()).toBe(0.3);
  });

  it('descarta la respuesta de un mes si el mes cambió mientras tanto', async () => {
    const primera = store.cargarGastos();
    const pendiente = gastosDelMes('2026-11');
    periodo.ir('2026-10');
    const segunda = store.cargarGastos();
    const octubre = gastosDelMes('2026-10');

    octubre.flush([GASTOS[1]]);
    await segunda;
    pendiente.flush(GASTOS); // llega tarde: no debe pisar octubre
    await primera;

    expect(store.gastos()).toEqual([GASTOS[1]]);
    expect(store.cargando()).toBe(false);
  });

  it('al cambiar de mes vacía la lista antes de que llegue la respuesta', async () => {
    const carga = store.cargarGastos();
    gastosDelMes('2026-11').flush(GASTOS);
    await carga;

    periodo.ir('2026-10');
    const otra = store.cargarGastos();
    expect(store.gastos()).toEqual([]);
    gastosDelMes('2026-10').flush([GASTOS[1]]);
    await otra;
    expect(store.gastos()).toEqual([GASTOS[1]]);
  });

  it('recargar el mismo mes no vacía la lista', async () => {
    const carga = store.cargarGastos();
    gastosDelMes('2026-11').flush(GASTOS);
    await carga;

    const recarga = store.cargarGastos();
    expect(store.gastos()).toEqual(GASTOS);
    gastosDelMes('2026-11').flush(GASTOS);
    await recarga;
  });

  it('al crear, envía POST y recarga la lista del mes seleccionado', async () => {
    const guardado = store.guardar({ fecha: '2026-11-03', importe: 5, categoriaId: 2, nota: null });
    const post = http.expectOne('/api/gastos');
    expect(post.request.method).toBe('POST');
    post.flush({ ...GASTOS[0], id: 3 });
    await tick();
    gastosDelMes('2026-11').flush(GASTOS);

    expect(await guardado).toBe(true);
    expect(store.gastos()).toEqual(GASTOS);
  });

  it('al editar, envía PUT al id del gasto', async () => {
    const guardado = store.guardar({ fecha: '2026-11-03', importe: 5, categoriaId: 2, nota: null }, 1);
    http.expectOne({ method: 'PUT', url: '/api/gastos/1' }).flush(GASTOS[1]);
    await tick();
    gastosDelMes('2026-11').flush(GASTOS);
    expect(await guardado).toBe(true);
  });

  it('muestra los mensajes de validación del backend', async () => {
    const guardado = store.guardar({ fecha: '2026-11-03', importe: 0, categoriaId: 2, nota: null });
    http.expectOne('/api/gastos').flush(
      { title: 'Datos inválidos', errores: { importe: 'El importe debe ser mayor que 0' } },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(await guardado).toBe(false);
    expect(store.error()).toBe('El importe debe ser mayor que 0');
  });

  it('al borrar, quita el gasto de la lista', async () => {
    store.gastos.set(GASTOS);
    const borrado = store.borrar(1);
    http.expectOne({ method: 'DELETE', url: '/api/gastos/1' }).flush(null, { status: 204, statusText: 'No Content' });

    expect(await borrado).toBe(true);
    expect(store.gastos().map((g) => g.id)).toEqual([2]);
  });

  it('cambios sube en 1 tras crear, editar y borrar con éxito', async () => {
    expect(store.cambios()).toBe(0);

    const creado = store.guardar({ fecha: '2026-11-03', importe: 5, categoriaId: 2, nota: null });
    http.expectOne({ method: 'POST', url: '/api/gastos' }).flush({ ...GASTOS[0], id: 3 });
    await tick();
    gastosDelMes('2026-11').flush(GASTOS);
    await creado;
    expect(store.cambios()).toBe(1);

    const editado = store.guardar({ fecha: '2026-11-03', importe: 5, categoriaId: 2, nota: null }, 1);
    http.expectOne({ method: 'PUT', url: '/api/gastos/1' }).flush(GASTOS[1]);
    await tick();
    gastosDelMes('2026-11').flush(GASTOS);
    await editado;
    expect(store.cambios()).toBe(2);

    const borrado = store.borrar(1);
    http.expectOne({ method: 'DELETE', url: '/api/gastos/1' }).flush(null, { status: 204, statusText: 'No Content' });
    await borrado;
    expect(store.cambios()).toBe(3);
  });

  it('cambios no sube si la API falla', async () => {
    const guardado = store.guardar({ fecha: '2026-11-03', importe: 0, categoriaId: 2, nota: null });
    http.expectOne('/api/gastos').flush({ errores: { importe: 'x' } }, { status: 400, statusText: 'Bad Request' });
    await guardado;

    const borrado = store.borrar(1);
    http.expectOne({ method: 'DELETE', url: '/api/gastos/1' }).flush(null, { status: 500, statusText: 'Error' });
    await borrado;

    expect(store.cambios()).toBe(0);
  });
});
