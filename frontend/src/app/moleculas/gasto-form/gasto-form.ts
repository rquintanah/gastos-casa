import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Categoria, Gasto, GastoRequest, hoyIso } from '../../core/modelos';

/** Como el backend: no posterior a hoy. */
function noFutura(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && control.value > hoyIso() ? { futura: true } : null;
}

/** Como el backend: máximo 2 decimales. */
function dosDecimales(control: AbstractControl<number | null>): ValidationErrors | null {
  const valor = control.value;
  return valor === null || /^\d+(\.\d{1,2})?$/.test(String(valor)) ? null : { decimales: true };
}

@Component({
  selector: 'app-gasto-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './gasto-form.html',
  styleUrl: './gasto-form.css',
})
export class GastoForm {
  readonly categorias = input.required<Categoria[]>();
  /** Gasto a editar; null para crear uno nuevo. */
  readonly gasto = input<Gasto | null>(null);
  readonly ocupado = input(false);

  readonly guardar = output<GastoRequest>();
  readonly cancelar = output<void>();

  protected readonly hoy = hoyIso();

  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    fecha: [hoyIso(), [Validators.required, noFutura]],
    importe: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01), dosDecimales]),
    categoriaId: [0, [Validators.required, Validators.min(1)]],
    nota: ['', [Validators.maxLength(500)]],
  });

  constructor() {
    effect(() => {
      const gasto = this.gasto();
      if (gasto) {
        this.form.setValue({
          fecha: gasto.fecha,
          importe: gasto.importe,
          categoriaId: gasto.categoria.id,
          nota: gasto.nota ?? '',
        });
      } else {
        this.limpiar();
      }
    });
  }

  protected enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { fecha, importe, categoriaId, nota } = this.form.getRawValue();
    this.guardar.emit({
      fecha,
      importe: importe as number,
      categoriaId: Number(categoriaId),
      nota: nota.trim() || null,
    });
  }

  /** Vuelve al formulario vacío (lo usa la página tras guardar). */
  limpiar(): void {
    this.form.reset({ fecha: hoyIso(), importe: null, categoriaId: 0, nota: '' });
  }

  protected muestraError(campo: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }
}
