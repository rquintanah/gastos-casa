import { TestBed } from '@angular/core/testing';
import { Gasto } from '../../core/modelos';
import { GastosTabla } from './gastos-tabla';

const GASTOS: Gasto[] = [
  { id: 2, fecha: '2026-11-01', importe: 45.5, categoria: { id: 2, nombre: 'Comida' }, nota: 'Mercado' },
  { id: 1, fecha: '2026-01-01', importe: 10, categoria: { id: 3, nombre: 'Transporte' }, nota: null },
];

async function crear(gastos: Gasto[]) {
  const fixture = TestBed.createComponent(GastosTabla);
  fixture.componentRef.setInput('gastos', gastos);
  fixture.componentRef.setInput('total', 55.5);
  await fixture.whenStable();
  return fixture;
}

describe('GastosTabla', () => {
  it('muestra el día de calendario de la fecha ISO sin desfase de zona horaria', async () => {
    const html = (await crear(GASTOS)).nativeElement as HTMLElement;
    const fechas = [...html.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent?.trim());
    // '2026-11-01' no debe mostrarse como 31/10 en zonas UTC-x (por ejemplo, America/Lima)
    expect(fechas).toEqual(['01/11/2026', '01/01/2026']);
  });

  it('muestra importes y total en soles', async () => {
    const html = (await crear(GASTOS)).nativeElement as HTMLElement;
    expect(html.querySelector('tbody')?.textContent).toContain('S/ 45.50');
    expect(html.querySelector('tfoot')?.textContent).toContain('S/ 55.50');
  });

  it('emite editar y borrar con el gasto de la fila', async () => {
    const fixture = await crear(GASTOS);
    const editados: Gasto[] = [];
    const borrados: Gasto[] = [];
    fixture.componentInstance.editar.subscribe((g) => editados.push(g));
    fixture.componentInstance.borrar.subscribe((g) => borrados.push(g));

    const botones = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr:first-child button');
    (botones[0] as HTMLButtonElement).click();
    (botones[1] as HTMLButtonElement).click();

    expect(editados.map((g) => g.id)).toEqual([2]);
    expect(borrados.map((g) => g.id)).toEqual([2]);
  });

  it('avisa cuando no hay gastos', async () => {
    const html = (await crear([])).nativeElement as HTMLElement;
    expect(html.textContent).toContain('Todavía no hay gastos');
    expect(html.querySelector('table')).toBeNull();
  });
});
