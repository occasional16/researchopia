import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";

const basicTool = new BasicTool();

if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  // Initialize global addon instance
  const addonInstance = new Addon();
  _globalThis.addon = addonInstance;

  defineGlobal("ztoolkit", () => {
    return _globalThis.addon.data.ztoolkit;
  });

  (Zotero as any)[config.addonInstance] = addonInstance;
}

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => any): void;
function defineGlobal(name: string, getter?: () => any) {
  Object.defineProperty(_globalThis, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}
