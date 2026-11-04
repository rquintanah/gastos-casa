import { InjectionToken } from '@angular/core';

/** Devuelve «ahora». Permite fijar «hoy» en los tests sin fake timers. */
export const RELOJ = new InjectionToken<() => Date>('RELOJ', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
