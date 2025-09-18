/*
  Researchopia for Zotero - Bootstrap Plugin
  Integrates Researchopia functionality into Zotero 7/8 using Item Pane sections
  Based on official make-it-red plugin structure
*/

// Ensure Services is available in bootstrap scope
try {
  // eslint-disable-next-line no-undef
  if (typeof Services === 'undefined') {
    // eslint-disable-next-line no-undef
    var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
  }
} catch (e) {
  // Ignore; Zotero provides Services in most contexts
}

function log(msg) {
  try { Zotero.debug("Researchopia: " + msg); } catch {}
}

async function startup(data, reason) {
  const { id, version, resourceURI } = data || {};
  const rootURI = resourceURI ? resourceURI.spec : (data?.rootURI || "");
  log("Starting up Researchopia plugin v" + (version || ""));

  try { await Zotero.initializationPromise; } catch {}

  // Initialize the main plugin object
  if (!Zotero.Researchopia) {
    Services.scriptloader.loadSubScript(rootURI + "researchopia.js");
  }

  // Load DOI handler and annotation sharing modules
  try {
    Services.scriptloader.loadSubScript(rootURI + "doi-handler.js");
    log("DOI handler loaded");
  } catch (e) {
    log("Failed to load DOI handler: " + e);
  }

  try {
    Services.scriptloader.loadSubScript(rootURI + "doi-annotation-sharing.js");
    log("DOI annotation sharing loaded");
  } catch (e) {
    log("Failed to load DOI annotation sharing: " + e);
  }
  
  try {
    Services.scriptloader.loadSubScript(rootURI + "annotation-sharing.js");
    log("Annotation sharing module loaded");
  } catch (e) {
    log("Failed to load annotation sharing module: " + e);
  }

  // Initialize plugin with root URI
  Zotero.Researchopia.init({ id, version, rootURI });
  Zotero.Researchopia.addToAllWindows();
  try { await Zotero.Researchopia.main(); } catch {}

  log("Researchopia plugin started successfully");
}

function shutdown(data, reason) {
  log("Shutting down Researchopia plugin");
  try {
    if (Zotero.Researchopia) {
      // 统一注销注册的 Section 等资源
      try { Zotero.Researchopia.unregisterItemPaneSection?.(); } catch {}
      Zotero.Researchopia.removeFromAllWindows();
    }
  } catch {}
}

function install(data, reason) {
  const version = data?.version || "";
  log(`Researchopia plugin ${version} installed`);
}

function uninstall(data, reason) {
  const version = data?.version || "";
  log(`Researchopia plugin ${version} uninstalled`);
}

// For compatibility with some bootstrap loaders expecting exported symbols
var EXPORTED_SYMBOLS = ["startup", "shutdown", "install", "uninstall"]; 
