import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth';
import { API_URL } from './api';
import { Role } from './models';
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.token()) return router.createUrlTree(['/login']);
  return auth.hasRole(route.data['role'] as Role) || router.createUrlTree(['/access-denied']);
};
export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const base = inject(API_URL);
  const auth = inject(AuthService);
  const router = inject(Router);
  const apiRequest = request.url === base || request.url.startsWith(base + '/');
  const anonymous =
    request.url.startsWith(base + '/auth/') || request.url.startsWith(base + '/public/');
  const token = apiRequest && !anonymous ? auth.token() : null;
  return next(
    token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request,
  ).pipe(
    catchError((error: unknown) => {
      if (apiRequest && !anonymous && error instanceof HttpErrorResponse) {
        if (
          error.status === 401 &&
          ((token && auth.session()?.token === token) || (!token && !auth.session()))
        ) {
          auth.clear();
          auth.notice.set('Your session has expired. Please sign in again.');
          void router.navigate(['/login']);
        } else if (error.status === 403) {
          void router.navigate(['/access-denied']);
        }
      }
      return throwError(() => error);
    }),
  );
};
