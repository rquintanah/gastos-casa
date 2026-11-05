import { TestBed } from '@angular/core/testing';
import { BarraResumen } from '../../core/resumen-store';
import { ResumenMes } from './resumen-mes';

const BARRAS: BarraResumen[] = [
  { categoria: { id: 1, nombre: 'Vivienda' }, total: 1234.5, cantidad: 2, porcentaje: 88 },
  { categoria: { id: 2, nombre: 'Comida' }, total: 80, cantidad: 5, porcentaje: 6 },
  { categoria: { id: 5, nombre: 'Ocio' }, total: 80, cantidad: 1, porcentaje: 6 },
];

async function crear(entradas: { barras?: BarraResumen[]; cargando?: boolean; error?: string | null } = {}) {
  const fixture = TestBed.createComponent(ResumenMes);
  fixture.componentRef.setInput('etiquetaMes', 'noviembre 2026');
  fixture.componentRef.setInput('barras', entradas.barras ?? []);
  fixture.componentRef.setInput('cargando', entradas.cargando ?? false);
  fixture.componentRef.setInput('error', entradas.error ?? null);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ResumenMes', () => {
  it('muestra el título con el mes', async () => {
    expect((await crear()).querySelector('h2')?.textContent).toBe('Resumen de noviembre 2026');
  });

  it('respeta el orden recibido', async () => {
    const html = await crear({ barras: BARRAS });
    const nombres = [...html.querySelectorAll('li .nombre')].map((n) => n.textContent?.trim().split(' ')[0]);
    expect(nombres).toEqual(['Vivienda', 'Comida', 'Ocio']);
    expect(html.querySelector('ol')).not.toBeNull();
  });

  it('sin barras muestra «Sin gastos este mes» y ninguna barra', async () => {
    const html = await crear();
    expect(html.textContent).toContain('Sin gastos este mes');
    expect(html.querySelector('app-barra-categoria')).toBeNull();
  });

  it('con error muestra un aviso con role alert', async () => {
    const html = await crear({ error: 'Fallo' });
    expect(html.querySelector('[role="alert"]')?.textContent).toContain('Fallo');
    expect(html.textContent).not.toContain('Sin gastos este mes');
  });

  it('cargando y sin barras muestra «Cargando…»', async () => {
    const html = await crear({ cargando: true });
    expect(html.textContent).toContain('Cargando…');
    expect(html.textContent).not.toContain('Sin gastos este mes');
  });
});
