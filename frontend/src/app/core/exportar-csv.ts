import { Mes } from './mes';

/** '2026-11' → '/api/gastos/export?mes=2026-11' */
export function urlExportarCsv(mes: Mes): string {
  return `/api/gastos/export?mes=${encodeURIComponent(mes)}`;
}

/** '2026-11' → 'gastos-2026-11.csv' */
export function nombreArchivoCsv(mes: Mes): string {
  return `gastos-${mes}.csv`;
}
