import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  it('muestra la cabecera de la aplicación', async () => {
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('h1')?.textContent).toContain('gastos-casa');
  });
});
