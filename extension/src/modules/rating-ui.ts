/**
 * Star Rating UI module for the browser extension
 * Handles the 10-point rating system with half-star support
 */

import type { Ratings, RatingItem } from '../types';
import { DEFAULT_RATINGS } from '../types';
import { showToast, formatRelativeTime, escapeHtml } from '../utils';

// ============================================================================
// Types
// ============================================================================

export type RatingField = keyof Ratings;

// ============================================================================
// Rating UI Manager Class
// ============================================================================

export class RatingUIManager {
  private ratings: Ratings = { ...DEFAULT_RATINGS };
  private existingRatingId: string | null = null;
  private currentUserId: string | null = null;

  // ==================== Getters/Setters ====================

  setCurrentUserId(userId: string | null): void {
    this.currentUserId = userId;
  }
  getRatings(): Ratings {
    return { ...this.ratings };
  }

  setRatings(ratings: Partial<Ratings>): void {
    this.ratings = { ...this.ratings, ...ratings };
    this.updateStarDisplay();
  }

  getExistingRatingId(): string | null {
    return this.existingRatingId;
  }

  setExistingRatingId(id: string | null): void {
    this.existingRatingId = id;
  }

  /**
   * Reset ratings to default values
   */
  reset(): void {
    this.ratings = { ...DEFAULT_RATINGS };
    this.existingRatingId = null;
    this.updateStarDisplay();
  }

  /**
   * Reset form to initial state (ratings + submit button text)
   */
  resetForm(): void {
    this.reset();
    
    // Reset submit button text
    const submitBtn = document.getElementById('submitRatingBtn');
    if (submitBtn) submitBtn.innerHTML = '<span>提交评分</span>';
    
    // Reset anonymous checkbox
    const anonymousCheckbox = document.getElementById('ratingAnonymous') as HTMLInputElement;
    if (anonymousCheckbox) anonymousCheckbox.checked = false;
  }

  /**
   * Clear all displayed data (stats and ratings list)
   */
  clearDisplay(): void {
    this.reset();
    
    // Hide stats section
    const container = document.getElementById('existingRating');
    if (container) container.classList.add('hidden');
    
    // Clear ratings list
    this.setRatingsList([]);
    
    // Reset submit button text
    const submitBtn = document.getElementById('submitRatingBtn');
    if (submitBtn) submitBtn.innerHTML = '<span>提交评分</span>';
  }

  // ==================== Validation ====================

  /**
   * Validate that at least overall rating is set
   */
  validate(): boolean {
    if (this.ratings.overall === 0) {
      showToast('请至少设置总体评价', 'error');
      return false;
    }
    return true;
  }

  // ==================== Display Update ====================

  /**
   * Update star display for all rating fields
   * Uses 10-point system (5 stars with half-star support)
   */
  updateStarDisplay(): void {
    (Object.keys(this.ratings) as RatingField[]).forEach(field => {
      const container = document.querySelector(`.star-rating[data-field="${field}"]`);
      if (!container) return;

      const stars = container.querySelectorAll('.star');
      const scoreDisplay = container.querySelector('.score-display');
      const score = this.ratings[field];

      stars.forEach((star, index) => {
        const starIndex = index + 1;
        const starScore = starIndex * 2; // Each star represents 2 points

        star.classList.remove('half', 'full');
        if (score >= starScore) {
          star.classList.add('full');
        } else if (score >= starScore - 1) {
          star.classList.add('half');
        }
      });

      if (scoreDisplay) {
        scoreDisplay.textContent = score > 0 ? `${score} 分` : '未评分';
      }
    });
  }

  /**
   * Update stats display (average rating and count)
   */
  updateStatsDisplay(average: number, count: number): void {
    const container = document.getElementById('existingRating');
    const avgOverall = document.getElementById('avgOverall');
    const ratingCount = document.getElementById('ratingCount');

    if (count > 0) {
      container?.classList.remove('hidden');
      if (avgOverall) avgOverall.textContent = average.toFixed(1);
      if (ratingCount) ratingCount.textContent = count.toString();
    } else {
      container?.classList.add('hidden');
    }
  }

  // ==================== Event Listeners ====================

  /**
   * Setup star rating event listeners
   */
  setupEventListeners(): void {
    document.querySelectorAll('.star-rating').forEach(container => {
      const field = (container as HTMLElement).dataset.field as RatingField | undefined;
      if (!field) return;

      const stars = container.querySelectorAll('.star');
      const scoreDisplay = container.querySelector('.score-display');

      stars.forEach((star, index) => {
        const starIndex = index + 1;

        // Mouse move for preview (left half = odd, right half = even)
        star.addEventListener('mousemove', (e: Event) => {
          const mouseEvent = e as MouseEvent;
          const rect = (star as HTMLElement).getBoundingClientRect();
          const isLeftHalf = mouseEvent.clientX - rect.left < rect.width / 2;
          const previewScore = starIndex * 2 - (isLeftHalf ? 1 : 0);

          // Update visual preview
          stars.forEach((s, i) => {
            const sIndex = i + 1;
            const sScore = sIndex * 2;
            s.classList.remove('half', 'full');
            if (previewScore >= sScore) {
              s.classList.add('full');
            } else if (previewScore >= sScore - 1) {
              s.classList.add('half');
            }
          });

          if (scoreDisplay) {
            scoreDisplay.textContent = `${previewScore} 分`;
          }
        });

        star.addEventListener('mouseleave', () => {
          // Restore actual rating display
          this.updateStarDisplay();
        });

        star.addEventListener('click', (e: Event) => {
          const mouseEvent = e as MouseEvent;
          const rect = (star as HTMLElement).getBoundingClientRect();
          const isLeftHalf = mouseEvent.clientX - rect.left < rect.width / 2;
          const newScore = starIndex * 2 - (isLeftHalf ? 1 : 0);
          this.ratings[field] = newScore;
          this.updateStarDisplay();
        });
      });
    });
  }

  // ==================== Rating List ====================

  private allRatings: RatingItem[] = [];
  private isListExpanded: boolean = false;

  /**
   * Set ratings list data
   */
  setRatingsList(ratings: RatingItem[]): void {
    this.allRatings = ratings;
    this.updateRatingsListUI();
  }

  /**
   * Update ratings list UI
   */
  private updateRatingsListUI(): void {
    const toggleBtn = document.getElementById('toggleRatingsListBtn');
    const listContainer = document.getElementById('ratingsListContainer');
    
    // Only show toggle button if there are ratings
    if (toggleBtn) {
      toggleBtn.style.display = this.allRatings.length > 0 ? 'block' : 'none';
      toggleBtn.textContent = this.isListExpanded 
        ? '收起评分列表 ▲' 
        : `查看全部评分 (${this.allRatings.length}) ▼`;
    }

    if (listContainer) {
      listContainer.style.display = this.isListExpanded ? 'block' : 'none';
      if (this.isListExpanded) {
        listContainer.innerHTML = this.renderRatingsList();
      }
    }
  }

  /**
   * Toggle ratings list visibility
   */
  toggleRatingsList(): void {
    this.isListExpanded = !this.isListExpanded;
    this.updateRatingsListUI();
  }

  /**
   * Render ratings list HTML
   */
  private renderRatingsList(): string {
    if (this.allRatings.length === 0) {
      return '<div class="ratings-list-empty">暂无评分</div>';
    }

    const dimensions = [
      { key: 'dimension1', label: '质量' },
      { key: 'dimension2', label: '实用' },
      { key: 'dimension3', label: '准确' },
    ];

    return this.allRatings.map(rating => {
      const isAnonymousDisplay = rating.isAnonymous || rating.showUsername === false;
      const isOwnRating = rating.user?.id === this.currentUserId;
      
      const username = isAnonymousDisplay ? '匿名用户' : (rating.user?.username || '用户');
      
      // Show "(你)" badge for user's own anonymous ratings
      const ownAnonymousBadge = (isAnonymousDisplay && isOwnRating)
        ? '<span class="own-anonymous-badge">(你)</span>'
        : '';
      
      const timeStr = formatRelativeTime(rating.createdAt);
      
      const dimensionScores = dimensions.map(dim => {
        const score = rating[dim.key as keyof RatingItem] as number | null;
        return score !== null && score !== undefined 
          ? `<span class="dim-score">${dim.label}: ${score}</span>` 
          : '';
      }).filter(Boolean).join(' ');

      return `
        <div class="rating-list-item">
          <div class="rating-list-header">
            <span class="rating-list-user">${escapeHtml(username)}${ownAnonymousBadge}</span>
            <span class="rating-list-time">${timeStr}</span>
          </div>
          <div class="rating-list-scores">
            <span class="overall-score">总评: ${rating.overallScore}</span>
            ${dimensionScores}
          </div>
        </div>
      `;
    }).join('');
  }
}