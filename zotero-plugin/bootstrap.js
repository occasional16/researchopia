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
  
  // Load core system modules first
  try {
    Services.scriptloader.loadSubScript(rootURI + "error-handler.js");
    log("Error handler loaded");
  } catch (e) {
    log("Failed to load error handler: " + e);
  }

  try {
    Services.scriptloader.loadSubScript(rootURI + "feedback-system.js");
    log("Feedback system loaded");
  } catch (e) {
    log("Failed to load feedback system: " + e);
  }

  try {
    Services.scriptloader.loadSubScript(rootURI + "diagnostic-tool.js");
    log("Diagnostic tool loaded");
  } catch (e) {
    log("Failed to load diagnostic tool: " + e);
  }

  try {
    Services.scriptloader.loadSubScript(rootURI + "annotation-share-dialog.js");
    log("Annotation share dialog loaded");
  } catch (e) {
    log("Failed to load annotation share dialog: " + e);
  }

  try {
    Services.scriptloader.loadSubScript(rootURI + "doi-annotation-display.js");
    log("DOI annotation display loaded");
  } catch (e) {
    log("Failed to load DOI annotation display: " + e);
  }

  // Load authentication manager (other modules depend on it)
  try {
    Services.scriptloader.loadSubScript(rootURI + "auth-manager.js");
    log("Authentication manager loaded");
  } catch (e) {
    log("Failed to load authentication manager: " + e);
  }

  try {
    Services.scriptloader.loadSubScript(rootURI + "annotation-sharing.js");
    log("Annotation sharing module loaded");
  } catch (e) {
    log("Failed to load annotation sharing module: " + e);
  }

  // Load user interface module
  try {
    Services.scriptloader.loadSubScript(rootURI + "user-interface.js");
    log("User interface module loaded");
  } catch (e) {
    log("Failed to load user interface module: " + e);
  }

  // Load annotation selector module
  try {
    Services.scriptloader.loadSubScript(rootURI + "annotation-selector.js");
    log("Annotation selector module loaded");
  } catch (e) {
    log("Failed to load annotation selector module: " + e);
  }

  // Load social features module
  try {
    Services.scriptloader.loadSubScript(rootURI + "social-features.js");
    log("Social features module loaded");
  } catch (e) {
    log("Failed to load social features module: " + e);
  }

  // Load annotation browser module
  try {
    Services.scriptloader.loadSubScript(rootURI + "annotation-browser.js");
    log("Annotation browser module loaded");
  } catch (e) {
    log("Failed to load annotation browser module: " + e);
  }

  // Load privacy manager module
  try {
    Services.scriptloader.loadSubScript(rootURI + "privacy-manager.js");
    log("Privacy manager module loaded");
  } catch (e) {
    log("Failed to load privacy manager module: " + e);
  }

  // Load collaboration manager module
  try {
    Services.scriptloader.loadSubScript(rootURI + "collaboration-manager.js");
    log("Collaboration manager module loaded");
  } catch (e) {
    log("Failed to load collaboration manager module: " + e);
  }

  // Initialize plugin with root URI
  Zotero.Researchopia.init({ id, version, rootURI });
  Zotero.Researchopia.addToAllWindows();
  try { await Zotero.Researchopia.main(); } catch {}

  // Initialize core systems first
  try {
    if (typeof ErrorHandler !== 'undefined') {
      ErrorHandler.init();
      log("Error handler initialized");
    }
  } catch (e) {
    log("Failed to initialize error handler: " + e);
  }

  try {
    if (typeof FeedbackSystem !== 'undefined') {
      FeedbackSystem.init();
      log("Feedback system initialized");
    }
  } catch (e) {
    log("Failed to initialize feedback system: " + e);
  }

  try {
    if (typeof DiagnosticTool !== 'undefined') {
      DiagnosticTool.init();
      log("Diagnostic tool initialized");
    }
  } catch (e) {
    log("Failed to initialize diagnostic tool: " + e);
  }

  // Start up all plugin modules
  try {
    Zotero.Researchopia.startup();
  } catch (e) {
    log("Failed to startup plugin modules: " + e);
  }

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
