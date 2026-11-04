import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ImportePen } from '../../atomos/importe-pen/importe-pen';
import { GastosStore } from '../../core/gastos-store';
import { Gasto, GastoRequest } from '../../core/modelos';
import { GastoForm } from '../../moleculas/gasto-form/gasto-form';
import { GastosTabla } from '../../organismos/gastos-tabla/gastos-tabla';

@Component({
  selector: 'app-gastos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, GastoForm, GastosTabla, ImportePen],
  templateUrl: './gastos-page.html',
  styleUrl: './gastos-page.css',
})
export class GastosPage implements OnInit {
  protected readonly store = inject(GastosStore);
  private readonly formulario = viewChild.required(GastoForm);

  protected readonly editando = signal<Gasto | null>(null);
  protected readonly porBorrar = signal<Gasto | null>(null);

  ngOnInit(): void {
    void this.store.cargar();
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
