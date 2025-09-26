/**
 * Annotation Management Module for Researchopia
 * Handles extraction, upload, and synchronization of Zotero annotations
 */

var ResearchopiaAnnotations = {
  initialized: false,

  initialize() {
    if (this.initialized) return;
    
    try {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Initializing annotations module');
      }
      
      this.initialized = true;
      
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Annotations module initialized successfully');
      }
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Failed to initialize annotations module:', error);
      }
    }
  },

  /**
   * Extract annotations from a Zotero item
   * @param {Zotero.Item} item - The Zotero item to extract annotations from
   * @returns {Array} Array of annotation objects
   */
  async extractAnnotations(item) {
    if (!item || !item.isRegularItem()) {
      return [];
    }

    try {
      const annotations = [];
      const attachments = item.getAttachments();
      
      if (typeof Zotero !== 'undefined') {
        Zotero.debug(`Researchopia: Found ${attachments.length} attachments for item`);
      }

      for (const attachmentID of attachments) {
        const attachment = Zotero.Items.get(attachmentID);
        if (!attachment || !attachment.isPDFAttachment()) continue;

        // Get annotations for this PDF attachment
        const pdfAnnotations = attachment.getAnnotations();
        
        if (typeof Zotero !== 'undefined') {
          Zotero.debug(`Researchopia: Found ${pdfAnnotations.length} annotations in PDF`);
        }

        for (const annotationItem of pdfAnnotations) {
          const annotation = this.processAnnotation(annotationItem, item);
          if (annotation) {
            annotations.push(annotation);
          }
        }
      }

      return annotations;
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Error extracting annotations:', error);
      }
      return [];
    }
  },

  /**
   * Process a single annotation item into our format
   * @param {Zotero.Item} annotationItem - The annotation item
   * @param {Zotero.Item} parentItem - The parent research item
   * @returns {Object|null} Processed annotation object
   */
  processAnnotation(annotationItem, parentItem) {
    try {
      const annotationData = annotationItem.annotationData;
      if (!annotationData) return null;

      const annotation = {
        id: annotationItem.key,
        type: annotationData.type, // 'highlight', 'note', 'image'
        text: annotationData.text || '',
        comment: annotationData.comment || '',
        color: annotationData.color || '#ffd400',
        page: annotationData.pageLabel || annotationData.page || 1,
        position: {
          rects: annotationData.position?.rects || [],
          pageIndex: annotationData.position?.pageIndex || 0
        },
        tags: annotationItem.getTags().map(tag => tag.tag),
        dateAdded: annotationItem.dateAdded,
        dateModified: annotationItem.dateModified,
        // Parent item info
        parentDOI: parentItem.getField('DOI'),
        parentTitle: parentItem.getField('title'),
        parentKey: parentItem.key
      };

      return annotation;
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Error processing annotation:', error);
      }
      return null;
    }
  },

  /**
   * Upload annotations to Supabase
   * @param {Array} annotations - Array of annotation objects
   * @param {string} doi - DOI of the paper
   * @returns {Object} Upload result
   */
  async uploadAnnotations(annotations, doi) {
    if (!annotations || annotations.length === 0) {
      return { success: false, error: 'No annotations to upload' };
    }

    try {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug(`Researchopia: Uploading ${annotations.length} annotations for DOI: ${doi}`);
      }

      // Check if user is logged in
      if (!Zotero.Researchopia?.auth?.isLoggedIn()) {
        return { success: false, error: 'User not logged in' };
      }

      const session = Zotero.Researchopia.auth.getStoredSession();
      if (!session || !session.access_token) {
        return { success: false, error: 'No valid session found' };
      }

      // Prepare annotations for upload
      const annotationsToUpload = annotations.map(annotation => ({
        id: annotation.id,
        paper_doi: doi,
        user_id: session.user.id,
        annotation_type: annotation.type,
        content: annotation.text,
        comment: annotation.comment,
        color: annotation.color,
        page_number: annotation.page,
        position_data: JSON.stringify(annotation.position),
        tags: annotation.tags,
        created_at: annotation.dateAdded,
        updated_at: annotation.dateModified
      }));

      // Upload to Supabase
      const result = await this.makeRequest('POST', '/rest/v1/annotations', annotationsToUpload, session.access_token);

      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Annotations uploaded successfully');
      }

      return { success: true, count: annotationsToUpload.length };
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Error uploading annotations:', error);
      }
      return { success: false, error: error.message };
    }
  },

  /**
   * Fetch shared annotations for a DOI
   * @param {string} doi - DOI of the paper
   * @returns {Array} Array of shared annotations
   */
  async fetchSharedAnnotations(doi) {
    try {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug(`Researchopia: Fetching shared annotations for DOI: ${doi}`);
      }

      // Check if user is logged in
      if (!Zotero.Researchopia?.auth?.isLoggedIn()) {
        return [];
      }

      const session = Zotero.Researchopia.auth.getStoredSession();
      if (!session || !session.access_token) {
        return [];
      }

      // Fetch from Supabase
      const annotations = await this.makeRequest(
        'GET', 
        `/rest/v1/annotations?paper_doi=eq.${encodeURIComponent(doi)}&select=*,profiles(username,avatar_url)&order=created_at.desc`,
        null,
        session.access_token
      );

      if (typeof Zotero !== 'undefined') {
        Zotero.debug(`Researchopia: Fetched ${annotations.length} shared annotations`);
      }

      return annotations || [];
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Error fetching shared annotations:', error);
      }
      return [];
    }
  },

  /**
   * Make HTTP request to Supabase
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} body - Request body
   * @param {string} accessToken - Access token
   * @returns {Promise} Request promise
   */
  makeRequest(method, endpoint, body = null, accessToken = null) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        const config = {
          url: 'https://obcblvdtqhwrihoddlez.supabase.co',
          anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4'
        };
        const url = config.url + endpoint;
        
        xhr.open(method, url, true);
        
        // Set headers
        xhr.setRequestHeader('apikey', config.anonKey);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        if (accessToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        } else {
          xhr.setRequestHeader('Authorization', `Bearer ${config.anonKey}`);
        }
        
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            try {
              const data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
              
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(data);
              } else {
                reject(new Error(data.message || `HTTP ${xhr.status}`));
              }
            } catch (parseError) {
              reject(new Error('Failed to parse response: ' + parseError.message));
            }
          }
        };
        
        xhr.onerror = function() {
          reject(new Error('Network request failed'));
        };
        
        xhr.ontimeout = function() {
          reject(new Error('Request timeout'));
        };
        
        xhr.timeout = 30000; // 30 second timeout
        
        // Send request
        if (body) {
          xhr.send(JSON.stringify(body));
        } else {
          xhr.send();
        }
      } catch (error) {
        reject(error);
      }
    });
  }
};

// Auto-initialize when loaded
if (typeof Zotero !== 'undefined') {
  Zotero.debug('Researchopia: Annotations module script loaded');
  ResearchopiaAnnotations.initialize();
}

// Export to global context
if (typeof window !== 'undefined') {
  window.ResearchopiaAnnotations = ResearchopiaAnnotations;
} else {
  this.ResearchopiaAnnotations = ResearchopiaAnnotations;
}
