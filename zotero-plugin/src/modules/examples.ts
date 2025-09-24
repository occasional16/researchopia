import { getString } from "../utils/locale";

function example(
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
) {
  const original = descriptor.value;
  descriptor.value = function (...args: any) {
    try {
      ztoolkit.log(`Calling example ${target.name}.${String(propertyKey)}`);
      return original.apply(this, args);
    } catch (e) {
      ztoolkit.log(`Error in example ${target.name}.${String(propertyKey)}`, e);
      throw e;
    }
  };
  return descriptor;
}

export class BasicExampleFactory {
  @example
  static registerNotifier() {
    const callback = {
      notify: async (
        event: string,
        type: string,
        ids: number[] | string[],
        extraData: { [key: string]: any },
      ) => {
        if (!addon?.data.alive) {
          this.unregisterNotifier(notifierID);
          return;
        }
        addon.hooks.onNotify(event, type, ids, extraData);
      },
    };

    // Register the callback in Zotero as an item observer
    const notifierID = Zotero.Notifier.registerObserver(callback, [
      "tab",
      "item",
      "file",
    ]);

    Zotero.Plugins.addObserver({
      shutdown: ({ id }) => {
        if (id === addon.data.config.addonID)
          this.unregisterNotifier(notifierID);
      },
    });

    this.unregisterNotifier = (notifierID: string) => {
      Zotero.Notifier.unregisterObserver(notifierID);
    };
  }

  @example
  static exampleNotifierCallback() {
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: "Open Tab Detected!",
        type: "success",
        progress: 100,
      })
      .show();
  }

  @example
  static registerPrefs() {
    Zotero.PreferencePanes.register({
      pluginID: addon.data.config.addonID,
      src: rootURI + "content/preferences.xhtml",
      label: getString("prefs-title"),
      image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
    });
  }

  private static unregisterNotifier: (notifierID: string) => void;
}

export class UIExampleFactory {
  @example
  static registerItemPaneSection() {
    Zotero.ItemPaneManager.registerSection({
      paneID: "researchopia",
      pluginID: addon.data.config.addonID,
      header: {
        l10nID: "researchopia-item-section-head-text",
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
      },
      sidenav: {
        l10nID: "researchopia-item-section-sidenav-tooltip",
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
      },
      onRender: ({ body, item }) => {
        this.renderItemPane(body, item);
      },
    });
  }

  @example
  static renderItemPane(body: Element, item: Zotero.Item | null) {
    // Clear existing content
    body.innerHTML = '';

    const doc = body.ownerDocument;
    if (!doc) return;

    if (!item) {
      const container = ztoolkit.UI.createElement(doc, "div", {
        styles: {
          padding: "20px",
          textAlign: "center",
          color: "#666",
          fontFamily: "system-ui, -apple-system, sans-serif"
        },
        children: [
          {
            tag: "div",
            styles: { fontSize: "32px", marginBottom: "10px" },
            properties: { textContent: "📚" }
          },
          {
            tag: "div",
            properties: { textContent: "请选择一个文献项目" }
          },
          {
            tag: "div",
            styles: { fontSize: "12px", marginTop: "8px", color: "#999" },
            properties: { textContent: "选择文献后，这里将显示Researchopia功能" }
          }
        ]
      });
      body.appendChild(container);
      return;
    }

    // Get item information
    const title = item.getDisplayTitle();
    const doi = item.getField('DOI');
    const url = item.getField('url');
    const itemType = item.itemType;
    const dateAdded = item.dateAdded;
    const creators = item.getCreators();
    const authorNames = creators.map(c => `${c.firstName} ${c.lastName}`).join(', ');

    // Create main container using ztoolkit
    const container = ztoolkit.UI.createElement(doc, "div", {
      styles: {
        padding: "15px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        height: "100%",
        overflowY: "auto"
      },
      children: [
        // Header
        {
          tag: "div",
          styles: {
            display: "flex",
            alignItems: "center",
            marginBottom: "15px",
            paddingBottom: "10px",
            borderBottom: "2px solid #e0e0e0"
          },
          children: [
            {
              tag: "div",
              styles: { fontSize: "24px", marginRight: "10px" },
              properties: { textContent: "📝" }
            },
            {
              tag: "div",
              children: [
                {
                  tag: "h3",
                  styles: { margin: "0", fontSize: "16px", color: "#2c3e50", fontWeight: "600" },
                  properties: { textContent: "Researchopia" }
                },
                {
                  tag: "div",
                  styles: { fontSize: "11px", color: "#666", marginTop: "2px" },
                  properties: { textContent: "学术协作与标注共享" }
                }
              ]
            }
          ]
        },
        // Item Info
        {
          tag: "div",
          styles: {
            background: "#f8f9fa",
            padding: "12px",
            borderRadius: "6px",
            marginBottom: "15px",
            borderLeft: "4px solid #007acc"
          },
          children: [
            {
              tag: "div",
              styles: { fontSize: "13px", fontWeight: "600", color: "#2c3e50", marginBottom: "8px" },
              properties: { textContent: "📄 文献信息" }
            },
            {
              tag: "div",
              styles: { fontSize: "12px", lineHeight: "1.4" },
              properties: {
                innerHTML: `
                  <div style="margin-bottom: 4px;"><strong>标题:</strong> ${title}</div>
                  ${authorNames ? `<div style="margin-bottom: 4px;"><strong>作者:</strong> ${authorNames}</div>` : ''}
                  <div style="margin-bottom: 4px;"><strong>类型:</strong> ${itemType}</div>
                  ${doi ? `<div style="margin-bottom: 4px;"><strong>DOI:</strong> <span style="color: #007acc; font-family: monospace;">${doi}</span></div>` : ''}
                  ${url ? `<div style="margin-bottom: 4px;"><strong>URL:</strong> <span style="color: #007acc; font-size: 11px; word-break: break-all;">${url}</span></div>` : ''}
                  <div style="color: #666; font-size: 11px;">添加时间: ${new Date(dateAdded).toLocaleDateString('zh-CN')}</div>
                `
              }
            }
          ]
        },
        // Action Buttons
        {
          tag: "div",
          styles: {
            background: "#ffffff",
            padding: "15px",
            borderRadius: "6px",
            marginBottom: "15px",
            border: "1px solid #e0e0e0"
          },
          children: [
            {
              tag: "div",
              styles: { fontSize: "13px", fontWeight: "600", color: "#2c3e50", marginBottom: "12px" },
              properties: { textContent: "🔧 功能操作" }
            },
            {
              tag: "div",
              styles: { display: "flex", flexDirection: "column", gap: "8px" },
              children: [
                {
                  tag: "button",
                  styles: {
                    padding: "8px 12px",
                    backgroundColor: "#007acc",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontFamily: "system-ui, -apple-system, sans-serif"
                  },
                  properties: { textContent: "提取我的标注" },
                  listeners: [{
                    type: "click",
                    listener: () => {
                      ztoolkit.getGlobal("alert")("提取标注功能开发中...");
                    }
                  }]
                },
                {
                  tag: "button",
                  styles: {
                    padding: "8px 12px",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontFamily: "system-ui, -apple-system, sans-serif"
                  },
                  properties: { textContent: "共享我的标注" },
                  listeners: [{
                    type: "click",
                    listener: () => {
                      ztoolkit.getGlobal("alert")("共享标注功能开发中...");
                    }
                  }]
                },
                {
                  tag: "button",
                  styles: {
                    padding: "8px 12px",
                    backgroundColor: "#6f42c1",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontFamily: "system-ui, -apple-system, sans-serif"
                  },
                  properties: { textContent: "查看共享标注" },
                  listeners: [{
                    type: "click",
                    listener: () => {
                      ztoolkit.getGlobal("alert")("查看共享标注功能开发中...");
                    }
                  }]
                }
              ]
            }
          ]
        }
      ]
    });

    body.appendChild(container);
  }
}

export class HelperExampleFactory {
  @example
  static dialogExample() {
    ztoolkit.getGlobal("alert")("Hello World! This is Researchopia!");
  }
}

export class KeyExampleFactory {
  @example
  static registerShortcuts() {
    // Register shortcuts if needed
    ztoolkit.log("Shortcuts registered");
  }

  @example
  static exampleShortcutLargerCallback() {
    ztoolkit.getGlobal("alert")("Larger!");
  }

  @example
  static exampleShortcutSmallerCallback() {
    ztoolkit.getGlobal("alert")("Smaller!");
  }
}

export class PromptExampleFactory {
  @example
  static registerNormalCommandExample() {
    ztoolkit.log("Normal command registered");
  }

  @example
  static registerAnonymousCommandExample(win: Window) {
    ztoolkit.log("Anonymous command registered for window");
  }

  @example
  static registerConditionalCommandExample() {
    ztoolkit.log("Conditional command registered");
  }
}