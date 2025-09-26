import { AnnotationManager, SharedAnnotation } from "./annotations";
import { AuthManager } from "./auth";

export class UIManager {
  static initialize() {
    ztoolkit.log("UIManager initialized");
  }

  static registerItemPaneSection() {
    try {
      ztoolkit.log("Registering Item Pane section...");

      // Check if ItemPaneManager is available
      // @ts-expect-error - ItemPaneManager exists in Zotero 8
      if (!Zotero.ItemPaneManager) {
        ztoolkit.log("ItemPaneManager not available, skipping registration");
        return;
      }

      // Register custom section in item pane using official Zotero API
      // @ts-expect-error - ItemPaneManager exists in Zotero 8
      const registeredID = Zotero.ItemPaneManager.registerSection({
        paneID: "researchopia-annotations",
        pluginID: addon.data.config.addonID,
        header: {
          l10nID: "researchopia-section-header",
          icon: "chrome://zotero/skin/16/universal/book.svg",
        },
        sidenav: {
          l10nID: "researchopia-section-sidenav",
          icon: "chrome://zotero/skin/16/universal/book.svg",
        },
        onRender: ({ body, item }) => {
          try {
            if (!item || !item.isRegularItem()) {
              body.innerHTML = `
                <div class="researchopia-container">
                  <div class="researchopia-message">
                    <h3>Shared Annotations</h3>
                    <p>Please select a research item to view shared annotations.</p>
                  </div>
                </div>
              `;
              return;
            }

            const doi = item.getField("DOI");
            if (!doi) {
              body.innerHTML = `
                <div class="researchopia-container">
                  <div class="researchopia-message">
                    <h3>Shared Annotations</h3>
                    <p>This item has no DOI. Shared annotations are only available for items with DOI numbers.</p>
                    <p><small>DOI (Digital Object Identifier) is required to match annotations across users.</small></p>
                  </div>
                </div>
              `;
              return;
            }

            UIManager.renderAnnotationsSection(body, doi, item.id);
          } catch (error) {
            ztoolkit.log("Error in onRender:", error);
            body.innerHTML = `
              <div class="researchopia-container">
                <div class="researchopia-error">
                  <h3>Shared Annotations</h3>
                  <p>Error loading annotations. Please try again later.</p>
                </div>
              </div>
            `;
          }
        },
      });

      ztoolkit.log("Item Pane section registered with ID:", registeredID);
    } catch (error) {
      ztoolkit.log("Error registering Item Pane section:", error);
    }
  }

  static async renderAnnotationsSection(container: HTMLElement, doi: string, itemId: number) {
    container.innerHTML = `
      <div id="researchopia-container">
        <div class="researchopia-header">
          <h3>Shared Annotations</h3>
          <div class="header-controls">
            ${AuthManager.isLoggedIn() ?
              `<button id="upload-annotations-btn" class="researchopia-btn">
                <span class="btn-icon">📤</span>
                <span class="btn-text">Share My Annotations</span>
              </button>` :
              `<div class="login-prompt">
                <span>🔒 Please log in to share annotations</span>
                <button id="open-prefs-btn" class="researchopia-btn secondary">Login</button>
              </div>`
            }
          </div>
        </div>

        <div class="annotations-controls">
          <div class="search-box">
            <input type="text" id="search-annotations" placeholder="Search annotations..." />
            <button id="search-btn" class="search-btn">🔍</button>
          </div>
          <div class="filter-controls">
            <select id="sort-select">
              <option value="quality">Best Quality</option>
              <option value="recent">Most Recent</option>
              <option value="likes">Most Liked</option>
              <option value="comments">Most Discussed</option>
            </select>
            <button id="filter-btn" class="filter-btn" title="Filters">⚙️</button>
          </div>
        </div>

        <div id="filter-panel" class="filter-panel" style="display: none;">
          <div class="filter-options">
            <label><input type="checkbox" id="filter-has-comments"> Has Comments</label>
            <label><input type="checkbox" id="filter-has-likes"> Has Likes</label>
            <label><input type="checkbox" id="filter-following"> From Followed Users</label>
          </div>
        </div>

        <div class="annotations-stats" id="annotations-stats"></div>
        <div id="annotations-list">Loading...</div>
      </div>
    `;

    this.bindEventListeners(container, doi, itemId);
    this.loadAndDisplayAnnotations(container.querySelector("#annotations-list")!, doi);
  }

  static bindEventListeners(container: HTMLElement, doi: string, itemId: number) {
    // Upload button
    const uploadBtn = container.querySelector("#upload-annotations-btn");
    uploadBtn?.addEventListener("click", async () => {
      this.setButtonLoading(uploadBtn as HTMLElement, true);
      try {
        const success = await AnnotationManager.uploadAnnotations(itemId);
        if (success) {
          this.showNotification("Annotations uploaded successfully!", "success");
          this.loadAndDisplayAnnotations(container.querySelector("#annotations-list")!, doi);
        } else {
          this.showNotification("Failed to upload annotations", "error");
        }
      } finally {
        this.setButtonLoading(uploadBtn as HTMLElement, false);
      }
    });

    // Login button
    const openPrefsBtn = container.querySelector("#open-prefs-btn");
    openPrefsBtn?.addEventListener("click", () => {
      // Open Zotero preferences
      // @ts-expect-error - openPreferences exists in Zotero 8
      Zotero.Prefs.openPreferences("researchopia");
    });

    // Search functionality
    const searchInput = container.querySelector("#search-annotations") as HTMLInputElement;
    const searchBtn = container.querySelector("#search-btn");

    const performSearch = () => {
      const searchText = searchInput.value.trim();
      this.loadAndDisplayAnnotations(
        container.querySelector("#annotations-list")!,
        doi,
        { searchText: searchText || undefined }
      );
    };

    searchBtn?.addEventListener("click", performSearch);
    searchInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") performSearch();
    });

    // Sort functionality
    const sortSelect = container.querySelector("#sort-select") as HTMLSelectElement;
    sortSelect?.addEventListener("change", () => {
      this.loadAndDisplayAnnotations(
        container.querySelector("#annotations-list")!,
        doi,
        { sortBy: sortSelect.value }
      );
    });

    // Filter panel toggle
    const filterBtn = container.querySelector("#filter-btn");
    const filterPanel = container.querySelector("#filter-panel") as HTMLElement;
    filterBtn?.addEventListener("click", () => {
      const isVisible = filterPanel?.style.display !== "none";
      if (filterPanel) {
        filterPanel.style.display = isVisible ? "none" : "block";
      }
    });

    // Filter checkboxes
    const filterCheckboxes = container.querySelectorAll(".filter-options input[type='checkbox']");
    filterCheckboxes.forEach(checkbox => {
      checkbox.addEventListener("change", () => {
        const filters = this.getActiveFilters(container);
        this.loadAndDisplayAnnotations(
          container.querySelector("#annotations-list")!,
          doi,
          { filters }
        );
      });
    });
  }

  static async loadAndDisplayAnnotations(
    container: HTMLElement,
    doi: string,
    options?: {
      searchText?: string;
      sortBy?: string;
      filters?: any;
    }
  ) {
    try {
      container.innerHTML = "<div class='loading'>Loading annotations...</div>";

      let annotations = await AnnotationManager.fetchSharedAnnotations(doi);

      // Apply search and filters
      if (options?.searchText || options?.filters) {
        annotations = await AnnotationManager.searchAnnotations(doi, options.searchText, options.filters);
      }

      // Update stats
      this.updateAnnotationsStats(container.parentElement!, annotations.length, doi);

      if (annotations.length === 0) {
        container.innerHTML = `
          <div class='no-annotations'>
            <div class="no-annotations-icon">📝</div>
            <div class="no-annotations-text">
              ${options?.searchText ? 'No annotations match your search.' : 'No shared annotations found for this paper.'}
            </div>
            ${!options?.searchText && AuthManager.isLoggedIn() ?
              '<div class="no-annotations-hint">Be the first to share your annotations!</div>' : ''
            }
          </div>
        `;
        return;
      }

      // Apply sorting
      if (options?.sortBy) {
        annotations = this.sortAnnotations(annotations, options.sortBy);
      }

      const annotationsHTML = annotations.map(annotation => this.renderAnnotationItem(annotation)).join('');
      container.innerHTML = annotationsHTML;

      // Add event listeners for actions
      this.addAnnotationEventListeners(container);
    } catch (error) {
      container.innerHTML = "<div class='error'>Error loading annotations. Please try again.</div>";
      ztoolkit.log("Error loading annotations:", error);
    }
  }

  static renderAnnotationItem(annotation: SharedAnnotation): string {
    const timeAgo = this.getTimeAgo(new Date(annotation.created_at));
    const qualityBadge = annotation.quality_score > 20 ? '<span class="quality-badge">⭐</span>' : '';

    return `
      <div class="annotation-item ${annotation.is_following_author ? 'following-author' : ''}" data-id="${annotation.id}">
        <div class="annotation-header">
          <div class="author-info">
            <span class="author" data-user-id="${annotation.user_id}">
              ${annotation.user_name}
              ${qualityBadge}
              ${annotation.is_following_author ? '<span class="following-indicator">👤</span>' : ''}
            </span>
            <span class="date" title="${new Date(annotation.created_at).toLocaleString()}">${timeAgo}</span>
          </div>
          <div class="annotation-meta">
            ${annotation.page_number ? `<span class="page-info">Page ${annotation.page_number}</span>` : ''}
            <span class="quality-score" title="Quality Score">${annotation.quality_score}</span>
          </div>
        </div>

        <div class="annotation-content">
          ${annotation.annotation_text ? `
            <div class="annotation-text" style="border-left-color: ${annotation.annotation_color}">
              "${this.escapeHtml(annotation.annotation_text)}"
            </div>
          ` : ''}
          ${annotation.annotation_comment ? `
            <div class="annotation-comment">
              ${this.escapeHtml(annotation.annotation_comment)}
            </div>
          ` : ''}
        </div>

        <div class="annotation-actions">
          <button class="like-btn ${annotation.is_liked ? 'liked' : ''}" data-id="${annotation.id}" title="Like this annotation">
            ${annotation.is_liked ? '❤️' : '👍'} ${annotation.likes_count}
          </button>
          <button class="comment-btn" data-id="${annotation.id}" title="View comments">
            💬 ${annotation.comments_count}
          </button>
          <button class="follow-btn ${annotation.is_following_author ? 'following' : ''}"
                  data-user-id="${annotation.user_id}"
                  title="${annotation.is_following_author ? 'Unfollow user' : 'Follow user'}"
                  ${AuthManager.getCurrentUser()?.id === annotation.user_id ? 'style="display:none"' : ''}>
            ${annotation.is_following_author ? '👤✓' : '👤+'}
          </button>
          <button class="share-btn" data-id="${annotation.id}" title="Share annotation">
            🔗
          </button>
        </div>
      </div>
    `;
  }

  static addAnnotationEventListeners(container: HTMLElement) {
    // Like buttons
    container.querySelectorAll(".like-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const annotationId = target.dataset.id;

        if (!annotationId) return;

        if (!AuthManager.isLoggedIn()) {
          this.showNotification("Please log in to like annotations", "error");
          return;
        }

        const isLiked = target.classList.contains("liked");
        const success = isLiked ?
          await AnnotationManager.unlikeAnnotation(annotationId) :
          await AnnotationManager.likeAnnotation(annotationId);

        if (success) {
          // Optimistic update
          target.classList.toggle("liked");
          const countSpan = target.textContent?.match(/\d+/);
          if (countSpan) {
            const currentCount = parseInt(countSpan[0]);
            const newCount = isLiked ? currentCount - 1 : currentCount + 1;
            target.innerHTML = `${isLiked ? '👍' : '❤️'} ${newCount}`;
          }
        } else {
          this.showNotification("Failed to update like", "error");
        }
      });
    });

    // Comment buttons
    container.querySelectorAll(".comment-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const annotationId = (e.target as HTMLElement).dataset.id;
        if (annotationId) {
          await this.showCommentsDialog(annotationId);
        }
      });
    });

    // Follow buttons
    container.querySelectorAll(".follow-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const userId = target.dataset.userId;

        if (!userId) return;

        if (!AuthManager.isLoggedIn()) {
          this.showNotification("Please log in to follow users", "error");
          return;
        }

        const isFollowing = target.classList.contains("following");
        const success = isFollowing ?
          await AnnotationManager.unfollowUser(userId) :
          await AnnotationManager.followUser(userId);

        if (success) {
          target.classList.toggle("following");
          target.innerHTML = isFollowing ? '👤+' : '👤✓';
          target.title = isFollowing ? 'Follow user' : 'Unfollow user';
          this.showNotification(
            isFollowing ? "Unfollowed user" : "Following user",
            "success"
          );
        } else {
          this.showNotification("Failed to update follow status", "error");
        }
      });
    });

    // Share buttons
    container.querySelectorAll(".share-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const annotationId = (e.target as HTMLElement).dataset.id;
        if (annotationId) {
          this.shareAnnotation(annotationId);
        }
      });
    });

    // Author name clicks (show user profile)
    container.querySelectorAll(".author").forEach(author => {
      author.addEventListener("click", (e) => {
        const userId = (e.target as HTMLElement).dataset.userId;
        if (userId) {
          this.showUserProfile(userId);
        }
      });
    });
  }

  static async showCommentsDialog(annotationId: string) {
    try {
      const comments = await AnnotationManager.getAnnotationComments(annotationId);

      let dialogContent = `
        <div class="comments-dialog">
          <h3>Comments</h3>
          <div class="comments-list">
      `;

      if (comments.length === 0) {
        dialogContent += '<div class="no-comments">No comments yet. Be the first to comment!</div>';
      } else {
        comments.forEach(comment => {
          dialogContent += `
            <div class="comment-item">
              <div class="comment-header">
                <span class="comment-author">${comment.user_name}</span>
                <span class="comment-date">${this.getTimeAgo(new Date(comment.created_at))}</span>
              </div>
              <div class="comment-text">${this.escapeHtml(comment.comment_text)}</div>
            </div>
          `;
        });
      }

      if (AuthManager.isLoggedIn()) {
        dialogContent += `
          <div class="add-comment">
            <textarea id="new-comment" placeholder="Add a comment..." rows="3"></textarea>
            <button id="submit-comment" class="researchopia-btn primary">Post Comment</button>
          </div>
        `;
      } else {
        dialogContent += '<div class="login-required">Please log in to add comments.</div>';
      }

      dialogContent += '</div></div>';

      // Create and show dialog
      const dialog = this.createDialog("Comments", dialogContent);

      if (AuthManager.isLoggedIn()) {
        const submitBtn = dialog.querySelector("#submit-comment");
        const textarea = dialog.querySelector("#new-comment") as HTMLTextAreaElement;

        submitBtn?.addEventListener("click", async () => {
          const commentText = textarea.value.trim();
          if (commentText) {
            const success = await AnnotationManager.addComment(annotationId, commentText);
            if (success) {
              this.showNotification("Comment added!", "success");
              dialog.remove();
              // Refresh comments
              this.showCommentsDialog(annotationId);
            } else {
              this.showNotification("Failed to add comment", "error");
            }
          }
        });
      }
    } catch (error) {
      this.showNotification("Failed to load comments", "error");
    }
  }

  static shareAnnotation(annotationId: string) {
    try {
      const link = `https://researchopia.com/annotation/${annotationId}`;
      navigator.clipboard.writeText(link);
      this.showNotification("Annotation link copied to clipboard!", "success");
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = `https://researchopia.com/annotation/${annotationId}`;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showNotification("Annotation link copied to clipboard!", "success");
    }
  }

  static showUserProfile(userId: string) {
    // TODO: Implement user profile dialog
    ztoolkit.log("Showing user profile for:", userId);
    this.showNotification("User profile feature coming soon!", "info");
  }

  // Utility methods
  static getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static setButtonLoading(button: HTMLElement, loading: boolean) {
    if (loading) {
      button.setAttribute('disabled', 'true');
      button.style.opacity = '0.6';
      button.style.cursor = 'not-allowed';
    } else {
      button.removeAttribute('disabled');
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }
  }

  static showNotification(message: string, type: "success" | "error" | "info") {
    // @ts-expect-error - ProgressWindow exists on ztoolkit
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: message,
        type: type === "error" ? "fail" : type === "success" ? "success" : "default",
        progress: 100,
      })
      .show();
  }

  static sortAnnotations(annotations: SharedAnnotation[], sortBy: string): SharedAnnotation[] {
    switch (sortBy) {
      case "recent":
        return annotations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "likes":
        return annotations.sort((a, b) => b.likes_count - a.likes_count);
      case "comments":
        return annotations.sort((a, b) => b.comments_count - a.comments_count);
      case "quality":
      default:
        return annotations.sort((a, b) => b.quality_score - a.quality_score);
    }
  }

  static getActiveFilters(container: HTMLElement) {
    const hasComments = (container.querySelector("#filter-has-comments") as HTMLInputElement)?.checked;
    const hasLikes = (container.querySelector("#filter-has-likes") as HTMLInputElement)?.checked;
    const followingOnly = (container.querySelector("#filter-following") as HTMLInputElement)?.checked;

    return {
      hasComments: hasComments || undefined,
      hasLikes: hasLikes || undefined,
      followingOnly: followingOnly || undefined,
    };
  }

  static updateAnnotationsStats(container: HTMLElement, count: number, doi: string) {
    const statsElement = container.querySelector("#annotations-stats");
    if (statsElement) {
      statsElement.innerHTML = `
        <div class="stats-info">
          <span class="stats-count">${count} annotation${count !== 1 ? 's' : ''}</span>
          <span class="stats-doi" title="DOI: ${doi}">📄 ${doi.substring(0, 30)}${doi.length > 30 ? '...' : ''}</span>
        </div>
      `;
    }
  }

  static createDialog(title: string, content: string): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'researchopia-dialog-overlay';
    dialog.innerHTML = `
      <div class="researchopia-dialog">
        <div class="dialog-header">
          <h3>${title}</h3>
          <button class="dialog-close">×</button>
        </div>
        <div class="dialog-content">
          ${content}
        </div>
      </div>
    `;

    // Add close functionality
    const closeBtn = dialog.querySelector('.dialog-close');
    const overlay = dialog;

    closeBtn?.addEventListener('click', () => dialog.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) dialog.remove();
    });

    document.body.appendChild(dialog);
    return dialog;
  }

  static registerReaderUI() {
    // Import and initialize reader UI manager
    import("./readerUI").then(({ ReaderUIManager }) => {
      ReaderUIManager.initialize();
    }).catch(error => {
      ztoolkit.log("Error loading ReaderUIManager:", error);
    });
  }

  static handleItemSelection(ids: Array<string | number>) {
    // Handle item selection changes
    ztoolkit.log("Item selection changed:", ids);
  }
}
