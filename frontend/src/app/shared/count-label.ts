import { Pipe, PipeTransform } from '@angular/core';
@Pipe({ name: 'countLabel' })
export class CountLabel implements PipeTransform {
  transform(count: number, singular: string, plural = singular + 's'): string {
    return `${count} ${count === 1 ? singular : plural}`;
  }
}
