import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BarraResumen } from '../../core/resumen-store';
import { BarraCategoria } from '../../moleculas/barra-categoria/barra-categoria';

/** Resumen del mes: una barra por categoría con gastos, en el orden recibido (de mayor a menor). */
@Component({
  selector: 'app-resumen-mes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarraCategoria],
  templateUrl: './resumen-mes.html',
  styleUrl: './resumen-mes.css',
})
export class ResumenMes {
  readonly etiquetaMes = input.required<string>();
  readonly barras = input.required<BarraResumen[]>();
  readonly cargando = input(false);
  readonly error = input<string | null>(null);
}
