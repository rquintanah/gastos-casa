import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GastosStore } from './gastos-store';
import { Gasto } from './modelos';

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

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(GastosStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carga categorías y gastos y calcula el total sin errores de redondeo', async () => {
    const carga = store.cargar();
    expect(store.cargando()).toBe(true);
    http.expectOne('/api/categorias').flush([COMIDA]);
    http.expectOne('/api/gastos').flush(GASTOS);
    await carga;

    expect(store.cargando()).toBe(false);
    expect(store.categorias()).toEqual([COMIDA]);
    expect(store.gastos()).toEqual(GASTOS);
    expect(store.total()).toBe(0.3);
  });

  it('al crear, envía POST y recarga la lista', async () => {
    const guardado = store.guardar({ fecha: '2026-11-03', importe: 5, categoriaId: 2, nota: null });
    const post = http.expectOne('/api/gastos');
    expect(post.request.method).toBe('POST');
    post.flush({ ...GASTOS[0], id: 3 });
    await tick();
    http.expectOne({ method: 'GET', url: '/api/gastos' }).flush(GASTOS);

    expect(await guardado).toBe(true);
    expect(store.gastos()).toEqual(GASTOS);
  });

  it('al editar, envía PUT al id del gasto', async () => {
    const guardado = store.guardar({ fecha: '2026-11-03', importe: 5, categoriaId: 2, nota: null }, 1);
    http.expectOne({ method: 'PUT', url: '/api/gastos/1' }).flush(GASTOS[1]);
    await tick();
    http.expectOne('/api/gastos').flush(GASTOS);
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
});
