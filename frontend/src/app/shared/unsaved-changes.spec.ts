import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { UnsavedChanges, UnsavedChangesForm, unsavedChangesGuard } from './unsaved-changes';

@Component({
  imports: [ReactiveFormsModule, UnsavedChangesForm],
  template: `<input [formControl]="form" [unsavedChanges]="form" />`,
})
class Editor {
  form = new FormControl('Original', { nonNullable: true });
}
@Component({ template: 'Destination' })
class Destination {}

describe('Unsaved editing protection', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'edit/:id', component: Editor, canDeactivate: [unsavedChangesGuard] },
          { path: 'destination', component: Destination },
        ]),
      ],
    }),
  );

  function setup() {
    const fixture = TestBed.createComponent(Editor);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    const change = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, change, changes: TestBed.inject(UnsavedChanges) };
  }
  it('does not warn for unchanged or reverted values, including disabled controls', () => {
    const { fixture, change, changes } = setup();
    expect(changes.hasChanges()).toBe(false);
    change('Changed');
    fixture.componentInstance.form.disable();
    expect(changes.hasChanges()).toBe(true);
    fixture.componentInstance.form.enable();
    change('Original');
    expect(changes.hasChanges()).toBe(false);
  });
  it('retains edits on cancel, accepts discard, and shares an outstanding confirmation', async () => {
    const { change, changes } = setup();
    change('Changed');
    const first = changes.confirm();
    expect(changes.confirm()).toBe(first);
    changes.finish(false);
    expect(await first).toBe(false);
    expect(changes.hasChanges()).toBe(true);
    const second = changes.confirm();
    changes.finish(true);
    expect(await second).toBe(true);
    expect(changes.hasChanges()).toBe(false);
  });
  it('clears after a successful reset and protects subsequent edits', () => {
    const { fixture, change, changes } = setup();
    change('Saved');
    fixture.componentInstance.form.reset('Saved');
    expect(changes.hasChanges()).toBe(false);
    change('Another change');
    expect(changes.hasChanges()).toBe(true);
    fixture.destroy();
    expect(changes.hasChanges()).toBe(false);
  });
  it('uses browser unload protection only when values changed', () => {
    const { change } = setup();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    change('Changed');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
  it('blocks route changes on cancel and navigates after explicit discard', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/edit/1', Editor);
    const input: HTMLInputElement = harness.routeNativeElement!.querySelector('input')!;
    input.value = 'Changed';
    input.dispatchEvent(new Event('input'));
    const changes = TestBed.inject(UnsavedChanges);
    const router = TestBed.inject(Router);
    const cancelled = router.navigateByUrl('/destination');
    await vi.waitFor(() => expect(changes.pending()).toBe(true));
    changes.finish(false);
    expect(await cancelled).toBe(false);
    expect(router.url).toBe('/edit/1');
    const allowed = router.navigateByUrl('/destination');
    await vi.waitFor(() => expect(changes.pending()).toBe(true));
    changes.finish(true);
    expect(await allowed).toBe(true);
    expect(router.url).toBe('/destination');
  });
  it('protects navigation to a different record on the same editor route', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/edit/1', Editor);
    const input = harness.routeNativeElement!.querySelector('input')!;
    input.value = 'Changed';
    input.dispatchEvent(new Event('input'));
    const changes = TestBed.inject(UnsavedChanges);
    const router = TestBed.inject(Router);
    const navigation = router.navigateByUrl('/edit/2');
    await vi.waitFor(() => expect(changes.pending()).toBe(true));
    changes.finish(false);
    expect(await navigation).toBe(false);
    expect(router.url).toBe('/edit/1');
  });
  it('attaches protection to every route hosting an authoring form', () => {
    const children = routes.find((route) => route.path === '')!.children!;
    for (const path of [
      'app/quizzes',
      'app/quizzes/:id/builder',
      'app/question-banks',
      'app/question-banks/:id',
      'app/questions/:id',
    ]) {
      expect(children.find((route) => route.path === path)?.canDeactivate).toContain(
        unsavedChangesGuard,
      );
    }
  });
});
