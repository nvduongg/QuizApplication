import { Component, computed, input, signal } from '@angular/core';
import { QuestionImportRow } from './import.models';
import { questionTypeLabel } from './content.models';
@Component({
  selector: 'app-import-preview',
  styleUrl: './import.scss',
  template: `<div class="preview-filter">
      <label for="row-filter">Show rows</label>
      <select id="row-filter" [value]="filter()" (change)="setFilter($event)">
        <option value="all">All</option>
        <option value="ready">Ready</option>
        <option value="invalid">Needs attention</option>
      </select>
    </div>
    @if (!visibleRows().length) {
      <p class="state">No rows match this filter.</p>
    } @else {
      <div class="preview-scroll" role="region" aria-label="Question import rows" tabindex="0">
        <table>
          <caption class="sr-only">
            Excel rows and validation results
          </caption>
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Question</th>
              <th scope="col">Type</th>
              <th scope="col">Answers</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            @for (row of visibleRows(); track row.rowNumber) {
              <tr>
                <th scope="row">{{ row.rowNumber }}</th>
                <td class="question-cell">
                  <span>{{ row.question || 'Question is empty' }}</span>
                  @if (row.errors.length) {
                    <ul
                      class="row-errors"
                      [attr.aria-label]="'Errors in Excel row ' + row.rowNumber"
                    >
                      @for (error of row.errors; track $index) {
                        <li>{{ error.message }}</li>
                      }
                    </ul>
                  }
                </td>
                <td>{{ typeLabel(row.type) }}</td>
                <td>
                  <details>
                    <summary [attr.aria-label]="'Review answers for Excel row ' + row.rowNumber">
                      {{ row.answers.length }} answers
                    </summary>
                    <ul class="answer-list">
                      @for (answer of row.answers; track answer.key) {
                        <li>
                          <strong>{{ answer.key }}.</strong> {{ answer.content }}
                        </li>
                      }
                    </ul>
                    <p>Correct: {{ row.correctAnswerKeys.join(', ') || 'Not provided' }}</p>
                  </details>
                </td>
                <td class="row-status">{{ row.isValid ? '✓ Ready' : 'Needs attention' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }`,
})
export class ImportPreview {
  rows = input.required<QuestionImportRow[]>();
  filter = signal('all');
  typeLabel = questionTypeLabel;
  visibleRows = computed(() =>
    this.rows().filter(
      (r) => this.filter() === 'all' || (this.filter() === 'ready' ? r.isValid : !r.isValid),
    ),
  );
  setFilter(event: Event) {
    if (event.target instanceof HTMLSelectElement) this.filter.set(event.target.value);
  }
}
