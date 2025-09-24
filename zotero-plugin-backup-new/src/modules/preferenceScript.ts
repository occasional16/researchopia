import { getPref, setPref } from "../utils/prefs";

const config = {
  addonName: "Researchopia",
  addonID: "researchopia@zotero.plugin",
  addonRef: "researchopia",
  addonInstance: "Researchopia",
  prefsPrefix: "extensions.zotero.researchopia"
};

export class PreferenceScript {
  private addon: any;

  constructor(addon: any) {
    this.addon = addon;
  }

  /**
   * Initialize preference pane
   */
  initPreferences() {
    const ztoolkit = this.addon.data.ztoolkit;
    
    // Register preference pane
    ztoolkit.PreferencePane.register({
      pluginID: config.addonID,
      src: rootURI + "content/preferences.xhtml",
      label: "Researchopia",
      image: `chrome://${config.addonRef}/content/icons/favicon.png`,
      defaultXUL: true,
    });
  }

  /**
   * Handle preference pane events
   */
  onPreferenceLoad(win: Window) {
    const doc = win.document;
    
    // Initialize UI elements
    this.initializeUI(doc);
    
    // Bind events
    this.bindEvents(doc);
    
    // Load current values
    this.loadPreferences(doc);
  }

  private initializeUI(doc: Document) {
    // Add test connection button
    const testButton = doc.createElement("button");
    testButton.id = "researchopia-test-connection";
    testButton.textContent = "Test Supabase Connection";
    testButton.style.marginTop = "10px";
    
    const supabaseSection = doc.getElementById("researchopia-supabase-key")?.parentElement;
    if (supabaseSection) {
      supabaseSection.appendChild(testButton);
    }

    // Add status indicator
    const statusLabel = doc.createElement("label");
    statusLabel.id = "researchopia-connection-status";
    statusLabel.style.marginTop = "5px";
    statusLabel.style.color = "#666";
    statusLabel.textContent = "Connection status: Not tested";
    
    if (supabaseSection) {
      supabaseSection.appendChild(statusLabel);
    }

    // Add annotation count display
    const countLabel = doc.createElement("label");
    countLabel.id = "researchopia-annotation-count";
    countLabel.style.marginTop = "10px";
    countLabel.style.fontWeight = "bold";
    countLabel.textContent = "Shared annotations: Loading...";
    
    const mainSection = doc.querySelector("groupbox");
    if (mainSection) {
      mainSection.appendChild(countLabel);
    }
  }

  private bindEvents(doc: Document) {
    // Test connection button
    const testButton = doc.getElementById("researchopia-test-connection");
    if (testButton) {
      testButton.addEventListener("click", () => this.testConnection(doc));
    }

    // Auto-save preferences on change
    const inputs = doc.querySelectorAll("textbox, checkbox");
    inputs.forEach(input => {
      input.addEventListener("change", () => this.savePreferences(doc));
    });

    // Load annotation count on enable
    const enableCheckbox = doc.getElementById("researchopia-enable");
    if (enableCheckbox) {
      enableCheckbox.addEventListener("change", () => {
        if ((enableCheckbox as any).checked) {
          this.loadAnnotationCount(doc);
        }
      });
    }
  }

  private loadPreferences(doc: Document) {
    // Load current preference values
    const enable = getPref("enable") as boolean;
    const supabaseUrl = getPref("supabaseUrl") as string;
    const supabaseKey = getPref("supabaseKey") as string;
    const autoShare = getPref("autoShare") as boolean;
    const notifications = getPref("showNotifications") as boolean;
    const debug = getPref("debugMode") as boolean;

    // Set UI values
    const enableCheckbox = doc.getElementById("researchopia-enable") as any;
    if (enableCheckbox) enableCheckbox.checked = enable;

    const urlTextbox = doc.getElementById("researchopia-supabase-url") as any;
    if (urlTextbox) urlTextbox.value = supabaseUrl || "";

    const keyTextbox = doc.getElementById("researchopia-supabase-key") as any;
    if (keyTextbox) keyTextbox.value = supabaseKey || "";

    const autoShareCheckbox = doc.getElementById("researchopia-auto-share") as any;
    if (autoShareCheckbox) autoShareCheckbox.checked = autoShare;

    const notificationsCheckbox = doc.getElementById("researchopia-notifications") as any;
    if (notificationsCheckbox) notificationsCheckbox.checked = notifications;

    const debugCheckbox = doc.getElementById("researchopia-debug") as any;
    if (debugCheckbox) debugCheckbox.checked = debug;

    // Load annotation count if enabled
    if (enable) {
      this.loadAnnotationCount(doc);
    }
  }

  private savePreferences(doc: Document) {
    // Save all preference values
    const enableCheckbox = doc.getElementById("researchopia-enable") as any;
    if (enableCheckbox) setPref("enable", enableCheckbox.checked);

    const urlTextbox = doc.getElementById("researchopia-supabase-url") as any;
    if (urlTextbox) setPref("supabaseUrl", urlTextbox.value);

    const keyTextbox = doc.getElementById("researchopia-supabase-key") as any;
    if (keyTextbox) setPref("supabaseKey", keyTextbox.value);

    const autoShareCheckbox = doc.getElementById("researchopia-auto-share") as any;
    if (autoShareCheckbox) setPref("autoShare", autoShareCheckbox.checked);

    const notificationsCheckbox = doc.getElementById("researchopia-notifications") as any;
    if (notificationsCheckbox) setPref("showNotifications", notificationsCheckbox.checked);

    const debugCheckbox = doc.getElementById("researchopia-debug") as any;
    if (debugCheckbox) setPref("debugMode", debugCheckbox.checked);

    this.addon.data.ztoolkit.log("Preferences saved");
  }

  private async testConnection(doc: Document) {
    const statusLabel = doc.getElementById("researchopia-connection-status");
    const testButton = doc.getElementById("researchopia-test-connection") as any;
    
    if (!statusLabel || !testButton) return;

    // Disable button and show testing status
    testButton.disabled = true;
    testButton.textContent = "Testing...";
    statusLabel.textContent = "Connection status: Testing...";
    statusLabel.style.color = "#666";

    try {
      // Test connection using current settings
      const url = (doc.getElementById("researchopia-supabase-url") as any)?.value;
      const key = (doc.getElementById("researchopia-supabase-key") as any)?.value;

      if (!url || !key) {
        throw new Error("Please enter both Supabase URL and API key");
      }

      // Simple connection test
      const response = await fetch(`${url}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
        }
      });

      if (response.ok) {
        statusLabel.textContent = "Connection status: ✅ Connected successfully";
        statusLabel.style.color = "#28a745";
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      statusLabel.textContent = `Connection status: ❌ ${(error as Error).message}`;
      statusLabel.style.color = "#dc3545";
    } finally {
      // Re-enable button
      testButton.disabled = false;
      testButton.textContent = "Test Supabase Connection";
    }
  }

  private async loadAnnotationCount(doc: Document) {
    const countLabel = doc.getElementById("researchopia-annotation-count");
    if (!countLabel) return;

    try {
      countLabel.textContent = "Shared annotations: Loading...";
      
      // Get count from Supabase API
      const count = await this.addon.api.supabase.getAnnotationCount();
      countLabel.textContent = `Shared annotations: ${count} total`;
      countLabel.style.color = "#28a745";
      
    } catch (error) {
      countLabel.textContent = "Shared annotations: Error loading count";
      countLabel.style.color = "#dc3545";
    }
  }

  /**
   * Handle preference pane unload
   */
  onPreferenceUnload(win: Window) {
    // Cleanup if needed
    this.addon.data.ztoolkit.log("Preference pane unloaded");
  }
}
