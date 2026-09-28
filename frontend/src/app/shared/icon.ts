import { Component, input } from '@angular/core';
export type IconName =
  | 'history'
  | 'check'
  | 'users'
  | 'overview'
  | 'globe'
  | 'banks'
  | 'quizzes'
  | 'back'
  | 'forward'
  | 'up'
  | 'down'
  | 'menu'
  | 'close';
const paths: Record<IconName, string> = {
  check: 'M5 12l4 4L19 6',
  history: 'M3 11a9 9 0 1 1 2.5 7M3 4v7h7M12 7v5l3 2',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  overview: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
  banks: 'M4 5h4v15H4ZM10 5h4v15h-4ZM16 6l4-1 3 14-4 1Z',
  quizzes: 'M8 4H5v17h14V4h-3M8 3h8v4H8ZM8 11h8M8 15h5',
  back: 'M19 12H5m6-6-6 6 6 6',
  forward: 'M5 12h14m-6-6 6 6-6 6',
  up: 'M12 19V5m-6 6 6-6 6 6',
  down: 'M12 5v14m-6-6 6 6 6-6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M18 6 6 18',
};
@Component({
  selector: 'app-icon',
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path [attr.d]="paths[name()]" />
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      width: 18px;
      height: 18px;
      flex: 0 0 18px;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
    }
    svg {
      width: 18px;
      height: 18px;
    }
  `,
})
export class Icon {
  name = input.required<IconName>();
  readonly paths = paths;
}
