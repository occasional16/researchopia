import { getString, initLocale } from "./utils/locale";
import { registerPrefs } from "./modules/prefs";
import { createZToolkit } from "./utils/ztoolkit";

const config = {
  addonName: "Researchopia",
  addonID: "researchopia@zotero.plugin",
  addonRef: "researchopia",
  addonInstance: "Researchopia",
  prefsPrefix: "extensions.zotero.researchopia"
};

export default {
  async onStartup() {
    ztoolkit.log("🚀 Starting Researchopia plugin");

    try {
      // Initialize locale
      initLocale();

      // Register preferences
      registerPrefs();

      // Initialize Supabase API
      await addon.api.supabase.initialize();

      // Register UI components
      await this.registerUI();

      // Register item pane
      this.registerItemPane();

      ztoolkit.log(`${config.addonName} loaded successfully!`);
    } catch (error) {
      ztoolkit.log(`❌ Plugin startup failed: ${(error as Error).message}`);
      ztoolkit.log(`❌ Stack trace: ${(error as Error).stack}`);
    }
  },

  async onShutdown() {
    // Remove UI components
    ztoolkit.unregisterAll();

    // Clean up
    ztoolkit.log(`${config.addonName} shutdown complete.`);
  },

  async registerUI() {

    // Register menu items
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: "researchopia-extract-annotations",
      label: getString("researchopia-menu-extract"),
      commandListener: () => this.extractAnnotations(),
      icon: `chrome://researchopia/content/icons/extract.png`,
    });

    ztoolkit.Menu.register("item", {
      tag: "menuitem", 
      id: "researchopia-share-annotations",
      label: getString("researchopia-menu-share"),
      commandListener: () => this.shareAnnotations(),
      icon: `chrome://researchopia/content/icons/share.png`,
    });

    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: "researchopia-view-shared",
      label: getString("researchopia-menu-view"),
      commandListener: () => this.viewSharedAnnotations(),
      icon: `chrome://researchopia/content/icons/view.png`,
    });
  },

  registerItemPane() {
    try {
      ztoolkit.log("📋 Registering Item Pane...");
      Zotero.ItemPaneManager.registerSection({
        paneID: "researchopia",
        pluginID: config.addonID,
        header: {
          l10nID: "researchopia-item-section-head-text",
          icon: `chrome://${config.addonRef}/content/icons/favicon.png`,
        },
        sidenav: {
          l10nID: "researchopia-item-section-sidenav-tooltip",
          icon: `chrome://${config.addonRef}/content/icons/favicon.png`,
        },
        onRender: ({ body, item, editable, tabType }) => {
          ztoolkit.log("🎨 Rendering Item Pane for item:", item?.key);
          addon.ui.renderPane(body, item);
        },
      });
      ztoolkit.log("✅ Item Pane registered successfully");
    } catch (error) {
      ztoolkit.log(`❌ Failed to register Item Pane: ${(error as Error).message}`);
    }
  },

  async extractAnnotations() {
    const items = ZoteroPane.getSelectedItems();
    if (!items.length) return;

    const item = items[0];
    const annotations = await addon.ui.extractAnnotations(item);

    if (annotations.length > 0) {
      ztoolkit.getGlobal("alert")(
        `${getString("researchopia-message-success")}: ${annotations.length} annotations extracted`
      );
    }
  },

  async shareAnnotations() {
    const items = ZoteroPane.getSelectedItems();
    if (!items.length) return;

    try {
      const item = items[0];
      const annotations = await addon.ui.extractAnnotations(item);

      if (annotations.length === 0) {
        ztoolkit.getGlobal("alert")("No annotations found to share");
        return;
      }

      await addon.api.supabase.uploadAnnotations(annotations);

      ztoolkit.getGlobal("alert")(
        `${getString("researchopia-message-success")}: ${annotations.length} annotations shared`
      );
    } catch (error) {
      ztoolkit.getGlobal("alert")(
        getString("researchopia-message-error", { error: (error as Error).message })
      );
    }
  },

  async viewSharedAnnotations() {
    const items = ZoteroPane.getSelectedItems();
    if (!items.length) return;

    try {
      const item = items[0];
      const doi = item.getField("DOI");

      if (!doi) {
        ztoolkit.getGlobal("alert")("No DOI found for this item");
        return;
      }

      const sharedAnnotations = await addon.api.supabase.getSharedAnnotations(doi);

      ztoolkit.getGlobal("alert")(
        `Found ${sharedAnnotations.length} shared annotations`
      );
    } catch (error) {
      ztoolkit.getGlobal("alert")(
        getString("researchopia-message-error", { error: (error as Error).message })
      );
    }
  },
};
