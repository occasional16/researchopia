const config = {
  addonName: "Researchopia",
  addonID: "researchopia@zotero.plugin",
  addonRef: "researchopia",
  addonInstance: "Researchopia",
  prefsPrefix: "extensions.zotero.researchopia"
};

export function initLocale() {
  const stringBundle = Services.strings.createBundle(
    `chrome://${config.addonRef}/locale/addon.properties`,
  );
  
  Zotero.Researchopia.data.locale = {
    current: stringBundle,
  };
}

export function getString(key: string, params?: Record<string, any>): string {
  try {
    const bundle = Zotero.Researchopia.data.locale?.current;
    if (!bundle) {
      return key;
    }
    
    if (params) {
      // Handle Fluent-style parameters
      let str = bundle.GetStringFromName(key);
      for (const [paramKey, paramValue] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{ *${paramKey} *\\}`, 'g'), String(paramValue));
      }
      return str;
    }
    
    return bundle.GetStringFromName(key);
  } catch (e) {
    return key;
  }
}
