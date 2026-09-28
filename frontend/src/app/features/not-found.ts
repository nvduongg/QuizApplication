import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  imports: [RouterLink],
  template: `<div class="page-heading">
      <h1>Page not found</h1>
      <p>This resource could not be found. Check the address or return to public quizzes.</p>
    </div>
    <a class="button secondary" routerLink="/quizzes">Public quizzes</a>`,
})
export class NotFound {}
