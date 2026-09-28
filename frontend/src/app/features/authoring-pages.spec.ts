import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { AuthService } from '../core/auth';
import { routes } from '../app.routes';
import { unsavedChangesGuard, UnsavedChanges } from '../shared/unsaved-changes';
import { AuthoringDetailsPage } from './authoring-details-page';
import { QuestionEditor } from './question-banks/question-editor';
import { QuestionCreator } from './question-banks/question-creator';
import { QuestionBank, Visibility } from './question-banks/content.models';

const bank: QuestionBank = {
  questionBankId: 7,
  name: 'Owned bank',
  description: null,
  visibility: Visibility.Private,
  ownerId: 'owner',
  ownerName: 'Owner',
  createdAt: '',
  questionCount: 0,
};
describe('Page authoring routing and return context', () => {
  let http: HttpTestingController;
  let snapshot: {
    data: Record<string, string>;
    paramMap: ReturnType<typeof convertToParamMap>;
    queryParamMap: ReturnType<typeof convertToParamMap>;
  };
  beforeEach(() => {
    snapshot = {
      data: { creation: 'quiz' },
      paramMap: convertToParamMap({ id: '5' }),
      queryParamMap: convertToParamMap({ bank: '7' }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot } },
        { provide: AuthService, useValue: { session: signal({ userId: 'owner' }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('routes both creation contexts through the existing QuestionEditor with unsaved guards', async () => {
    const children = routes.find((r) => r.path === '')!.children!;
    for (const path of [
      'app/quizzes/:id/questions/create',
      'app/question-banks/:id/questions/create',
    ]) {
      const route = children.find((r) => r.path === path)!;
      expect(route.canDeactivate).toContain(unsavedChangesGuard);
      expect(await route.loadComponent!()).toBe(QuestionEditor);
    }
  });
  it('renders the shared form as a page, resolves the real quiz title and returns after attachment', async () => {
    const f = TestBed.createComponent(QuestionEditor);
    f.detectChanges();
    http
      .expectOne('/api/quizzes/5')
      .flush({ quizId: 5, creatorId: 'owner', visibility: 1, title: 'Real quiz title' });
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('/api/question-banks/mine').flush([bank]);
    await f.whenStable();
    expect(f.nativeElement.querySelector('dialog')).toBeNull();
    expect(f.nativeElement.querySelector('h1').textContent).toContain('Create question');
    expect(f.nativeElement.querySelector('.page-back').textContent).toContain('Real quiz title');
    const child = f.debugElement.query(By.directive(QuestionCreator))
      .componentInstance as QuestionCreator;
    expect(child.form.controls.bankId.value).toBe(7);
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    f.componentInstance.createdForQuiz(22);
    expect(nav).toHaveBeenCalledWith(['/app/quizzes', 5, 'builder'], {
      queryParams: { added: 22 },
    });
  });
  it('tracks actual changes on the page and clears the warning after successful save', async () => {
    snapshot.data = { creation: 'bank' };
    snapshot.paramMap = convertToParamMap({ id: '7' });
    const f = TestBed.createComponent(QuestionEditor);
    f.detectChanges();
    http.expectOne('/api/question-banks/7').flush(bank);
    await Promise.resolve();
    await Promise.resolve();
    await f.whenStable();
    const changes = TestBed.inject(UnsavedChanges);
    expect(changes.hasChanges()).toBe(false);
    const field = f.nativeElement.querySelector('#create-content') as HTMLTextAreaElement;
    field.value = 'Changed';
    field.dispatchEvent(new Event('input'));
    await f.whenStable();
    expect(changes.hasChanges()).toBe(true);
    field.value = '';
    field.dispatchEvent(new Event('input'));
    await f.whenStable();
    expect(changes.hasChanges()).toBe(false);
    const child = f.debugElement.query(By.directive(QuestionCreator))
      .componentInstance as QuestionCreator;
    child.choose(0, { target: { checked: true } } as unknown as Event);
    expect(changes.hasChanges()).toBe(true);
    child.form.markAsPristine();
    expect(changes.hasChanges()).toBe(false);
  });
  it('returns from page bank creation to the explicit quiz context with the new bank selected', async () => {
    snapshot.data = { resource: 'bank' };
    snapshot.paramMap = convertToParamMap({});
    snapshot.queryParamMap = convertToParamMap({ quizId: '5' });
    const f = TestBed.createComponent(AuthoringDetailsPage);
    await f.whenStable();
    expect(f.nativeElement.querySelector('dialog')).toBeNull();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    f.componentInstance.bankSaved(bank);
    expect(nav).toHaveBeenCalledWith(['/app/quizzes', 5, 'questions', 'create'], {
      queryParams: { bank: 7 },
    });
    expect(router.serializeUrl(router.createUrlTree(f.componentInstance.backLink()))).toBe(
      '/app/quizzes/5/questions/create',
    );
  });
  it('ignores arbitrary return URLs and rejects foreign bank editing', async () => {
    snapshot.data = { resource: 'bank' };
    snapshot.paramMap = convertToParamMap({ id: '7' });
    snapshot.queryParamMap = convertToParamMap({
      quizId: 'nonsense',
      returnUrl: 'https://example.invalid',
    });
    const f = TestBed.createComponent(AuthoringDetailsPage);
    http.expectOne('/api/question-banks/7').flush({ ...bank, ownerId: 'foreign' });
    await f.whenStable();
    expect(f.nativeElement.querySelector('form')).toBeNull();
    expect(f.componentInstance.backLink()).toEqual(['/app/question-banks', 7]);
  });
});
