import { BasicTool, unregister } from "zotero-plugin-toolkit";

export { unregister };

export function createZToolkit() {
  const _ztoolkit = new BasicTool();
  initZToolkit(_ztoolkit);
  return _ztoolkit;
}

function initZToolkit(_ztoolkit: BasicTool) {
  const env = __env__;
  _ztoolkit.basicOptions.log.prefix = `[${addon.data.config.addonName}]`;
  _ztoolkit.basicOptions.log.disableConsole = env === "production";
  // @ts-expect-error - UI property exists on BasicTool
  _ztoolkit.UI.basicOptions.ui.enableElementJSONLog = __env__ === "development";
  // @ts-expect-error - UI property exists on BasicTool
  _ztoolkit.UI.basicOptions.ui.enableElementDOMLog = __env__ === "development";
  _ztoolkit.basicOptions.debug.disableDebugBridgePassword =
    __env__ === "development";
  _ztoolkit.basicOptions.api.pluginID = addon.data.config.addonID;
  // @ts-expect-error - ProgressWindow property exists on BasicTool
  _ztoolkit.ProgressWindow.setIconURI(
    "default",
    `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  );
}
