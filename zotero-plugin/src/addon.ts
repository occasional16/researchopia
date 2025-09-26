import { config } from "../package.json";
import { ColumnOptions, DialogHelper, BasicTool } from "zotero-plugin-toolkit";
import hooks from "./hooks";
import { createZToolkit } from "./utils/ztoolkit";

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    // Env type, see build.js
    env: "development" | "production";
    initialized?: boolean;
    ztoolkit: BasicTool;
    locale?: {
      current: any;
    };
    prefs?: {
      window: Window;
      columns: Array<ColumnOptions>;
      rows: Array<{ [dataKey: string]: string }>;
    };
    dialog?: DialogHelper;
    // Researchopia specific data
    auth?: {
      user: any;
      session: any;
      isLoggedIn: boolean;
    };
    annotations?: {
      shared: any[];
      local: any[];
    };
  };
  // Lifecycle hooks
  public hooks: typeof hooks;
  // APIs
  public api: object;

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      initialized: false,
      ztoolkit: createZToolkit(),
      auth: {
        user: null,
        session: null,
        isLoggedIn: false,
      },
      annotations: {
        shared: [],
        local: [],
      },
    };
    this.hooks = hooks;
    this.api = {};
  }
}

export default Addon;
