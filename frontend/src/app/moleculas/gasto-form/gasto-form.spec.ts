import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Categoria, GastoRequest, hoyIso } from '../../core/modelos';
import { GastoForm } from './gasto-form';

const CATEGORIAS: Categoria[] = [
  { id: 2, nombre: 'Comida' },
  { id: 3, nombre: 'Transporte' },
];

function manana(): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 1);
  return hoyIso(fecha);
}

describe('GastoForm', () => {
  let fixture: ComponentFixture<GastoForm>;
  let html: HTMLElement;
  let emitidos: GastoRequest[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(GastoForm);
    fixture.componentRef.setInput('categorias', CATEGORIAS);
    emitidos = [];
    fixture.componentInstance.guardar.subscribe((datos) => emitidos.push(datos));
    await fixture.whenStable();
    html = fixture.nativeElement as HTMLElement;
  });

  function rellenar(campos: { fecha?: string; importe?: string; categoria?: number; nota?: string }): void {
    const asignar = (selector: string, valor: string, evento: string) => {
      const control = html.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
      control.value = valor;
      control.dispatchEvent(new Event(evento));
    };
    if (campos.fecha !== undefined) asignar('input[type=date]', campos.fecha, 'input');
    if (campos.importe !== undefined) asignar('input[type=number]', campos.importe, 'input');
    if (campos.categoria !== undefined) {
      const select = html.querySelector('select') as HTMLSelectElement;
      select.selectedIndex = CATEGORIAS.findIndex((c) => c.id === campos.categoria) + 1;
      select.dispatchEvent(new Event('change'));
    }
    if (campos.nota !== undefined) asignar('textarea', campos.nota, 'input');
  }

  async function enviar(): Promise<void> {
    (html.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await fixture.whenStable();
  }

  it('emite el gasto con la categoría como número y la nota recortada', async () => {
    rellenar({ fecha: hoyIso(), importe: '45.5', categoria: 3, nota: '  Taxi  ' });
    await enviar();
    expect(emitidos).toEqual([{ fecha: hoyIso(), importe: 45.5, categoriaId: 3, nota: 'Taxi' }]);
  });

  it('envía la nota vacía como null', async () => {
    rellenar({ importe: '10', categoria: 2, nota: '   ' });
    await enviar();
    expect(emitidos[0].nota).toBeNull();
  });

  it.each(['0', '-3', '1.234'])('bloquea el importe %s', async (importe) => {
    rellenar({ importe, categoria: 2 });
    await enviar();
    expect(emitidos).toEqual([]);
    expect(html.textContent).toContain('El importe debe ser mayor que 0');
  });

  it('bloquea una fecha futura', async () => {
    rellenar({ fecha: manana(), importe: '10', categoria: 2 });
    await enviar();
    expect(emitidos).toEqual([]);
    expect(html.textContent).toContain('no sea futura');
  });

  it('exige elegir categoría', async () => {
    rellenar({ importe: '10' });
    await enviar();
    expect(emitidos).toEqual([]);
    expect(html.textContent).toContain('Elige una categoría.');
  });

  it('carga los datos del gasto a editar', async () => {
    fixture.componentRef.setInput('gasto', {
      id: 7,
      fecha: '2026-10-01',
      importe: 12.3,
      categoria: CATEGORIAS[0],
      nota: null,
    });
    await fixture.whenStable();
    await enviar();
    expect(emitidos).toEqual([{ fecha: '2026-10-01', importe: 12.3, categoriaId: 2, nota: null }]);
    expect(html.querySelector('h2')?.textContent).toContain('Editar gasto');
  });
});
