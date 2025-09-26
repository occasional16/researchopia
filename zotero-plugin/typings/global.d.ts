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
  };

  var Services: {
    strings: {
      createBundle(url: string): any;
    };
    wm: {
      getMostRecentWindow(type: string): Window | null;
    };
  };

  namespace _ZoteroTypes {
    interface MainWindow extends Window {
      MozXULElement: any;
    }
  }
}

export {};
