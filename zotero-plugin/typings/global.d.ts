import Addon from "../src/addon";
import { BasicTool } from "zotero-plugin-toolkit";

declare global {
  var _globalThis: {
    [key: string]: any;
    addon: Addon;
  };

  var addon: Addon;
  var ztoolkit: BasicTool;
  var __env__: "development" | "production";

  interface Window {
    MozXULElement: any;
  }

  // XUL types
  namespace XUL {
    interface Element extends Node {
      setAttribute(name: string, value: string): void;
      getAttribute(name: string): string | null;
      removeAttribute(name: string): void;
      hasAttribute(name: string): boolean;
      querySelector(selectors: string): Element | null;
      querySelectorAll(selectors: string): NodeListOf<Element>;
      appendChild<T extends Node>(node: T): T;
      removeChild<T extends Node>(node: T): T;
      innerHTML: string;
      textContent: string | null;
      style: CSSStyleDeclaration;
      ownerDocument: Document;
      addEventListener(type: string, listener: EventListener | ((e: Event) => void), options?: AddEventListenerOptions): void;
      removeEventListener(type: string, listener: EventListener, options?: EventListenerOptions): void;
      click(): void;
    }
  }

  interface Document {
    createXULElement(tagName: string): XUL.Element;
  }

  // Zotero types
  var Zotero: {
    initializationPromise: Promise<void>;
    unlockPromise: Promise<void>;
    uiReadyPromise: Promise<void>;
    getMainWindows(): any[];
    getMainWindow(): any;
    locale: string;
    Promise: {
      delay(ms: number): Promise<void>;
    };
    Items: {
      get(id: number): any;
    };
    Prefs: {
      get(key: string, global?: boolean): any;
      set(key: string, value: any, global?: boolean): any;
      clear(key: string, global?: boolean): void;
    };
    ItemPaneManager?: {
      registerSection(config: any): void;
    };
  };

  var Services: {
    strings: {
      createBundle(url: string): any;
    };
    wm: {
      getMostRecentWindow(type: string): Window | null;
    };
    io: {
      newURI(url: string, charset: string | null, baseURI: any): any;
    };
  };

  var Components: {
    classes: any;
    interfaces: any;
  };

  namespace _ZoteroTypes {
    interface MainWindow extends Window {
      MozXULElement: any;
    }
  }
}

export {};
