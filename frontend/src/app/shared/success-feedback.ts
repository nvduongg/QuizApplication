import { Component, effect, input, output } from '@angular/core';
@Component({
  selector: 'app-success-feedback',
  template:
    '<p role="status">{{ message() }}</p><button type="button" class="text-button" aria-label="Dismiss success message" (click)="dismissed.emit()">Dismiss</button>',
  styles:
    ':host { display:flex; align-items:center; gap:12px; margin:16px 0; } p { margin:0; color:var(--success); }',
})
export class SuccessFeedback {
  constructor() {
    effect((onCleanup) => {
      this.message();
      const timer = setTimeout(() => this.dismissed.emit(), 8000);
      onCleanup(() => clearTimeout(timer));
    });
  }
  message = input.required<string>();
  dismissed = output<void>();
}
