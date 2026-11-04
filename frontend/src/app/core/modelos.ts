/** Contrato con el backend (docs/planes/2026-11-04-esqueleto.md). Importes en soles (PEN). */
export interface Categoria {
  id: number;
  nombre: string;
}

export interface Gasto {
  id: number;
  /** ISO yyyy-MM-dd */
  fecha: string;
  importe: number;
  categoria: Categoria;
  nota: string | null;
}

export interface GastoRequest {
  fecha: string;
  importe: number;
  categoriaId: number;
  nota: string | null;
}

/** Respuesta de error del backend (RFC 9457). */
export interface ProblemDetail {
  title?: string;
  detail?: string;
  status?: number;
  errores?: Record<string, string>;
}

/** Fecha de hoy en la zona horaria local, en formato ISO yyyy-MM-dd. */
export function hoyIso(hoy: Date = new Date()): string {
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}
