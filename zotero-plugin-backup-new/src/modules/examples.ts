import { getString } from "../utils/locale";

/**
 * Examples for Researchopia plugin
 * These examples demonstrate how to use zotero-plugin-toolkit APIs
 */

export class Examples {
  private addon: any;

  constructor(addon: any) {
    this.addon = addon;
  }

  /**
   * @example Basic notification example
   */
  registerNotifier() {
    const callback = {
      notify: async (
        event: string,
        type: string,
        ids: number[] | string[],
        extraData: { [key: string]: any }
      ) => {
        if (!this.addon.data.alive) return;
        
        this.addon.data.ztoolkit.log(
          `Notifier triggered: ${event}, ${type}, ${ids}, ${JSON.stringify(extraData)}`
        );

        // Handle annotation events for auto-sharing
        if (type === "item" && event === "add") {
          for (const id of ids) {
            const item = await Zotero.Items.getAsync(id as number);
            if (item && item.isAnnotation()) {
              this.addon.data.ztoolkit.log("New annotation detected:", item.key);
              // Could trigger auto-sharing here if enabled in preferences
            }
          }
        }
      },
    };

    // Register the callback
    const notifierID = Zotero.Notifier.registerObserver(callback, [
      "tab",
      "item",
      "file",
    ]);

    // Unregister callback when the plugin is disabled
    this.addon.data.ztoolkit.unregister(notifierID);
  }

  /**
   * @example Register shortcuts
   */
  registerShortcuts() {
    const ztoolkit = this.addon.data.ztoolkit;
    
    // Register shortcut for quick annotation extraction
    ztoolkit.Shortcut.register("event", {
      id: "researchopia-extract-shortcut",
      key: "E",
      modifiers: "accel,shift",
      callback: (keyOptions) => {
        this.addon.data.ztoolkit.log("Extract annotations shortcut triggered");
        this.addon.extractAnnotations();
      },
    });

    // Register shortcut for quick sharing
    ztoolkit.Shortcut.register("event", {
      id: "researchopia-share-shortcut", 
      key: "S",
      modifiers: "accel,shift",
      callback: (keyOptions) => {
        this.addon.data.ztoolkit.log("Share annotations shortcut triggered");
        this.addon.shareAnnotations();
      },
    });
  }

  /**
   * @example Register custom column in library view
   */
  registerExtraColumn() {
    const ztoolkit = this.addon.data.ztoolkit;
    
    ztoolkit.ExtraColumn.register({
      pluginID: this.addon.data.config.addonID,
      dataKey: "sharedAnnotations",
      label: "Shared",
      dataProvider: (item: Zotero.Item, dataKey: string) => {
        // Show if item has shared annotations
        if (item.isRegularItem()) {
          const doi = item.getField("DOI");
          if (doi) {
            // This would need to be cached/async in real implementation
            return "📤"; // Indicates item has shareable annotations
          }
        }
        return "";
      },
    });
  }

  /**
   * @example Register custom item box row
   */
  registerCustomItemBoxRow() {
    const ztoolkit = this.addon.data.ztoolkit;
    
    ztoolkit.ItemBox.register({
      pluginID: this.addon.data.config.addonID,
      rowID: "researchopia-status",
      label: "Annotation Status",
      getFieldValue: (field, unformatted, includeBaseMapped, item, original) => {
        if (item && item.isRegularItem()) {
          const doi = item.getField("DOI");
          if (doi) {
            return "Ready for sharing";
          }
        }
        return "No DOI found";
      },
      setFieldValue: (field, value, loadIn, item, original) => {
        // This could trigger sharing when clicked
        return false;
      },
      editable: false,
      clickable: true,
      index: 99,
    });
  }

  /**
   * @example Progress window for long operations
   */
  async progressWindowExample() {
    const ztoolkit = this.addon.data.ztoolkit;
    
    const progressWindow = new ztoolkit.ProgressWindow("Researchopia", {
      closeOnClick: true,
      closeTime: -1,
    })
      .createLine({
        text: "Uploading annotations...",
        type: "default",
        progress: 0,
      })
      .show();

    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      progressWindow.changeLine({
        progress: i,
        text: `Uploading annotations... ${i}%`,
      });
      await Zotero.Promise.delay(100);
    }

    progressWindow.changeLine({
      progress: 100,
      text: "Upload completed!",
      type: "success",
    });

    progressWindow.startCloseTimer(2000);
  }

  /**
   * @example Dialog for user input
   */
  async dialogExample() {
    const ztoolkit = this.addon.data.ztoolkit;
    
    const dialogData: { [key: string | number]: any } = {
      comment: "",
      makePublic: true,
    };

    const dialogHelper = new ztoolkit.Dialog(3, 2)
      .addCell(0, 0, {
        tag: "label",
        properties: { textContent: "Add comment to annotation:" },
      })
      .addCell(1, 0, {
        tag: "textbox",
        id: "comment-input",
        attributes: {
          "data-bind": "comment",
          "data-prop": "value",
          multiline: true,
          rows: 3,
        },
      })
      .addCell(2, 0, {
        tag: "checkbox",
        id: "public-checkbox",
        attributes: {
          "data-bind": "makePublic",
          "data-prop": "checked",
        },
        properties: { label: "Make annotation public" },
      })
      .addButton("Confirm", "confirm")
      .addButton("Cancel", "cancel")
      .setDialogData(dialogData)
      .open("Share Annotation", {
        width: 400,
        height: 200,
        centerscreen: true,
        resizable: false,
      });

    await dialogHelper.getWindow()?.document.getElementById("comment-input")?.focus();

    if ((await dialogHelper.wait()) && dialogData.comment) {
      this.addon.data.ztoolkit.log("User comment:", dialogData.comment);
      this.addon.data.ztoolkit.log("Make public:", dialogData.makePublic);
      return { comment: dialogData.comment, isPublic: dialogData.makePublic };
    }
    
    return null;
  }

  /**
   * @example Clipboard operations
   */
  clipboardExample() {
    const ztoolkit = this.addon.data.ztoolkit;
    
    // Copy annotation data to clipboard
    const annotationData = {
      text: "Sample annotation text",
      comment: "User comment",
      doi: "10.1000/sample",
    };
    
    ztoolkit.Clipboard.addText(JSON.stringify(annotationData, null, 2));
    
    this.addon.data.ztoolkit.log("Annotation data copied to clipboard");
  }
}
