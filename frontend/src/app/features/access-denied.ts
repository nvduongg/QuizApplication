import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth';
@Component({
  selector: 'app-access-denied',
  imports: [RouterLink],
  template: `<div class="page-heading">
      <h1>You don't have access to this page</h1>
      <p>You do not have permission to access this resource.</p>
    </div>
    <a class="button" [routerLink]="auth.session() ? auth.home() : '/quizzes'">{{
      auth.session() ? 'Back to overview' : 'Browse public quizzes'
    }}</a>`,
})
export class AccessDenied {
  readonly auth = inject(AuthService);
}
