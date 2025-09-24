import { getString } from "../utils/locale";

export class UIManager {
  renderPane(body: Element, item: Zotero.Item): void {
    const ztoolkit = Zotero.Researchopia.data.ztoolkit;
    
    try {
      ztoolkit.log('🔍 Rendering pane for item:', item.getDisplayTitle());
      
      // Clear existing content
      body.innerHTML = '';
      
      // Create container
      const container = ztoolkit.UI.createElement(body.ownerDocument, "div", {
        styles: {
          padding: "10px",
          fontFamily: "system-ui, -apple-system, sans-serif"
        }
      });
      body.appendChild(container);
      
      // Title
      const title = ztoolkit.UI.createElement(container.ownerDocument, "h3", {
        properties: {
          textContent: getString("researchopia-name")
        },
        styles: {
          margin: "0 0 10px 0",
          color: "#333"
        }
      });
      container.appendChild(title);
      
      // Status
      const status = ztoolkit.UI.createElement(container.ownerDocument, "div", {
        properties: {
          textContent: getString("researchopia-status-ready")
        },
        styles: {
          marginBottom: "15px",
          color: "#666",
          fontSize: "12px"
        }
      });
      container.appendChild(status);
      
      // Buttons container
      const buttonsContainer = ztoolkit.UI.createElement(container.ownerDocument, "div", {
        styles: {
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }
      });
      container.appendChild(buttonsContainer);
      
      // Extract button
      const extractBtn = ztoolkit.UI.createElement(buttonsContainer.ownerDocument, "button", {
        id: "researchopia-extract-btn",
        properties: {
          textContent: getString("researchopia-button-extract")
        },
        styles: {
          padding: "8px 12px",
          backgroundColor: "#007acc",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer"
        }
      });
      buttonsContainer.appendChild(extractBtn);
      
      // Share button
      const shareBtn = ztoolkit.UI.createElement(buttonsContainer.ownerDocument, "button", {
        id: "researchopia-share-btn",
        properties: {
          textContent: getString("researchopia-button-share")
        },
        styles: {
          padding: "8px 12px",
          backgroundColor: "#28a745",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer"
        }
      });
      buttonsContainer.appendChild(shareBtn);
      
      // View button
      const viewBtn = ztoolkit.UI.createElement(buttonsContainer.ownerDocument, "button", {
        id: "researchopia-view-btn",
        properties: {
          textContent: getString("researchopia-button-view")
        },
        styles: {
          padding: "8px 12px",
          backgroundColor: "#6c757d",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer"
        }
      });
      buttonsContainer.appendChild(viewBtn);
      
      // Bind events
      this.bindEvents(container, item);
      
    } catch (error) {
      ztoolkit.log(`❌ Error rendering pane: ${error.message}`);
      body.innerHTML = `<div style="color: red; padding: 10px;">Error: ${error.message}</div>`;
    }
  }
  
  private bindEvents(container: Element, item: Zotero.Item): void {
    const ztoolkit = Zotero.Researchopia.data.ztoolkit;
    
    const extractBtn = container.querySelector('#researchopia-extract-btn');
    const shareBtn = container.querySelector('#researchopia-share-btn');
    const viewBtn = container.querySelector('#researchopia-view-btn');
    
    if (extractBtn) {
      extractBtn.addEventListener('click', async () => {
        try {
          const annotations = await this.extractAnnotations(item);
          ztoolkit.getGlobal("alert")(`Extracted ${annotations.length} annotations`);
        } catch (error) {
          ztoolkit.getGlobal("alert")(`Error: ${error.message}`);
        }
      });
    }
    
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        try {
          const annotations = await this.extractAnnotations(item);
          if (annotations.length === 0) {
            ztoolkit.getGlobal("alert")("No annotations found to share");
            return;
          }
          
          await Zotero.Researchopia.api.supabase.uploadAnnotations(annotations);
          ztoolkit.getGlobal("alert")(`Successfully shared ${annotations.length} annotations`);
        } catch (error) {
          ztoolkit.getGlobal("alert")(`Upload failed: ${error.message}`);
        }
      });
    }
    
    if (viewBtn) {
      viewBtn.addEventListener('click', async () => {
        try {
          const doi = item.getField("DOI");
          if (!doi) {
            ztoolkit.getGlobal("alert")("No DOI found for this item");
            return;
          }
          
          const sharedAnnotations = await Zotero.Researchopia.api.supabase.getSharedAnnotations(doi);
          ztoolkit.getGlobal("alert")(`Found ${sharedAnnotations.length} shared annotations`);
        } catch (error) {
          ztoolkit.getGlobal("alert")(`Error: ${error.message}`);
        }
      });
    }
  }
  
  async extractAnnotations(item: Zotero.Item): Promise<Annotation[]> {
    const ztoolkit = Zotero.Researchopia.data.ztoolkit;
    
    try {
      const doi = item.getField("DOI");
      const attachments = await item.getBestAttachments();
      const annotations: Annotation[] = [];
      
      for (const attachment of attachments) {
        if (attachment.isPDFAttachment()) {
          const itemAnnotations = attachment.getAnnotations();
          
          for (const ann of itemAnnotations) {
            const annotationData: Annotation = {
              key: ann.key,
              type: ann.annotationType || 'highlight',
              text: ann.annotationText || '',
              comment: ann.annotationComment || '',
              color: ann.annotationColor || '#ffd400',
              page: ann.annotationPageLabel ? parseInt(ann.annotationPageLabel) : 1,
              paperDoi: doi,
              position: ann.annotationPosition
            };
            
            annotations.push(annotationData);
          }
        }
      }
      
      ztoolkit.log(`📋 Extracted ${annotations.length} annotations for DOI: ${doi}`);
      return annotations;
      
    } catch (error) {
      ztoolkit.log(`❌ Error extracting annotations: ${error.message}`);
      throw error;
    }
  }
}
