import { Component, ElementRef, input, output, viewChild } from '@angular/core';
let nextDialogId = 0;
@Component({
  selector: 'app-confirm-dialog',
  template: `<dialog
    #dialog
    [attr.aria-labelledby]="dialogId + '-title'"
    [attr.aria-describedby]="dialogId + '-description'"
    (cancel)="cancel($event)"
  >
    <h2 [id]="dialogId + '-title'">{{ title() }}</h2>
    <p class="subject">{{ subject() }}</p>
    <p [id]="dialogId + '-description'">
      {{ description() }}
      @if (irreversible()) {
        This action cannot be undone.
      }
    </p>
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    <div class="actions">
      <button
        autofocus
        type="button"
        class="button secondary"
        [disabled]="busy()"
        (click)="dismiss()"
      >
        Cancel</button
      ><button
        type="button"
        class="button"
        [class.danger]="danger()"
        [disabled]="busy()"
        (click)="confirmed.emit()"
      >
        {{ busy() ? pendingLabel() : actionLabel() }}
      </button>
    </div>
  </dialog>`,
  styles: `
    dialog {
      width: min(460px, calc(100% - 32px));
      max-height: calc(100dvh - 32px);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 28px;
      color: var(--text);
      background: var(--surface);
    }
    dialog::backdrop {
      background: #14233770;
    }
    .subject {
      font-weight: 600;
      color: var(--text);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
    }
    .danger {
      background: var(--danger);
    }
  `,
})
export class ConfirmDialog {
  actionLabel = input('Delete');
  pendingLabel = input('Deleting…');
  irreversible = input(true);
  danger = input(true);
  readonly dialogId = 'confirm-' + nextDialogId++;
  title = input('Delete content?');
  subject = input('');
  description = input('');
  busy = input(false);
  error = input('');
  confirmed = output<void>();
  cancelled = output<void>();
  dismiss() {
    this.close();
    this.cancelled.emit();
  }
  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  open() {
    this.dialog().nativeElement.showModal();
  }
  close() {
    this.dialog().nativeElement.close();
  }
  cancel(event: Event) {
    event.preventDefault();
    if (!this.busy()) this.dismiss();
  }
}
