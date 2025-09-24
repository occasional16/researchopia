import { getPref } from "../utils/prefs";

export class SupabaseAPI implements SupabaseAPI {
  private baseUrl: string = "";
  private apiKey: string = "";
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    this.baseUrl = getPref("supabaseUrl") as string;
    this.apiKey = getPref("supabaseKey") as string;
    
    if (!this.baseUrl || !this.apiKey) {
      throw new Error("Supabase configuration not found");
    }
    
    this.initialized = true;
    this.log("✅ Supabase API initialized");
  }

  private log(message: string): void {
    Zotero.Researchopia.data.ztoolkit.log(`Supabase: ${message}`);
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private async makeRequest(endpoint: string, method: string = 'GET', data: any = null): Promise<any> {
    if (!this.initialized) {
      throw new Error("Supabase API not initialized");
    }

    const url = `${this.baseUrl}/rest/v1/${endpoint}`;
    const headers = {
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    this.log(`🌐 Making ${method} request to: ${url}`);
    if (data) {
      this.log(`📤 Request data: ${JSON.stringify(data, null, 2).substring(0, 500)}...`);
    }

    try {
      const response = await fetch(url, options);
      const responseText = await response.text();

      this.log(`📡 Response status: ${response.status}`);
      this.log(`📡 Response body: ${responseText.substring(0, 500)}...`);

      if (!response.ok) {
        if (response.status === 401) {
          this.log(`🔐 Authentication issue: This might be due to Row Level Security (RLS) policies`);
        }
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      return responseText ? JSON.parse(responseText) : null;
    } catch (error) {
      this.log(`❌ Request failed: ${error.message}`);
      throw error;
    }
  }

  async uploadAnnotations(annotations: Annotation[]): Promise<any> {
    this.log(`📤 Uploading ${annotations.length} annotations`);

    try {
      // Generate UUIDs for document and user
      const documentId = this.generateUUID();
      const userId = this.generateUUID();
      const doi = annotations[0]?.paperDoi || 'unknown';

      this.log(`🔑 Generated IDs - Document: ${documentId}, User: ${userId}`);

      // Step 1: Create user record (optional)
      try {
        const userData = {
          id: userId,
          email: `user_${userId.substring(0, 8)}@researchopia.com`,
          username: `user_${userId.substring(0, 8)}`,
          created_at: new Date().toISOString()
        };

        this.log(`👤 Creating user: ${JSON.stringify(userData)}`);
        await this.makeRequest('users', 'POST', userData);
        this.log(`✅ User created successfully`);
      } catch (userError) {
        this.log(`⚠️ User creation failed (might not be needed): ${userError.message}`);
      }

      // Step 2: Create document record
      try {
        const documentData = {
          id: documentId,
          title: `Paper with DOI: ${doi}`,
          doi: doi,
          created_at: new Date().toISOString()
        };

        this.log(`📄 Creating document: ${JSON.stringify(documentData)}`);
        await this.makeRequest('documents', 'POST', documentData);
        this.log(`✅ Document created successfully`);
      } catch (docError) {
        this.log(`❌ Document creation failed: ${docError.message}`);
        throw new Error(`Unable to create document record: ${docError.message}`);
      }

      // Step 3: Create annotation records
      const annotationData = annotations.map(ann => ({
        document_id: documentId,
        user_id: userId,
        type: ann.type || 'highlight',
        position: {
          page: parseInt(ann.page.toString()) || 1,
          key: ann.key || '',
          doi: doi,
          zotero_key: ann.key || ''
        },
        content: ann.text || '',
        comment: ann.comment || '',
        color: ann.color || '#ffd400',
        visibility: 'public',
        platform: 'zotero',
        original_id: ann.key || ''
      }));

      this.log(`📋 Creating annotations: ${annotationData.length} items`);

      const result = await this.makeRequest('annotations', 'POST', annotationData);

      this.log(`✅ Successfully uploaded ${annotationData.length} annotations`);
      return { success: true, count: annotationData.length, data: result };

    } catch (error) {
      this.log(`❌ Upload failed: ${error.message}`);

      if (error.message.includes('row-level security policy')) {
        throw new Error('Database permission restriction: Need to configure Supabase RLS policies or use authenticated user');
      } else if (error.message.includes('foreign key constraint')) {
        throw new Error('Database constraint error: User or document ID does not exist');
      } else {
        throw error;
      }
    }
  }

  async getSharedAnnotations(paperId: string): Promise<SharedAnnotation[]> {
    this.log(`📥 Loading shared annotations for paper: ${paperId}`);

    try {
      const result = await this.makeRequest(`annotations?select=*`);

      this.log(`✅ Loaded ${result.length} shared annotations`);
      return result.map((ann: any) => ({
        id: ann.id,
        key: ann.original_id || '',
        type: ann.type || 'highlight',
        text: ann.content || ann.text || '',
        comment: ann.comment || '',
        color: ann.color || '#ffd400',
        page: ann.position?.page || 1,
        user: ann.user || 'anonymous',
        likes: 0,
        comments: 0,
        created_at: ann.created_at
      }));

    } catch (error) {
      this.log(`❌ Loading failed: ${error.message}`);
      return [];
    }
  }

  async likeAnnotation(annotationId: string): Promise<any> {
    this.log(`👍 Liking annotation: ${annotationId}`);
    
    try {
      const userId = 'user_' + Date.now();
      const likeData = {
        id: 'like_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        user_id: userId,
        annotation_id: annotationId,
        created_at: new Date().toISOString()
      };

      const result = await this.makeRequest('likes', 'POST', likeData);
      this.log(`✅ Like added successfully`);
      return result;
    } catch (error) {
      this.log(`❌ Like failed: ${error.message}`);
      throw error;
    }
  }

  async addComment(annotationId: string, comment: string): Promise<any> {
    this.log(`💬 Adding comment to annotation: ${annotationId}`);
    
    try {
      const userId = 'user_' + Date.now();
      const commentData = {
        id: 'comment_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
        user_id: userId,
        annotation_id: annotationId,
        content: comment,
        created_at: new Date().toISOString()
      };

      const result = await this.makeRequest('comments', 'POST', commentData);
      this.log(`✅ Comment added successfully`);
      return result;
    } catch (error) {
      this.log(`❌ Comment failed: ${error.message}`);
      throw error;
    }
  }
}
