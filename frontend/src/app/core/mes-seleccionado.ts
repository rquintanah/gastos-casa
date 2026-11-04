import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Mes, esMes, etiquetaMes, mesDe } from './mes';
import { RELOJ } from './reloj';

/** Mes que se está viendo (solo en memoria). Lo comparten las pantallas que filtran por mes. */
@Injectable({ providedIn: 'root' })
export class MesSeleccionado {
  /** Mes actual al crear el servicio: no se puede navegar más allá. */
  readonly maximo: Mes = mesDe(inject(RELOJ)());

  private readonly _mes = signal<Mes>(this.maximo);
  readonly mes: Signal<Mes> = this._mes.asReadonly();
  readonly etiqueta = computed(() => etiquetaMes(this.mes()));
  readonly esMaximo = computed(() => this.mes() >= this.maximo);

  /** Cambia de mes; ignora valores mal formados y limita a `maximo`. */
  ir(mes: Mes): void {
    if (!esMes(mes)) {
      return;
    }
    this._mes.set(mes > this.maximo ? this.maximo : mes);
  }
}
