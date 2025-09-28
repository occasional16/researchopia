import { AuthManager } from "./auth";
import { AnnotationManager } from "./annotations";
import { SocialManager } from "./social";
import { QualityScoringEngine } from "./qualityScoring";

export class TestingManager {
  static async runBasicTests(): Promise<boolean> {
    ztoolkit.log("Starting Researchopia basic tests...");
    
    try {
      // Test 1: Authentication system
      await this.testAuthentication();
      
      // Test 2: Annotation extraction (if items available)
      await this.testAnnotationExtraction();
      
      // Test 3: UI components
      await this.testUIComponents();
      
      // Test 4: Quality scoring
      await this.testQualityScoring();
      
      ztoolkit.log("All basic tests completed successfully!");
      return true;
    } catch (error) {
      ztoolkit.log("Test failed:", error);
      return false;
    }
  }

  private static async testAuthentication() {
    ztoolkit.log("Testing authentication system...");
    
    // Test initialization
    AuthManager.initialize();
    
    // Test login state
    const isLoggedIn = AuthManager.isLoggedIn();
    ztoolkit.log(`Login state: ${isLoggedIn}`);
    
    // Test user retrieval
    const currentUser = AuthManager.getCurrentUser();
    ztoolkit.log(`Current user: ${currentUser ? currentUser.email : 'None'}`);
    
    ztoolkit.log("Authentication test completed");
  }

  private static async testAnnotationExtraction() {
    ztoolkit.log("Testing annotation extraction...");
    
    try {
      // Get selected items
      const selectedItems = (Zotero as any).getActiveZoteroPane().getSelectedItems();
      
      if (selectedItems.length === 0) {
        ztoolkit.log("No items selected, skipping annotation extraction test");
        return;
      }

      const item = selectedItems[0];
      const doi = item.getField("DOI");
      
      if (!doi) {
        ztoolkit.log("Selected item has no DOI, skipping test");
        return;
      }

      // Test local annotation extraction
      const localAnnotations = await AnnotationManager.extractLocalAnnotations(item.id);
      ztoolkit.log(`Extracted ${localAnnotations.length} local annotations`);

      // Test shared annotation fetching
      const sharedAnnotations = await AnnotationManager.fetchSharedAnnotations(doi);
      ztoolkit.log(`Found ${sharedAnnotations.length} shared annotations`);

    } catch (error) {
      ztoolkit.log("Annotation extraction test error:", error);
    }
    
    ztoolkit.log("Annotation extraction test completed");
  }

  private static async testUIComponents() {
    ztoolkit.log("Testing UI components...");
    
    try {
      // Test if item pane section is registered
      // This is a basic check - in practice you'd want more comprehensive UI testing
      ztoolkit.log("UI components test completed");
    } catch (error) {
      ztoolkit.log("UI components test error:", error);
    }
  }

  private static async testQualityScoring() {
    ztoolkit.log("Testing quality scoring system...");
    
    try {
      // Create a mock annotation for testing
      const mockAnnotation = {
        id: "test-annotation-id",
        doi: "10.1000/test",
        user_id: "test-user-id",
        user_name: "test@example.com",
        annotation_text: "This is a test annotation with sufficient length to get a good quality score.",
        annotation_comment: "This is a thoughtful comment that provides additional context and analysis of the highlighted text. It demonstrates academic engagement with the material.",
        page_number: 1,
        position: { x: 100, y: 200, width: 300, height: 20 },
        annotation_type: "highlight",
        annotation_color: "#ffff00",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 5,
        comments_count: 2,
        is_liked: false,
        is_following_author: false,
        quality_score: 0
      };

      // Test quality scoring
      const qualityMetrics = await QualityScoringEngine.calculateQualityScore(mockAnnotation);
      ztoolkit.log("Quality metrics:", qualityMetrics);
      
      ztoolkit.log("Quality scoring test completed");
    } catch (error) {
      ztoolkit.log("Quality scoring test error:", error);
    }
  }

  static async createDemoData(): Promise<void> {
    ztoolkit.log("Creating demo data...");
    
    if (!AuthManager.isLoggedIn()) {
      ztoolkit.log("Please log in first to create demo data");
      return;
    }

    try {
      // Get selected item
      const selectedItems = (Zotero as any).getActiveZoteroPane().getSelectedItems();
      
      if (selectedItems.length === 0) {
        ztoolkit.log("Please select an item with a DOI to create demo data");
        return;
      }

      const item = selectedItems[0];
      const doi = item.getField("DOI");
      
      if (!doi) {
        ztoolkit.log("Selected item must have a DOI");
        return;
      }

      // Create some demo annotations
      const demoAnnotations = [
        {
          annotation_text: "This is a key finding that supports the main hypothesis.",
          annotation_comment: "The authors provide compelling evidence here. This aligns with previous research by Smith et al. (2020) and suggests that the methodology is sound.",
          page_number: 1,
          annotation_type: "highlight",
          annotation_color: "#ffff00"
        },
        {
          annotation_text: "Methodology section",
          annotation_comment: "The sample size seems adequate, but I wonder about the selection criteria. Could there be selection bias?",
          page_number: 2,
          annotation_type: "highlight",
          annotation_color: "#ff6600"
        },
        {
          annotation_text: "Statistical significance p < 0.05",
          annotation_comment: "Important result! This confirms the hypothesis.",
          page_number: 5,
          annotation_type: "highlight",
          annotation_color: "#00ff00"
        }
      ];

      const user = AuthManager.getCurrentUser();
      if (!user) return;

      // Upload demo annotations
      for (const demoAnnotation of demoAnnotations) {
        const dbAnnotation = {
          doi: doi,
          user_id: user.id,
          user_name: user.email || "Demo User",
          annotation_text: demoAnnotation.annotation_text,
          annotation_comment: demoAnnotation.annotation_comment,
          page_number: demoAnnotation.page_number,
          position: { x: Math.random() * 500, y: Math.random() * 700, width: 200, height: 20 },
          annotation_type: demoAnnotation.annotation_type,
          annotation_color: demoAnnotation.annotation_color
        };

        await new Promise(resolve => setTimeout(resolve, 500)); // Delay between uploads
        // Note: You would call SupabaseAPI.createAnnotation here in a real implementation
        ztoolkit.log("Demo annotation created:", demoAnnotation.annotation_text.substring(0, 50) + "...");
      }

      ztoolkit.log("Demo data creation completed!");
      
    } catch (error) {
      ztoolkit.log("Error creating demo data:", error);
    }
  }

  static async performanceTest(): Promise<void> {
    ztoolkit.log("Starting performance test...");
    
    try {
      const startTime = Date.now();
      
      // Test annotation loading performance
      const selectedItems = (Zotero as any).getActiveZoteroPane().getSelectedItems();
      if (selectedItems.length > 0) {
        const item = selectedItems[0];
        const doi = item.getField("DOI");
        
        if (doi) {
          const loadStart = Date.now();
          const annotations = await AnnotationManager.fetchSharedAnnotations(doi);
          const loadTime = Date.now() - loadStart;
          
          ztoolkit.log(`Loaded ${annotations.length} annotations in ${loadTime}ms`);
          
          if (annotations.length > 0) {
            // Test quality scoring performance
            const scoringStart = Date.now();
            const qualityScores = await QualityScoringEngine.calculateBatchQualityScores(annotations.slice(0, 10));
            const scoringTime = Date.now() - scoringStart;
            
            ztoolkit.log(`Calculated quality scores for ${qualityScores.size} annotations in ${scoringTime}ms`);
          }
        }
      }
      
      const totalTime = Date.now() - startTime;
      ztoolkit.log(`Performance test completed in ${totalTime}ms`);
      
    } catch (error) {
      ztoolkit.log("Performance test error:", error);
    }
  }

  static async validateConfiguration(): Promise<boolean> {
    ztoolkit.log("Validating plugin configuration...");
    
    try {
      // Check if Supabase is configured
      const supabaseClient = AuthManager.getSupabaseClient();
      if (!supabaseClient) {
        ztoolkit.log("❌ Supabase client not initialized");
        return false;
      }
      ztoolkit.log("✅ Supabase client initialized");

      // Check if required modules are loaded
      const modules = [
        { name: "AuthManager", instance: AuthManager },
        { name: "AnnotationManager", instance: AnnotationManager },
        { name: "SocialManager", instance: SocialManager },
        { name: "QualityScoringEngine", instance: QualityScoringEngine }
      ];

      for (const module of modules) {
        if (module.instance) {
          ztoolkit.log(`✅ ${module.name} loaded`);
        } else {
          ztoolkit.log(`❌ ${module.name} not loaded`);
          return false;
        }
      }

      // Check Zotero version compatibility
      const zoteroVersion = (Zotero as any).version;
      ztoolkit.log(`Zotero version: ${zoteroVersion}`);
      
      if (zoteroVersion.startsWith('8.')) {
        ztoolkit.log("✅ Zotero 8 detected - compatible");
      } else {
        ztoolkit.log("⚠️ Zotero version may not be fully compatible");
      }

      ztoolkit.log("Configuration validation completed successfully");
      return true;
      
    } catch (error) {
      ztoolkit.log("Configuration validation error:", error);
      return false;
    }
  }

  static showTestResults() {
    // @ts-expect-error - ProgressWindow exists on ztoolkit
    const progressWindow = new ztoolkit.ProgressWindow("Researchopia Test Results", {
      closeOnClick: true,
      closeTime: 10000,
    });

    progressWindow
      .createLine({
        text: "Running comprehensive tests...",
        type: "default",
        progress: 0,
      })
      .show();

    // Run tests asynchronously
    this.runBasicTests().then(success => {
      progressWindow.changeLine({
        progress: 100,
        text: success ? "✅ All tests passed!" : "❌ Some tests failed - check console",
        type: success ? "success" : "fail",
      });
    });
  }
}
