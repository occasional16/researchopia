/**
 * Researchopia Preferences Initialization Script
 */

(async function() {
  if (typeof Zotero === 'undefined') {
    return;
  }

  Zotero.debug("[Researchopia Prefs] Initializing...");

  // Wait for addon
  let attempts = 0;
  while (!Zotero.Researchopia && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (!Zotero.Researchopia) {
    Zotero.debug("[Researchopia Prefs] Addon not available");
    return;
  }

  try {
    if (Zotero.Researchopia.registerPrefsScripts) {
      await Zotero.Researchopia.registerPrefsScripts(window);
      Zotero.debug("[Researchopia Prefs] Scripts registered");
    }
  } catch (error) {
    Zotero.debug("[Researchopia Prefs] Error: " + error);
  }
})();