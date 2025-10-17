import { ZoteroToolkit, unregister } from "zotero-plugin-toolkit";

export { unregister };

export function createZToolkit() {
  const _ztoolkit = new ZoteroToolkit();
  initZToolkit(_ztoolkit);
  return _ztoolkit;
}

function initZToolkit(_ztoolkit: ReturnType<typeof createZToolkit>) {
  const env = __env__;
  
  // Get addon safely
  const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
  
  if (addon) {
    _ztoolkit.basicOptions.log.prefix = `[${addon.data.config.addonName}]`;
    _ztoolkit.basicOptions.api.pluginID = addon.data.config.addonID;
    _ztoolkit.ProgressWindow.setIconURI(
      "default",
      `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
    );
  } else {
    // Fallback values if addon is not available
    _ztoolkit.basicOptions.log.prefix = `[Researchopia]`;
    _ztoolkit.basicOptions.api.pluginID = "researchopia@zotero.plugin";
    _ztoolkit.ProgressWindow.setIconURI(
      "default",
      `chrome://researchopia/content/icons/favicon.png`,
    );
  }
  
  _ztoolkit.basicOptions.log.disableConsole = env === "production";
  _ztoolkit.UI.basicOptions.ui.enableElementJSONLog = __env__ === "development";
  _ztoolkit.UI.basicOptions.ui.enableElementDOMLog = __env__ === "development";
  _ztoolkit.basicOptions.debug.disableDebugBridgePassword =
    __env__ === "development";
}
