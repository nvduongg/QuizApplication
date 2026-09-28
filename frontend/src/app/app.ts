import { UnsavedChangesDialog } from './shared/unsaved-changes';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UnsavedChangesDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
