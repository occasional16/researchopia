/**
 * Bootstrap script for Researchopia Zotero plugin
 * Compatible with Zotero 8 beta
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

    // Register preference pane first
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

    // Register item pane section
    if (Zotero.ItemPaneManager) {
      Zotero.debug("Researchopia: Registering item pane section");
      const registeredID = Zotero.ItemPaneManager.registerSection({
        paneID: "researchopia-annotations",
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
          try {
            Zotero.debug("Researchopia: onRender called for item: " + (item ? item.getField("title") : "none"));

            if (!item || !item.isRegularItem()) {
              body.innerHTML = `
                <div style="padding: 20px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <h3 style="margin: 0 0 12px 0; color: #333; font-size: 16px;">Shared Annotations</h3>
                  <p style="color: #666; font-size: 14px;">Please select a research item to view shared annotations.</p>
                </div>
              `;
              return;
            }

            const doi = item.getField("DOI");
            Zotero.debug("Researchopia: DOI found: " + doi);

            if (!doi) {
              body.innerHTML = `
                <div style="padding: 20px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <h3 style="margin: 0 0 12px 0; color: #333; font-size: 16px;">Shared Annotations</h3>
                  <p style="color: #666; font-size: 14px; margin-bottom: 8px;">This item has no DOI. Shared annotations are only available for items with DOI numbers.</p>
                  <p style="color: #999; font-size: 12px;"><small>DOI (Digital Object Identifier) is required to match annotations across users.</small></p>
                </div>
              `;
              return;
            }

            // Show enhanced interface
            const title = item.getField("title") || "Untitled";
            const authors = item.getCreators().map(c => c.firstName + " " + c.lastName).join(", ") || "Unknown";
            const year = item.getField("date") ? new Date(item.getField("date")).getFullYear() : "Unknown";

            Zotero.debug("Researchopia: Rendering UI for: " + title);

            // Use body.ownerDocument instead of global document
            const doc = body.ownerDocument;

            // Create container div
            const container = doc.createElement('div');
            container.style.cssText = 'padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';

            // Header
            const header = doc.createElement('div');
            header.style.cssText = 'display: flex; align-items: center; margin-bottom: 16px;';
            header.innerHTML = `
              <h3 style="margin: 0; color: #333; font-size: 16px; font-weight: 600;">Shared Annotations</h3>
              <span style="margin-left: auto; background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">Beta</span>
            `;
            container.appendChild(header);

            // Paper info
            const paperInfo = doc.createElement('div');
            paperInfo.style.cssText = 'background: #f8f9fa; border-radius: 8px; padding: 12px; margin-bottom: 16px; border-left: 4px solid #007acc;';
            paperInfo.innerHTML = `
              <div style="font-size: 14px; font-weight: 500; color: #333; margin-bottom: 4px;">
                ${title.length > 60 ? title.substring(0, 60) + "..." : title}
              </div>
              <div style="font-size: 12px; color: #666; margin-bottom: 2px;">
                <strong>Authors:</strong> ${authors.length > 40 ? authors.substring(0, 40) + "..." : authors}
              </div>
              <div style="font-size: 12px; color: #666;">
                <strong>Year:</strong> ${year} | <strong>DOI:</strong> ${doi}
              </div>
            `;
            container.appendChild(paperInfo);

            // Three main action buttons
            const buttonContainer = doc.createElement('div');
            buttonContainer.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px;';

            // 1. Extract My Annotations Button
            const extractBtn = doc.createElement('button');
            extractBtn.id = 'extract-annotations-btn';
            extractBtn.style.cssText = 'padding: 10px 8px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s ease; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px;';

            const extractIcon = doc.createElement('span');
            extractIcon.textContent = '📋';
            const extractText = doc.createElement('span');
            extractText.textContent = '提取标注';
            extractBtn.appendChild(extractIcon);
            extractBtn.appendChild(extractText);

            // 2. Share My Annotations Button
            const shareBtn = doc.createElement('button');
            shareBtn.id = 'share-annotations-btn';
            shareBtn.style.cssText = 'padding: 10px 8px; background: #007acc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s ease; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px;';

            const shareIcon = doc.createElement('span');
            shareIcon.textContent = '📤';
            const shareText = doc.createElement('span');
            shareText.textContent = '共享标注';
            shareBtn.appendChild(shareIcon);
            shareBtn.appendChild(shareText);

            // 3. View Shared Annotations Button
            const viewBtn = doc.createElement('button');
            viewBtn.id = 'view-annotations-btn';
            viewBtn.style.cssText = 'padding: 10px 8px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s ease; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px;';

            const viewIcon = doc.createElement('span');
            viewIcon.textContent = '👥';
            const viewText = doc.createElement('span');
            viewText.textContent = '查看共享';
            viewBtn.appendChild(viewIcon);
            viewBtn.appendChild(viewText);

            // Add buttons to container
            buttonContainer.appendChild(extractBtn);
            buttonContainer.appendChild(shareBtn);
            buttonContainer.appendChild(viewBtn);

            // Add container to main container
            container.appendChild(buttonContainer);

            // Helper function to safely create annotation display
            const createAnnotationDisplay = function(annotations, type = 'my') {
              // Clear container safely
              while (annotationsContainer.firstChild) {
                annotationsContainer.removeChild(annotationsContainer.firstChild);
              }

              if (annotations.length === 0) {
                const emptyDiv = doc.createElement('div');
                emptyDiv.style.cssText = 'text-align: center; color: #666; padding: 20px;';

                const emptyIcon = doc.createElement('div');
                emptyIcon.style.cssText = 'font-size: 48px; margin-bottom: 8px;';
                emptyIcon.textContent = type === 'my' ? '📝' : '👥';

                const emptyTitle = doc.createElement('div');
                emptyTitle.style.cssText = 'font-size: 14px; font-weight: 500; margin-bottom: 4px;';
                emptyTitle.textContent = type === 'my' ? 'No annotations found' : 'No shared annotations yet';

                const emptyDesc = doc.createElement('div');
                emptyDesc.style.cssText = 'font-size: 12px;';
                emptyDesc.textContent = type === 'my' ? 'Please add annotations to the PDF first' : 'Be the first to share annotations for this paper!';

                emptyDiv.appendChild(emptyIcon);
                emptyDiv.appendChild(emptyTitle);
                emptyDiv.appendChild(emptyDesc);
                annotationsContainer.appendChild(emptyDiv);
                return;
              }

              // Create header
              const headerDiv = doc.createElement('div');
              headerDiv.style.cssText = 'font-size: 14px; font-weight: 500; margin-bottom: 12px; color: #333;';
              headerDiv.textContent = `${type === 'my' ? '📋 My' : '👥 Shared'} Annotations (${annotations.length})`;
              annotationsContainer.appendChild(headerDiv);

              // Create annotations
              annotations.forEach((annotation, index) => {
                const annotationDiv = doc.createElement('div');
                annotationDiv.style.cssText = 'border-bottom: 1px solid #eee; padding: 12px 0;';

                const contentDiv = doc.createElement('div');
                contentDiv.style.cssText = 'display: flex; align-items: start; gap: 8px;';

                // Add checkbox for my annotations
                if (type === 'my') {
                  const checkbox = doc.createElement('input');
                  checkbox.type = 'checkbox';
                  checkbox.id = `annotation-${index}`;
                  checkbox.checked = true;
                  checkbox.style.cssText = 'margin-top: 4px;';
                  contentDiv.appendChild(checkbox);
                }

                // User info and content will be added here
                const infoDiv = doc.createElement('div');
                infoDiv.style.cssText = 'flex: 1;';
                contentDiv.appendChild(infoDiv);

                annotationDiv.appendChild(contentDiv);
                annotationsContainer.appendChild(annotationDiv);
              });
            };

            // 1. Extract My Annotations Function
            const extractMyAnnotations = async function() {
              extractBtn.disabled = true;
              extractIcon.textContent = '⏳';
              extractText.textContent = '提取中...';
              extractBtn.style.background = '#6c757d';

              try {
                // Check if user is logged in
                if (!Zotero.Researchopia?.auth?.isLoggedIn()) {
                  // Clear status div and set error message safely
                  while (statusDiv.firstChild) {
                    statusDiv.removeChild(statusDiv.firstChild);
                  }
                  const errorMsg = doc.createElement('div');
                  errorMsg.style.cssText = 'color: #e74c3c; font-size: 12px; margin-top: 8px;';
                  errorMsg.textContent = '❌ Please log in first to extract annotations';
                  statusDiv.appendChild(errorMsg);
                  return;
                }

                // Extract annotations from current item
                const annotations = await Zotero.Researchopia.annotations.extractAnnotations(item);

                if (annotations.length === 0) {
                  statusDiv.innerHTML = '<div style="color: #f39c12; font-size: 12px; margin-top: 8px;">📝 No annotations found in this paper</div>';
                  annotationsContainer.innerHTML = `
                    <div style="text-align: center; color: #666; padding: 20px;">
                      <div style="font-size: 48px; margin-bottom: 8px;">�</div>
                      <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">No annotations found</div>
                      <div style="font-size: 12px;">Please add annotations to the PDF first</div>
                    </div>
                  `;
                  return;
                }

                // Display extracted annotations
                let annotationsHTML = `<div style="font-size: 14px; font-weight: 500; margin-bottom: 12px; color: #333;">� My Annotations (${annotations.length})</div>`;

                annotations.forEach((annotation, index) => {
                  annotationsHTML += `
                    <div style="border-bottom: 1px solid #eee; padding: 12px 0;">
                      <div style="display: flex; align-items: start; gap: 8px;">
                        <input type="checkbox" id="annotation-${index}" style="margin-top: 4px;" checked>
                        <div style="flex: 1;">
                          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-weight: 500; font-size: 13px; color: #333;">You</span>
                            <span style="font-size: 11px; color: #666;">${new Date(annotation.dateAdded).toLocaleDateString()}</span>
                            <span style="background: #e8f5e8; color: #2e7d32; padding: 2px 6px; border-radius: 10px; font-size: 10px;">Page ${annotation.page}</span>
                          </div>
                          ${annotation.text ? `
                            <div style="background: #fff3cd; border-left: 3px solid #ffc107; padding: 8px; border-radius: 4px; margin-bottom: 6px; font-size: 13px; line-height: 1.4;">
                              ${annotation.text}
                            </div>
                          ` : ''}
                          ${annotation.comment ? `
                            <div style="font-size: 12px; color: #555; margin-bottom: 8px;">
                              💭 ${annotation.comment}
                            </div>
                          ` : ''}
                          <div style="font-size: 11px; color: #999;">
                            Type: ${annotation.type} | Color: <span style="display: inline-block; width: 12px; height: 12px; background: ${annotation.color}; border-radius: 2px; vertical-align: middle;"></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  `;
                });

                annotationsContainer.innerHTML = annotationsHTML;
                statusDiv.innerHTML = `<div style="color: #27ae60; font-size: 12px; margin-top: 8px;">✅ Extracted ${annotations.length} annotations</div>`;
              } catch (error) {
                statusDiv.innerHTML = `<div style="color: #e74c3c; font-size: 12px; margin-top: 8px;">❌ Error: ${error.message}</div>`;
              } finally {
                extractBtn.disabled = false;
                extractIcon.textContent = '📋';
                extractText.textContent = '提取标注';
                extractBtn.style.background = '#28a745';
              }
            };

            // 2. Share My Annotations Function
            const shareMyAnnotations = async function() {
              shareBtn.disabled = true;
              shareIcon.textContent = '⏳';
              shareText.textContent = '共享中...';
              shareBtn.style.background = '#6c757d';

              try {
                // Check if user is logged in
                if (!Zotero.Researchopia?.auth?.isLoggedIn()) {
                  statusDiv.innerHTML = '<div style="color: #e74c3c; font-size: 12px; margin-top: 8px;">❌ Please log in first to share annotations</div>';
                  return;
                }

                // Get selected annotations from checkboxes
                const checkboxes = annotationsContainer.querySelectorAll('input[type="checkbox"]:checked');
                if (checkboxes.length === 0) {
                  statusDiv.innerHTML = '<div style="color: #f39c12; font-size: 12px; margin-top: 8px;">📝 Please extract annotations first and select which ones to share</div>';
                  return;
                }

                // Extract all annotations first
                const allAnnotations = await Zotero.Researchopia.annotations.extractAnnotations(item);
                const selectedAnnotations = [];

                checkboxes.forEach((checkbox, index) => {
                  if (checkbox.checked && allAnnotations[index]) {
                    selectedAnnotations.push(allAnnotations[index]);
                  }
                });

                if (selectedAnnotations.length === 0) {
                  statusDiv.innerHTML = '<div style="color: #f39c12; font-size: 12px; margin-top: 8px;">📝 No annotations selected for sharing</div>';
                  return;
                }

                // Upload selected annotations
                const result = await Zotero.Researchopia.annotations.uploadAnnotations(selectedAnnotations, doi);

                if (result.success) {
                  statusDiv.innerHTML = `<div style="color: #27ae60; font-size: 12px; margin-top: 8px;">✅ Successfully shared ${result.count} annotations</div>`;
                } else {
                  statusDiv.innerHTML = `<div style="color: #e74c3c; font-size: 12px; margin-top: 8px;">❌ Failed to share: ${result.error}</div>`;
                }
              } catch (error) {
                statusDiv.innerHTML = `<div style="color: #e74c3c; font-size: 12px; margin-top: 8px;">❌ Error: ${error.message}</div>`;
              } finally {
                shareBtn.disabled = false;
                shareIcon.textContent = '📤';
                shareText.textContent = '共享标注';
                shareBtn.style.background = '#007acc';
              }
            };

            // 3. View Shared Annotations Function
            const viewSharedAnnotations = async function() {
              viewBtn.disabled = true;
              viewIcon.textContent = '⏳';
              viewText.textContent = '加载中...';
              viewBtn.style.background = '#495057';

              try {
                const sharedAnnotations = await Zotero.Researchopia.annotations.fetchSharedAnnotations(doi);

                if (sharedAnnotations.length === 0) {
                  annotationsContainer.innerHTML = `
                    <div style="text-align: center; color: #666; padding: 20px;">
                      <div style="font-size: 48px; margin-bottom: 8px;">👥</div>
                      <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">No shared annotations yet</div>
                      <div style="font-size: 12px;">Be the first to share annotations for this paper!</div>
                    </div>
                  `;
                } else {
                  // Display shared annotations
                  let annotationsHTML = `<div style="font-size: 14px; font-weight: 500; margin-bottom: 12px; color: #333;">👥 Shared Annotations (${sharedAnnotations.length})</div>`;

                  sharedAnnotations.forEach(annotation => {
                    const username = annotation.profiles?.username || 'Anonymous';
                    const initials = username.substring(0, 2).toUpperCase();
                    const date = new Date(annotation.created_at).toLocaleDateString();

                    annotationsHTML += `
                      <div style="border-bottom: 1px solid #eee; padding: 12px 0;">
                        <div style="display: flex; align-items: start; gap: 8px;">
                          <div style="width: 32px; height: 32px; border-radius: 50%; background: #007acc; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; flex-shrink: 0;">
                            ${initials}
                          </div>
                          <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                              <span style="font-weight: 500; font-size: 13px; color: #333;">${username}</span>
                              <span style="font-size: 11px; color: #666;">${date}</span>
                              <span style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 10px; font-size: 10px;">Page ${annotation.page_number}</span>
                            </div>
                            ${annotation.content ? `
                              <div style="background: #fff3cd; border-left: 3px solid #ffc107; padding: 8px; border-radius: 4px; margin-bottom: 6px; font-size: 13px; line-height: 1.4;">
                                ${annotation.content}
                              </div>
                            ` : ''}
                            ${annotation.comment ? `
                              <div style="font-size: 12px; color: #555; margin-bottom: 8px;">
                                💭 ${annotation.comment}
                              </div>
                            ` : ''}
                            <div style="display: flex; align-items: center; gap: 12px; font-size: 12px;">
                              <button style="background: none; border: none; color: #666; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                ❤️ 0
                              </button>
                              <button style="background: none; border: none; color: #666; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                💬 0
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    `;
                  });

                  annotationsContainer.innerHTML = annotationsHTML;
                }

                statusDiv.innerHTML = `<div style="color: #27ae60; font-size: 12px; margin-top: 8px;">✅ Loaded ${sharedAnnotations.length} shared annotations</div>`;
              } catch (error) {
                statusDiv.innerHTML = `<div style="color: #e74c3c; font-size: 12px; margin-top: 8px;">❌ Failed to load annotations: ${error.message}</div>`;
              } finally {
                viewBtn.disabled = false;
                viewIcon.textContent = '👥';
                viewText.textContent = '查看共享';
                viewBtn.style.background = '#6c757d';
              }
            };

            // Add event listeners
            extractBtn.addEventListener('click', extractMyAnnotations);
            shareBtn.addEventListener('click', shareMyAnnotations);
            viewBtn.addEventListener('click', viewSharedAnnotations);

            // Annotations container
            const annotationsContainer = doc.createElement('div');
            annotationsContainer.id = 'annotations-container';
            annotationsContainer.style.cssText = 'max-height: 300px; overflow-y: auto; border: 1px solid #eee; border-radius: 6px; padding: 16px; margin-bottom: 12px;';

            // Create welcome message safely
            const welcomeDiv = doc.createElement('div');
            welcomeDiv.style.cssText = 'text-align: center; color: #666;';

            const welcomeIcon = doc.createElement('div');
            welcomeIcon.style.cssText = 'font-size: 48px; margin-bottom: 8px;';
            welcomeIcon.textContent = '📚';

            const welcomeTitle = doc.createElement('div');
            welcomeTitle.style.cssText = 'font-size: 14px; font-weight: 500; margin-bottom: 4px;';
            welcomeTitle.textContent = 'Welcome to Researchopia';

            const welcomeDesc = doc.createElement('div');
            welcomeDesc.style.cssText = 'font-size: 12px;';
            welcomeDesc.textContent = 'Click "提取标注" to extract your annotations, "共享标注" to share selected ones, or "查看共享" to see community annotations';

            welcomeDiv.appendChild(welcomeIcon);
            welcomeDiv.appendChild(welcomeTitle);
            welcomeDiv.appendChild(welcomeDesc);
            annotationsContainer.appendChild(welcomeDiv);
            container.appendChild(annotationsContainer);

            // Status message
            const statusDiv = doc.createElement('div');
            statusDiv.id = 'status-message';
            statusDiv.style.cssText = 'margin-top: 8px;';
            container.appendChild(statusDiv);

            // Clear body and append container
            body.innerHTML = '';
            body.appendChild(container);

            Zotero.debug("Researchopia: UI rendered successfully for item: " + title);
          } catch (error) {
            Zotero.debug("Researchopia: Error rendering UI:", error);
            body.innerHTML = '<div style="padding: 16px; color: #e74c3c;">Error loading annotations. Please try again later.</div>';
          }
        },
      });
      Zotero.debug("Researchopia: Item pane section registered with ID:", registeredID);
    } else {
      Zotero.debug("Researchopia: ItemPaneManager not available");
    }

    // Load auth module directly
    try {
      Zotero.debug("Researchopia: Loading auth module from: " + rootURI + "content/auth.js");

      // Create a proper context for the script
      const authContext = {
        Zotero: Zotero,
        Services: Services,
        Components: Components,
        ChromeUtils: ChromeUtils,
        XMLHttpRequest: XMLHttpRequest // Make sure XMLHttpRequest is available
      };

      Services.scriptloader.loadSubScript(
        `${rootURI}content/auth.js`,
        authContext
      );

      Zotero.debug("Researchopia: Auth script loaded, checking for ResearchopiaAuth...");

      // Make auth module globally available
      if (authContext.ResearchopiaAuth) {
        if (!Zotero.Researchopia) {
          Zotero.Researchopia = {};
        }
        Zotero.Researchopia.auth = authContext.ResearchopiaAuth;
        Zotero.debug("Researchopia: Auth module loaded and attached to Zotero.Researchopia.auth");
      } else {
        Zotero.debug("Researchopia: ResearchopiaAuth not found in script context");
      }
    } catch (scriptError) {
      Zotero.debug("Researchopia: Failed to load auth module:", scriptError);
      Zotero.debug("Researchopia: Error details:", scriptError.message);
      Zotero.debug("Researchopia: Error stack:", scriptError.stack);
    }

    // Load annotations module
    try {
      Zotero.debug("Researchopia: Loading annotations module from: " + rootURI + "content/annotations.js");

      const annotationsContext = {
        Zotero: Zotero,
        Services: Services,
        Components: Components,
        ChromeUtils: ChromeUtils,
        XMLHttpRequest: XMLHttpRequest
      };

      Services.scriptloader.loadSubScript(
        `${rootURI}content/annotations.js`,
        annotationsContext
      );

      if (annotationsContext.ResearchopiaAnnotations) {
        if (!Zotero.Researchopia) {
          Zotero.Researchopia = {};
        }
        Zotero.Researchopia.annotations = annotationsContext.ResearchopiaAnnotations;
        Zotero.debug("Researchopia: Annotations module loaded and attached to Zotero.Researchopia.annotations");
      } else {
        Zotero.debug("Researchopia: ResearchopiaAnnotations not found in script context");
      }
    } catch (scriptError) {
      Zotero.debug("Researchopia: Failed to load annotations module:", scriptError);
    }

    Zotero.debug("Researchopia: Bootstrap startup completed successfully");
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
