import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Mes } from './mes';
import { Categoria, Gasto, GastoRequest } from './modelos';

@Injectable({ providedIn: 'root' })
export class GastosApi {
  private readonly http = inject(HttpClient);

  listarCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>('/api/categorias');
  }

  /** Sin `mes`, todos los gastos; con `mes` (AAAA-MM), solo los de ese mes. */
  listarGastos(mes?: Mes): Observable<Gasto[]> {
    return this.http.get<Gasto[]>('/api/gastos', { params: mes ? { mes } : {} });
  }

  crear(datos: GastoRequest): Observable<Gasto> {
    return this.http.post<Gasto>('/api/gastos', datos);
  }

  actualizar(id: number, datos: GastoRequest): Observable<Gasto> {
    return this.http.put<Gasto>(`/api/gastos/${id}`, datos);
  }

  borrar(id: number): Observable<void> {
    return this.http.delete<void>(`/api/gastos/${id}`);
  }
}
