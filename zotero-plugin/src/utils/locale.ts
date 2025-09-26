import { config } from "../../package.json";

export function initLocale() {
  addon.data.locale = {
    current: Zotero.locale,
  };
}

export function getString(
  key: string,
  ...args: Array<string | number>
): string {
  if (!addon.data.locale?.current) {
    return key;
  }
  const stringBundle = Services.strings.createBundle(
    `chrome://${config.addonRef}/locale/${addon.data.locale.current}/${config.addonRef}.properties`,
  );
  try {
    if (args.length === 0) {
      return stringBundle.GetStringFromName(key);
    } else {
      return stringBundle.formatStringFromName(key, args);
    }
  } catch (e) {
    return key;
  }
}
