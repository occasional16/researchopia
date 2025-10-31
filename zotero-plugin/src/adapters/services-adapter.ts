/**
 * Services API适配器
 * 统一Zotero 7/8的Services调用接口
 */

import { ModuleAdapter } from './module-adapter';

export class ServicesAdapter {
  private static services: any = null;

  /**
   * 获取Services对象
   */
  private static getServices(): any {
    if (!this.services) {
      this.services = ModuleAdapter.importServices();
    }
    return this.services;
  }

  /**
   * 显示提示对话框
   */
  static alert(title: string, message: string): void {
    const Services = this.getServices();
    Services.prompt.alert(null, title, message);
  }

  /**
   * 显示确认对话框
   */
  static confirm(title: string, message: string): boolean {
    const Services = this.getServices();
    return Services.prompt.confirm(null, title, message);
  }

  /**
   * 显示输入对话框
   */
  static prompt(title: string, message: string, defaultValue: string = ''): string | null {
    const Services = this.getServices();
    const input = { value: defaultValue };
    const result = Services.prompt.prompt(null, title, message, input, null, {});
    return result ? input.value : null;
  }

  /**
   * 打开URL
   */
  static openURL(url: string): void {
    const Services = this.getServices();
    const ioService = Services.io;
    const uri = ioService.newURI(url, null, null);
    Services.ww.openWindow(
      null,
      uri.spec,
      '_blank',
      'chrome,dialog=no,all',
      null
    );
  }
}
