/**
 * Integration tests for Researchopia plugin
 * Tests core functionality in a simulated Zotero environment
 */

import { expect } from 'chai';
import { AuthManager } from '../src/modules/auth';
import { AnnotationManager } from '../src/modules/annotations';
import { QualityScoringEngine } from '../src/modules/qualityScoring';
import { SocialManager } from '../src/modules/social';
import { PreciseTrackingEngine } from '../src/modules/preciseTracking';

// Mock global objects for testing
declare global {
  var ztoolkit: any;
  var addon: any;
  var Zotero: any;
}

// Setup test environment
before(() => {
  global.ztoolkit = {
    log: (message: string, ...args: any[]) => {
      console.log(`[TEST] ${message}`, ...args);
    }
  };

  global.addon = {
    data: {
      config: {
        addonID: 'researchopia@zotero.plugin',
        addonRef: 'researchopia',
        addonInstance: 'Researchopia'
      },
      auth: {
        user: null,
        session: null,
        isLoggedIn: false
      },
      annotations: {
        shared: [],
        local: []
      },
      initialized: false
    }
  };

  global.Zotero = {
    Promise: {
      delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    },
    Items: {
      get: (id: number) => ({
        isRegularItem: () => true,
        getField: (field: string) => field === 'DOI' ? '10.1000/test.doi' : 'Test Value',
        getAnnotations: () => Promise.resolve([])
      })
    }
  };
});

describe('Researchopia Plugin Integration Tests', () => {
  
  describe('AuthManager', () => {
    it('should initialize without errors', () => {
      expect(() => AuthManager.initialize()).to.not.throw();
    });

    it('should handle login state correctly', () => {
      expect(AuthManager.isLoggedIn()).to.be.false;
    });
  });

  describe('AnnotationManager', () => {
    it('should initialize without errors', () => {
      expect(() => AnnotationManager.initialize()).to.not.throw();
    });

    it('should extract local annotations', async () => {
      const annotations = await AnnotationManager.extractLocalAnnotations(1);
      expect(annotations).to.be.an('array');
    });
  });

  describe('QualityScoringEngine', () => {
    const mockAnnotation = {
      id: 'test-annotation-1',
      doi: '10.1000/test.doi',
      user_id: 'test-user-1',
      user_name: 'Test User',
      annotation_text: 'This is a comprehensive analysis of the methodology used in this research study.',
      annotation_comment: 'The authors provide significant evidence for their hypothesis through statistical analysis.',
      annotation_type: 'highlight',
      annotation_color: '#ffff00',
      page_number: 5,
      position: { x: 100, y: 200 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      likes_count: 3,
      comments_count: 1,
      quality_score: 0
    };

    it('should calculate quality metrics', async () => {
      const metrics = await QualityScoringEngine.calculateQualityScore(mockAnnotation);
      
      expect(metrics).to.have.property('contentQuality');
      expect(metrics).to.have.property('socialEngagement');
      expect(metrics).to.have.property('authorReputation');
      expect(metrics).to.have.property('recency');
      expect(metrics).to.have.property('relevance');
      expect(metrics).to.have.property('academicValue');
      expect(metrics).to.have.property('totalScore');
      expect(metrics).to.have.property('grade');
      
      expect(metrics.totalScore).to.be.a('number');
      expect(metrics.totalScore).to.be.at.least(0);
      expect(metrics.totalScore).to.be.at.most(100);
      
      expect(metrics.grade).to.be.oneOf(['A+', 'A', 'B+', 'B', 'C+', 'C', 'D']);
    });

    it('should handle batch quality scoring', async () => {
      const annotations = [mockAnnotation, { ...mockAnnotation, id: 'test-annotation-2' }];
      const results = await QualityScoringEngine.calculateBatchQualityScores(annotations);
      
      expect(results).to.be.instanceOf(Map);
      expect(results.size).to.equal(2);
      expect(results.has('test-annotation-1')).to.be.true;
      expect(results.has('test-annotation-2')).to.be.true;
    });

    it('should generate recommendations', async () => {
      const annotations = [
        mockAnnotation,
        { ...mockAnnotation, id: 'test-annotation-2', user_id: 'followed-user' },
        { ...mockAnnotation, id: 'test-annotation-3', annotation_text: 'Short text' }
      ];

      const recommendations = await QualityScoringEngine.recommendAnnotations(annotations, {
        followedUsers: ['followed-user'],
        preferredTopics: ['methodology', 'analysis'],
        minQualityScore: 50,
        maxResults: 5
      });

      expect(recommendations).to.be.an('array');
      expect(recommendations.length).to.be.at.most(5);
    });
  });

  describe('SocialManager', () => {
    it('should initialize without errors', () => {
      expect(() => SocialManager.initialize()).to.not.throw();
    });

    it('should handle user profile operations', async () => {
      // These would normally require a real Supabase connection
      // For now, just test that methods exist and don't throw
      expect(SocialManager.getUserProfile).to.be.a('function');
      expect(SocialManager.likeAnnotation).to.be.a('function');
      expect(SocialManager.addComment).to.be.a('function');
      expect(SocialManager.followUser).to.be.a('function');
    });
  });

  describe('PreciseTrackingEngine', () => {
    const mockTextPositions = [
      {
        page: 1,
        paragraph: 0,
        sentence: 0,
        startOffset: 0,
        endOffset: 50,
        textContent: 'This is a test sentence for precise tracking.',
        context: 'This is a test sentence for precise tracking. It should match annotations accurately.'
      },
      {
        page: 1,
        paragraph: 0,
        sentence: 1,
        startOffset: 51,
        endOffset: 100,
        textContent: 'Another sentence with different content.',
        context: 'This is a test sentence for precise tracking. Another sentence with different content.'
      }
    ];

    const mockAnnotation = {
      id: 'precise-test-1',
      text: 'test sentence for precise',
      comment: 'This is a test comment',
      type: 'highlight' as const,
      color: '#ffff00',
      author: 'Test User',
      timestamp: new Date()
    };

    it('should match annotations to positions', () => {
      const result = PreciseTrackingEngine.matchAnnotationToPosition(
        mockAnnotation,
        mockTextPositions
      );

      expect(result).to.not.be.null;
      if (result) {
        expect(result).to.have.property('id');
        expect(result).to.have.property('position');
        expect(result).to.have.property('confidence');
        expect(result.confidence).to.be.a('number');
        expect(result.confidence).to.be.at.least(0);
        expect(result.confidence).to.be.at.most(1);
      }
    });

    it('should get annotations for reading position', () => {
      const preciseAnnotations = [
        {
          id: 'precise-1',
          originalText: 'test text',
          position: { page: 1, paragraph: 0, sentence: 0, startOffset: 0, endOffset: 10, textContent: 'test', context: 'test context' },
          type: 'highlight' as const,
          color: '#ffff00',
          author: 'Test User',
          timestamp: new Date(),
          confidence: 0.9
        }
      ];

      const relevantAnnotations = PreciseTrackingEngine.getAnnotationsForPosition(
        1, 0, preciseAnnotations
      );

      expect(relevantAnnotations).to.be.an('array');
      expect(relevantAnnotations.length).to.equal(1);
    });
  });

  describe('Plugin Integration', () => {
    it('should have all required modules initialized', () => {
      expect(AuthManager).to.exist;
      expect(AnnotationManager).to.exist;
      expect(QualityScoringEngine).to.exist;
      expect(SocialManager).to.exist;
      expect(PreciseTrackingEngine).to.exist;
    });

    it('should handle plugin lifecycle', () => {
      // Test initialization
      AuthManager.initialize();
      AnnotationManager.initialize();
      SocialManager.initialize();

      expect(addon.data.initialized).to.be.false; // Will be set to true by hooks
    });
  });

  describe('Error Handling', () => {
    it('should handle missing DOI gracefully', async () => {
      // Mock item without DOI
      global.Zotero.Items.get = () => ({
        isRegularItem: () => true,
        getField: (field: string) => field === 'DOI' ? '' : 'Test Value',
        getAnnotations: () => Promise.resolve([])
      });

      const annotations = await AnnotationManager.extractLocalAnnotations(1);
      expect(annotations).to.be.an('array');
    });

    it('should handle network errors gracefully', async () => {
      // These tests would require mocking network failures
      // For now, just ensure methods exist and can be called
      expect(() => AuthManager.signIn('test@example.com', 'password')).to.not.throw();
    });
  });
});

// Cleanup after tests
after(() => {
  // Reset global state
  global.addon.data.initialized = false;
  global.addon.data.auth.isLoggedIn = false;
});
