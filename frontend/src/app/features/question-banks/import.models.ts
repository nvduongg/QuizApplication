export interface QuestionImportError {
  rowNumber: number;
  code: string;
  message: string;
}
export interface QuestionImportAnswer {
  key: string;
  content: string;
}
export interface QuestionImportRow {
  rowNumber: number;
  question: string;
  type: string;
  answers: QuestionImportAnswer[];
  correctAnswerKeys: string[];
  isValid: boolean;
  errors: QuestionImportError[];
}
export interface QuestionImportPreview {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  canImport: boolean;
  rows: QuestionImportRow[];
}
export interface QuestionImportResult {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  importedQuestionIds: number[];
  errors: QuestionImportError[];
}
// Backend QuestionImportWorkbook constants; only lightweight file checks belong in the client.
export const importFileLimit = 5 * 1024 * 1024;
export const importRowLimit = 500;
