/**
 * 论文评估管理模块
 * 负责论文评分、评价、推荐等功能
 */

export class PaperEvaluationManager {
  private static instance: PaperEvaluationManager | null = null;
  private isInitialized = false;
  private evaluations: Map<string, any> = new Map();

  public static getInstance(): PaperEvaluationManager {
    if (!PaperEvaluationManager.instance) {
      PaperEvaluationManager.instance = new PaperEvaluationManager();
    }
    return PaperEvaluationManager.instance;
  }

  public static initialize(): void {
    const instance = PaperEvaluationManager.getInstance();
    if (instance.isInitialized) {
      return;
    }

    console.log("[PaperEvaluationManager] Initializing...");
    
    try {
      // 初始化论文评估系统
      instance.loadEvaluations();
      instance.isInitialized = true;
      console.log("[PaperEvaluationManager] Initialized successfully");
    } catch (error) {
      console.error("[PaperEvaluationManager] Initialization error:", error);
      throw error;
    }
  }

  public static async evaluatePaper(
    itemId: string | number,
    rating: number,
    comment?: string
  ): Promise<boolean> {
    const instance = PaperEvaluationManager.getInstance();
    
    try {
      console.log("[PaperEvaluationManager] Evaluating paper:", itemId, rating);
      
      const evaluation = {
        itemId: itemId.toString(),
        rating,
        comment: comment || '',
        timestamp: Date.now(),
        userId: 'current-user' // TODO: 从AuthManager获取当前用户
      };
      
      instance.evaluations.set(itemId.toString(), evaluation);
      await instance.saveEvaluation(evaluation);
      
      console.log("[PaperEvaluationManager] Paper evaluation saved");
      return true;
    } catch (error) {
      console.error("[PaperEvaluationManager] Error evaluating paper:", error);
      return false;
    }
  }

  public static getEvaluation(itemId: string | number): any | null {
    const instance = PaperEvaluationManager.getInstance();
    return instance.evaluations.get(itemId.toString()) || null;
  }

  public static getAllEvaluations(): any[] {
    const instance = PaperEvaluationManager.getInstance();
    return Array.from(instance.evaluations.values());
  }

  public static async getRecommendations(
    itemId: string | number,
    limit: number = 5
  ): Promise<any[]> {
    try {
      console.log("[PaperEvaluationManager] Getting recommendations for item:", itemId);
      
      // TODO: 实现基于评分和标注的推荐算法
      // 这里返回模拟数据
      const recommendations: any[] = [];
      for (let i = 0; i < Math.min(limit, 3); i++) {
        recommendations.push({
          itemId: `rec-${itemId}-${i}`,
          title: `推荐论文 ${i + 1}`,
          authors: [`作者${i + 1}A`, `作者${i + 1}B`],
          score: 0.9 - i * 0.1,
          reason: `基于相似标注和评分推荐`
        });
      }
      
      return recommendations;
    } catch (error) {
      console.error("[PaperEvaluationManager] Error getting recommendations:", error);
      return [];
    }
  }

  public static async exportEvaluations(format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const instance = PaperEvaluationManager.getInstance();
      const evaluations = PaperEvaluationManager.getAllEvaluations();
      
      if (format === 'csv') {
        return instance.exportToCSV(evaluations);
      } else {
        return JSON.stringify(evaluations, null, 2);
      }
    } catch (error) {
      console.error("[PaperEvaluationManager] Error exporting evaluations:", error);
      throw error;
    }
  }

  private loadEvaluations(): void {
    try {
      console.log("[PaperEvaluationManager] Loading evaluations...");
      
      // TODO: 从Zotero首选项或本地存储加载评估数据
      const storedEvaluations = Zotero.Prefs.get('extensions.zotero.researchopia.evaluations', true);
      
      if (storedEvaluations) {
        const evaluations = JSON.parse(storedEvaluations);
        for (const evaluation of evaluations) {
          this.evaluations.set(evaluation.itemId, evaluation);
        }
        console.log("[PaperEvaluationManager] Loaded evaluations:", this.evaluations.size);
      }
    } catch (error) {
      console.error("[PaperEvaluationManager] Error loading evaluations:", error);
    }
  }

  private async saveEvaluation(evaluation: any): Promise<void> {
    try {
      // 保存单个评估
      console.log("[PaperEvaluationManager] Saving evaluation:", evaluation.itemId);
      
      // TODO: 保存到本地存储和/或远程API
      await this.saveAllEvaluations();
      
      console.log("[PaperEvaluationManager] Evaluation saved");
    } catch (error) {
      console.error("[PaperEvaluationManager] Error saving evaluation:", error);
      throw error;
    }
  }

  private async saveAllEvaluations(): Promise<void> {
    try {
      const evaluations = Array.from(this.evaluations.values());
      Zotero.Prefs.set(
        'extensions.zotero.researchopia.evaluations',
        JSON.stringify(evaluations),
        true
      );
    } catch (error) {
      console.error("[PaperEvaluationManager] Error saving all evaluations:", error);
      throw error;
    }
  }

  private exportToCSV(evaluations: any[]): string {
    if (evaluations.length === 0) {
      return 'itemId,rating,comment,timestamp,userId\n';
    }
    
    const headers = ['itemId', 'rating', 'comment', 'timestamp', 'userId'];
    const csvContent = headers.join(',') + '\n';
    
    const rows = evaluations.map(evaluation => {
      return headers.map(header => {
        const value = evaluation[header] || '';
        // 转义CSV中的特殊字符
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    }).join('\n');
    
    return csvContent + rows;
  }

  public static cleanup(): void {
    const instance = PaperEvaluationManager.getInstance();
    
    try {
      // 保存所有评估数据
      instance.saveAllEvaluations();
      
      instance.evaluations.clear();
      instance.isInitialized = false;
      PaperEvaluationManager.instance = null;
      
      console.log("[PaperEvaluationManager] Cleanup completed");
    } catch (error) {
      console.error("[PaperEvaluationManager] Error during cleanup:", error);
    }
  }
}