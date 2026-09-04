import { Component, computed, inject, input } from '@angular/core';
import { FavoritesService } from './favorites.service';

@Component({
  selector: 'app-favorite-button',
  template: `
    <button type="button" class="favorite-toggle" [class.active]="favorite()" [class.compact]="compact()"
      [attr.aria-pressed]="favorite()" [attr.aria-label]="actionLabel()" [title]="actionLabel()"
      (click)="favorites.toggle(testId(), questionId())">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>
      @if (!compact()) { <span>{{ favorite() ? 'Favorited' : 'Favorite' }}</span> }
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    .favorite-toggle { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 44px; min-height: 44px; padding: 9px 12px; border: 1px solid #d9ddd9; border-radius: 10px; background: white; color: #59655e; font-size: .875rem; font-weight: 650; }
    .favorite-toggle svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linejoin: round; }
    .favorite-toggle.active { color: #80520b; border-color: #e0c78e; background: #fff3d7; }
    .favorite-toggle.active svg { fill: #edc265; }
    .favorite-toggle:hover { border-color: #aa853c; }
    .favorite-toggle:focus-visible { outline: 2px solid #80520b; outline-offset: 3px; }
    .favorite-toggle.compact { padding: 9px; }
  `,
})
export class FavoriteButton {
  protected readonly favorites = inject(FavoritesService);
  readonly testId = input.required<string>();
  readonly questionId = input.required<string>();
  readonly label = input('question');
  readonly compact = input(false);
  protected readonly favorite = computed(() => this.favorites.has(this.testId(), this.questionId()));
  protected readonly actionLabel = computed(() => this.favorite() ? `Remove ${this.label()} from favorites` : `Add ${this.label()} to favorites`);
}
