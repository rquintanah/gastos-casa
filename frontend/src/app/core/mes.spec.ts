import { esMes, etiquetaMes, mesDe, mesDeFechaIso, sumarMeses } from './mes';

describe('mes', () => {
  it('mesDe usa el mes local, también a última hora del último día', () => {
    expect(mesDe(new Date(2026, 10, 30, 23, 59))).toBe('2026-11');
    expect(mesDe(new Date(2026, 0, 1, 0, 0))).toBe('2026-01');
  });

  it('mesDeFechaIso recorta la fecha ISO', () => {
    expect(mesDeFechaIso('2026-11-04')).toBe('2026-11');
  });

  it('sumarMeses cruza años en ambos sentidos', () => {
    expect(sumarMeses('2026-01', -1)).toBe('2025-12');
    expect(sumarMeses('2026-12', 1)).toBe('2027-01');
    expect(sumarMeses('2026-11', 0)).toBe('2026-11');
    expect(sumarMeses('2026-11', -23)).toBe('2024-12');
    expect(sumarMeses('2026-11', 14)).toBe('2028-01');
  });

  it('etiquetaMes da el nombre en español sin desfase de zona horaria', () => {
    expect(etiquetaMes('2026-11')).toBe('noviembre 2026');
    expect(etiquetaMes('2026-01')).toBe('enero 2026');
  });

  it('esMes valida el formato AAAA-MM', () => {
    expect(esMes('2026-11')).toBe(true);
    expect(esMes('2026-13')).toBe(false);
    expect(esMes('2026-00')).toBe(false);
    expect(esMes('2026-1')).toBe(false);
    expect(esMes('2026-11-01')).toBe(false);
    expect(esMes('basura')).toBe(false);
  });
});
