import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { API_URL, apiError } from '../../core/api';
import { QuestionImportError, QuestionImportPreview, QuestionImportResult } from './import.models';

@Injectable({ providedIn: 'root' })
export class QuestionImportService {
  private http = inject(HttpClient);
  private base = inject(API_URL) + '/question-banks';
  template() {
    return this.http.get(this.base + '/import-template', { responseType: 'blob' });
  }
  preview(bankId: number, file: File) {
    return this.http.post<QuestionImportPreview>(
      `${this.base}/${bankId}/import/preview`,
      this.form(file),
    );
  }
  import(bankId: number, file: File) {
    return this.http.post<QuestionImportResult>(`${this.base}/${bankId}/import`, this.form(file));
  }
  private form(file: File) {
    const form = new FormData();
    form.append('file', file);
    return form;
  }
}
const safeDetails = new Set([
  'Select a non-empty .xlsx file.',
  'Only .xlsx files are supported.',
  'The file must not exceed 5 MB.',
  'The workbook must contain a Questions worksheet.',
  'Use one worksheet named Questions.',
  'Header cells must not contain formulas.',
  'A file can contain at most 500 non-empty question rows.',
  'The file is not a readable .xlsx workbook. Save it as a new Excel workbook and try again.',
  'The workbook is too complex or expands beyond the 20 MB limit.',
  'The file is not an .xlsx workbook.',
  'Macro-enabled workbooks are not supported.',
  'The workbook contains too many cells. Use the import template with at most 500 questions.',
  'The file is corrupt or is not a supported .xlsx workbook.',
  'No valid question rows were found. Nothing was imported.',
]);
export function importError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 404)
      return 'This question bank is unavailable or you do not have permission to import into it.';
    if (error.status === 413)
      return 'The upload is too large. Select an Excel file no larger than 5 MB.';
    const body: unknown = error.error;
    if (
      error.status === 400 &&
      typeof body === 'object' &&
      body !== null &&
      'detail' in body &&
      typeof body.detail === 'string'
    ) {
      if (safeDetails.has(body.detail)) return body.detail;
      if (body.detail.startsWith('Missing required columns: '))
        return 'Required columns are missing. Use the Excel template and keep all its headers.';
      if (body.detail.startsWith('Duplicate required column: '))
        return 'A required column appears more than once. Keep one copy of each template header.';
    }
  }
  return apiError(error);
}
export function importRowErrors(error: unknown): QuestionImportError[] {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return [];
  const body: unknown = error.error;
  if (
    typeof body !== 'object' ||
    body === null ||
    !('errors' in body) ||
    !Array.isArray(body.errors)
  )
    return [];
  return body.errors.filter(
    (item: unknown): item is QuestionImportError =>
      typeof item === 'object' &&
      item !== null &&
      'rowNumber' in item &&
      typeof item.rowNumber === 'number' &&
      'code' in item &&
      typeof item.code === 'string' &&
      'message' in item &&
      typeof item.message === 'string',
  );
}
