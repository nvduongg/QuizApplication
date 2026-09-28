import { Icon } from '../../shared/icon';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth';
import { Observable } from 'rxjs';
import { apiError } from '../../core/api';
@Component({
  selector: 'app-auth-page',
  imports: [Icon, ReactiveFormsModule, RouterLink],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly register = inject(ActivatedRoute).snapshot.data['register'] === true;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly created = signal(false);
  readonly visible = signal(false);
  readonly form = new FormGroup({
    fullName: new FormControl('', {
      nonNullable: true,
      validators: this.register
        ? [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]
        : [],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: this.register
        ? [
            Validators.required,
            Validators.minLength(8),
            Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/),
          ]
        : [Validators.required],
    }),
  });
  submit(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    const model = { email: value.email.trim(), password: value.password };
    this.form.disable();
    const request: Observable<unknown> = this.register
      ? this.auth.register({ ...model, fullName: value.fullName.trim() })
      : this.auth.login(model);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        if (this.register) this.created.set(true);
        else void this.router.navigate([this.auth.home()]);
      },
      error: (error) => {
        this.busy.set(false);
        this.form.enable();
        this.error.set(apiError(error));
      },
    });
  }
}
