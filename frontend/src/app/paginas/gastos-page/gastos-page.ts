import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ImportePen } from '../../atomos/importe-pen/importe-pen';
import { GastosStore } from '../../core/gastos-store';
import { MesSeleccionado } from '../../core/mes-seleccionado';
import { Mes, mesDeFechaIso } from '../../core/mes';
import { Gasto, GastoRequest } from '../../core/modelos';
import { ResumenStore } from '../../core/resumen-store';
import { AvisoOtroMes } from '../../moleculas/aviso-otro-mes/aviso-otro-mes';
import { GastoForm } from '../../moleculas/gasto-form/gasto-form';
import { SelectorMes } from '../../moleculas/selector-mes/selector-mes';
import { GastosTabla } from '../../organismos/gastos-tabla/gastos-tabla';
import { ResumenMes } from '../../organismos/resumen-mes/resumen-mes';

@Component({
  selector: 'app-gastos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvisoOtroMes, DatePipe, GastoForm, GastosTabla, ImportePen, ResumenMes, SelectorMes],
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
  protected readonly guardadoEn = signal<Mes | null>(null);

  constructor() {
    // Carga el mes actual al iniciar y recarga cada vez que cambia el mes.
    effect(() => {
      this.periodo.mes();
      untracked(() => {
        this.porBorrar.set(null);
        this.guardadoEn.set(null);
        void this.store.cargarGastos();
      });
    });
  }

  ngOnInit(): void {
    void this.store.cargarCategorias();
  }

  protected async guardar(datos: GastoRequest): Promise<void> {
    this.guardadoEn.set(null);
    const ok = await this.store.guardar(datos, this.editando()?.id);
    if (ok) {
      const mes = mesDeFechaIso(datos.fecha);
      if (mes !== this.periodo.mes()) {
        this.guardadoEn.set(mes);
      }
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
