import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ImportePen } from '../../atomos/importe-pen/importe-pen';
import { nombreArchivoCsv, urlExportarCsv } from '../../core/exportar-csv';
import { GastosStore } from '../../core/gastos-store';
import { MesSeleccionado } from '../../core/mes-seleccionado';
import { Gasto, GastoRequest } from '../../core/modelos';
import { ResumenStore } from '../../core/resumen-store';
import { GastoForm } from '../../moleculas/gasto-form/gasto-form';
import { SelectorMes } from '../../moleculas/selector-mes/selector-mes';
import { GastosTabla } from '../../organismos/gastos-tabla/gastos-tabla';
import { ResumenMes } from '../../organismos/resumen-mes/resumen-mes';

@Component({
  selector: 'app-gastos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, GastoForm, GastosTabla, ImportePen, ResumenMes, SelectorMes],
  providers: [ResumenStore],
  templateUrl: './gastos-page.html',
  styleUrl: './gastos-page.css',
})
export class GastosPage implements OnInit {
  protected readonly store = inject(GastosStore);
  protected readonly periodo = inject(MesSeleccionado);
  protected readonly resumen = inject(ResumenStore);
  private readonly formulario = viewChild.required(GastoForm);

  protected readonly editando = signal<Gasto | null>(null);
  protected readonly porBorrar = signal<Gasto | null>(null);
  protected readonly urlCsv = computed(() => urlExportarCsv(this.periodo.mes()));
  protected readonly archivoCsv = computed(() => nombreArchivoCsv(this.periodo.mes()));

  constructor() {
    // Carga el mes actual al iniciar y recarga cada vez que cambia el mes.
    effect(() => {
      this.periodo.mes();
      untracked(() => {
        this.porBorrar.set(null);
        void this.store.cargarGastos();
      });
    });
  }

  ngOnInit(): void {
    void this.store.cargarCategorias();
  }

  protected async guardar(datos: GastoRequest): Promise<void> {
    const ok = await this.store.guardar(datos, this.editando()?.id);
    if (ok) {
      this.editando.set(null);
      this.formulario().limpiar();
    }
  }

  protected async confirmarBorrado(): Promise<void> {
    const gasto = this.porBorrar();
    if (!gasto) {
      return;
    }
    if (await this.store.borrar(gasto.id)) {
      this.porBorrar.set(null);
      if (this.editando()?.id === gasto.id) {
        this.editando.set(null);
      }
    }
  }
}
