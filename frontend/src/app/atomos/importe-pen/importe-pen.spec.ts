import { TestBed } from '@angular/core/testing';
import { ImportePen, formatearPen } from './importe-pen';

describe('formatearPen', () => {
  it('formatea en soles con 2 decimales y separador de miles', () => {
    expect(formatearPen(1234.5)).toBe('S/ 1,234.50');
    expect(formatearPen(0.1)).toBe('S/ 0.10');
  });
});

describe('ImportePen', () => {
  it('muestra el importe formateado', async () => {
    const fixture = TestBed.createComponent(ImportePen);
    fixture.componentRef.setInput('importe', 45.5);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('S/ 45.50');
  });
});
