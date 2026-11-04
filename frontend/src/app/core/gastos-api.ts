import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Categoria, Gasto, GastoRequest } from './modelos';

@Injectable({ providedIn: 'root' })
export class GastosApi {
  private readonly http = inject(HttpClient);

  listarCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>('/api/categorias');
  }

  listarGastos(): Observable<Gasto[]> {
    return this.http.get<Gasto[]>('/api/gastos');
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
