/**
 * Minimal test bootstrap for debugging
 */

var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  try {
    Zotero.debug("Researchopia: Bootstrap startup called");
    
    var aomStartup = Components.classes[
      "@mozilla.org/addons/addon-manager-startup;1"
    ].getService(Components.interfaces.amIAddonManagerStartup);
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "researchopia", rootURI + "content/"],
    ]);

    Zotero.debug("Researchopia: Chrome registered");

    // Test preference pane registration
    if (Zotero.PreferencePanes) {
      Zotero.debug("Researchopia: Registering preference pane");
      Zotero.PreferencePanes.register({
        pluginID: 'researchopia@zotero.plugin',
        src: rootURI + 'content/preferences.xhtml',
        scripts: [rootURI + 'content/preferences.js'],
        stylesheets: [rootURI + 'content/preferences.css'],
      });
      Zotero.debug("Researchopia: Preference pane registered");
    } else {
      Zotero.debug("Researchopia: PreferencePanes not available");
    }

    // Test item pane registration
    if (Zotero.ItemPaneManager) {
      Zotero.debug("Researchopia: Registering item pane section");
      const registeredID = Zotero.ItemPaneManager.registerSection({
        paneID: "researchopia-test",
        pluginID: 'researchopia@zotero.plugin',
        header: {
          l10nID: "researchopia-annotations-header",
          icon: rootURI + "content/icons/favicon.png",
        },
        sidenav: {
          l10nID: "researchopia-annotations-sidenav",
          icon: rootURI + "content/icons/favicon.png",
        },
        onRender: ({ body, item }) => {
          body.innerHTML = "<div><h3>Researchopia Test</h3><p>Plugin is working!</p></div>";
        },
      });
      Zotero.debug("Researchopia: Item pane section registered with ID:", registeredID);
    } else {
      Zotero.debug("Researchopia: ItemPaneManager not available");
    }

    Zotero.debug("Researchopia: Bootstrap startup completed");
  } catch (error) {
    Zotero.debug("Researchopia: Bootstrap startup error:", error);
  }
}

async function onMainWindowLoad({ window }, reason) {
  Zotero.debug("Researchopia: Main window load called");
}

async function onMainWindowUnload({ window }, reason) {
  Zotero.debug("Researchopia: Main window unload called");
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  Zotero.debug("Researchopia: Bootstrap shutdown called");

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function uninstall(data, reason) {}
