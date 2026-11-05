import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Mes } from '../../core/mes';
import { AvisoOtroMes } from './aviso-otro-mes';

describe('AvisoOtroMes', () => {
  let fixture: ComponentFixture<AvisoOtroMes>;
  let html: HTMLElement;
  let irEmitidos: Mes[];
  let cerrados: number;

  async function crear(mes: Mes | null, maximo: Mes): Promise<void> {
    fixture = TestBed.createComponent(AvisoOtroMes);
    fixture.componentRef.setInput('mes', mes);
    fixture.componentRef.setInput('maximo', maximo);
    irEmitidos = [];
    cerrados = 0;
    fixture.componentInstance.ir.subscribe((m) => irEmitidos.push(m));
    fixture.componentInstance.cerrar.subscribe(() => cerrados++);
    await fixture.whenStable();
    html = fixture.nativeElement as HTMLElement;
  }

  const botones = () => Array.from(html.querySelectorAll('button'));
  const botonVer = () => botones().find((b) => b.textContent?.trim().startsWith('Ver'));

  it('sin mes: el host tiene role=status y está vacío', async () => {
    await crear(null, '2026-11');
    expect(html.getAttribute('role')).toBe('status');
    expect(html.textContent?.trim()).toBe('');
    expect(botones().length).toBe(0);
  });

  it('muestra el texto y emite ir con el mes', async () => {
    await crear('2026-10', '2026-11');
    expect(html.textContent).toContain('Guardado en octubre 2026.');
    expect(botonVer()?.textContent?.trim()).toBe('Ver octubre 2026');
    botonVer()?.click();
    expect(irEmitidos).toEqual(['2026-10']);
  });

  it('con mes igual al máximo hay botón de ir', async () => {
    await crear('2026-11', '2026-11');
    expect(botonVer()?.textContent?.trim()).toBe('Ver noviembre 2026');
  });

  it('con mes mayor que el máximo pide recargar y no hay botón de ir', async () => {
    await crear('2026-12', '2026-11');
    expect(html.textContent).toContain('Guardado en diciembre 2026.');
    expect(html.textContent).toContain('Recarga la página para ver ese mes.');
    expect(botonVer()).toBeUndefined();
  });

  it('el botón «Cerrar aviso» emite cerrar', async () => {
    await crear('2026-10', '2026-11');
    (html.querySelector('button[aria-label="Cerrar aviso"]') as HTMLButtonElement).click();
    expect(cerrados).toBe(1);
  });

  it('todos los botones son type=button', async () => {
    await crear('2026-10', '2026-11');
    expect(botones().length).toBe(2);
    expect(botones().every((b) => b.type === 'button')).toBe(true);
  });
});
