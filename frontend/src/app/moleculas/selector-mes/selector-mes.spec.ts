import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Mes } from '../../core/mes';
import { SelectorMes } from './selector-mes';

describe('SelectorMes', () => {
  let fixture: ComponentFixture<SelectorMes>;
  let html: HTMLElement;
  let emitidos: Mes[];

  async function crear(mes: Mes, maximo: Mes): Promise<void> {
    fixture = TestBed.createComponent(SelectorMes);
    fixture.componentRef.setInput('mes', mes);
    fixture.componentRef.setInput('maximo', maximo);
    emitidos = [];
    fixture.componentInstance.cambiar.subscribe((m) => emitidos.push(m));
    await fixture.whenStable();
    html = fixture.nativeElement as HTMLElement;
  }

  const boton = (nombre: string) => html.querySelector(`button[aria-label="${nombre}"]`) as HTMLButtonElement;

  it('muestra la etiqueta del mes en una región aria-live', async () => {
    await crear('2026-11', '2026-11');
    const etiqueta = html.querySelector('[aria-live="polite"]');
    expect(etiqueta?.textContent?.trim()).toBe('noviembre 2026');
  });

  it('deshabilita «Mes siguiente» en el mes máximo', async () => {
    await crear('2026-11', '2026-11');
    expect(boton('Mes siguiente').disabled).toBe(true);
    expect(boton('Mes anterior').disabled).toBe(false);
  });

  it('habilita «Mes siguiente» en meses anteriores al máximo', async () => {
    await crear('2026-10', '2026-11');
    expect(boton('Mes siguiente').disabled).toBe(false);
  });

  it('emite el mes anterior y el siguiente, cruzando de año', async () => {
    await crear('2026-01', '2026-11');
    boton('Mes anterior').click();
    boton('Mes siguiente').click();
    expect(emitidos).toEqual(['2025-12', '2026-02']);
  });
});
