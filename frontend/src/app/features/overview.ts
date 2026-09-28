import { Icon } from '../shared/icon';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth';
@Component({
  selector: 'app-overview',
  imports: [Icon, RouterLink],
  template: `
    <div class="page-heading">
      <h1>{{ admin ? 'Administration overview' : 'Welcome, ' + auth.session()?.fullName }}</h1>
      <p>
        {{
          admin
            ? 'A dedicated space for user access and quiz oversight.'
            : 'A place for your questions, ideas, and next discoveries.'
        }}
      </p>
    </div>
    <section class="overview-intro">
      <span class="overview-number" aria-hidden="true">Q.</span>
      <div>
        <h2>{{ admin ? 'Responsible oversight' : 'Start with a little curiosity' }}</h2>
        <p>
          {{
            admin
              ? 'Your administrator account provides system oversight. Content creation and participation use a User account.'
              : 'Explore assessments shared by the community. Preview the questions count, time, and points before choosing a quiz.'
          }}
        </p>
        @if (admin) {
          <div class="overview-actions">
            <a class="button" routerLink="/admin/users">Manage users</a
            ><a class="button secondary" routerLink="/admin/quizzes">Manage quizzes</a>
          </div>
        } @else {
          <a class="button" routerLink="/quizzes"
            >Explore public quizzes <app-icon name="forward"
          /></a>
        }
      </div>
    </section>
  `,
  styles: `
    .overview-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .overview-intro {
      display: flex;
      gap: 32px;
      border-top: 1px solid var(--border);
      padding: 40px 0;
      max-width: var(--reading-width);
    }
    .overview-intro p {
      max-width: 58ch;
      margin-bottom: 24px;
    }
    .overview-number {
      font-size: 56px;
      font-weight: 700;
      color: var(--primary);
    }
    @media (max-width: 599px) {
      .overview-number {
        display: none;
      }
    }
  `,
})
export class Overview {
  readonly auth = inject(AuthService);
  readonly admin = inject(ActivatedRoute).snapshot.data['role'] === 'Administrator';
}
