/**
 * Reparte 100 puntos porcentuales ENTEROS en proporción a los importes (método del resto mayor).
 * La suma es siempre 100 (o [] si no hay importes). Aritmética entera en céntimos: sin errores de coma flotante.
 * Empates de resto: gana el que va antes en la lista (la API ya viene ordenada por importe desc, nombre asc).
 */
export function porcentajesRestoMayor(importes: readonly number[]): number[] {
  const centimos = importes.map((importe) => Math.round(importe * 100));
  const total = centimos.reduce((suma, c) => suma + c, 0);
  if (importes.length === 0 || total <= 0) {
    return importes.map(() => 0);
  }
  const base = centimos.map((c) => Math.floor((c * 100) / total));
  const restos = centimos.map((c, indice) => ({ indice, resto: (c * 100) % total }));
  const faltan = 100 - base.reduce((suma, b) => suma + b, 0);
  restos
    .sort((a, b) => b.resto - a.resto || a.indice - b.indice)
    .slice(0, faltan)
    .forEach(({ indice }) => base[indice]++);
  return base;
}
