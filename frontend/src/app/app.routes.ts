import { unsavedChangesGuard } from './shared/unsaved-changes';
import { Routes } from '@angular/router';
import { roleGuard } from './core/security';
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
    title: 'Sign in | Quizizi.',
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
    data: { register: true },
    title: 'Create account | Quizizi.',
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'app/history',
        canActivate: [roleGuard],
        data: { role: 'User' },
        loadComponent: () => import('./features/attempts/history-page').then((m) => m.HistoryPage),
        title: 'History | Quizizi.',
      },
      {
        path: 'app/attempts/:id/result',
        canActivate: [roleGuard],
        data: { role: 'User' },
        loadComponent: () => import('./features/attempts/result-page').then((m) => m.ResultPage),
        title: 'Quiz result | Quizizi.',
      },
      {
        path: 'app/attempts/:id',
        canActivate: [roleGuard],
        data: { role: 'User' },
        loadComponent: () => import('./features/attempts/attempt-page').then((m) => m.AttemptPage),
        title: 'Take quiz | Quizizi.',
      },
      {
        path: 'admin/users/:id',
        canActivate: [roleGuard],
        data: { role: 'Administrator' },
        loadComponent: () => import('./features/admin/admin-users').then((m) => m.AdminUsers),
        title: 'User details | Quizizi.',
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard],
        data: { role: 'Administrator' },
        loadComponent: () => import('./features/admin/admin-users').then((m) => m.AdminUsers),
        title: 'Users | Quizizi.',
      },
      {
        path: 'admin/quizzes',
        canActivate: [roleGuard],
        data: { role: 'Administrator' },
        loadComponent: () => import('./features/admin/admin-quizzes').then((m) => m.AdminQuizzes),
        title: 'Quiz administration | Quizizi.',
      },
      {
        path: 'app/quizzes/:id/questions/add',
        canActivate: [roleGuard],
        data: { role: 'User' },
        loadComponent: () =>
          import('./features/quiz-authoring/question-picker').then((m) => m.QuestionPicker),
        title: 'Add questions | Quizizi.',
      },
      {
        path: 'app/quizzes/:id/questions/create',
        canActivate: [roleGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { role: 'User', creation: 'quiz' },
        loadComponent: () =>
          import('./features/question-banks/question-editor').then((m) => m.QuestionEditor),
        title: 'Create question | Quizizi.',
      },
      {
        path: 'app/question-banks/:id/questions/create',
        canActivate: [roleGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { role: 'User', creation: 'bank' },
        loadComponent: () =>
          import('./features/question-banks/question-editor').then((m) => m.QuestionEditor),
        title: 'Create question | Quizizi.',
      },
      {
        path: 'app/question-banks/create',
        canActivate: [roleGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { role: 'User', resource: 'bank' },
        loadComponent: () =>
          import('./features/authoring-details-page').then((m) => m.AuthoringDetailsPage),
        title: 'Editor | Quizizi.',
      },
      {
        path: 'app/question-banks/:id/edit',
        canActivate: [roleGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { role: 'User', resource: 'bank' },
        loadComponent: () =>
          import('./features/authoring-details-page').then((m) => m.AuthoringDetailsPage),
        title: 'Editor | Quizizi.',
      },
      {
        path: 'app/quizzes/create',
        canActivate: [roleGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { role: 'User', resource: 'quiz' },
        loadComponent: () =>
          import('./features/authoring-details-page').then((m) => m.AuthoringDetailsPage),
        title: 'Editor | Quizizi.',
      },
      {
        path: 'app/quizzes/:id/edit',
        canActivate: [roleGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { role: 'User', resource: 'quiz' },
        loadComponent: () =>
          import('./features/authoring-details-page').then((m) => m.AuthoringDetailsPage),
        title: 'Editor | Quizizi.',
      },
      {
        path: 'app/quizzes',
        canDeactivate: [unsavedChangesGuard],
        canActivate: [roleGuard],
        data: { role: 'User' },
        loadComponent: () =>
          import('./features/quiz-authoring/my-quizzes').then((m) => m.MyQuizzes),
        title: 'My Quizzes | Quizizi.',
      },
      {
        path: 'app/quizzes/:id/builder',
        canDeactivate: [unsavedChangesGuard],
        canActivate: [roleGuard],
        data: { role: 'User' },
        loadComponent: () =>
          import('./features/quiz-authoring/quiz-builder').then((m) => m.QuizBuilder),
        title: 'Quiz Builder | Quizizi.',
      },
      {
        path: 'app/question-banks',
        canDeactivate: [unsavedChangesGuard],
        canActivate: [roleGuard],
        data: { role: 'User' },
        loadComponent: () => import('./features/question-banks/bank-list').then((m) => m.BankList),
        title: 'Question Banks | Quizizi.',
      },
      {
        path: 'app/question-banks/:id/import',
        canActivate: [roleGuard],
        data: { role: 'User' },
        loadComponent: () =>
          import('./features/question-banks/import-page').then((m) => m.QuestionImportPage),
        title: 'Import questions | Quizizi.',
      },
      {
        path: 'app/question-banks/:id',
        canDeactivate: [unsavedChangesGuard],
        canActivate: [roleGuard],
        data: { role: 'User' },
        loadComponent: () =>
          import('./features/question-banks/bank-detail').then((m) => m.BankDetail),
        title: 'Question bank | Quizizi.',
      },
      {
        path: 'app/questions/:id',
        canDeactivate: [unsavedChangesGuard],
        canActivate: [roleGuard],
        data: { role: 'User' },
        loadComponent: () =>
          import('./features/question-banks/question-editor').then((m) => m.QuestionEditor),
        title: 'Question editor | Quizizi.',
      },
      {
        path: 'quizzes',
        loadComponent: () => import('./features/public-quizzes/quiz-list').then((m) => m.QuizList),
        title: 'Public Quizzes | Quizizi.',
      },
      {
        path: 'quizzes/:id',
        loadComponent: () =>
          import('./features/public-quizzes/quiz-detail').then((m) => m.QuizDetail),
        title: 'Quiz details | Quizizi.',
      },
      {
        path: 'app',
        canActivate: [roleGuard],
        data: { role: 'User' },
        loadComponent: () => import('./features/overview').then((m) => m.Overview),
        title: 'Overview | Quizizi.',
      },
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { role: 'Administrator' },
        loadComponent: () => import('./features/overview').then((m) => m.Overview),
        title: 'Administration | Quizizi.',
      },
      {
        path: 'access-denied',
        loadComponent: () => import('./features/access-denied').then((m) => m.AccessDenied),
        title: 'Access restricted | Quizizi.',
      },
      { path: '', pathMatch: 'full', redirectTo: 'quizzes' },
      {
        path: '**',
        loadComponent: () => import('./features/not-found').then((m) => m.NotFound),
        title: 'Page not found | Quizizi.',
      },
    ],
  },
];
