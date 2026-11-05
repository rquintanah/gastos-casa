import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ImportePen } from '../../atomos/importe-pen/importe-pen';

/** Una categoría del resumen: nombre, importe, porcentaje y una barra decorativa. */
@Component({
  selector: 'app-barra-categoria',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportePen],
  templateUrl: './barra-categoria.html',
  styleUrl: './barra-categoria.css',
})
export class BarraCategoria {
  readonly nombre = input.required<string>();
  readonly total = input.required<number>();
  /** Entero 0..100 sobre el total del mes. */
  readonly porcentaje = input.required<number>();
  readonly cantidad = input.required<number>();

  protected readonly textoCantidad = computed(() =>
    this.cantidad() === 1 ? '1 gasto' : `${this.cantidad()} gastos`,
  );
}
