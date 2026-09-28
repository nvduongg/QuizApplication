import {
  afterNextRender,
  Component,
  DestroyRef,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth';
import { Icon } from '../../shared/icon';
import { CountLabel } from '../../shared/count-label';
import { QuestionBankService } from './content.services';
import { QuestionBank } from './content.models';
import { validId } from './content.rules';
import {
  importFileLimit,
  importRowLimit,
  QuestionImportError,
  QuestionImportPreview,
  QuestionImportResult,
} from './import.models';
import { QuestionImportService, importError, importRowErrors } from './import.service';
import { ImportPreview } from './import-preview';
@Component({
  selector: 'app-question-import',
  host: { class: 'has-page-back' },
  imports: [RouterLink, Icon, CountLabel, ImportPreview],
  templateUrl: './import-page.html',
  styleUrl: './import.scss',
})
export class QuestionImportPage {
  private banks = inject(QuestionBankService);
  private api = inject(QuestionImportService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private destroy = inject(DestroyRef);
  private injector = inject(Injector);
  private bankRequest?: Subscription;
  private previewRequest?: Subscription;
  private importRequest?: Subscription;
  id = 0;
  bank = signal<QuestionBank | null>(null);
  loading = signal(true);
  loadError = signal('');
  file = signal<File | null>(null);
  preview = signal<QuestionImportPreview | null>(null);
  result = signal<QuestionImportResult | null>(null);
  error = signal('');
  rowErrors = signal<QuestionImportError[]>([]);
  previewing = signal(false);
  importing = signal(false);
  downloading = signal(false);
  downloadError = signal('');
  uncertain = signal(false);
  owned = computed(() => this.bank()?.ownerId === this.auth.session()?.userId && !!this.bank());
  busy = computed(() => this.previewing() || this.importing());
  fileSize = computed(() => Math.max(1, Math.ceil((this.file()?.size ?? 0) / 1024)) + ' KB');
  rowLimit = importRowLimit;
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.importRequest?.unsubscribe();
      this.importing.set(false);
      this.id = validId(params.get('id'));
      this.reset();
      this.load();
    });
  }
  load() {
    this.bankRequest?.unsubscribe();
    this.bank.set(null);
    this.loading.set(true);
    this.loadError.set('');
    if (!this.id) {
      this.loadError.set('This question bank is unavailable.');
      this.loading.set(false);
      return;
    }
    this.bankRequest = this.banks
      .detail(this.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (bank) => {
          this.bank.set(bank);
          this.loading.set(false);
        },
        error: (e: unknown) => {
          this.loadError.set(importError(e));
          this.loading.set(false);
        },
      });
  }
  select(event: Event) {
    if (!(event.target instanceof HTMLInputElement) || this.importing()) return;
    const file = event.target.files?.[0];
    if (!file) return;
    this.reset();
    event.target.value = '';
    if (!/\.xlsx$/i.test(file.name)) this.error.set('Choose an Excel .xlsx file.');
    else if (!file.size) this.error.set('This file is empty. Choose a populated Excel file.');
    else if (file.size > importFileLimit)
      this.error.set('Choose an Excel file no larger than 5 MB.');
    else this.file.set(file);
  }
  reset() {
    if (this.importing()) return;
    this.previewRequest?.unsubscribe();
    this.previewing.set(false);
    this.file.set(null);
    this.preview.set(null);
    this.result.set(null);
    this.error.set('');
    this.rowErrors.set([]);
    this.uncertain.set(false);
  }
  previewFile() {
    const file = this.file();
    if (!file || !this.owned() || this.busy() || this.result()) return;
    this.preview.set(null);
    this.error.set('');
    this.rowErrors.set([]);
    this.uncertain.set(false);
    this.previewing.set(true);
    this.previewRequest = this.api
      .preview(this.id, file)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (preview) => {
          this.preview.set(preview);
          this.previewing.set(false);
        },
        error: (e: unknown) => {
          this.error.set(importError(e));
          this.previewing.set(false);
        },
      });
  }
  importFile() {
    const file = this.file();
    if (!file || !this.owned() || !this.preview()?.canImport || this.busy() || this.result())
      return;
    this.importing.set(true);
    this.error.set('');
    this.rowErrors.set([]);
    this.importRequest = this.api
      .import(this.id, file)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.preview.set(null);
          this.file.set(null);
          this.importing.set(false);
          afterNextRender(() => document.getElementById('import-complete')?.focus(), {
            injector: this.injector,
          });
        },
        error: (e: unknown) => {
          this.importing.set(false);
          this.preview.set(null);
          this.error.set(importError(e));
          this.rowErrors.set(importRowErrors(e));
          this.uncertain.set(
            !(e instanceof HttpErrorResponse) || e.status === 0 || e.status >= 500,
          );
        },
      });
  }
  downloadTemplate() {
    if (this.downloading() || !this.owned()) return;
    this.downloading.set(true);
    this.downloadError.set('');
    this.api
      .template()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'Quizizi-Question-Import-Template.xlsx';
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.downloading.set(false);
        },
        error: (e: unknown) => {
          this.downloadError.set(importError(e));
          this.downloading.set(false);
        },
      });
  }
}
