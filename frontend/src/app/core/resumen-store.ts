import { Injectable, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GastosStore, mensajeDeError } from './gastos-store';
import { MesSeleccionado } from './mes-seleccionado';
import { Categoria } from './modelos';
import { porcentajesRestoMayor } from './porcentajes';
import { ResumenApi, ResumenCategoria } from './resumen-api';

export interface BarraResumen {
  categoria: Categoria;
  total: number;
  cantidad: number;
  porcentaje: number;
}

/** Estado del resumen del mes. Se provee en la página: vive con ella. */
@Injectable()
export class ResumenStore {
  private readonly api = inject(ResumenApi);
  private readonly periodo = inject(MesSeleccionado);
  private readonly gastos = inject(GastosStore);

  private secuencia = 0;
  private pendientes = 0;
  /** Mes al que pertenecen las filas actuales. */
  private mesCargado = this.periodo.mes();

  private readonly filas = signal<ResumenCategoria[]>([]);
  private readonly _cargando = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly cargando: Signal<boolean> = this._cargando.asReadonly();
  readonly error: Signal<string | null> = this._error.asReadonly();
  /** Filas de la API (en su orden) con el porcentaje entero ya repartido. */
  readonly barras: Signal<BarraResumen[]> = computed(() => {
    const filas = this.filas();
    const porcentajes = porcentajesRestoMayor(filas.map((fila) => fila.total));
    return filas.map((fila, i) => ({ ...fila, porcentaje: porcentajes[i] }));
  });

  constructor() {
    // Carga al iniciar y recarga al cambiar de mes o tras crear, editar o borrar un gasto.
    effect(() => {
      this.periodo.mes();
      this.gastos.cambios();
      untracked(() => void this.cargar());
    });
  }

  /** Pide el resumen del mes seleccionado; solo se aplica la respuesta de la última petición. */
  async cargar(): Promise<void> {
    const mes = this.periodo.mes();
    const id = ++this.secuencia;
    if (mes !== this.mesCargado) {
      // Otro mes: no dejar a la vista el resumen del anterior.
      this.filas.set([]);
      this.mesCargado = mes;
    }
    this.pendientes++;
    this._cargando.set(true);
    this._error.set(null);
    try {
      const filas = await firstValueFrom(this.api.obtener(mes));
      if (id === this.secuencia) {
        this.filas.set(filas);
      }
    } catch (e) {
      if (id === this.secuencia) {
        this._error.set(mensajeDeError(e));
      }
    } finally {
      this.pendientes--;
      this._cargando.set(this.pendientes > 0);
    }
  }
}
