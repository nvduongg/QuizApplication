import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../core/auth';
import { QuestionImportPage } from './import-page';
import { QuestionImportPreview } from './import.models';
import { importError, importRowErrors, QuestionImportService } from './import.service';
import { routes } from '../../app.routes';
import { roleGuard } from '../../core/security';
const preview: QuestionImportPreview = {
  fileName: 'questions.xlsx',
  totalRows: 2,
  validRows: 1,
  invalidRows: 1,
  canImport: true,
  rows: [
    {
      rowNumber: 2,
      question: 'Choose a method',
      type: 'SingleChoice',
      answers: [
        { key: 'A', content: 'GET' },
        { key: 'B', content: 'POST' },
      ],
      correctAnswerKeys: ['B'],
      isValid: true,
      errors: [],
    },
    {
      rowNumber: 7,
      question: 'Invalid question',
      type: 'Unknown',
      answers: [],
      correctAnswerKeys: [],
      isValid: false,
      errors: [
        {
          rowNumber: 7,
          code: 'INVALID_TYPE',
          message: 'Type must be SingleChoice, MultipleChoice or TrueFalse.',
        },
        {
          rowNumber: 7,
          code: 'NO_CORRECT_ANSWER',
          message: 'Correct must contain at least one answer key.',
        },
      ],
    },
  ],
};
describe('Excel question import', () => {
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ id: '7' }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: AuthService, useValue: { session: signal({ userId: 'owner' }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function page(ownerId = 'owner') {
    const fixture = TestBed.createComponent(QuestionImportPage);
    http
      .expectOne('/api/question-banks/7')
      .flush({ questionBankId: 7, name: 'Network bank', ownerId });
    fixture.detectChanges();
    return fixture;
  }
  function choose(
    component: QuestionImportPage,
    file = new File(['xlsx content'], 'questions.xlsx'),
  ) {
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: [file] });
    const event = new Event('change');
    Object.defineProperty(event, 'target', { value: input });
    component.select(event);
    return file;
  }
  it('adds only a related User-protected import route', () => {
    const route = routes
      .find((r) => r.path === '')
      ?.children?.find((r) => r.path === 'app/question-banks/:id/import');
    expect(route?.canActivate).toContain(roleGuard);
    expect(route?.data?.['role']).toBe('User');
  });
  it('hides controls and prevents requests for a readable foreign bank', () => {
    const f = page('another-user');
    choose(f.componentInstance);
    f.componentInstance.previewFile();
    f.componentInstance.downloadTemplate();
    expect(f.nativeElement.textContent).toContain('only import questions into your own');
    expect(f.nativeElement.querySelector('input[type=file]')).toBeNull();
    http.expectNone((r) => r.method === 'POST');
  });
  it('checks extension, empty and oversized files without calling the parser', () => {
    const f = page();
    choose(f.componentInstance, new File(['data'], 'wrong.csv'));
    expect(f.componentInstance.file()).toBeNull();
    choose(f.componentInstance, new File([], 'empty.xlsx'));
    expect(f.componentInstance.error()).toContain('empty');
    choose(f.componentInstance, new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.xlsx'));
    expect(f.componentInstance.error()).toContain('5 MB');
    http.expectNone((r) => r.method === 'POST');
  });
  it('uploads FormData with the exact file, no ownership or manual Content-Type, once per preview', () => {
    const f = page();
    const file = choose(f.componentInstance);
    f.componentInstance.previewFile();
    f.componentInstance.previewFile();
    const request = http.expectOne('/api/question-banks/7/import/preview');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect(request.request.body.get('file')).toBe(file);
    expect([...request.request.body.keys()]).toEqual(['file']);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush(preview);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('1 ready to import');
    expect(f.nativeElement.textContent).toContain('Single Choice');
    expect(f.nativeElement.textContent).toContain('Correct must contain');
    expect(f.nativeElement.textContent).toContain('Type must be');
  });
  it('uses backend counts rather than visible rows and imports despite skipped rows', () => {
    const f = page();
    const file = choose(f.componentInstance);
    f.componentInstance.previewFile();
    http
      .expectOne('/api/question-banks/7/import/preview')
      .flush({ ...preview, totalRows: 50, validRows: 47, invalidRows: 3 });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Import 47 questions');
    f.componentInstance.importFile();
    f.componentInstance.importFile();
    const request = http.expectOne('/api/question-banks/7/import');
    expect(request.request.body.get('file')).toBe(file);
    request.flush({
      totalRows: 50,
      importedCount: 47,
      skippedCount: 3,
      importedQuestionIds: [100],
      errors: preview.rows[1].errors,
    });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('47 questions imported');
    expect(f.nativeElement.textContent).toContain('3 rows skipped');
    expect(f.nativeElement.textContent).toContain('Row 7:');
    expect(f.componentInstance.file()).toBeNull();
    f.componentInstance.importFile();
    http.expectNone((r) => r.method === 'POST');
    expect(f.nativeElement.querySelector('a.button').getAttribute('href')).toBe(
      '/app/question-banks/7',
    );
  });
  it('never imports a zero-valid preview', () => {
    const f = page();
    choose(f.componentInstance);
    f.componentInstance.previewFile();
    http
      .expectOne('/api/question-banks/7/import/preview')
      .flush({ ...preview, validRows: 0, canImport: false });
    f.detectChanges();
    f.componentInstance.importFile();
    http.expectNone('/api/question-banks/7/import');
    expect(f.nativeElement.textContent).toContain('No questions are ready');
  });
  it('invalidates preview when replacing or removing a file', () => {
    const f = page();
    choose(f.componentInstance);
    f.componentInstance.previewFile();
    http.expectOne('/api/question-banks/7/import/preview').flush(preview);
    choose(f.componentInstance, new File(['next'], 'next.xlsx'));
    expect(f.componentInstance.preview()).toBeNull();
    f.componentInstance.importFile();
    http.expectNone('/api/question-banks/7/import');
    f.componentInstance.reset();
    expect(f.componentInstance.file()).toBeNull();
  });
  it('cancels an old preview on replacement and ignores file changes during import', () => {
    const f = page();
    const original = choose(f.componentInstance);
    f.componentInstance.previewFile();
    const request = http.expectOne('/api/question-banks/7/import/preview');
    choose(f.componentInstance);
    expect(request.cancelled).toBe(true);
    f.componentInstance.previewFile();
    http.expectOne('/api/question-banks/7/import/preview').flush(preview);
    const selected = f.componentInstance.file();
    f.componentInstance.importFile();
    choose(f.componentInstance, original);
    expect(f.componentInstance.file()).toBe(selected);
    http
      .expectOne('/api/question-banks/7/import')
      .flush({
        importedCount: 1,
        totalRows: 2,
        skippedCount: 1,
        errors: [],
        importedQuestionIds: [4],
      });
  });
  it('clears old route data and cancels in-flight preview when the bank changes', () => {
    const f = page();
    choose(f.componentInstance);
    f.componentInstance.previewFile();
    const request = http.expectOne('/api/question-banks/7/import/preview');
    params.next(convertToParamMap({ id: '8' }));
    expect(request.cancelled).toBe(true);
    expect(f.componentInstance.file()).toBeNull();
    http
      .expectOne('/api/question-banks/8')
      .flush({ questionBankId: 8, name: 'Next bank', ownerId: 'owner' });
  });
  it('renders row errors returned by zero-valid revalidation', () => {
    const f = page();
    choose(f.componentInstance);
    f.componentInstance.previewFile();
    http.expectOne('/api/question-banks/7/import/preview').flush(preview);
    f.componentInstance.importFile();
    http
      .expectOne('/api/question-banks/7/import')
      .flush(
        {
          detail: 'No valid question rows were found. Nothing was imported.',
          errors: preview.rows[1].errors,
        },
        { status: 400, statusText: 'Bad Request' },
      );
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Nothing was imported');
    expect(f.nativeElement.textContent).toContain('Row 7:');
    expect(f.componentInstance.preview()).toBeNull();
  });
  it('does not automatically retry ambiguous import failures', () => {
    const f = page();
    choose(f.componentInstance);
    f.componentInstance.previewFile();
    http.expectOne('/api/question-banks/7/import/preview').flush(preview);
    f.componentInstance.importFile();
    http
      .expectOne('/api/question-banks/7/import')
      .flush({ detail: 'SqlException secret' }, { status: 500, statusText: 'Server Error' });
    f.detectChanges();
    expect(f.nativeElement.textContent).not.toContain('SqlException');
    expect(f.nativeElement.textContent).toContain('duplicate questions');
    f.componentInstance.importFile();
    http.expectNone('/api/question-banks/7/import');
  });
  it('downloads a backend Blob and suppresses duplicate clicks', () => {
    const create = vi.fn(() => 'blob:test');
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const f = page();
    f.componentInstance.downloadTemplate();
    f.componentInstance.downloadTemplate();
    const request = http.expectOne('/api/question-banks/import-template');
    expect(request.request.responseType).toBe('blob');
    const blob = new Blob(['xlsx']);
    request.flush(blob);
    expect(create).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
  it('uses safe messages for API errors and never prints raw server details', () => {
    for (const status of [400, 401, 403, 404, 409, 413, 500]) {
      const e = new HttpErrorResponse({
        status,
        error: { detail: 'System.Exception at internal/file' },
      });
      expect(importError(e)).not.toContain('Exception');
      expect(importError(e).length).toBeGreaterThan(0);
    }
    expect(
      importError(
        new HttpErrorResponse({
          status: 400,
          error: { detail: 'The workbook must contain a Questions worksheet.' },
        }),
      ),
    ).toContain('Questions worksheet');
    expect(
      importRowErrors(
        new HttpErrorResponse({ status: 400, error: { errors: ['wrong', { message: 'bad' }] } }),
      ),
    ).toEqual([]);
  });
});
