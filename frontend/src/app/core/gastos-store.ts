import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GastosApi } from './gastos-api';
import { MesSeleccionado } from './mes-seleccionado';
import { Categoria, Gasto, GastoRequest, ProblemDetail } from './modelos';

/** Estado de la pantalla de gastos, con signals. */
@Injectable({ providedIn: 'root' })
export class GastosStore {
  private readonly api = inject(GastosApi);
  private readonly periodo = inject(MesSeleccionado);
  private pendientes = 0;
  /** Mes al que pertenece la lista `gastos` actual. */
  private mesCargado = this.periodo.mes();

  readonly gastos = signal<Gasto[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly total = computed(() =>
    this.gastos().reduce((suma, gasto) => suma + Math.round(gasto.importe * 100), 0) / 100,
  );

  async cargarCategorias(): Promise<void> {
    await this.ejecutar(async () => {
      this.categorias.set(await firstValueFrom(this.api.listarCategorias()));
    });
  }

  /** Carga los gastos del mes seleccionado. */
  async cargarGastos(): Promise<void> {
    await this.ejecutar(() => this.pedirGastos());
  }

  /** Pide los gastos del mes actual; descarta la respuesta si el mes cambió mientras tanto. */
  private async pedirGastos(): Promise<void> {
    const mes = this.periodo.mes();
    if (mes !== this.mesCargado) {
      // Otro mes: no dejar a la vista (ni editables) los gastos del mes anterior.
      this.gastos.set([]);
      this.mesCargado = mes;
    }
    const gastos = await firstValueFrom(this.api.listarGastos(mes));
    if (mes === this.periodo.mes()) {
      this.gastos.set(gastos);
    }
  }

  /** Crea (sin id) o actualiza (con id). Devuelve true si se guardó. */
  async guardar(datos: GastoRequest, id?: number): Promise<boolean> {
    return this.ejecutar(async () => {
      if (id === undefined) {
        await firstValueFrom(this.api.crear(datos));
      } else {
        await firstValueFrom(this.api.actualizar(id, datos));
      }
      await this.pedirGastos();
    });
  }

  async borrar(id: number): Promise<boolean> {
    return this.ejecutar(async () => {
      await firstValueFrom(this.api.borrar(id));
      this.gastos.update((lista) => lista.filter((gasto) => gasto.id !== id));
    });
  }

  private async ejecutar(accion: () => Promise<void>): Promise<boolean> {
    this.pendientes++;
    this.cargando.set(true);
    this.error.set(null);
    try {
      await accion();
      return true;
    } catch (e) {
      this.error.set(mensajeDeError(e));
      return false;
    } finally {
      this.pendientes--;
      this.cargando.set(this.pendientes > 0);
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
