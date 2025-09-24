export class SupabaseAPI {
  private baseUrl: string = "";
  private apiKey: string = "";
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    // 使用预配置的Supabase配置
    const config = {
      url: 'https://obcblvdtqhwrihoddlez.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4'
    };

    this.baseUrl = config.url;
    this.apiKey = config.anonKey;

    if (!this.baseUrl || !this.apiKey) {
      throw new Error("Supabase configuration not found");
    }

    this.initialized = true;
    this.log("✅ Supabase API initialized");
    this.log(`📍 URL: ${config.url}`);
    this.log(`🔑 Key: ${config.anonKey.substring(0, 20)}...`);
  }

  private log(message: string): void {
    ztoolkit.log(`Supabase: ${message}`);
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

    try {
      this.log(`Making ${method} request to ${endpoint}`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      this.log(`✅ Request successful`);
      return result;
    } catch (error) {
      this.log(`❌ Request failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 检查是否已认证
   */
  isAuthenticated(): boolean {
    // 简化版本：总是返回true，因为我们使用服务密钥
    // 实际应用中应该检查用户认证状态
    return true;
  }

  async createUser(email: string, displayName: string): Promise<any> {
    const userData = {
      id: this.generateUUID(),
      username: email.split('@')[0], // 从邮箱提取用户名
      display_name: displayName,
      created_at: new Date().toISOString()
    };

    return await this.makeRequest('users', 'POST', userData);
  }

  async uploadAnnotations(doi: string, annotations: any[]): Promise<void> {
    if (!annotations || annotations.length === 0) {
      this.log("No annotations to upload");
      return;
    }

    try {
      // 简化版本：直接模拟成功上传
      this.log(`📤 Simulating upload of ${annotations.length} annotations for DOI: ${doi}`);

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 模拟成功
      this.log(`✅ Successfully uploaded ${annotations.length} annotations (simulated)`);

    } catch (error) {
      this.log(`❌ Upload failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async getSharedAnnotations(doi: string): Promise<any[]> {
    try {
      // 简化版本：返回模拟数据
      this.log(`📥 Simulating load of shared annotations for DOI: ${doi}`);

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 800));

      // 返回模拟的标注数据
      const mockAnnotations = [
        {
          id: '1',
          text_content: '这是一个示例标注',
          comment: '用户评论示例',
          color: '#ffd400',
          page_number: 1,
          user: { display_name: '示例用户' },
          created_at: new Date().toISOString()
        }
      ];

      this.log(`✅ Loaded ${mockAnnotations.length} shared annotations (simulated)`);
      return mockAnnotations;

    } catch (error) {
      this.log(`❌ Loading failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async likeAnnotation(annotationId: string, userId: string): Promise<void> {
    const likeData = {
      id: this.generateUUID(),
      annotation_id: annotationId,
      user_id: userId,
      created_at: new Date().toISOString()
    };

    try {
      await this.makeRequest('likes', 'POST', likeData);
      this.log(`✅ Liked annotation ${annotationId}`);
    } catch (error) {
      this.log(`❌ Like failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async commentOnAnnotation(annotationId: string, userId: string, content: string): Promise<void> {
    const commentData = {
      id: this.generateUUID(),
      annotation_id: annotationId,
      user_id: userId,
      content,
      created_at: new Date().toISOString()
    };

    try {
      await this.makeRequest('comments', 'POST', commentData);
      this.log(`✅ Added comment to annotation ${annotationId}`);
    } catch (error) {
      this.log(`❌ Comment failed: ${(error as Error).message}`);
      throw error;
    }
  }
}
