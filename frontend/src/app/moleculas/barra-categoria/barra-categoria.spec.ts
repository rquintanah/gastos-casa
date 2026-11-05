import { TestBed } from '@angular/core/testing';
import { BarraCategoria } from './barra-categoria';

async function crear(cantidad = 2, porcentaje = 42) {
  const fixture = TestBed.createComponent(BarraCategoria);
  fixture.componentRef.setInput('nombre', 'Vivienda');
  fixture.componentRef.setInput('total', 1234.5);
  fixture.componentRef.setInput('porcentaje', porcentaje);
  fixture.componentRef.setInput('cantidad', cantidad);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('BarraCategoria', () => {
  it('muestra nombre, importe, porcentaje y cantidad', async () => {
    const texto = (await crear()).textContent ?? '';
    expect(texto).toContain('Vivienda');
    expect(texto).toContain('S/ 1,234.50');
    expect(texto).toContain('42 %');
    expect(texto).toContain('2 gastos');
  });

  it('usa el singular con un solo gasto', async () => {
    expect((await crear(1)).textContent).toContain('1 gasto');
    expect((await crear(1)).textContent).not.toContain('1 gastos');
  });

  it('el relleno ocupa el porcentaje y la pista es decorativa', async () => {
    const html = await crear();
    expect((html.querySelector('.relleno') as HTMLElement).style.width).toBe('42%');
    expect(html.querySelector('.pista')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('con 0 % el relleno no tiene ancho mínimo', async () => {
    const html = await crear(1, 0);
    expect(html.querySelector('.relleno')?.classList.contains('minimo')).toBe(false);
  });
});
