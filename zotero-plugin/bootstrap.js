/*
  Academic Rating for Zotero - Bootstrap Plugin
  Integrates Academic Rating functionality into Zotero 7/8 using Item Pane sections
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
  try { Zotero.debug("Academic Rating: " + msg); } catch {}
}

async function startup(data, reason) {
  const { id, version, resourceURI } = data || {};
  const rootURI = resourceURI ? resourceURI.spec : (data?.rootURI || "");
  log("Starting up Academic Rating plugin v" + (version || ""));

  try { await Zotero.initializationPromise; } catch {}

  // Initialize the main plugin object
  if (!Zotero.AcademicRating) {
    Services.scriptloader.loadSubScript(rootURI + "academic-rating.js");
  }

  // Initialize plugin with root URI
  Zotero.AcademicRating.init({ id, version, rootURI });
  Zotero.AcademicRating.addToAllWindows();
  try { await Zotero.AcademicRating.main(); } catch {}

  log("Academic Rating plugin started successfully");
}

function shutdown(data, reason) {
  log("Shutting down Academic Rating plugin");
  try {
    if (Zotero.AcademicRating) {
      Zotero.AcademicRating.removeFromAllWindows();
    }
  } catch {}
}

function install(data, reason) {
  const version = data?.version || "";
  log(`Academic Rating plugin ${version} installed`);
}

function uninstall(data, reason) {
  const version = data?.version || "";
  log(`Academic Rating plugin ${version} uninstalled`);
}

// For compatibility with some bootstrap loaders expecting exported symbols
var EXPORTED_SYMBOLS = ["startup", "shutdown", "install", "uninstall"]; 
