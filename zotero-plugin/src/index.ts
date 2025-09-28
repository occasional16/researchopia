import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";

// Enable strict mode for Zotero 8 compatibility
"use strict";

const basicTool = new BasicTool();

// Initialize the addon only once
if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  // Create global addon instance
  _globalThis.addon = new Addon();
  
  // Define global ztoolkit getter
  defineGlobal("ztoolkit", () => {
    return _globalThis.addon.data.ztoolkit;
  });

  // Register addon instance on Zotero object
  (Zotero as any)[config.addonInstance] = addon;
  
  // Log successful initialization
  console.log(`${config.addonName} initialized successfully`);
}

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => any): void;
function defineGlobal(name: string, getter?: () => any) {
  Object.defineProperty(_globalThis, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
    configurable: true,
    enumerable: true,
  });
}
