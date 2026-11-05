import { nombreArchivoCsv, urlExportarCsv } from './exportar-csv';

describe('exportar-csv', () => {
  it('urlExportarCsv apunta al endpoint con el mes', () => {
    expect(urlExportarCsv('2026-11')).toBe('/api/gastos/export?mes=2026-11');
  });

  it('nombreArchivoCsv usa el mes con cero a la izquierda', () => {
    expect(nombreArchivoCsv('2026-01')).toBe('gastos-2026-01.csv');
  });
});
