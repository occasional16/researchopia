// Simplified bootstrap.js with safe DOM operations
if (typeof Zotero === 'undefined') {
  var Zotero;
}

// Create console object for debugging
if (typeof console === 'undefined') {
  var console = {
    log: function(msg) { if (typeof Zotero !== 'undefined') Zotero.debug("Researchopia: " + msg); },
    error: function(msg) { if (typeof Zotero !== 'undefined') Zotero.debug("Researchopia ERROR: " + msg); },
    warn: function(msg) { if (typeof Zotero !== 'undefined') Zotero.debug("Researchopia WARN: " + msg); },
    debug: function(msg) { if (typeof Zotero !== 'undefined') Zotero.debug("Researchopia DEBUG: " + msg); }
  };
}

// Global context setup
if (typeof _globalThis === 'undefined') {
  var _globalThis = this;
}

async function install(data, reason) {
  Zotero.debug("Researchopia: Install called");
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  try {
    Zotero.debug("Researchopia: Bootstrap startup called");
    
    // Load auth module
    const authScriptPath = rootURI + "content/auth.js";
    Zotero.debug("Researchopia: Loading auth module from: " + authScriptPath);
    
    const scriptContext = {
      Zotero: Zotero,
      console: console,
      XMLHttpRequest: XMLHttpRequest,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      _globalThis: _globalThis
    };
    
    Services.scriptloader.loadSubScript(authScriptPath, scriptContext);
    
    if (scriptContext.ResearchopiaAuth) {
      if (!Zotero.Researchopia) {
        Zotero.Researchopia = {};
      }
      Zotero.Researchopia.auth = new scriptContext.ResearchopiaAuth();
      Zotero.debug("Researchopia: Auth module loaded and attached to Zotero.Researchopia.auth");
    } else {
      throw new Error("ResearchopiaAuth not found in script context");
    }
    
    // Load annotations module
    const annotationsScriptPath = rootURI + "content/annotations.js";
    Zotero.debug("Researchopia: Loading annotations module from: " + annotationsScriptPath);
    
    Services.scriptloader.loadSubScript(annotationsScriptPath, scriptContext);
    
    if (scriptContext.ResearchopiaAnnotations) {
      Zotero.Researchopia.annotations = new scriptContext.ResearchopiaAnnotations();
      Zotero.debug("Researchopia: Annotations module loaded and attached to Zotero.Researchopia.annotations");
    } else {
      throw new Error("ResearchopiaAnnotations not found in script context");
    }
    
    // Register preference pane
    Zotero.PreferencePanes.register({
      pluginID: "researchopia@example.com",
      src: rootURI + "content/preferences.xhtml",
      scripts: [rootURI + "content/preferences.js"]
    });
    Zotero.debug("Researchopia: Preference pane registered");
    
    // Register item pane section with simplified UI
    const sectionID = Zotero.ItemPaneManager.registerSection({
      paneID: "researchopia",
      pluginID: "researchopia@example.com",
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
          
          if (!item) {
            body.textContent = "No item selected";
            return;
          }
          
          const doc = body.ownerDocument;
          
          // Create simple container
          const container = doc.createElement('div');
          container.style.cssText = 'padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
          
          // Create title
          const title = doc.createElement('h3');
          title.textContent = 'Shared Annotations';
          title.style.cssText = 'margin: 0 0 16px 0; color: #333; font-size: 16px;';
          container.appendChild(title);
          
          // Create simple buttons
          const buttonContainer = doc.createElement('div');
          buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px;';
          
          const extractBtn = doc.createElement('button');
          extractBtn.textContent = 'Extract Annotations';
          extractBtn.style.cssText = 'padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;';
          
          const shareBtn = doc.createElement('button');
          shareBtn.textContent = 'Share Annotations';
          shareBtn.style.cssText = 'padding: 8px 12px; background: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer;';
          
          const viewBtn = doc.createElement('button');
          viewBtn.textContent = 'View Shared';
          viewBtn.style.cssText = 'padding: 8px 12px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;';
          
          buttonContainer.appendChild(extractBtn);
          buttonContainer.appendChild(shareBtn);
          buttonContainer.appendChild(viewBtn);
          container.appendChild(buttonContainer);
          
          // Create status area
          const statusDiv = doc.createElement('div');
          statusDiv.style.cssText = 'margin-bottom: 12px; min-height: 20px;';
          container.appendChild(statusDiv);
          
          // Create content area
          const contentDiv = doc.createElement('div');
          contentDiv.style.cssText = 'border: 1px solid #ddd; border-radius: 4px; padding: 12px; min-height: 100px;';
          contentDiv.textContent = 'Click a button above to get started';
          container.appendChild(contentDiv);
          
          // Add simple click handlers
          extractBtn.addEventListener('click', async () => {
            extractBtn.disabled = true;
            extractBtn.textContent = 'Extracting...';
            statusDiv.textContent = 'Extracting annotations...';
            
            try {
              if (!Zotero.Researchopia?.auth?.isLoggedIn()) {
                statusDiv.textContent = 'Please log in first';
                statusDiv.style.color = '#e74c3c';
                return;
              }
              
              const annotations = await Zotero.Researchopia.annotations.extractAnnotations(item);
              contentDiv.textContent = `Found ${annotations.length} annotations`;
              statusDiv.textContent = `Successfully extracted ${annotations.length} annotations`;
              statusDiv.style.color = '#27ae60';
            } catch (error) {
              statusDiv.textContent = 'Error: ' + error.message;
              statusDiv.style.color = '#e74c3c';
            } finally {
              extractBtn.disabled = false;
              extractBtn.textContent = 'Extract Annotations';
            }
          });
          
          shareBtn.addEventListener('click', async () => {
            shareBtn.disabled = true;
            shareBtn.textContent = 'Sharing...';
            statusDiv.textContent = 'Sharing annotations...';
            
            try {
              if (!Zotero.Researchopia?.auth?.isLoggedIn()) {
                statusDiv.textContent = 'Please log in first';
                statusDiv.style.color = '#e74c3c';
                return;
              }
              
              const doi = item.getField('DOI');
              if (!doi) {
                statusDiv.textContent = 'This item has no DOI';
                statusDiv.style.color = '#f39c12';
                return;
              }
              
              const annotations = await Zotero.Researchopia.annotations.extractAnnotations(item);
              if (annotations.length === 0) {
                statusDiv.textContent = 'No annotations to share';
                statusDiv.style.color = '#f39c12';
                return;
              }
              
              const result = await Zotero.Researchopia.annotations.uploadAnnotations(annotations, doi);
              if (result.success) {
                statusDiv.textContent = `Successfully shared ${result.count} annotations`;
                statusDiv.style.color = '#27ae60';
              } else {
                statusDiv.textContent = 'Failed to share: ' + result.error;
                statusDiv.style.color = '#e74c3c';
              }
            } catch (error) {
              statusDiv.textContent = 'Error: ' + error.message;
              statusDiv.style.color = '#e74c3c';
            } finally {
              shareBtn.disabled = false;
              shareBtn.textContent = 'Share Annotations';
            }
          });
          
          viewBtn.addEventListener('click', async () => {
            viewBtn.disabled = true;
            viewBtn.textContent = 'Loading...';
            statusDiv.textContent = 'Loading shared annotations...';
            
            try {
              const doi = item.getField('DOI');
              if (!doi) {
                statusDiv.textContent = 'This item has no DOI';
                statusDiv.style.color = '#f39c12';
                return;
              }
              
              const sharedAnnotations = await Zotero.Researchopia.annotations.fetchSharedAnnotations(doi);
              contentDiv.textContent = `Found ${sharedAnnotations.length} shared annotations`;
              statusDiv.textContent = `Loaded ${sharedAnnotations.length} shared annotations`;
              statusDiv.style.color = '#27ae60';
            } catch (error) {
              statusDiv.textContent = 'Error: ' + error.message;
              statusDiv.style.color = '#e74c3c';
            } finally {
              viewBtn.disabled = false;
              viewBtn.textContent = 'View Shared';
            }
          });
          
          // Clear body and append container
          body.textContent = '';
          body.appendChild(container);
          
          Zotero.debug("Researchopia: Simple UI rendered successfully");
          
        } catch (error) {
          Zotero.debug("Researchopia: Error in onRender: " + error.message);
          body.textContent = "Error loading Researchopia: " + error.message;
        }
      }
    });
    
    Zotero.debug("Researchopia: Item pane section registered with ID: " + sectionID);
    Zotero.debug("Researchopia: Bootstrap startup completed successfully");
    
  } catch (error) {
    Zotero.debug("Researchopia: Bootstrap startup failed: " + error.message);
    Zotero.debug("Researchopia: Error details: " + JSON.stringify(error));
    if (error.stack) {
      Zotero.debug("Researchopia: Error stack: " + error.stack);
    }
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
  Zotero.debug("Researchopia: Shutdown called");
}

async function uninstall(data, reason) {
  Zotero.debug("Researchopia: Uninstall called");
}
