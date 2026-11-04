import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ImportePen } from '../../atomos/importe-pen/importe-pen';
import { Gasto } from '../../core/modelos';

@Component({
  selector: 'app-gastos-tabla',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ImportePen],
  templateUrl: './gastos-tabla.html',
  styleUrl: './gastos-tabla.css',
})
export class GastosTabla {
  readonly gastos = input.required<Gasto[]>();
  readonly total = input.required<number>();
  readonly mensajeVacio = input('Todavía no hay gastos.');

  readonly editar = output<Gasto>();
  readonly borrar = output<Gasto>();
}
