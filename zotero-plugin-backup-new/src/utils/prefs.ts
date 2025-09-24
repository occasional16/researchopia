const config = {
  addonName: "Researchopia",
  addonID: "researchopia@zotero.plugin",
  addonRef: "researchopia",
  addonInstance: "Researchopia",
  prefsPrefix: "extensions.zotero.researchopia"
};

export function getPref(key: string): string | number | boolean {
  return Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
}

export function setPref(key: string, value: string | number | boolean): void {
  Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, value, true);
}

export function clearPref(key: string): void {
  Zotero.Prefs.clear(`${config.prefsPrefix}.${key}`, true);
}
