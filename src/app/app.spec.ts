import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { BattlefieldComponent } from './battle/battlefield.component';
import { StatusComponent } from './status/status.component';
import { routes } from './app.routes';

describe('Lanes Application Shell Tests', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, BattlefieldComponent, StatusComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  describe('App Shell', () => {
    it('should create the root shell', () => {
      const fixture = TestBed.createComponent(App);
      const app = fixture.componentInstance;
      expect(app).toBeTruthy();
    });

    it('should render the Lanes brand title', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.brand-title')?.textContent).toContain('Lanes');
    });

    it('should render navigation links for the Guild Hall, Battle and War Room', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#nav-link-guild')?.textContent?.trim()).toBe('Guild Hall');
      expect(compiled.querySelector('#nav-link-home')?.textContent?.trim()).toBe('Battle');
      expect(compiled.querySelector('#nav-link-squad')?.textContent?.trim()).toBe('War Room');
      expect(compiled.querySelector('#nav-link-status')?.textContent?.trim()).toBe('Diagnostics');
    });

    it('should render skip link for accessibility', async () => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      const skipLink = compiled.querySelector('.skip-link');
      expect(skipLink).toBeTruthy();
      expect(skipLink?.getAttribute('href')).toBe('#main-content');
    });
  });

  describe('BattlefieldComponent Route', () => {
    it('should render the 3-lane battlefield', async () => {
      const fixture = TestBed.createComponent(BattlefieldComponent);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelectorAll('.combat-lane').length).toBe(3);
    });
  });

  describe('StatusComponent', () => {
    it('should create status component and render base uri diagnostic', async () => {
      const fixture = TestBed.createComponent(StatusComponent);
      await fixture.whenStable();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#status-heading')?.textContent).toContain(
        'Runtime & Routing Verification',
      );
      expect(compiled.querySelector('#base-uri-val')).toBeTruthy();
      expect(compiled.querySelector('#back-home-link')).toBeTruthy();
    });
  });
});
