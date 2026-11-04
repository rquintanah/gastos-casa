import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GastosApi } from './gastos-api';
import { Categoria, Gasto, GastoRequest, ProblemDetail } from './modelos';

/** Estado de la pantalla de gastos, con signals. */
@Injectable({ providedIn: 'root' })
export class GastosStore {
  private readonly api = inject(GastosApi);

  readonly gastos = signal<Gasto[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly total = computed(() =>
    this.gastos().reduce((suma, gasto) => suma + Math.round(gasto.importe * 100), 0) / 100,
  );

  async cargar(): Promise<void> {
    await this.ejecutar(async () => {
      const [categorias, gastos] = await Promise.all([
        firstValueFrom(this.api.listarCategorias()),
        firstValueFrom(this.api.listarGastos()),
      ]);
      this.categorias.set(categorias);
      this.gastos.set(gastos);
    });
  }

  /** Crea (sin id) o actualiza (con id). Devuelve true si se guardó. */
  async guardar(datos: GastoRequest, id?: number): Promise<boolean> {
    return this.ejecutar(async () => {
      if (id === undefined) {
        await firstValueFrom(this.api.crear(datos));
      } else {
        await firstValueFrom(this.api.actualizar(id, datos));
      }
      this.gastos.set(await firstValueFrom(this.api.listarGastos()));
    });
  }

  async borrar(id: number): Promise<boolean> {
    return this.ejecutar(async () => {
      await firstValueFrom(this.api.borrar(id));
      this.gastos.update((lista) => lista.filter((gasto) => gasto.id !== id));
    });
  }

  private async ejecutar(accion: () => Promise<void>): Promise<boolean> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      await accion();
      return true;
    } catch (e) {
      this.error.set(mensajeDeError(e));
      return false;
    } finally {
      this.cargando.set(false);
    }
  }
}

export function mensajeDeError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) {
      return 'No se pudo conectar con el servidor.';
    }
    const problema = e.error as ProblemDetail | null;
    if (problema?.errores) {
      return Object.values(problema.errores).join(' · ');
    }
    return problema?.detail ?? problema?.title ?? `Error ${e.status}`;
  }
  return 'Error inesperado.';
}
