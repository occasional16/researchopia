/*
  Bootstrapped Zotero plugin entry points for Zotero 7/8
  Registers an Item Pane custom section embedding the panel iframe
*/

var chromeHandle;

async function startup({ id, version, rootURI }, reason) {
  // Register a custom Item Pane section (Zotero 7+)
  try {
    const registeredID = Zotero.ItemPaneManager.registerSection({
      paneID: "academic-rating-section",
      pluginID: id,
      header: {
        l10nID: "academic-rating-item-pane-header",
        icon: rootURI + "icons/icon16.svg",
      },
      sidenav: {
        l10nID: "academic-rating-item-pane-header",
        icon: rootURI + "icons/icon16.svg",
      },
      onRender: ({ body, item, editable, tabType }) => {
        // Clear
        body.replaceChildren();
        const container = body.ownerDocument.createElement("div");
        container.style.cssText = "display:flex;flex-direction:column;gap:6px;width:100%;height:260px;";

        const info = body.ownerDocument.createElement("div");
        info.textContent = "Academic Rating preview";
        info.style.cssText = "font-size:12px;color:#6b7280";

        const iframe = body.ownerDocument.createElement("iframe");
        iframe.style.cssText = "flex:1;border:1px solid #2a2f4a;border-radius:6px;background:#0e142b";
        iframe.setAttribute("allow", "clipboard-read; clipboard-write; geolocation");
        iframe.setAttribute("referrerpolicy", "no-referrer");

        const url = new URL("panel/panel.html", rootURI);
        const usp = new URLSearchParams();
        try {
          const doi = item?.getField?.("DOI");
          const arxiv = item?.getField?.("archiveLocation");
          const urlField = item?.getField?.("url");
          const extra = item?.getField?.("extra");
          const pmid = /PMID\s*:\s*(\d+)/i.exec(extra || "")?.[1];
          if (doi) usp.set("doi", doi);
          if (pmid) usp.set("pmid", pmid);
          if (arxiv && /^(arXiv:|\d{4}\.\d{4,5})/i.test(arxiv)) usp.set("arxiv", arxiv.replace(/^arXiv:/i, ""));
          if (urlField) usp.set("url", urlField);
        } catch (e) {}
        url.hash = usp.toString();
        iframe.src = url.toString();

        container.append(info, iframe);
        body.append(container);
      },
    });

    // Keep a ref so we could unregister on shutdown if needed
    startup._registeredSection = registeredID;
  } catch (e) {
    Zotero.logError("Academic Rating: registerSection failed: " + e);
  }
}

function shutdown() {
  try {
    if (startup._registeredSection) {
      Zotero.ItemPaneManager.unregisterSection(startup._registeredSection);
    }
  } catch (e) {
    Zotero.logError("Academic Rating: unregisterSection failed: " + e);
  }
}

function install() {}
function uninstall() {}

this.install = install;
this.startup = startup;
this.shutdown = shutdown;
this.uninstall = uninstall;
