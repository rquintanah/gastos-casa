import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Mes, etiquetaMes } from '../../core/mes';

/** Aviso tras guardar un gasto cuya fecha cae en otro mes. El host es una región viva permanente. */
@Component({
  selector: 'app-aviso-otro-mes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status' },
  templateUrl: './aviso-otro-mes.html',
  styleUrl: './aviso-otro-mes.css',
})
export class AvisoOtroMes {
  /** Mes donde se guardó el gasto; null = sin aviso. */
  readonly mes = input<Mes | null>(null);
  readonly maximo = input.required<Mes>();
  readonly ir = output<Mes>();
  readonly cerrar = output<void>();

  protected readonly etiquetaMes = etiquetaMes;
  protected readonly navegable = computed(() => {
    const mes = this.mes();
    return mes !== null && mes <= this.maximo();
  });
}
