import { TestBed } from '@angular/core/testing';
import { MesSeleccionado } from './mes-seleccionado';
import { RELOJ } from './reloj';

describe('MesSeleccionado', () => {
  let periodo: MesSeleccionado;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: RELOJ, useValue: () => new Date(2026, 10, 15) }] });
    periodo = TestBed.inject(MesSeleccionado);
  });

  it('empieza en el mes actual, que es también el máximo', () => {
    expect(periodo.mes()).toBe('2026-11');
    expect(periodo.maximo).toBe('2026-11');
    expect(periodo.esMaximo()).toBe(true);
  });

  it('no avanza más allá del mes actual', () => {
    periodo.ir('2026-12');
    expect(periodo.mes()).toBe('2026-11');
  });

  it('cambia a un mes anterior y actualiza la etiqueta', () => {
    periodo.ir('2026-10');
    expect(periodo.mes()).toBe('2026-10');
    expect(periodo.etiqueta()).toBe('octubre 2026');
    expect(periodo.esMaximo()).toBe(false);
  });

  it('ignora valores mal formados', () => {
    periodo.ir('basura');
    periodo.ir('2026-13');
    expect(periodo.mes()).toBe('2026-11');
  });
});
