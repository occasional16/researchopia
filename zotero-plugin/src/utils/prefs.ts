import { config } from "../../package.json";

export function getPref(key: string): string | number | boolean | undefined {
  return Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
}

export function setPref(
  key: string,
  value: string | number | boolean,
): string | number | boolean | undefined {
  return Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, value, true);
}

export function clearPref(key: string): void {
  return Zotero.Prefs.clear(`${config.prefsPrefix}.${key}`, true);
}
