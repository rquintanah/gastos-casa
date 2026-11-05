import { porcentajesRestoMayor } from './porcentajes';

const suma = (valores: number[]) => valores.reduce((a, b) => a + b, 0);

describe('porcentajesRestoMayor', () => {
  it('devuelve [] si no hay importes', () => {
    expect(porcentajesRestoMayor([])).toEqual([]);
  });

  it('una sola categoría es 100', () => {
    expect(porcentajesRestoMayor([5])).toEqual([100]);
  });

  it('reparte el resto al primero en un empate', () => {
    expect(porcentajesRestoMayor([1, 1, 1])).toEqual([34, 33, 33]);
  });

  it('una categoría muy pequeña puede quedar en 0', () => {
    expect(porcentajesRestoMayor([0.01, 999.99])).toEqual([0, 100]);
  });

  it('no toca los repartos ya exactos', () => {
    expect(porcentajesRestoMayor([50, 50])).toEqual([50, 50]);
  });

  it('suma 100 con importes reales y respeta el orden', () => {
    const resultado = porcentajesRestoMayor([1234.5, 80, 80]);
    expect(suma(resultado)).toBe(100);
    expect(resultado).toEqual([88, 6, 6]);
  });

  it('con 200 listas pseudoaleatorias suma 100 y cada valor difiere menos de 1 del exacto', () => {
    let semilla = 12345;
    const azar = () => {
      semilla = (semilla * 1664525 + 1013904223) % 4294967296;
      return semilla / 4294967296;
    };
    for (let i = 0; i < 200; i++) {
      const n = 1 + Math.floor(azar() * 6);
      const importes = Array.from({ length: n }, () => Math.round((0.01 + azar() * 2000) * 100) / 100);
      const resultado = porcentajesRestoMayor(importes);
      const total = importes.reduce((a, b) => a + Math.round(b * 100), 0);
      expect(suma(resultado)).toBe(100);
      resultado.forEach((p, k) => {
        const exacto = (Math.round(importes[k] * 100) * 100) / total;
        expect(Math.abs(p - exacto)).toBeLessThan(1);
      });
    }
  });
});
