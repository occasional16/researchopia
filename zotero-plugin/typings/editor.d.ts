/**
 * 编辑器相关类型定义
 */

/**
 * 编辑器元素接口
 */
export interface EditorElement extends HTMLElement {
  _bnScrollHooked?: boolean;
  _editorInstance?: Zotero.EditorInstance;
  notify?: (
    event: string,
    type: string,
    ids: number[],
    extraData: any
  ) => Promise<void>;
}

declare global {
  namespace Zotero {
    /**
     * 编辑器实例接口
     */
    interface EditorInstance {
      _iframeWindow?: Window;
      _initPromise?: Promise<void>;
      instanceID?: string;
      getCurrentInstance?: () => Zotero.EditorInstance | null;
    }

    /**
     * Notifier 接口
     */
    interface Notifier {
      registerObserver(
        observer: {
          notify: (
            event: string,
            type: string,
            ids: number[] | string[],
            extraData: any
          ) => Promise<void> | void;
        },
        types: string[]
      ): string;
      unregisterObserver(id: string): void;
    }

    /**
     * Reader 接口
     */
    interface Reader {
      getByTabID(tabID: string): any;
    }

    /**
     * ZoteroPane 接口
     */
    interface ZoteroPane {
      document: Document;
      getCurrentEditor?: () => Zotero.EditorInstance | null;
    }

    const Notifier: Notifier;
    const Reader: Reader;
    function getActiveZoteroPane(): ZoteroPane | null;
  }

  /**
   * Zotero Tabs 全局变量
   */
  const Zotero_Tabs: {
    selectedID: string;
  };
}
