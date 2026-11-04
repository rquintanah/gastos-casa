import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const FORMATO_PEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

/** Formatea un importe en soles, por ejemplo S/ 1,234.50. */
export function formatearPen(importe: number): string {
  return FORMATO_PEN.format(importe).replace(/\u00a0/g, ' ');
}

@Component({
  selector: 'app-importe-pen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="importe">{{ texto() }}</span>`,
  styles: `
    .importe {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  `,
})
export class ImportePen {
  readonly importe = input.required<number>();
  protected readonly texto = computed(() => formatearPen(this.importe()));
}
