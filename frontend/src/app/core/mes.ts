/** Un mes se representa como texto 'AAAA-MM', igual que en la API (`?mes=`). */
export type Mes = string;

const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export function esMes(valor: string): boolean {
  return FORMATO_MES.test(valor);
}

/** Mes de calendario LOCAL del navegador. */
export function mesDe(fecha: Date): Mes {
  return formatear(fecha.getFullYear(), fecha.getMonth() + 1);
}

/** '2026-11-04' → '2026-11' (sin pasar por Date, así no hay desfase de zona horaria). */
export function mesDeFechaIso(fecha: string): Mes {
  return fecha.slice(0, 7);
}

/** Suma (o resta) meses con aritmética entera: ('2026-01', -1) → '2025-12'. */
export function sumarMeses(mes: Mes, n: number): Mes {
  const [anio, numero] = partes(mes);
  const indice = anio * 12 + (numero - 1) + n;
  return formatear(Math.floor(indice / 12), (((indice % 12) + 12) % 12) + 1);
}

/** '2026-11' → 'noviembre 2026'. */
export function etiquetaMes(mes: Mes): string {
  const [anio, numero] = partes(mes);
  const fecha = new Date(anio, numero - 1, 1);
  const nombre = new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(fecha).toLocaleLowerCase('es-PE');
  return `${nombre} ${anio}`;
}

function partes(mes: Mes): [number, number] {
  const [anio, numero] = mes.split('-').map(Number);
  return [anio, numero];
}

function formatear(anio: number, numero: number): Mes {
  return `${String(anio).padStart(4, '0')}-${String(numero).padStart(2, '0')}`;
}
