import { UnsavedChanges } from '../shared/unsaved-changes';
import { Icon } from '../shared/icon';
import { Component, ElementRef, HostListener, inject, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { NgTemplateOutlet } from '@angular/common';
import { AuthService } from '../core/auth';
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, Icon],
  template: `@if (auth.session(); as user) {
      <a class="skip" href="#content">Skip to content</a>
      <aside class="desktop-sidebar"><ng-container [ngTemplateOutlet]="navigation" /></aside>
      <dialog #drawer class="drawer" (click)="backdrop($event)" aria-label="Navigation">
        <button class="close" (click)="close()" aria-label="Close navigation">
          <app-icon name="close" /></button
        ><ng-container [ngTemplateOutlet]="navigation" />
      </dialog>
      <main id="content" tabindex="-1" class="workspace">
        <button class="menu secondary" (click)="open()" aria-haspopup="dialog">
          <app-icon name="menu" /> Navigation</button
        ><router-outlet />
      </main>
      <ng-template #navigation
        ><div class="sidebar-inner">
          <a routerLink="/quizzes" class="brand" (click)="close()"
            >Quizizi<span class="brand-dot">.</span></a
          >
          <nav aria-label="Main navigation">
            <a
              [routerLink]="auth.home()"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
              ariaCurrentWhenActive="page"
              ><app-icon name="overview" /> Overview</a
            ><a routerLink="/quizzes" routerLinkActive="active" ariaCurrentWhenActive="page"
              ><app-icon name="globe" /> Public Quizzes</a
            >
            @if (user.roles.includes('User')) {
              <a
                routerLink="/app/question-banks"
                routerLinkActive="active"
                ariaCurrentWhenActive="page"
                ><app-icon name="banks" /> Question Banks</a
              >
              <a routerLink="/app/quizzes" routerLinkActive="active" ariaCurrentWhenActive="page"
                ><app-icon name="quizzes" /> My Quizzes</a
              >
            }
            @if (user.roles.includes('User')) {
              <a routerLink="/app/history" routerLinkActive="active" ariaCurrentWhenActive="page"
                ><app-icon name="history" /> History</a
              >
            }
            @if (user.roles.includes('Administrator')) {
              <a routerLink="/admin/users" routerLinkActive="active" ariaCurrentWhenActive="page"
                ><app-icon name="users" /> Users</a
              >
              <a routerLink="/admin/quizzes" routerLinkActive="active" ariaCurrentWhenActive="page"
                ><app-icon name="quizzes" /> Quiz administration</a
              >
            }
          </nav>
          <div class="account">
            <strong>{{ user.fullName }}</strong
            ><small>{{ user.roles.join(' · ') }}</small
            ><button class="logout" (click)="logout()">Sign out <app-icon name="forward" /></button>
          </div></div
      ></ng-template>
    } @else {
      <div class="guest-wrap">
        <nav class="guest-nav" aria-label="Main navigation">
          <a class="brand" routerLink="/quizzes">Quizizi<span class="brand-dot">.</span></a>
          <div>
            <a routerLink="/login">Sign in</a
            ><a class="button secondary" routerLink="/register">Create account</a>
          </div>
        </nav>
        <main id="content" class="guest-main"><router-outlet /></main>
      </div>
    }`,
  styleUrl: './shell.scss',
})
export class Shell {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly drawer = viewChild<ElementRef<HTMLDialogElement>>('drawer');
  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.close());
  }
  open(): void {
    this.drawer()?.nativeElement.showModal();
  }
  @HostListener('window:resize')
  resized(): void {
    if (window.matchMedia('(min-width: 960px)').matches) this.close();
  }
  close(): void {
    this.drawer()?.nativeElement.close();
  }
  backdrop(event: MouseEvent): void {
    if (event.target === this.drawer()?.nativeElement) this.close();
  }
  private changes = inject(UnsavedChanges);
  async logout(): Promise<void> {
    if (!(await this.changes.confirm())) return;
    this.auth.clear();
    this.close();
    void this.router.navigate(['/quizzes']);
  }
}
