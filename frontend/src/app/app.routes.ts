import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'gastos' },
  {
    path: 'gastos',
    title: 'Gastos · gastos-casa',
    loadComponent: () => import('./paginas/gastos-page/gastos-page').then((m) => m.GastosPage),
  },
  { path: '**', redirectTo: 'gastos' },
];
