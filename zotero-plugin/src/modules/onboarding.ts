/**
 * 用户引导模块
 * 负责新用户引导、帮助提示、功能介绍等
 */

import { logger } from "../utils/logger";

export class OnboardingManager {
  private static instance: OnboardingManager | null = null;
  private isOnboardingActive = false;
  private currentStep = 0;
  private onboardingSteps: any[] = [];

  public static getInstance(): OnboardingManager {
    if (!OnboardingManager.instance) {
      OnboardingManager.instance = new OnboardingManager();
    }
    return OnboardingManager.instance;
  }

  public static shouldShowOnboarding(): boolean {
    try {
      const addon = (globalThis as any).Zotero?.Researchopia;
      // 检查是否是第一次使用
      const hasSeenOnboarding = Zotero.Prefs.get('extensions.zotero.researchopia.onboardingCompleted', true);
      const pluginVersion = Zotero.Prefs.get('extensions.zotero.researchopia.version', true);
      const currentVersion = (addon?.data.config as any)?.buildVersion || '0.2.0';
      
      // 如果从未完成引导，或者版本更新了，则显示引导
      return !hasSeenOnboarding || pluginVersion !== currentVersion;
    } catch (error) {
      logger.error("[OnboardingManager] Error checking onboarding status:", error);
      return false;
    }
  }

  public static async startOnboarding(): Promise<void> {
    const instance = OnboardingManager.getInstance();
    
    try {
      logger.log("[OnboardingManager] Starting onboarding...");
      
      instance.setupOnboardingSteps();
      instance.isOnboardingActive = true;
      instance.currentStep = 0;
      
      await instance.showStep(0);
      
    } catch (error) {
      logger.error("[OnboardingManager] Error starting onboarding:", error);
    }
  }

  public static async nextStep(): Promise<void> {
    const instance = OnboardingManager.getInstance();
    
    if (!instance.isOnboardingActive) {
      return;
    }

    instance.currentStep++;
    
    if (instance.currentStep >= instance.onboardingSteps.length) {
      await OnboardingManager.completeOnboarding();
    } else {
      await instance.showStep(instance.currentStep);
    }
  }

  public static async previousStep(): Promise<void> {
    const instance = OnboardingManager.getInstance();
    
    if (!instance.isOnboardingActive || instance.currentStep <= 0) {
      return;
    }

    instance.currentStep--;
    await instance.showStep(instance.currentStep);
  }

  public static async skipOnboarding(): Promise<void> {
    await OnboardingManager.completeOnboarding();
  }

  public static async completeOnboarding(): Promise<void> {
    const instance = OnboardingManager.getInstance();
    
    try {
      const addon = (globalThis as any).Zotero?.Researchopia;
      logger.log("[OnboardingManager] Completing onboarding...");
      
      instance.isOnboardingActive = false;
      instance.currentStep = 0;
      
      // 标记引导完成
      Zotero.Prefs.set('extensions.zotero.researchopia.onboardingCompleted', true, true);
      Zotero.Prefs.set('extensions.zotero.researchopia.version', (addon?.data.config as any)?.buildVersion || '0.2.0', true);
      
      // 清理引导UI
      await instance.cleanupOnboardingUI();
      
      logger.log("[OnboardingManager] Onboarding completed");
    } catch (error) {
      logger.error("[OnboardingManager] Error completing onboarding:", error);
    }
  }

  public static resetOnboarding(): void {
    try {
      logger.log("[OnboardingManager] Resetting onboarding...");
      
      Zotero.Prefs.clear('extensions.zotero.researchopia.onboardingCompleted', true);
      Zotero.Prefs.clear('extensions.zotero.researchopia.version', true);
      
      const instance = OnboardingManager.getInstance();
      instance.isOnboardingActive = false;
      instance.currentStep = 0;
      
      logger.log("[OnboardingManager] Onboarding reset completed");
    } catch (error) {
      logger.error("[OnboardingManager] Error resetting onboarding:", error);
    }
  }

  private setupOnboardingSteps(): void {
    this.onboardingSteps = [
      {
        id: 'welcome',
        title: '欢迎使用 Researchopia',
        content: '感谢您安装 Researchopia！这是一个用于学术标注分享和协作的 Zotero 插件。',
        action: 'showWelcome',
        element: null
      },
      {
        id: 'item-pane',
        title: '条目面板',
        content: '在条目详情面板中，您可以看到 Researchopia 的功能区域。在这里可以共享和查看标注。',
        action: 'highlightItemPane',
        element: '#zotero-item-pane'
      },
      {
        id: 'annotations',
        title: '标注管理',
        content: '您可以将 PDF 标注分享给社区，也可以查看其他用户的标注和评论。',
        action: 'showAnnotationFeatures',
        element: null
      },
      {
        id: 'authentication',
        title: '账户登录',
        content: '要使用完整功能，请在首选项中登录您的 Researchopia 账户。',
        action: 'showAuthSettings',
        element: null
      },
      {
        id: 'complete',
        title: '设置完成',
        content: '您已经了解了 Researchopia 的基本功能。现在可以开始使用了！',
        action: 'showCompletion',
        element: null
      }
    ];
  }

  private async showStep(stepIndex: number): Promise<void> {
    try {
      if (stepIndex < 0 || stepIndex >= this.onboardingSteps.length) {
        return;
      }

      const step = this.onboardingSteps[stepIndex];
      logger.log(`[OnboardingManager] Showing step ${stepIndex + 1}/${this.onboardingSteps.length}: ${step.title}`);

      // 执行步骤动作
      switch (step.action) {
        case 'showWelcome':
          await this.showWelcomeDialog(step);
          break;
        case 'highlightItemPane':
          await this.highlightElement(step);
          break;
        case 'showAnnotationFeatures':
          await this.showFeatureDialog(step);
          break;
        case 'showAuthSettings':
          await this.showAuthDialog(step);
          break;
        case 'showCompletion':
          await this.showCompletionDialog(step);
          break;
        default:
          await this.showGenericDialog(step);
      }

    } catch (error) {
      logger.error(`[OnboardingManager] Error showing step ${stepIndex}:`, error);
    }
  }

  private async showWelcomeDialog(step: any): Promise<void> {
    const mainWindow = Zotero.getMainWindow();
    if (!mainWindow) return;

    const dialog = mainWindow.document.createElement('div');
    dialog.className = 'researchopia-onboarding-dialog';
    dialog.innerHTML = `
      <div class="onboarding-content">
        <h2>${step.title}</h2>
        <p>${step.content}</p>
        <div class="onboarding-buttons">
          <button id="onboarding-skip">跳过引导</button>
          <button id="onboarding-next" class="primary">开始</button>
        </div>
      </div>
    `;

    this.attachDialogEvents(dialog, mainWindow);
    mainWindow.document.body.appendChild(dialog);
  }

  private async showFeatureDialog(step: any): Promise<void> {
    const mainWindow = Zotero.getMainWindow();
    if (!mainWindow) return;

    const dialog = mainWindow.document.createElement('div');
    dialog.className = 'researchopia-onboarding-dialog';
    dialog.innerHTML = `
      <div class="onboarding-content">
        <h2>${step.title}</h2>
        <p>${step.content}</p>
        <ul>
          <li>标注分享：将您的 PDF 标注分享给社区</li>
          <li>协作评论：查看其他用户的标注和评论</li>
          <li>论文评估：对论文进行评分和评价</li>
        </ul>
        <div class="onboarding-buttons">
          <button id="onboarding-previous">上一步</button>
          <button id="onboarding-skip">跳过</button>
          <button id="onboarding-next" class="primary">下一步</button>
        </div>
      </div>
    `;

    this.attachDialogEvents(dialog, mainWindow);
    mainWindow.document.body.appendChild(dialog);
  }

  private async showAuthDialog(step: any): Promise<void> {
    const mainWindow = Zotero.getMainWindow();
    if (!mainWindow) return;

    const dialog = mainWindow.document.createElement('div');
    dialog.className = 'researchopia-onboarding-dialog';
    dialog.innerHTML = `
      <div class="onboarding-content">
        <h2>${step.title}</h2>
        <p>${step.content}</p>
        <p>您可以在 编辑 → 首选项 → Researchopia 中进行登录设置。</p>
        <div class="onboarding-buttons">
          <button id="onboarding-previous">上一步</button>
          <button id="onboarding-skip">跳过</button>
          <button id="onboarding-preferences">打开首选项</button>
          <button id="onboarding-next" class="primary">下一步</button>
        </div>
      </div>
    `;

    this.attachDialogEvents(dialog, mainWindow);
    mainWindow.document.body.appendChild(dialog);
  }

  private async showCompletionDialog(step: any): Promise<void> {
    const mainWindow = Zotero.getMainWindow();
    if (!mainWindow) return;

    const dialog = mainWindow.document.createElement('div');
    dialog.className = 'researchopia-onboarding-dialog';
    dialog.innerHTML = `
      <div class="onboarding-content">
        <h2>${step.title}</h2>
        <p>${step.content}</p>
        <p>如果您有任何问题，可以查看帮助文档或联系我们。</p>
        <div class="onboarding-buttons">
          <button id="onboarding-finish" class="primary">开始使用</button>
        </div>
      </div>
    `;

    this.attachDialogEvents(dialog, mainWindow);
    mainWindow.document.body.appendChild(dialog);
  }

  private async showGenericDialog(step: any): Promise<void> {
    const mainWindow = Zotero.getMainWindow();
    if (!mainWindow) return;

    const dialog = mainWindow.document.createElement('div');
    dialog.className = 'researchopia-onboarding-dialog';
    dialog.innerHTML = `
      <div class="onboarding-content">
        <h2>${step.title}</h2>
        <p>${step.content}</p>
        <div class="onboarding-buttons">
          <button id="onboarding-previous">上一步</button>
          <button id="onboarding-skip">跳过</button>
          <button id="onboarding-next" class="primary">下一步</button>
        </div>
      </div>
    `;

    this.attachDialogEvents(dialog, mainWindow);
    mainWindow.document.body.appendChild(dialog);
  }

  private async highlightElement(step: any): Promise<void> {
    // TODO: 实现元素高亮显示
    await this.showGenericDialog(step);
  }

  private attachDialogEvents(dialog: HTMLElement, window: Window): void {
    const nextBtn = dialog.querySelector('#onboarding-next') as HTMLButtonElement;
    const prevBtn = dialog.querySelector('#onboarding-previous') as HTMLButtonElement;
    const skipBtn = dialog.querySelector('#onboarding-skip') as HTMLButtonElement;
    const finishBtn = dialog.querySelector('#onboarding-finish') as HTMLButtonElement;
    const prefsBtn = dialog.querySelector('#onboarding-preferences') as HTMLButtonElement;

    if (nextBtn) {
      nextBtn.onclick = () => {
        this.removeDialog(window);
        OnboardingManager.nextStep();
      };
    }

    if (prevBtn) {
      prevBtn.onclick = () => {
        this.removeDialog(window);
        OnboardingManager.previousStep();
      };
    }

    if (skipBtn) {
      skipBtn.onclick = () => {
        this.removeDialog(window);
        OnboardingManager.skipOnboarding();
      };
    }

    if (finishBtn) {
      finishBtn.onclick = () => {
        this.removeDialog(window);
        OnboardingManager.completeOnboarding();
      };
    }

    if (prefsBtn) {
      prefsBtn.onclick = () => {
        // 打开首选项窗口
        (window as any).openDialog('chrome://zotero/content/preferences/preferences.xul', 
          'zotero-prefs', 'chrome,titlebar,toolbar,centerscreen,modal');
      };
    }
  }

  private removeDialog(window: Window): void {
    const dialogs = window.document.querySelectorAll('.researchopia-onboarding-dialog');
    dialogs.forEach(dialog => dialog.remove());
  }

  private async cleanupOnboardingUI(): Promise<void> {
    try {
      // 清理所有引导相关的UI元素
      const windows = Zotero.getMainWindows();
      for (const win of windows) {
        this.removeDialog(win);
      }
      
      logger.log("[OnboardingManager] Onboarding UI cleanup completed");
    } catch (error) {
      logger.error("[OnboardingManager] Error cleaning up onboarding UI:", error);
    }
  }

  public static cleanup(): void {
    const instance = OnboardingManager.getInstance();
    
    try {
      instance.cleanupOnboardingUI();
      instance.isOnboardingActive = false;
      instance.currentStep = 0;
      instance.onboardingSteps = [];
      
      OnboardingManager.instance = null;
      logger.log("[OnboardingManager] Cleanup completed");
    } catch (error) {
      logger.error("[OnboardingManager] Error during cleanup:", error);
    }
  }
}