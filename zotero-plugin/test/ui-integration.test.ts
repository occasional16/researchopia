/**
 * UI Integration Tests for Researchopia
 * Tests the Item Pane integration and UI functionality
 */

import { expect } from "chai";
import { UIManager } from "../src/modules/ui-enhanced";
import { AuthManager } from "../src/modules/auth";

describe("UI Integration Tests", () => {
  let mockContainer: HTMLElement;
  let mockDocument: Document;

  beforeEach(() => {
    // Create mock DOM environment
    mockDocument = new DOMParser().parseFromString(`
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div id="test-container"></div>
        </body>
      </html>
    `, 'text/html');
    
    mockContainer = mockDocument.getElementById('test-container')!;
  });

  describe("Item Pane Registration", () => {
    it("should register item pane section without errors", () => {
      // Mock Zotero ItemPaneManager
      const mockZotero = {
        ItemPaneManager: {
          registerSection: (config: any) => {
            expect(config.paneID).to.equal("researchopia-annotations");
            expect(config.pluginID).to.be.a("string");
            expect(config.header.l10nID).to.equal("researchopia-section-header");
            expect(config.sidenav.l10nID).to.equal("researchopia-section-sidenav");
            expect(config.onRender).to.be.a("function");
            return "test-section-id";
          }
        }
      };

      // Mock global Zotero
      (global as any).Zotero = mockZotero;
      (global as any).addon = {
        data: {
          config: {
            addonID: "researchopia@zotero.plugin"
          }
        }
      };

      expect(() => UIManager.registerItemPaneSection()).to.not.throw();
    });
  });

  describe("Style Injection", () => {
    it("should inject styles without errors", () => {
      UIManager.injectItemPaneStyles(mockContainer);
      
      const styleElement = mockDocument.querySelector('#researchopia-item-pane-styles');
      expect(styleElement).to.not.be.null;
      expect(styleElement?.textContent).to.include('.researchopia-container');
    });

    it("should not inject styles twice", () => {
      UIManager.injectItemPaneStyles(mockContainer);
      UIManager.injectItemPaneStyles(mockContainer);
      
      const styleElements = mockDocument.querySelectorAll('#researchopia-item-pane-styles');
      expect(styleElements.length).to.equal(1);
    });
  });

  describe("Localization", () => {
    it("should apply localization to elements", () => {
      mockContainer.innerHTML = `
        <div data-l10n-id="test-key">Default Text</div>
        <input type="text" data-l10n-id="placeholder-key" placeholder="Default Placeholder" />
      `;

      // Mock Zotero.getString
      (global as any).Zotero = {
        getString: (key: string) => {
          if (key === "researchopia.test-key") return "Localized Text";
          if (key === "researchopia.placeholder-key") return "Localized Placeholder";
          return key;
        }
      };

      UIManager.applyLocalization(mockContainer);

      const textElement = mockContainer.querySelector('[data-l10n-id="test-key"]');
      const inputElement = mockContainer.querySelector('[data-l10n-id="placeholder-key"]') as HTMLInputElement;
      
      expect(textElement?.textContent).to.equal("Localized Text");
      expect(inputElement?.placeholder).to.equal("Localized Placeholder");
    });
  });

  describe("Button Loading States", () => {
    it("should set button loading state correctly", () => {
      const button = mockDocument.createElement('button');
      button.textContent = "Original Text";
      mockContainer.appendChild(button);

      UIManager.setButtonLoading(button, true);
      
      expect(button.hasAttribute('disabled')).to.be.true;
      expect(button.classList.contains('loading')).to.be.true;
      expect(button.getAttribute('data-original-text')).to.equal("Original Text");
    });

    it("should restore button from loading state", () => {
      const button = mockDocument.createElement('button');
      button.textContent = "Original Text";
      mockContainer.appendChild(button);

      UIManager.setButtonLoading(button, true);
      UIManager.setButtonLoading(button, false);
      
      expect(button.hasAttribute('disabled')).to.be.false;
      expect(button.classList.contains('loading')).to.be.false;
      expect(button.textContent).to.equal("Original Text");
    });
  });

  describe("Notification System", () => {
    it("should show notifications without errors", () => {
      // Mock ztoolkit
      (global as any).ztoolkit = {
        ProgressWindow: class {
          constructor(title: string, options?: any) {}
          createLine(config: any) {
            expect(config.text).to.be.a("string");
            expect(config.type).to.be.oneOf(["success", "fail", "default"]);
            return this;
          }
          show() { return this; }
          startCloseTimer(duration: number) { return this; }
        }
      };

      expect(() => UIManager.showNotification("Test message", "success")).to.not.throw();
      expect(() => UIManager.showNotification("Error message", "error")).to.not.throw();
      expect(() => UIManager.showNotification("Info message", "info")).to.not.throw();
    });
  });

  describe("Annotation Rendering", () => {
    it("should render annotation item correctly", () => {
      const mockAnnotation = {
        id: "test-annotation-1",
        user_name: "Test User",
        user_id: "user-123",
        annotation_text: "This is a test annotation",
        annotation_comment: "This is a test comment",
        annotation_color: "#ffff00",
        created_at: new Date().toISOString(),
        page_number: 5,
        quality_score: 85,
        likes_count: 3,
        comments_count: 1,
        is_liked: false,
        is_following_author: false
      };

      // Mock AuthManager
      (global as any).AuthManager = {
        getCurrentUser: () => ({ id: "current-user" }),
        isLoggedIn: () => true
      };

      const html = UIManager.renderAnnotationItem(mockAnnotation as any);
      
      expect(html).to.include('data-id="test-annotation-1"');
      expect(html).to.include("Test User");
      expect(html).to.include("This is a test annotation");
      expect(html).to.include("This is a test comment");
      expect(html).to.include("Page 5");
      expect(html).to.include("85");
    });
  });

  describe("Time Formatting", () => {
    it("should format time correctly", () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const oneDayAgo = new Date(now.getTime() - 86400000);

      expect(UIManager.getTimeAgo(now)).to.equal("just now");
      expect(UIManager.getTimeAgo(oneMinuteAgo)).to.equal("1m ago");
      expect(UIManager.getTimeAgo(oneHourAgo)).to.equal("1h ago");
      expect(UIManager.getTimeAgo(oneDayAgo)).to.equal("1d ago");
    });
  });

  describe("HTML Escaping", () => {
    it("should escape HTML correctly", () => {
      const dangerousText = '<script>alert("xss")</script>';
      const escaped = UIManager.escapeHtml(dangerousText);
      
      expect(escaped).to.not.include('<script>');
      expect(escaped).to.include('&lt;script&gt;');
    });
  });

  describe("Filter Management", () => {
    it("should get active filters correctly", () => {
      mockContainer.innerHTML = `
        <div>
          <input type="checkbox" id="filter-has-comments" checked />
          <input type="checkbox" id="filter-has-likes" />
          <input type="checkbox" id="filter-following" checked />
        </div>
      `;

      const filters = UIManager.getActiveFilters(mockContainer);
      
      expect(filters.hasComments).to.be.true;
      expect(filters.hasLikes).to.be.undefined;
      expect(filters.followingOnly).to.be.true;
    });
  });

  describe("Annotation Sorting", () => {
    it("should sort annotations by quality", () => {
      const annotations = [
        { quality_score: 50, created_at: "2023-01-01" },
        { quality_score: 90, created_at: "2023-01-02" },
        { quality_score: 70, created_at: "2023-01-03" }
      ];

      const sorted = UIManager.sortAnnotations(annotations as any, "quality");
      
      expect(sorted[0].quality_score).to.equal(90);
      expect(sorted[1].quality_score).to.equal(70);
      expect(sorted[2].quality_score).to.equal(50);
    });

    it("should sort annotations by recency", () => {
      const annotations = [
        { quality_score: 50, created_at: "2023-01-01T00:00:00Z" },
        { quality_score: 90, created_at: "2023-01-03T00:00:00Z" },
        { quality_score: 70, created_at: "2023-01-02T00:00:00Z" }
      ];

      const sorted = UIManager.sortAnnotations(annotations as any, "recent");
      
      expect(sorted[0].created_at).to.equal("2023-01-03T00:00:00Z");
      expect(sorted[1].created_at).to.equal("2023-01-02T00:00:00Z");
      expect(sorted[2].created_at).to.equal("2023-01-01T00:00:00Z");
    });
  });
});
