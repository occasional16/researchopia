import { config } from "../package.json";
import { ColumnOptions, DialogHelper } from "zotero-plugin-toolkit";
import hooks from "./hooks";
import { createZToolkit } from "./utils/ztoolkit";

// Keep it simple for now - we'll add modules back gradually

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    // Env type, see build.js
    env: "development" | "production";
    initialized?: boolean;
    ztoolkit: ZToolkit;
    locale?: {
      current: any;
    };
    prefs?: {
      window: Window;
      columns: Array<ColumnOptions>;
      rows: Array<{ [dataKey: string]: string }>;
    };
    dialog?: DialogHelper;
  };

  // Lifecycle hooks
  public hooks: typeof hooks;

  // APIs - simplified for now
  public api: object;

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      initialized: false,
      ztoolkit: createZToolkit(),
    };
    this.hooks = hooks;
    this.api = {};

    // Simple initialization
    try {
      if (this.data.env === 'development') {
        this.data.ztoolkit.log('🔍 开发模式已启动');
      }
      this.data.ztoolkit.log('✅ Addon constructor completed successfully');
    } catch (error) {
      // Fallback to basic error handling if ztoolkit fails
      if (this.data.ztoolkit && this.data.ztoolkit.log) {
        this.data.ztoolkit.log(`❌ Addon constructor failed: ${(error as Error).message}`);
      }
    }
  }


}

export default Addon;
