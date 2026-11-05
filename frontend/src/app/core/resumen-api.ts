import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Mes } from './mes';
import { Categoria } from './modelos';

/** Total y número de gastos de una categoría en un mes (solo categorías con gastos). */
export interface ResumenCategoria {
  categoria: Categoria;
  total: number;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class ResumenApi {
  private readonly http = inject(HttpClient);

  /** Resumen por categoría del mes (AAAA-MM), ya ordenado por la API. */
  obtener(mes: Mes): Observable<ResumenCategoria[]> {
    return this.http.get<ResumenCategoria[]>('/api/gastos/resumen', { params: { mes } });
  }
}
