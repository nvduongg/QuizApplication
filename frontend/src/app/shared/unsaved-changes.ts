import {
  Component,
  Directive,
  DestroyRef,
  ElementRef,
  Injectable,
  OnInit,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmDialog } from '../features/question-banks/confirm-dialog';

@Injectable({ providedIn: 'root' })
export class UnsavedChanges {
  private entries = new Set<{ changed: () => boolean; discard: () => void }>();
  readonly pending = signal(false);
  private resolve?: (leave: boolean) => void;
  private decision?: Promise<boolean>;
  register(entry: { changed: () => boolean; discard: () => void }) {
    this.entries.add(entry);
    return () => this.entries.delete(entry);
  }
  hasChanges() {
    return [...this.entries].some((e) => e.changed());
  }
  confirm(): Promise<boolean> {
    if (this.decision) return this.decision;
    if (!this.hasChanges()) return Promise.resolve(true);
    this.decision = new Promise((resolve) => {
      this.resolve = resolve;
    });
    this.pending.set(true);
    return this.decision;
  }
  finish(leave: boolean) {
    if (leave)
      this.entries.forEach((e) => {
        if (e.changed()) e.discard();
      });
    const resolve = this.resolve;
    this.resolve = undefined;
    this.decision = undefined;
    this.pending.set(false);
    resolve?.(leave);
  }
}
export const unsavedChangesGuard: CanDeactivateFn<unknown> = () => inject(UnsavedChanges).confirm();

@Directive({
  selector: '[unsavedChanges]',
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class UnsavedChangesForm implements OnInit {
  readonly control = input.required<AbstractControl>({ alias: 'unsavedChanges' });
  private element = inject(ElementRef<HTMLElement>);
  private changes = inject(UnsavedChanges);
  private destroy = inject(DestroyRef);
  private baseline = '';
  private value() {
    return JSON.stringify(this.control().getRawValue());
  }
  ngOnInit() {
    this.baseline = this.value();
    const subscription = this.control().events.subscribe(() => {
      if (this.control().pristine) this.baseline = this.value();
    });
    const unregister = this.changes.register({
      changed: () => this.changed(),
      discard: () => this.control().markAsPristine(),
    });
    this.destroy.onDestroy(() => {
      subscription.unsubscribe();
      unregister();
    });
  }
  changed() {
    const dialog = this.element.nativeElement.closest('dialog');
    return (!dialog || dialog.open) && this.control().dirty && this.value() !== this.baseline;
  }
  beforeUnload(event: BeforeUnloadEvent) {
    if (this.changed()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}

@Component({
  selector: 'app-unsaved-changes-dialog',
  imports: [ConfirmDialog],
  template: `<app-confirm-dialog
    title="Leave without saving?"
    subject="You have unsaved changes."
    description="Stay to keep editing, or discard your changes and leave."
    actionLabel="Discard changes"
    [irreversible]="false"
    [danger]="false"
    (confirmed)="decide(true)"
    (cancelled)="decide(false)"
  />`,
})
export class UnsavedChangesDialog {
  private changes = inject(UnsavedChanges);
  private dialog = viewChild.required(ConfirmDialog);
  constructor() {
    effect(() => {
      if (this.changes.pending()) this.dialog().open();
    });
  }
  decide(leave: boolean) {
    this.dialog().close();
    this.changes.finish(leave);
  }
}
