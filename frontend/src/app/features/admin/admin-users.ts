import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, Subscription } from 'rxjs';
import { Icon } from '../../shared/icon';
import { SuccessFeedback } from '../../shared/success-feedback';
import { ConfirmDialog } from '../question-banks/confirm-dialog';
import { AdminService, AdminUser, adminError } from './admin.service';
@Component({
  selector: 'app-admin-users',
  imports: [RouterLink, Icon, SuccessFeedback, ConfirmDialog],
  styleUrl: './admin.scss',
  template: `
    @if (id()) {
      <a class="page-back" routerLink="/admin/users"><app-icon name="back" /> Users</a>
    }
    <div class="page-heading">
      <h1>{{ id() ? users()[0]?.fullName || 'User details' : 'Users' }}</h1>
      <p>Review accounts and manage sign-in access.</p>
    </div>
    @if (message()) {
      <app-success-feedback [message]="message()" (dismissed)="message.set('')" />
    }
    @if (loading()) {
      <p class="loading" role="status">Loading users…</p>
    } @else if (error()) {
      <section class="state" role="alert">
        <p>{{ error() }}</p>
        <button class="button secondary" (click)="load()">Retry</button>
      </section>
    } @else if (!users().length) {
      <section class="state">
        <h2>No users found</h2>
        <p>Registered accounts will appear here.</p>
      </section>
    } @else {
      <div class="table-wrap" role="region" aria-label="User accounts" tabindex="0">
        <table>
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Roles</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            @for (user of users(); track user.userId) {
              <tr>
                <td>
                  @if (id()) {
                    <strong>{{ user.fullName }}</strong>
                  } @else {
                    <a [routerLink]="['/admin/users', user.userId]">{{ user.fullName }}</a>
                  }
                  <small>{{ user.email }}</small>
                </td>
                <td>{{ user.roles.join(', ') }}</td>
                <td>{{ user.isBlocked ? 'Blocked' : 'Active' }}</td>
                <td>
                  <button
                    class="text-button"
                    [class.danger-button]="!user.isBlocked"
                    [disabled]="busy()"
                    (click)="ask(user)"
                  >
                    {{ user.isBlocked ? 'Unblock' : 'Block' }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
    <app-confirm-dialog
      [title]="pending()?.isBlocked ? 'Unblock account?' : 'Block account?'"
      [subject]="pending()?.email || ''"
      [description]="
        pending()?.isBlocked
          ? 'This account will be allowed to sign in again.'
          : 'This account will be prevented from signing in. An already active session may remain valid.'
      "
      [actionLabel]="pending()?.isBlocked ? 'Unblock' : 'Block'"
      pendingLabel="Updating…"
      [danger]="!pending()?.isBlocked"
      [irreversible]="false"
      [busy]="busy()"
      [error]="actionError()"
      (confirmed)="changeStatus()"
    />
  `,
})
export class AdminUsers {
  private api = inject(AdminService);
  private route = inject(ActivatedRoute);
  private destroy = inject(DestroyRef);
  private dialog = viewChild.required(ConfirmDialog);
  private request?: Subscription;
  private mutation?: Subscription;
  id = signal('');
  users = signal<AdminUser[]>([]);
  loading = signal(true);
  error = signal('');
  actionError = signal('');
  message = signal('');
  busy = signal(false);
  pending = signal<AdminUser | null>(null);
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((p) => {
      this.mutation?.unsubscribe();
      this.busy.set(false);
      this.id.set(p.get('id') || '');
      this.load();
    });
  }
  load() {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.users.set([]);
    const request = this.id() ? this.api.user(this.id()).pipe(map((u) => [u])) : this.api.users();
    this.request = request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (u) => {
        this.users.set(u);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(adminError(e));
      },
    });
  }
  ask(user: AdminUser) {
    if (this.busy()) return;
    this.pending.set(user);
    this.actionError.set('');
    this.dialog().open();
  }
  changeStatus() {
    const user = this.pending();
    if (!user || this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    this.mutation = this.api
      .status(user.userId, !user.isBlocked)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (u) => {
          this.users.update((users) => users.map((x) => (x.userId === u.userId ? u : x)));
          this.busy.set(false);
          this.dialog().close();
          this.message.set(u.isBlocked ? 'Account blocked.' : 'Account unblocked.');
        },
        error: (e) => {
          this.busy.set(false);
          this.actionError.set(adminError(e));
        },
      });
  }
}
