import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Mes, etiquetaMes, sumarMeses } from '../../core/mes';

/** Navegación por meses: anterior / siguiente (sin pasar de `maximo`). */
@Component({
  selector: 'app-selector-mes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './selector-mes.html',
  styleUrl: './selector-mes.css',
})
export class SelectorMes {
  readonly mes = input.required<Mes>();
  readonly maximo = input.required<Mes>();
  readonly cambiar = output<Mes>();

  protected readonly etiquetaMes = etiquetaMes;

  protected mover(n: number): void {
    this.cambiar.emit(sumarMeses(this.mes(), n));
  }
}
