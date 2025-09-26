// Bootstrap for Researchopia Zotero Plugin
// This file loads the compiled TypeScript code

if (typeof Zotero === 'undefined') {
  var Zotero;
}

// Global context setup
if (typeof _globalThis === 'undefined') {
  var _globalThis = this;
}

async function install() {
  Zotero.debug("Researchopia: Install called");
}

async function startup({ id, version, resourceURI, rootURI }) {
  try {
    Zotero.debug("Researchopia: Bootstrap startup called");

    // Register preference pane first
    try {
      Zotero.PreferencePanes.register({
        pluginID: id,
        src: rootURI + "content/preferences.xhtml",
        scripts: [rootURI + "content/preferences.js"]
      });
      Zotero.debug("Researchopia: Preference pane registered successfully");
    } catch (prefError) {
      Zotero.debug("Researchopia: Failed to register preference pane: " + prefError.message);
    }

    // Register item pane section
    const sectionID = Zotero.ItemPaneManager.registerSection({
      paneID: "researchopia-annotations",
      pluginID: id,
      header: {
        l10nID: "researchopia-section-header",
        icon: "chrome://zotero/skin/16/universal/book.svg"
      },
      sidenav: {
        l10nID: "researchopia-section-sidenav",
        icon: "chrome://zotero/skin/16/universal/book.svg"
      },
      onRender: ({ body, item, editable, tabType }) => {
        try {
          Zotero.debug("Researchopia: Rendering item pane for item: " + (item ? item.getDisplayTitle() : 'null'));

          if (!item || !item.isRegularItem()) {
            body.innerHTML = `
              <div style="padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 16px;">Shared Annotations</h3>
                <p style="color: #666;">Please select a research item to view shared annotations.</p>
              </div>
            `;
            return;
          }

          const doi = item.getField("DOI");
          if (!doi) {
            body.innerHTML = `
              <div style="padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 16px;">Shared Annotations</h3>
                <p style="color: #f39c12;">This item has no DOI. Only items with DOI can have shared annotations.</p>
              </div>
            `;
            return;
          }

          // Create functional UI
          const container = body.ownerDocument.createElement('div');
          container.style.cssText = 'padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';

          const title = body.ownerDocument.createElement('h3');
          title.textContent = 'Shared Annotations';
          title.style.cssText = 'margin: 0 0 16px 0; color: #333; font-size: 16px;';
          container.appendChild(title);

          const doiInfo = body.ownerDocument.createElement('p');
          doiInfo.textContent = `DOI: ${doi}`;
          doiInfo.style.cssText = 'margin: 0 0 16px 0; color: #666; font-size: 12px;';
          container.appendChild(doiInfo);

          const buttonContainer = body.ownerDocument.createElement('div');
          buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px;';

          const extractBtn = body.ownerDocument.createElement('button');
          extractBtn.textContent = 'Extract Annotations';
          extractBtn.style.cssText = 'padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;';

          const shareBtn = body.ownerDocument.createElement('button');
          shareBtn.textContent = 'Share Annotations';
          shareBtn.style.cssText = 'padding: 8px 12px; background: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;';

          const viewBtn = body.ownerDocument.createElement('button');
          viewBtn.textContent = 'View Shared';
          viewBtn.style.cssText = 'padding: 8px 12px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;';

          buttonContainer.appendChild(extractBtn);
          buttonContainer.appendChild(shareBtn);
          buttonContainer.appendChild(viewBtn);
          container.appendChild(buttonContainer);

          const statusDiv = body.ownerDocument.createElement('div');
          statusDiv.style.cssText = 'margin-bottom: 12px; min-height: 20px; font-size: 12px;';
          statusDiv.textContent = 'Ready to use. Click a button above to get started.';
          container.appendChild(statusDiv);

          const contentDiv = body.ownerDocument.createElement('div');
          contentDiv.style.cssText = 'border: 1px solid #ddd; border-radius: 4px; padding: 12px; min-height: 100px; font-size: 12px;';
          contentDiv.textContent = 'Annotation content will appear here.';
          container.appendChild(contentDiv);

          // Add click handlers
          extractBtn.addEventListener('click', () => {
            statusDiv.textContent = 'Extracting annotations...';
            statusDiv.style.color = '#007acc';
            setTimeout(() => {
              try {
                // Get annotations from attachments instead of the main item
                const attachments = item.getAttachments();
                let totalAnnotations = 0;

                for (let attachmentID of attachments) {
                  const attachment = Zotero.Items.get(attachmentID);
                  if (attachment && attachment.isPDFAttachment()) {
                    const annotations = attachment.getAnnotations();
                    totalAnnotations += annotations.length;
                  }
                }

                contentDiv.textContent = `Found ${totalAnnotations} local annotations from ${attachments.length} attachments`;
                statusDiv.textContent = `Successfully extracted ${totalAnnotations} annotations`;
                statusDiv.style.color = '#28a745';
              } catch (error) {
                contentDiv.textContent = 'Error extracting annotations: ' + error.message;
                statusDiv.textContent = 'Extraction failed';
                statusDiv.style.color = '#e74c3c';
                Zotero.debug("Researchopia: Annotation extraction error: " + error.message);
              }
            }, 1000);
          });

          shareBtn.addEventListener('click', () => {
            statusDiv.textContent = 'Sharing annotations...';
            statusDiv.style.color = '#007acc';
            setTimeout(() => {
              statusDiv.textContent = 'Feature coming soon - please log in first';
              statusDiv.style.color = '#f39c12';
            }, 1000);
          });

          viewBtn.addEventListener('click', () => {
            statusDiv.textContent = 'Loading shared annotations...';
            statusDiv.style.color = '#007acc';
            setTimeout(() => {
              contentDiv.textContent = 'No shared annotations found for this DOI';
              statusDiv.textContent = 'Feature coming soon - database connection needed';
              statusDiv.style.color = '#f39c12';
            }, 1000);
          });

          body.textContent = '';
          body.appendChild(container);

          Zotero.debug("Researchopia: Item pane UI rendered successfully");

        } catch (error) {
          Zotero.debug("Researchopia: Error in onRender: " + error.message);
          body.innerHTML = `
            <div style="padding: 16px; color: #e74c3c;">
              <h3>Researchopia Error</h3>
              <p>Error loading plugin: ${error.message}</p>
            </div>
          `;
        }
      }
    });

    Zotero.debug("Researchopia: Item pane section registered with ID: " + sectionID);

    // Load the compiled TypeScript code for additional functionality
    try {
      const scriptPath = rootURI + "content/scripts/researchopia.js";
      Zotero.debug("Researchopia: Loading main script from: " + scriptPath);

      const scriptContext = {
        Zotero: Zotero,
        _globalThis: _globalThis,
        Services: Services,
        Components: Components,
        ChromeUtils: ChromeUtils,
        console: {
          log: (msg) => Zotero.debug("Researchopia: " + msg),
          error: (msg) => Zotero.debug("Researchopia ERROR: " + msg),
          warn: (msg) => Zotero.debug("Researchopia WARN: " + msg),
          debug: (msg) => Zotero.debug("Researchopia DEBUG: " + msg)
        }
      };

      Services.scriptloader.loadSubScript(scriptPath, scriptContext);
      Zotero.debug("Researchopia: Main script loaded successfully");
    } catch (scriptError) {
      Zotero.debug("Researchopia: Script loading failed (non-critical): " + scriptError.message);
    }

    Zotero.debug("Researchopia: Bootstrap startup completed successfully");

  } catch (error) {
    Zotero.debug("Researchopia: Bootstrap startup failed: " + error.message);
    if (error.stack) {
      Zotero.debug("Researchopia: Error stack: " + error.stack);
    }
  }
}

async function onMainWindowLoad() {
  Zotero.debug("Researchopia: Main window load called");
}

async function onMainWindowUnload() {
  Zotero.debug("Researchopia: Main window unload called");
}

async function shutdown(data, reason) {
  if (reason === 2) { // APP_SHUTDOWN
    return;
  }
  Zotero.debug("Researchopia: Shutdown called");
}

async function uninstall() {
  Zotero.debug("Researchopia: Uninstall called");
}
