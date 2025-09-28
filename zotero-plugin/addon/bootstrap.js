// Bootstrap for Researchopia Zotero Plugin - Redesigned
// Based on Zotero 8 development guidelines

if (typeof Zotero === 'undefined') {
  var Zotero;
}

// Global context setup for Zotero 8
if (typeof _globalThis === 'undefined') {
  var _globalThis = this;
}

// Supabase configuration
const SUPABASE_URL = "https://obcblvdtqhwrihoddlez.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4";
// Use service role key to bypass RLS for anonymous users
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ5ODIzNSwiZXhwIjoyMDczMDc0MjM1fQ.ywlXk4IOZ-eyGhJXmVve-zSNHo5fUnOK0fwJf32EjCE";

// Simple ztoolkit polyfill for ProgressWindow
if (typeof ztoolkit === 'undefined') {
  var ztoolkit = {
    ProgressWindow: class {
      constructor(title) {
        this.title = title || "Researchopia";
        this.currentLine = null;
        this.window = null;
      }
      
      createLine(options) {
        this.currentLine = options;
        return this;
      }
      
      changeLine(options) {
        this.currentLine = options;
        this.show();
        return this;
      }
      
      show() {
        try {
          if (this.window) {
            try { this.window.close(); } catch(e) {}
          }
          
          this.window = new Zotero.ProgressWindow({ closeOnClick: true });
          this.window.changeHeadline(this.title);
          
          if (this.currentLine) {
            let message = this.currentLine.text || "";
            if (this.currentLine.progress) {
              message += ` (${this.currentLine.progress}%)`;
            }
            this.window.addDescription(message);
          }
          
          this.window.show();
          
          if (this.currentLine && this.currentLine.progress === 100) {
            setTimeout(() => this.close(), 3000);
          }
        } catch (error) {
          Zotero.debug("ProgressWindow error: " + error.message);
        }
        return this;
      }
      
      close() {
        if (this.window) {
          try { 
            this.window.close(); 
          } catch(e) { 
            Zotero.debug("Error closing ProgressWindow: " + e.message);
          }
          this.window = null;
        }
      }
    }
  };
}

// Global state management
const ResearchopiaState = {
  currentAnnotations: [],
  selectedAnnotations: [],
  sharedAnnotations: [],
  currentMode: 'default', // 'extract', 'share', 'view'
  currentItem: null,
  // Auth state
  currentUser: null,
  accessToken: null,
  isAuthenticated: false
};

// Global Authentication Manager
const ResearchopiaAuth = {
  supabaseUrl: 'https://obcblvdtqhwrihoddlez.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4',
  serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ5ODIzNSwiZXhwIjoyMDczMDc0MjM1fQ.ywlXk4IOZ-eyGhJXmVve-zSNHo5fUnOK0fwJf32EjCE',

  init() {
    this.loadAuthState();
  },

  loadAuthState() {
    try {
      // Check new preference format first (used by preferences.js)
      let email = Zotero.Prefs.get('extensions.zotero.researchopia.email', true);
      let accessToken = Zotero.Prefs.get('extensions.zotero.researchopia.accessToken', true);
      let userDataStr = Zotero.Prefs.get('extensions.zotero.researchopia.user', true);
      
      if (email && accessToken && userDataStr) {
        ResearchopiaState.accessToken = accessToken;
        ResearchopiaState.currentUser = JSON.parse(userDataStr);
        ResearchopiaState.isAuthenticated = true;
        
        Zotero.debug("Researchopia: Loaded auth state from new preferences for: " + email);
        return true;
      }

      // Fallback to old preference format
      email = Zotero.Prefs.get('extensions.researchopia.auth.email', true);
      accessToken = Zotero.Prefs.get('extensions.researchopia.auth.accessToken', true);
      userDataStr = Zotero.Prefs.get('extensions.researchopia.auth.userData', true);
      
      if (email && accessToken && userDataStr) {
        ResearchopiaState.accessToken = accessToken;
        ResearchopiaState.currentUser = JSON.parse(userDataStr);
        ResearchopiaState.isAuthenticated = true;
        
        Zotero.debug("Researchopia: Loaded auth state from legacy preferences for: " + email);
        return true;
      }
    } catch (error) {
      Zotero.debug("Researchopia: Error loading auth state: " + error.message);
    }
    
    ResearchopiaState.isAuthenticated = false;
    return false;
  },

  saveAuthState(email, accessToken, userData) {
    try {
      Zotero.Prefs.set('extensions.researchopia.auth.email', email, true);
      Zotero.Prefs.set('extensions.researchopia.auth.accessToken', accessToken, true);
      Zotero.Prefs.set('extensions.researchopia.auth.userData', JSON.stringify(userData), true);
      Zotero.Prefs.set('extensions.researchopia.auth.loginTime', new Date().toISOString(), true);
    } catch (error) {
      Zotero.debug("Researchopia: Error saving auth state: " + error.message);
    }
  },

  clearAuthState() {
    try {
      Zotero.Prefs.clear('extensions.researchopia.auth.email', true);
      Zotero.Prefs.clear('extensions.researchopia.auth.accessToken', true);
      Zotero.Prefs.clear('extensions.researchopia.auth.userData', true);
      Zotero.Prefs.clear('extensions.researchopia.auth.loginTime', true);
    } catch (error) {
      Zotero.debug("Researchopia: Error clearing auth state: " + error.message);
    }
  },

  getCurrentUser() {
    return ResearchopiaState.currentUser;
  },

  getAccessToken() {
    return ResearchopiaState.accessToken;
  },

  isLoggedIn() {
    return ResearchopiaState.isAuthenticated && ResearchopiaState.currentUser && ResearchopiaState.accessToken;
  },

  // Get current user ID - return actual user ID if logged in
  getCurrentUserId() {
    if (this.isLoggedIn() && ResearchopiaState.currentUser) {
      return ResearchopiaState.currentUser.id;
    }
    // Return null if not logged in instead of fallback anonymous ID
    return null;
  },

  // Get current user's real name for display purposes
  getCurrentUserDisplayName() {
    if (this.isLoggedIn() && ResearchopiaState.currentUser) {
      const user = ResearchopiaState.currentUser;
      
      // Try to get username from user metadata first
      const username = user.user_metadata?.username ||
                      user.user_metadata?.name ||
                      user.user_metadata?.full_name;
      
      if (username) {
        return username;
      }
      
      // Fallback to email prefix
      if (user.email) {
        return user.email.split('@')[0];
      }
    }
    
    return null; // No real name available
  },

  // Get appropriate auth headers with token validation
  getAuthHeaders() {
    if (this.isLoggedIn()) {
      // Check if token might be expiring soon (warn at 50 minutes)
      this.checkTokenExpiry();
      return {
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${ResearchopiaState.accessToken}`
      };
    } else {
      // Use service role key for anonymous operations
      return {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${this.serviceKey}`
      };
    }
  },

  // Check if token is approaching expiry
  checkTokenExpiry() {
    try {
      const loginTimeStr = Zotero.Prefs.get('extensions.researchopia.auth.loginTime', true);
      if (!loginTimeStr) return;

      const loginTime = new Date(loginTimeStr);
      const now = new Date();
      const minutesSinceLogin = (now - loginTime) / (1000 * 60);
      
      // Warn if token has been active for 50+ minutes (JWT expires at 60 minutes)
      if (minutesSinceLogin >= 50 && minutesSinceLogin < 55) {
        new ztoolkit.ProgressWindow("Researchopia")
          .createLine({
            text: "⚠️ 登录将在10分钟内过期，建议先保存工作",
            type: "default", 
            progress: 100
          })
          .show();
      }
    } catch (error) {
      Zotero.debug("Researchopia: Error checking token expiry: " + error.message);
    }
  },

  // Sign out and clear auth state
  signOut() {
    ResearchopiaState.isAuthenticated = false;
    ResearchopiaState.currentUser = null;
    ResearchopiaState.accessToken = null;
    this.clearAuthState();
    
    Zotero.debug("Researchopia: User signed out, auth state cleared");
  },

  // Handle API errors, especially auth-related ones
  handleApiError(response, error) {
    if (response && response.status === 401) {
      // Token expired, clear auth state and prompt re-login
      ResearchopiaAuth.signOut();
      new ztoolkit.ProgressWindow("Researchopia")
        .createLine({
          text: "⚠️ 登录已过期，请重新登录",
          type: "fail",
          progress: 100
        })
        .show();
      return { shouldRetry: false, message: "登录已过期，请重新登录" };
    }
    return { shouldRetry: false, message: error?.message || "未知错误" };
  }
};

async function install() {
  Zotero.debug("Researchopia: Install called - v0.1.1");
}

async function startup({ id, version, resourceURI, rootURI }) {
  try {
    Zotero.debug("Researchopia: Bootstrap startup called");
    Zotero.debug(`Researchopia: Plugin ID: ${id}, Version: ${version}`);
    
    // Initialize authentication manager
    ResearchopiaAuth.init();
    
    // Register the Item Pane section
    try {
      if (Zotero.ItemPaneManager) {
        Zotero.ItemPaneManager.registerSection({
          paneID: "researchopia-annotations",
          pluginID: id,
          header: {
            l10nID: "researchopia-researchopia-annotations-header",
            icon: "chrome://zotero/skin/16/universal/book.svg"
          },
          sidenav: {
            l10nID: "researchopia-researchopia-annotations-sidenav", 
            icon: "chrome://zotero/skin/16/universal/book.svg"
          },
          onRender: ({ body, item, setL10nArgs, setSectionSummary, setSectionButtonStatus }) => {
            Zotero.debug("Researchopia: Item section onRender called");
            
            // Store current item
            ResearchopiaState.currentItem = item;
            
            // Clear existing content
            while (body.firstChild) {
              body.removeChild(body.firstChild);
            }
            
            // Create main container
            const container = body.ownerDocument.createElement('div');
            container.style.cssText = 'padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
            
            // Create header section
            const header = createHeaderSection(body.ownerDocument, item);
            container.appendChild(header);
            
            // Create button section
            const buttonSection = createButtonSection(body.ownerDocument, item, container);
            container.appendChild(buttonSection);
            
            // Create main content area
            const contentArea = body.ownerDocument.createElement('div');
            contentArea.id = 'researchopia-content';
            contentArea.style.cssText = 'margin-top: 16px; min-height: 200px; background: #fafafa; border-radius: 6px; border: 1px solid #e1e5e9;';
            
            // Initial content
            const initialContent = createInitialContent(body.ownerDocument, item);
            contentArea.appendChild(initialContent);
            
            container.appendChild(contentArea);
            body.appendChild(container);
          },
          
          onItemChange: ({ body, item, setL10nArgs, setSectionSummary, setSectionButtonStatus }) => {
            Zotero.debug("Researchopia: Item changed");
            ResearchopiaState.currentItem = item;
            
            // Update content if item changed
            const contentArea = body.ownerDocument.getElementById('researchopia-content');
            if (contentArea && ResearchopiaState.currentMode === 'default') {
              while (contentArea.firstChild) {
                contentArea.removeChild(contentArea.firstChild);
              }
              const initialContent = createInitialContent(body.ownerDocument, item);
              contentArea.appendChild(initialContent);
            }
          }
        });
        
        Zotero.debug("Researchopia: ItemPaneManager section registered successfully");
      } else {
        Zotero.debug("Researchopia: ItemPaneManager not available");
      }
    } catch (error) {
      Zotero.debug("Researchopia: Error registering ItemPaneManager section: " + error.message);
    }
    
    // Register preference pane
    try {
      if (Zotero.PreferencePanes) {
        Zotero.PreferencePanes.register({
          pluginID: id,
          src: "content/preferences.xhtml",
          scripts: ["content/preferences.js"],
          stylesheets: ["content/preferences.css"]
        });
        Zotero.debug("Researchopia: Preference pane registered successfully");
      } else {
        Zotero.debug("Researchopia: PreferencePanes not available");
      }
    } catch (error) {
      Zotero.debug("Researchopia: Error registering preference pane: " + error.message);
    }
    
  } catch (error) {
    Zotero.debug("Researchopia: Startup error: " + error.message);
    Zotero.debug("Researchopia: Error stack: " + error.stack);
  }
}

// Create header section
function createHeaderSection(doc, item) {
  const header = doc.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #e1e5e9;';
  
  const titleSection = doc.createElement('div');
  
  const title = doc.createElement('h3');
  title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;';
  title.textContent = '社区标注';
  
  const subtitle = doc.createElement('div');
  subtitle.style.cssText = 'font-size: 12px; color: #666; margin-top: 4px;';
  subtitle.textContent = '协作式文献标注系统';
  
  titleSection.appendChild(title);
  titleSection.appendChild(subtitle);
  
  const status = doc.createElement('div');
  status.style.cssText = 'font-size: 11px; padding: 4px 8px; border-radius: 12px; background: #e8f5e8; color: #2d5a2d; font-weight: 500;';
  status.textContent = 'Beta';
  
  header.appendChild(titleSection);
  header.appendChild(status);
  
  return header;
}

// Create button section
function createButtonSection(doc, item, container) {
  const buttonSection = doc.createElement('div');
  buttonSection.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
  
  // Extract annotations button
  const extractBtn = doc.createElement('button');
  extractBtn.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: none; border-radius: 6px; background: #28a745; color: white; font-size: 14px; font-weight: 500; cursor: pointer; transition: background-color 0.2s;';
  extractBtn.onmouseover = () => extractBtn.style.backgroundColor = '#218838';
  extractBtn.onmouseout = () => extractBtn.style.backgroundColor = '#28a745';
  
  const extractIcon = doc.createElement('span');
  extractIcon.textContent = '📝';
  const extractText = doc.createElement('span');
  extractText.textContent = '提取我的标注';
  extractBtn.appendChild(extractIcon);
  extractBtn.appendChild(extractText);
  
  extractBtn.addEventListener('click', () => {
    handleExtractAnnotations(item, container);
  });
  
  // Share annotations button
  const shareBtn = doc.createElement('button');
  shareBtn.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: none; border-radius: 6px; background: #17a2b8; color: white; font-size: 14px; font-weight: 500; cursor: pointer; transition: background-color 0.2s;';
  shareBtn.onmouseover = () => shareBtn.style.backgroundColor = '#138496';
  shareBtn.onmouseout = () => shareBtn.style.backgroundColor = '#17a2b8';
  
  const shareIcon = doc.createElement('span');
  shareIcon.textContent = '🚀';
  const shareText = doc.createElement('span');
  shareText.textContent = '共享我的标注';
  shareBtn.appendChild(shareIcon);
  shareBtn.appendChild(shareText);
  
  shareBtn.addEventListener('click', () => {
    handleShareAnnotations(item, container);
  });
  
  // View shared annotations button
  const viewBtn = doc.createElement('button');
  viewBtn.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: none; border-radius: 6px; background: #6f42c1; color: white; font-size: 14px; font-weight: 500; cursor: pointer; transition: background-color 0.2s;';
  viewBtn.onmouseover = () => viewBtn.style.backgroundColor = '#5a32a3';
  viewBtn.onmouseout = () => viewBtn.style.backgroundColor = '#6f42c1';
  
  const viewIcon = doc.createElement('span');
  viewIcon.textContent = '👥';
  const viewText = doc.createElement('span');
  viewText.textContent = '查看共享标注';
  viewBtn.appendChild(viewIcon);
  viewBtn.appendChild(viewText);
  
  viewBtn.addEventListener('click', () => {
    handleViewSharedAnnotations(item, container);
  });
  
  buttonSection.appendChild(extractBtn);
  buttonSection.appendChild(shareBtn);
  buttonSection.appendChild(viewBtn);
  
  return buttonSection;
}

// Create initial content
function createInitialContent(doc, item) {
  const content = doc.createElement('div');
  content.style.cssText = 'padding: 24px; text-align: center;';
  
  const icon = doc.createElement('div');
  icon.style.cssText = 'font-size: 48px; margin-bottom: 16px;';
  icon.textContent = '📚';
  
  const message = doc.createElement('div');
  message.style.cssText = 'font-size: 14px; color: #666; margin-bottom: 8px;';
  
  const submessage = doc.createElement('div');
  submessage.style.cssText = 'font-size: 12px; color: #999;';
  
  if (!item) {
    message.textContent = '请选择一个文献项目';
    submessage.textContent = '选择文献后即可使用标注功能';
  } else {
    const doi = getItemDOI(item);
    message.textContent = `当前文献：${item.getDisplayTitle() || '未知标题'}`;
    submessage.textContent = doi ? `DOI: ${doi}` : '此文献没有DOI';
  }
  
  content.appendChild(icon);
  content.appendChild(message);
  content.appendChild(submessage);
  
  return content;
}

// Handle extract annotations
async function handleExtractAnnotations(item, container) {
  const contentArea = container.querySelector('#researchopia-content');
  if (!contentArea) return;
  
  ResearchopiaState.currentMode = 'extract';
  
  // Show loading
  showLoading(contentArea, '正在提取标注...');
  
  try {
    const annotations = await extractAnnotationsFromItem(item);
    ResearchopiaState.currentAnnotations = annotations;
    
    // Display annotations in panel
    displayExtractedAnnotations(contentArea, annotations, item);
    
  } catch (error) {
    Zotero.debug("Researchopia: Extract error: " + error.message);
    showError(contentArea, '提取标注失败：' + error.message);
  }
}

// Handle share annotations
async function handleShareAnnotations(item, container) {
  const contentArea = container.querySelector('#researchopia-content');
  if (!contentArea) return;
  
  ResearchopiaState.currentMode = 'share';
  
  // Show loading
  showLoading(contentArea, '正在准备标注数据...');
  
  try {
    const doi = getItemDOI(item);
    if (!doi) {
      showError(contentArea, '此文献没有DOI，无法共享标注');
      return;
    }
    
    const annotations = await extractAnnotationsFromItem(item);
    if (annotations.length === 0) {
      showError(contentArea, '没有找到可共享的标注');
      return;
    }
    
    ResearchopiaState.currentAnnotations = annotations;
    ResearchopiaState.selectedAnnotations = [];
    
    // Display annotation selection interface
    displayAnnotationSelection(contentArea, annotations, item, doi);
    
  } catch (error) {
    Zotero.debug("Researchopia: Share error: " + error.message);
    showError(contentArea, '准备标注数据失败：' + error.message);
  }
}

// Handle view shared annotations
async function handleViewSharedAnnotations(item, container) {
  const contentArea = container.querySelector('#researchopia-content');
  if (!contentArea) return;
  
  ResearchopiaState.currentMode = 'view';
  
  // Show loading
  showLoading(contentArea, '正在加载共享标注...');
  
  try {
    const doi = getItemDOI(item);
    if (!doi) {
      showError(contentArea, '此文献没有DOI，无法查看共享标注');
      return;
    }
    
    const sharedAnnotations = await fetchSharedAnnotations(doi);
    ResearchopiaState.sharedAnnotations = sharedAnnotations;
    
    // Show success notification if annotations found
    if (sharedAnnotations && sharedAnnotations.length > 0) {
      new ztoolkit.ProgressWindow("Researchopia")
        .createLine({
          text: `📚 找到 ${sharedAnnotations.length} 个共享标注`,
          type: "success",
          progress: 100
        })
        .show();
    }
    
    // Display shared annotations
    displaySharedAnnotations(contentArea, sharedAnnotations, item, doi);
    
  } catch (error) {
    Zotero.debug("Researchopia: View shared error: " + error.message);
    showError(contentArea, '加载共享标注失败：' + error.message);
    
    // Show error notification
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: `❌ 无法加载共享标注：${error.message.includes('HTTP') ? '网络错误' : '系统错误'}`,
        type: "fail",
        progress: 100
      })
      .show();
  }
}

// Extract annotations from item
async function extractAnnotationsFromItem(item) {
  if (!item) {
    throw new Error('没有选中的文献项目');
  }
  
  const annotations = [];
  
  try {
    const attachments = item.getAttachments() || [];
    let pdfCount = 0;
    
    for (const attachmentID of attachments) {
      try {
        const attachment = Zotero.Items.get(attachmentID);
        if (!attachment) continue;
        
        if (attachment.isPDFAttachment && attachment.isPDFAttachment()) {
          pdfCount++;
          const attachmentAnnotations = await attachment.getAnnotations();
          
          for (const annotation of attachmentAnnotations) {
            try {
              const text = annotation.annotationText || "";
              const comment = annotation.annotationComment || "";
              
              if (text || comment) {
                annotations.push({
                  id: annotation.id,
                  text: text,
                  comment: comment,
                  type: annotation.annotationType || "highlight",
                  page: annotation.annotationPageLabel || "",
                  color: annotation.annotationColor || "#ffff00",
                  created: annotation.dateAdded || new Date(),
                  position: annotation.annotationPosition,
                  attachmentId: attachmentID
                });
              }
            } catch (e) {
              Zotero.debug(`Researchopia: 处理标注失败: ${e.message}`);
            }
          }
        }
      } catch (e) {
        Zotero.debug(`Researchopia: 处理附件 ${attachmentID} 失败: ${e.message}`);
      }
    }
    
    if (pdfCount === 0) {
      throw new Error('没有找到PDF附件');
    }
    
  } catch (error) {
    Zotero.debug("Researchopia: 提取标注错误: " + error.message);
    throw error;
  }
  
  return annotations;
}

// Display extracted annotations
function displayExtractedAnnotations(contentArea, annotations, item) {
  while (contentArea.firstChild) {
    contentArea.removeChild(contentArea.firstChild);
  }
  
  const doc = contentArea.ownerDocument;
  
  // Header
  const header = doc.createElement('div');
  header.style.cssText = 'padding: 16px; border-bottom: 1px solid #e1e5e9; background: white;';
  
  const title = doc.createElement('h4');
  title.style.cssText = 'margin: 0 0 8px 0; font-size: 16px; color: #1a1a1a;';
  title.textContent = `我的标注 (${annotations.length}个)`;
  
  const subtitle = doc.createElement('div');
  subtitle.style.cssText = 'font-size: 12px; color: #666;';
  subtitle.textContent = item.getDisplayTitle() || '未知文献';
  
  header.appendChild(title);
  header.appendChild(subtitle);
  
  // Annotations list
  const list = doc.createElement('div');
  list.style.cssText = 'max-height: 400px; overflow-y: auto;';
  
  if (annotations.length === 0) {
    const empty = doc.createElement('div');
    empty.style.cssText = 'padding: 40px; text-align: center; color: #999;';
    empty.textContent = '没有找到标注';
    list.appendChild(empty);
  } else {
    annotations.forEach((annotation, index) => {
      const item = createAnnotationItem(doc, annotation, index, false);
      list.appendChild(item);
    });
  }
  
  contentArea.appendChild(header);
  contentArea.appendChild(list);
}

// Display annotation selection interface
function displayAnnotationSelection(contentArea, annotations, item, doi) {
  while (contentArea.firstChild) {
    contentArea.removeChild(contentArea.firstChild);
  }
  
  const doc = contentArea.ownerDocument;
  
  // Header with controls
  const header = doc.createElement('div');
  header.style.cssText = 'padding: 16px; border-bottom: 1px solid #e1e5e9; background: white;';
  
  const title = doc.createElement('h4');
  title.style.cssText = 'margin: 0 0 12px 0; font-size: 16px; color: #1a1a1a;';
  title.textContent = `选择要共享的标注 (${annotations.length}个)`;
  
  const controls = doc.createElement('div');
  controls.style.cssText = 'display: flex; gap: 12px; align-items: center;';
  
  // Select all button
  const selectAllBtn = doc.createElement('button');
  selectAllBtn.style.cssText = 'padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; font-size: 12px;';
  selectAllBtn.textContent = '全选';
  selectAllBtn.addEventListener('click', () => {
    ResearchopiaState.selectedAnnotations = [...annotations];
    updateSelectionDisplay();
  });
  
  // Clear selection button
  const clearBtn = doc.createElement('button');
  clearBtn.style.cssText = 'padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; font-size: 12px;';
  clearBtn.textContent = '清空';
  clearBtn.addEventListener('click', () => {
    ResearchopiaState.selectedAnnotations = [];
    updateSelectionDisplay();
  });
  
  // Privacy settings (only show if user is logged in)
  let privacyControls = null;
  if (ResearchopiaAuth.isLoggedIn()) {
    privacyControls = doc.createElement('div');
    privacyControls.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-left: 16px;';
    
    const privacyLabel = doc.createElement('label');
    privacyLabel.style.cssText = 'font-size: 12px; color: #666;';
    privacyLabel.textContent = '显示我的用户名:';
    
    const showNameCheckbox = doc.createElement('input');
    showNameCheckbox.type = 'checkbox';
    showNameCheckbox.checked = Zotero.Prefs.get('extensions.researchopia.showRealName', true) !== false;
    showNameCheckbox.addEventListener('change', (e) => {
      Zotero.Prefs.set('extensions.researchopia.showRealName', e.target.checked, true);
    });
    
    privacyControls.appendChild(privacyLabel);
    privacyControls.appendChild(showNameCheckbox);
    controls.appendChild(privacyControls);
  }
  
  // Share button
  const shareBtn = doc.createElement('button');
  shareBtn.style.cssText = 'padding: 6px 16px; border: none; border-radius: 4px; background: #28a745; color: white; cursor: pointer; font-size: 12px; font-weight: 500; margin-left: auto;';
  shareBtn.textContent = '共享选中的标注';
  shareBtn.addEventListener('click', () => {
    shareSelectedAnnotations(doi, item);
  });
  
  controls.appendChild(selectAllBtn);
  controls.appendChild(clearBtn);
  controls.appendChild(shareBtn);
  
  header.appendChild(title);
  header.appendChild(controls);
  
  // Annotations list with checkboxes
  const list = doc.createElement('div');
  list.style.cssText = 'max-height: 350px; overflow-y: auto;';
  list.id = 'annotation-selection-list';
  
  function updateSelectionDisplay() {
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }
    
    annotations.forEach((annotation, index) => {
      const item = createAnnotationItem(doc, annotation, index, true, ResearchopiaState.selectedAnnotations.includes(annotation));
      list.appendChild(item);
    });
    
    // Update share button text
    shareBtn.textContent = `共享选中的标注 (${ResearchopiaState.selectedAnnotations.length})`;
    shareBtn.disabled = ResearchopiaState.selectedAnnotations.length === 0;
    shareBtn.style.opacity = shareBtn.disabled ? '0.5' : '1';
  }
  
  updateSelectionDisplay();
  
  contentArea.appendChild(header);
  contentArea.appendChild(list);
}

// Display shared annotations
function displaySharedAnnotations(contentArea, sharedAnnotations, item, doi) {
  while (contentArea.firstChild) {
    contentArea.removeChild(contentArea.firstChild);
  }
  
  const doc = contentArea.ownerDocument;
  
  // Header with search
  const header = doc.createElement('div');
  header.style.cssText = 'padding: 16px; border-bottom: 1px solid #e1e5e9; background: white;';
  
  const title = doc.createElement('h4');
  title.style.cssText = 'margin: 0 0 12px 0; font-size: 16px; color: #1a1a1a;';
  title.textContent = `社区共享标注 (${sharedAnnotations.length}个)`;
  
  const subtitle = doc.createElement('div');
  subtitle.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 12px;';
  subtitle.textContent = `DOI: ${doi}`;
  
  // Search box and filter
  const controlsContainer = doc.createElement('div');
  controlsContainer.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 12px;';
  
  const searchInput = doc.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = '搜索标注内容...';
  searchInput.style.cssText = 'flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;';
  
  // Filter dropdown
  const filterSelect = doc.createElement('select');
  filterSelect.style.cssText = 'padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; background: white; min-width: 120px;';
  // Create options using DOM methods for security compliance
  const defaultOption = doc.createElement('option');
  defaultOption.value = 'page';
  defaultOption.textContent = '默认排序';
  filterSelect.appendChild(defaultOption);
  
  const timeOption = doc.createElement('option');
  timeOption.value = 'time';
  timeOption.textContent = '按时间排序';
  filterSelect.appendChild(timeOption);
  
  const qualityOption = doc.createElement('option');
  qualityOption.value = 'quality';
  qualityOption.textContent = '优质标注';
  filterSelect.appendChild(qualityOption);
  
  if (ResearchopiaAuth.isLoggedIn()) {
    const followingOption = doc.createElement('option');
    followingOption.value = 'following';
    followingOption.textContent = '关注用户';
    filterSelect.appendChild(followingOption);
  }
  
  controlsContainer.appendChild(searchInput);
  controlsContainer.appendChild(filterSelect);
  
  header.appendChild(title);
  header.appendChild(subtitle);
  header.appendChild(controlsContainer);
  
  // Annotations list container
  const listContainer = doc.createElement('div');
  listContainer.id = 'annotations-list-container';
  listContainer.style.cssText = 'max-height: 400px; overflow-y: auto;';
  
  // Function to filter and sort annotations
  const filterAndSortAnnotations = (annotations, searchTerm = '', sortBy = 'quality', pageFrom = null, pageTo = null, annotationType = '', followedOnly = false) => {
    let filtered = [...annotations];
    
    // Text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(annotation => {
        const content = (annotation.content || '').toLowerCase();
        const comment = (annotation.comment || '').toLowerCase();
        const type = (annotation.type || '').toLowerCase();
        const authorName = (annotation.author_name || '').toLowerCase();
        
        return content.includes(term) || 
               comment.includes(term) || 
               type.includes(term) ||
               authorName.includes(term);
      });
    }
    
    // Page range filter
    if (pageFrom !== null || pageTo !== null) {
      filtered = filtered.filter(annotation => {
        const page = annotation.position?.page || annotation.page_number || 0;
        if (pageFrom !== null && page < pageFrom) return false;
        if (pageTo !== null && page > pageTo) return false;
        return true;
      });
    }
    
    // Annotation type filter
    if (annotationType) {
      filtered = filtered.filter(annotation => annotation.type === annotationType);
    }
    
    // Followed users only (we'll implement this as a placeholder for now)
    if (followedOnly) {
      // For now, just show non-anonymous annotations as a proxy
      // Real implementation would require loading followed users list in advance
      filtered = filtered.filter(annotation => annotation.show_author_name);
    }
    
    // Sorting
    switch (sortBy) {
      case 'time_desc':
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'time_asc':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'likes_desc':
        filtered.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
        break;
      case 'comments_desc':
        filtered.sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0));
        break;
      case 'page_asc':
        filtered.sort((a, b) => {
          const pageA = a.position?.page || a.page_number || 0;
          const pageB = b.position?.page || b.page_number || 0;
          return pageA - pageB;
        });
        break;
      case 'page_desc':
        filtered.sort((a, b) => {
          const pageA = a.position?.page || a.page_number || 0;
          const pageB = b.position?.page || b.page_number || 0;
          return pageB - pageA;
        });
        break;
      case 'quality':
      default:
        // Use existing intelligent sorting
        filtered = applyIntelligentSorting(filtered);
        break;
    }
    
    return filtered;
  };
  
  // Function to render annotations list
  const renderAnnotationsList = (annotationsToShow) => {
    while (listContainer.firstChild) {
      listContainer.removeChild(listContainer.firstChild);
    }
    
    if (annotationsToShow.length === 0) {
      const empty = doc.createElement('div');
      empty.style.cssText = 'padding: 40px; text-align: center; color: #999;';
      if (sharedAnnotations.length === 0) {
        empty.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
          <div style="font-size: 14px; margin-bottom: 8px;">还没有人共享这篇文献的标注</div>
          <div style="font-size: 12px;">成为第一个分享者吧！</div>
        `;
      } else {
        empty.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
          <div style="font-size: 14px; margin-bottom: 8px;">未找到匹配的标注</div>
          <div style="font-size: 12px;">尝试修改筛选条件</div>
        `;
      }
      listContainer.appendChild(empty);
    } else {
      annotationsToShow.forEach((annotation, index) => {
        const item = createSharedAnnotationItem(doc, annotation, index);
        listContainer.appendChild(item);
      });
    }
  };
  
  // Function to update results based on filters
  const updateResults = () => {
    const searchTerm = searchInput.value;
    const filterType = filterSelect.value;
    
    // Map filter types to sortBy values
    let sortBy = 'quality';
    let followedOnly = false;
    
    switch (filterType) {
      case 'page':
        sortBy = 'page_asc';
        break;
      case 'time':
        sortBy = 'time_desc';
        break;
      case 'quality':
        sortBy = 'quality';
        break;
      case 'following':
        sortBy = 'time_desc';
        followedOnly = true;
        break;
    }
    
    const filteredAnnotations = filterAndSortAnnotations(
      sharedAnnotations, 
      searchTerm, 
      sortBy, 
      null, // pageFrom
      null, // pageTo
      '', // annotationType
      followedOnly
    );
    
    // Update title with count
    title.textContent = `社区共享标注 (显示${filteredAnnotations.length}/${sharedAnnotations.length}个)`;
    
    renderAnnotationsList(filteredAnnotations);
  };
  
  // Event listeners for simplified filters
  searchInput.addEventListener('input', updateResults);
  filterSelect.addEventListener('change', updateResults);
  
  // Initial render
  updateResults();
  
  contentArea.appendChild(header);
  contentArea.appendChild(listContainer);
}

// Create annotation item
function createAnnotationItem(doc, annotation, index, selectable = false, selected = false) {
  const item = doc.createElement('div');
  item.style.cssText = `padding: 16px; border-bottom: 1px solid #f0f0f0; background: ${index % 2 === 0 ? '#fafafa' : 'white'};`;
  
  if (selectable) {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      const isSelected = ResearchopiaState.selectedAnnotations.includes(annotation);
      if (isSelected) {
        ResearchopiaState.selectedAnnotations = ResearchopiaState.selectedAnnotations.filter(a => a !== annotation);
      } else {
        ResearchopiaState.selectedAnnotations.push(annotation);
      }
      
      // Update parent display
      const list = doc.getElementById('annotation-selection-list');
      if (list) {
        const parent = list.parentNode;
        displayAnnotationSelection(parent, ResearchopiaState.currentAnnotations, ResearchopiaState.currentItem, getItemDOI(ResearchopiaState.currentItem));
      }
    });
  }
  
  const content = doc.createElement('div');
  content.style.cssText = 'display: flex; gap: 12px; align-items: flex-start;';
  
  if (selectable) {
    const checkbox = doc.createElement('div');
    checkbox.style.cssText = `width: 16px; height: 16px; border: 2px solid ${selected ? '#28a745' : '#ddd'}; border-radius: 3px; background: ${selected ? '#28a745' : 'white'}; flex-shrink: 0; position: relative; margin-top: 2px;`;
    
    if (selected) {
      const checkmark = doc.createElement('div');
      checkmark.style.cssText = 'position: absolute; top: 1px; left: 3px; width: 6px; height: 10px; border: 2px solid white; border-top: none; border-left: none; transform: rotate(45deg);';
      checkbox.appendChild(checkmark);
    }
    
    content.appendChild(checkbox);
  }
  
  // Color indicator
  const colorIndicator = doc.createElement('div');
  colorIndicator.style.cssText = `width: 4px; min-height: 40px; background: ${annotation.color}; border-radius: 2px; flex-shrink: 0;`;
  
  // Text content
  const textContent = doc.createElement('div');
  textContent.style.cssText = 'flex: 1; min-width: 0;';
  
  if (annotation.text) {
    const text = doc.createElement('div');
    text.style.cssText = 'font-size: 14px; line-height: 1.4; color: #333; margin-bottom: 6px; word-wrap: break-word;';
    text.textContent = annotation.text;
    textContent.appendChild(text);
  }
  
  if (annotation.comment) {
    const comment = doc.createElement('div');
    comment.style.cssText = 'font-size: 12px; line-height: 1.3; color: #666; font-style: italic; margin-bottom: 6px; word-wrap: break-word;';
    comment.textContent = `💭 ${annotation.comment}`;
    textContent.appendChild(comment);
  }
  
  // Metadata
  const metadata = doc.createElement('div');
  metadata.style.cssText = 'display: flex; gap: 12px; font-size: 11px; color: #999;';
  
  if (annotation.page) {
    const page = doc.createElement('span');
    page.textContent = `第${annotation.page}页`;
    metadata.appendChild(page);
  }
  
  const type = doc.createElement('span');
  type.textContent = annotation.type === 'highlight' ? '高亮' : annotation.type === 'note' ? '注释' : annotation.type;
  metadata.appendChild(type);
  
  if (annotation.created) {
    const date = doc.createElement('span');
    date.textContent = new Date(annotation.created).toLocaleDateString();
    metadata.appendChild(date);
  }
  
  textContent.appendChild(metadata);
  
  // Add sharing status display for selectable items
  if (selectable) {
    const sharingStatus = doc.createElement('div');
    sharingStatus.style.cssText = 'margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;';
    sharingStatus.className = 'sharing-status';
    
    // We'll populate this asynchronously
    sharingStatus.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #666;">
        <span>🔄 检查共享状态...</span>
      </div>
    `;
    
    textContent.appendChild(sharingStatus);
    
    // Async load sharing status
    loadSharingStatus(annotation, sharingStatus, doc);
  }
  
  content.appendChild(colorIndicator);
  content.appendChild(textContent);
  
  item.appendChild(content);
  
  return item;
}

// Check annotation sharing status
async function checkAnnotationSharingStatus(annotation, doi) {
  try {
    if (!doi) return null;
    
    // Only check sharing status for logged in users
    if (!ResearchopiaAuth.isLoggedIn()) {
      return { isShared: false };
    }
    
    const authHeaders = ResearchopiaAuth.getAuthHeaders();
    const currentUserId = ResearchopiaAuth.getCurrentUserId();
    
    if (!currentUserId) {
      return { isShared: false };
    }
    
    // First find the document by DOI
    const docResponse = await fetch(`${SUPABASE_URL}/rest/v1/documents?doi=eq.${encodeURIComponent(doi)}&select=id`, {
      headers: authHeaders
    });
    
    if (!docResponse.ok) {
      return null;
    }
    
    const documents = await docResponse.json();
    if (!documents || documents.length === 0) {
      return null;
    }
    
    const documentId = documents[0].id;
    
    // Check if this annotation exists in the database
    const response = await fetch(`${SUPABASE_URL}/rest/v1/annotations?document_id=eq.${documentId}&user_id=eq.${currentUserId}&original_id=eq.${annotation.id}&select=id,show_author_name,visibility,created_at`, {
      headers: authHeaders
    });
    
    if (!response.ok) {
      return null;
    }
    
    const existingAnnotations = await response.json();
    if (existingAnnotations.length > 0) {
      const sharedAnnotation = existingAnnotations[0];
      return {
        isShared: true,
        showAuthorName: sharedAnnotation.show_author_name,
        visibility: sharedAnnotation.visibility,
        sharedAt: sharedAnnotation.created_at,
        annotationId: sharedAnnotation.id
      };
    }
    
    return { isShared: false };
    
  } catch (error) {
    Zotero.debug("Researchopia: Check sharing status error: " + error.message);
    return null;
  }
}

// Load and display sharing status for an annotation
async function loadSharingStatus(annotation, statusContainer, doc) {
  try {
    const doi = getItemDOI(ResearchopiaState.currentItem);
    const status = await checkAnnotationSharingStatus(annotation, doi);
    
    // Clear loading indicator
    while (statusContainer.firstChild) {
      statusContainer.removeChild(statusContainer.firstChild);
    }
    
    const statusDiv = doc.createElement('div');
    statusDiv.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px;';
    
    const statusInfo = doc.createElement('div');
    statusInfo.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
    if (status && status.isShared) {
      // Already shared
      const sharedIcon = doc.createElement('span');
      sharedIcon.textContent = '✅';
      sharedIcon.title = '已共享';
      
      const sharedText = doc.createElement('span');
      sharedText.style.cssText = 'color: #28a745; font-weight: 500;';
      sharedText.textContent = '已共享';
      
      const privacyText = doc.createElement('span');
      privacyText.style.cssText = 'color: #666;';
      privacyText.textContent = status.showAuthorName ? ' · 显示用户名' : ' · 匿名';
      
      const sharedDate = doc.createElement('span');
      sharedDate.style.cssText = 'color: #999;';
      sharedDate.textContent = ` · ${new Date(status.sharedAt).toLocaleDateString()}`;
      
      statusInfo.appendChild(sharedIcon);
      statusInfo.appendChild(sharedText);
      statusInfo.appendChild(privacyText);
      statusInfo.appendChild(sharedDate);
      
      // Quick action buttons
      const actions = doc.createElement('div');
      actions.style.cssText = 'display: flex; gap: 4px;';
      
      const togglePrivacyBtn = doc.createElement('button');
      togglePrivacyBtn.style.cssText = 'padding: 2px 6px; border: 1px solid #ddd; border-radius: 3px; background: white; color: #666; font-size: 10px; cursor: pointer;';
      togglePrivacyBtn.textContent = status.showAuthorName ? '改为匿名' : '显示姓名';
      togglePrivacyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAnnotationPrivacy(status.annotationId, !status.showAuthorName, statusContainer, doc, annotation);
      });
      
      const unshareBtn = doc.createElement('button');
      unshareBtn.style.cssText = 'padding: 2px 6px; border: 1px solid #dc3545; border-radius: 3px; background: white; color: #dc3545; font-size: 10px; cursor: pointer;';
      unshareBtn.textContent = '取消共享';
      unshareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        unshareAnnotation(status.annotationId, statusContainer, doc, annotation);
      });
      
      actions.appendChild(togglePrivacyBtn);
      actions.appendChild(unshareBtn);
      statusDiv.appendChild(statusInfo);
      statusDiv.appendChild(actions);
      
    } else {
      // Not shared
      const unsharedIcon = doc.createElement('span');
      unsharedIcon.textContent = '⭕';
      unsharedIcon.title = '未共享';
      
      const unsharedText = doc.createElement('span');
      unsharedText.style.cssText = 'color: #6c757d;';
      unsharedText.textContent = '未共享';
      
      statusInfo.appendChild(unsharedIcon);
      statusInfo.appendChild(unsharedText);
      
      // Quick share button
      const quickShareBtn = doc.createElement('button');
      quickShareBtn.style.cssText = 'padding: 2px 6px; border: 1px solid #28a745; border-radius: 3px; background: white; color: #28a745; font-size: 10px; cursor: pointer;';
      quickShareBtn.textContent = '快速共享';
      quickShareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickShareAnnotation(annotation, statusContainer, doc);
      });
      
      statusDiv.appendChild(statusInfo);
      statusDiv.appendChild(quickShareBtn);
    }
    
    statusContainer.appendChild(statusDiv);
    
  } catch (error) {
    Zotero.debug("Researchopia: Load sharing status error: " + error.message);
    statusContainer.innerHTML = `
      <div style="color: #dc3545; font-size: 11px;">
        ❌ 状态加载失败
      </div>
    `;
  }
}

// Create shared annotation item
function createSharedAnnotationItem(doc, annotation, index) {
  const item = doc.createElement('div');
  item.style.cssText = `padding: 16px; border-bottom: 1px solid #f0f0f0; background: ${index % 2 === 0 ? '#fafafa' : 'white'};`;
  
  const content = doc.createElement('div');
  content.style.cssText = 'display: flex; gap: 12px; align-items: flex-start;';
  
  // User avatar placeholder
  const avatar = doc.createElement('div');
  avatar.style.cssText = 'width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold;';
  
  // Determine avatar letter based on user info
  let avatarLetter = 'A'; // Default anonymous
  let displayName = '匿名用户';
  
  // 匿名标注优先判断 show_author_name 字段
  if (annotation.show_author_name === false || !annotation.show_author_name) {
    displayName = '匿名用户';
    avatarLetter = 'A';
  } else if (annotation.display_name && annotation.display_name !== '匿名用户') {
    displayName = annotation.display_name;
    avatarLetter = annotation.display_name.charAt(0).toUpperCase();
  } else if (annotation.username && annotation.username !== null) {
    displayName = annotation.username;
    avatarLetter = annotation.username.charAt(0).toUpperCase();
  } else if (annotation.users && annotation.users.length > 0) {
    // Legacy format support from joined query
    const user = annotation.users[0];
    if (user.username && user.username !== null) {
      displayName = user.username;
      avatarLetter = user.username.charAt(0).toUpperCase();
    } else if (user.email) {
      // Fallback to email prefix if no username
      displayName = user.email.split('@')[0];
      avatarLetter = displayName.charAt(0).toUpperCase();
    }
  } else if (annotation.user_email && !annotation.username) {
    // Use email if available but no username
    displayName = annotation.user_email.split('@')[0];
    avatarLetter = displayName.charAt(0).toUpperCase();
  } else if (annotation.user_id) {
    // Final fallback if user data not loaded
    displayName = `用户 ${annotation.user_id.toString().slice(-8)}`;
    avatarLetter = annotation.user_id.toString().slice(-1).toUpperCase();
  }
  
  avatar.textContent = avatarLetter;
  
  // Text content
  const textContent = doc.createElement('div');
  textContent.style.cssText = 'flex: 1; min-width: 0;';
  
  // User info
  const userInfo = doc.createElement('div');
  userInfo.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
  
  const userName = doc.createElement('span');
  userName.style.cssText = 'font-size: 13px; font-weight: 500; color: #333;';
  userName.textContent = displayName;
  
  const timestamp = doc.createElement('span');
  timestamp.style.cssText = 'font-size: 11px; color: #999;';
  timestamp.textContent = new Date(annotation.created_at).toLocaleDateString();
  
  userInfo.appendChild(userName);
  userInfo.appendChild(timestamp);
  
  // Add follow button (only for logged in users and not their own annotations, and only for non-anonymous users)
  if (ResearchopiaAuth.isLoggedIn() && 
      annotation.user_id && 
      annotation.show_author_name && // Only show follow button for non-anonymous users
      annotation.user_id !== ResearchopiaAuth.getCurrentUserId()) {
    
    const followBtn = doc.createElement('button');
    followBtn.style.cssText = 'border: 1px solid #ddd; background: white; color: #666; font-size: 10px; padding: 2px 6px; border-radius: 12px; cursor: pointer; margin-left: auto; transition: all 0.2s;';
    
    const isFollowed = annotation.isFollowed || false;
    followBtn.textContent = isFollowed ? '已关注' : '关注';
    followBtn.style.backgroundColor = isFollowed ? '#e3f2fd' : 'white';
    followBtn.style.color = isFollowed ? '#1976d2' : '#666';
    followBtn.style.borderColor = isFollowed ? '#1976d2' : '#ddd';
    
    followBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleUserFollow(annotation.user_id, followBtn);
    });
    
    followBtn.addEventListener('mouseenter', () => {
      if (!isFollowed) {
        followBtn.style.backgroundColor = '#f5f5f5';
      }
    });
    
    followBtn.addEventListener('mouseleave', () => {
      followBtn.style.backgroundColor = isFollowed ? '#e3f2fd' : 'white';
    });
    
    userInfo.appendChild(followBtn);
  }
  
  if (annotation.content) {
    const text = doc.createElement('div');
    text.style.cssText = 'font-size: 14px; line-height: 1.4; color: #333; margin-bottom: 6px; word-wrap: break-word; padding: 8px; background: white; border-left: 3px solid #007acc; border-radius: 4px;';
    text.textContent = annotation.content;
    textContent.appendChild(text);
  }
  
  if (annotation.comment) {
    const comment = doc.createElement('div');
    comment.style.cssText = 'font-size: 12px; line-height: 1.3; color: #666; margin-bottom: 6px; word-wrap: break-word;';
    comment.textContent = `💭 ${annotation.comment}`;
    textContent.appendChild(comment);
  }
  
  // Metadata
  const metadata = doc.createElement('div');
  metadata.style.cssText = 'display: flex; gap: 12px; font-size: 11px; color: #999;';
  
  if (annotation.position && annotation.position.page) {
    const page = doc.createElement('span');
    page.textContent = `第${annotation.position.page}页`;
    metadata.appendChild(page);
  }
  
  const type = doc.createElement('span');
  type.textContent = annotation.type === 'highlight' ? '高亮' : annotation.type === 'note' ? '注释' : annotation.type;
  metadata.appendChild(type);
  
  const platform = doc.createElement('span');
  platform.textContent = annotation.platform || 'zotero';
  metadata.appendChild(platform);
  
  textContent.insertBefore(userInfo, textContent.firstChild);
  textContent.appendChild(metadata);
  
  // Social actions (likes and comments)
  const socialActions = doc.createElement('div');
  socialActions.style.cssText = 'display: flex; gap: 16px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0;';
  
  // Like button
  const likeBtn = doc.createElement('button');
  likeBtn.style.cssText = 'border: none; background: none; color: #666; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;';
  
  const likesCount = annotation.likes_count || 0;
  const isLiked = annotation.isLiked || false;
  
  likeBtn.innerHTML = `<span style="font-size: 14px;">${isLiked ? '❤️' : '🤍'}</span> ${likesCount}`;
  likeBtn.addEventListener('mouseenter', () => {
    likeBtn.style.backgroundColor = '#f0f0f0';
  });
  likeBtn.addEventListener('mouseleave', () => {
    likeBtn.style.backgroundColor = 'transparent';
  });
  likeBtn.addEventListener('click', async () => {
    await toggleAnnotationLike(annotation.id, likeBtn);
  });
  
  // Comment button
  const commentBtn = doc.createElement('button');
  commentBtn.style.cssText = 'border: none; background: none; color: #666; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;';
  
  const commentsCount = annotation.comments_count || 0;
  commentBtn.innerHTML = `<span style="font-size: 14px;">💬</span> ${commentsCount}`;
  commentBtn.addEventListener('mouseenter', () => {
    commentBtn.style.backgroundColor = '#f0f0f0';
  });
  commentBtn.addEventListener('mouseleave', () => {
    commentBtn.style.backgroundColor = 'transparent';
  });
  commentBtn.addEventListener('click', () => {
    toggleCommentsSection(annotation.id, item);
  });
  
  socialActions.appendChild(likeBtn);
  socialActions.appendChild(commentBtn);
  textContent.appendChild(socialActions);

  content.appendChild(avatar);
  content.appendChild(textContent);
  
  item.appendChild(content);
  
  return item;
}

// Share selected annotations
async function shareSelectedAnnotations(doi, item) {
  if (ResearchopiaState.selectedAnnotations.length === 0) {
    return;
  }

  // Check if user is logged in
  if (!ResearchopiaAuth.isLoggedIn()) {
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: "请先登录后再分享标注",
        type: "fail",
        progress: 100
      })
      .show();
    return;
  }
  
  const progressWin = new ztoolkit.ProgressWindow("Researchopia");
  progressWin.createLine({
    text: `正在上传 ${ResearchopiaState.selectedAnnotations.length} 个标注...`,
    type: "default",
    progress: 0
  }).show();
  
  try {
    // First, find or create the document
    progressWin.changeLine({
      text: "正在查找或创建文档...",
      type: "default",
      progress: 10
    });
    
    let documentId = await findOrCreateDocument(doi, item);
    
    // Get current user ID (must be logged in at this point)
    const currentUserId = ResearchopiaAuth.getCurrentUserId();
    
    if (!currentUserId) {
      throw new Error('用户ID获取失败，请重新登录');
    }
    
    // Get authentication headers
    const authHeaders = ResearchopiaAuth.getAuthHeaders();
    
    // Get privacy preference
    const showRealName = Zotero.Prefs.get('extensions.researchopia.showRealName', true) !== false;
    
    progressWin.changeLine({
      text: `正在为用户 ${ResearchopiaAuth.getCurrentUserDisplayName() || ResearchopiaAuth.getCurrentUser().email} 准备上传...`,
      type: "default",
      progress: 15
    });
    
    // Check for duplicate annotations before uploading
    const uniqueAnnotations = await filterDuplicateAnnotations(documentId, ResearchopiaState.selectedAnnotations, currentUserId);
    
    if (uniqueAnnotations.length === 0) {
      progressWin.changeLine({
        text: "所选标注已存在，无需重复上传",
        type: "success",
        progress: 100
      });
      return;
    }
    
    if (uniqueAnnotations.length < ResearchopiaState.selectedAnnotations.length) {
      const duplicateCount = ResearchopiaState.selectedAnnotations.length - uniqueAnnotations.length;
      progressWin.changeLine({
        text: `过滤了 ${duplicateCount} 个重复标注，将上传 ${uniqueAnnotations.length} 个新标注`,
        type: "default",
        progress: 20
      });
    }
    
    for (let i = 0; i < uniqueAnnotations.length; i++) {
      const annotation = uniqueAnnotations[i];
      
      const payload = {
        document_id: documentId,
        user_id: currentUserId,
        type: annotation.type || 'highlight',
        content: annotation.text || '',
        comment: annotation.comment || '',
        color: annotation.color || '#ffff00',
        position: {
          page: annotation.page || '',
          zotero_annotation_id: annotation.id,
          platform: 'zotero'
        },
        platform: 'zotero',
        original_id: annotation.id,
        visibility: 'public'
      };
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/annotations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          'Prefer': 'return=minimal',
          'X-Client-Info': 'zotero-plugin'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      progressWin.changeLine({
        text: `已上传 ${i + 1}/${uniqueAnnotations.length} 个标注`,
        type: "default",
        progress: Math.round(20 + ((i + 1) / uniqueAnnotations.length) * 80)
      });
    }
    
    progressWin.changeLine({
      text: `成功上传 ${uniqueAnnotations.length} 个标注！`,
      type: "success",
      progress: 100
    });
    
    // Show success notification
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: `🎉 成功分享了 ${uniqueAnnotations.length} 个标注！`,
        type: "success",
        progress: 100
      })
      .show();
    
    // Reset selection
    ResearchopiaState.selectedAnnotations = [];
    
    // Update UI to reflect success
    setTimeout(() => {
      if (ResearchopiaState.currentItem) {
        // Optionally refresh the content area or show success state
      }
    }, 1000);
    
  } catch (error) {
    Zotero.debug("Researchopia: Share error: " + error.message);
    progressWin.changeLine({
      text: "上传失败：" + error.message,
      type: "fail",
      progress: 100
    });
    
    // Show error notification
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: `❌ 分享失败：${error.message.includes('HTTP') ? '网络错误' : '系统错误'}`,
        type: "fail",
        progress: 100
      })
      .show();
  }
}

// Helper functions to extract item metadata
function getItemAuthors(item) {
  if (!item) return [];
  
  try {
    const creators = item.getCreators();
    return creators.map(creator => {
      if (creator.firstName && creator.lastName) {
        return `${creator.firstName} ${creator.lastName}`;
      } else if (creator.lastName) {
        return creator.lastName;
      } else if (creator.name) {
        return creator.name;
      }
      return '';
    }).filter(name => name.trim() !== '');
  } catch (error) {
    Zotero.debug("Researchopia: Error getting authors: " + error.message);
    return [];
  }
}

function getItemAbstract(item) {
  if (!item) return null;
  
  try {
    return item.getField('abstractNote') || null;
  } catch (error) {
    Zotero.debug("Researchopia: Error getting abstract: " + error.message);
    return null;
  }
}

function getItemDate(item) {
  if (!item) return null;
  
  try {
    const date = item.getField('date');
    if (!date) return null;
    
    // Try to parse and format the date
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    return null;
  } catch (error) {
    Zotero.debug("Researchopia: Error getting date: " + error.message);
    return null;
  }
}

function getItemJournal(item) {
  if (!item) return null;
  
  try {
    return item.getField('publicationTitle') || 
           item.getField('journalAbbreviation') || 
           item.getField('bookTitle') || null;
  } catch (error) {
    Zotero.debug("Researchopia: Error getting journal: " + error.message);
    return null;
  }
}

// Find or create document in Supabase (restore full implementation)
async function findOrCreateDocument(doi, item) {
  try {
    const authHeaders = ResearchopiaAuth.getAuthHeaders();
    
    // First try to find existing document by DOI
    if (doi) {
      const findResponse = await fetch(`${SUPABASE_URL}/rest/v1/documents?doi=eq.${encodeURIComponent(doi)}&select=id`, {
        headers: authHeaders
      });
      
      if (findResponse.status === 401) {
        const errorInfo = ResearchopiaAuth.handleApiError(findResponse);
        throw new Error(errorInfo.message);
      }
      
      if (findResponse.ok) {
        const existingDocs = await findResponse.json();
        if (existingDocs && existingDocs.length > 0) {
          return existingDocs[0].id;
        }
      }
    }
    
    // If not found, create new document
    const documentPayload = {
      doi: doi || null,
      title: item?.getDisplayTitle() || 'Untitled Document',
      authors: getItemAuthors(item) || [],
      abstract: getItemAbstract(item) || null,
      publication_date: getItemDate(item) || null,
      journal: getItemJournal(item) || null,
      document_type: 'pdf'
    };
    
    const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(documentPayload)
    });
    
    if (createResponse.status === 401) {
      const errorInfo = ResearchopiaAuth.handleApiError(createResponse);
      throw new Error(errorInfo.message);
    }
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create document: ${createResponse.status} ${errorText}`);
    }
    
    const newDoc = await createResponse.json();
    return newDoc[0].id;
    
  } catch (error) {
    Zotero.debug("Researchopia: Document creation error: " + error.message);
    throw error;
  }
}

// Fetch shared annotations from Supabase
async function fetchSharedAnnotations(doi) {
  try {
    if (!doi) {
      return [];
    }
    
    // Always use anon key for public read operations
    const authHeaders = {
      'apikey': ResearchopiaAuth.supabaseKey,
      'Authorization': `Bearer ${ResearchopiaAuth.supabaseKey}`
    };
    
    Zotero.debug("Researchopia: Fetching shared annotations for DOI: " + doi);
    
    // First find the document by DOI
    const docResponse = await fetch(`${SUPABASE_URL}/rest/v1/documents?doi=eq.${encodeURIComponent(doi)}&select=id`, {
      headers: authHeaders
    });
    
    if (!docResponse.ok) {
      const errorText = await docResponse.text();
      Zotero.debug("Researchopia: Document fetch error: " + docResponse.status + " - " + errorText);
      throw new Error(`HTTP ${docResponse.status}: ${docResponse.statusText}`);
    }
    
    const documents = await docResponse.json();
    if (!documents || documents.length === 0) {
      Zotero.debug("Researchopia: No document found for DOI: " + doi);
      return []; // No document found, return empty array
    }
    
    const documentId = documents[0].id;
    Zotero.debug("Researchopia: Found document ID: " + documentId);
    
    // Use the new database function for better performance
    Zotero.debug("Researchopia: Calling RPC get_shared_annotations_with_users with doc_id: " + documentId);
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_shared_annotations_with_users`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ doc_id: documentId })
    });
    
    Zotero.debug("Researchopia: RPC Response status: " + response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      Zotero.debug("Researchopia: RPC error response: " + errorText);
      
      // Fallback to direct query if RPC fails
      Zotero.debug("Researchopia: Falling back to direct query with user join");
      const fallbackResponse = await fetch(`${SUPABASE_URL}/rest/v1/annotations_with_users?document_id=eq.${documentId}&visibility=in.(public,shared)`, {
        headers: authHeaders
      });
      
      if (!fallbackResponse.ok) {
        // Final fallback to basic annotations
        Zotero.debug("Researchopia: Trying basic annotations query");
        const basicResponse = await fetch(`${SUPABASE_URL}/rest/v1/annotations?document_id=eq.${documentId}&visibility=in.(public,shared)&select=*`, {
          headers: authHeaders
        });
        
        if (!basicResponse.ok) {
          const basicError = await basicResponse.text();
          Zotero.debug("Researchopia: All queries failed: " + basicError);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const basicAnnotations = await basicResponse.json();
        Zotero.debug("Researchopia: Basic query fetched " + basicAnnotations.length + " annotations (without user data)");
        
        // Add placeholder user data for basic annotations
        basicAnnotations.forEach(annotation => {
          annotation.username = null;
          annotation.user_email = null;
          annotation.user_avatar = null;
          annotation.display_name = '匿名用户';
        });
        
        return basicAnnotations || [];
      }
      
      const fallbackAnnotations = await fallbackResponse.json();
      Zotero.debug("Researchopia: Fallback query fetched " + fallbackAnnotations.length + " annotations with user data");
      return fallbackAnnotations || [];
    }
    
    const annotations = await response.json();
    Zotero.debug("Researchopia: RPC successfully fetched " + (annotations ? annotations.length : 'null') + " annotations with user data");
    
    if (!Array.isArray(annotations)) {
      Zotero.debug("Researchopia: Unexpected RPC response format: " + JSON.stringify(annotations));
      return [];
    }
    
    // For logged in users, fetch their like status and follow status for each annotation
    if (ResearchopiaAuth.isLoggedIn() && annotations.length > 0) {
      const userId = ResearchopiaAuth.getCurrentUserId();
      if (userId) {
        const userAuthHeaders = ResearchopiaAuth.getAuthHeaders();
        const annotationIds = annotations.map(a => a.id).join(',');
        const authorIds = [...new Set(annotations.map(a => a.user_id).filter(id => id && id !== userId))];
        
        try {
          // Fetch like status
          const likesResponse = await fetch(`${SUPABASE_URL}/rest/v1/annotation_likes?user_id=eq.${userId}&annotation_id=in.(${annotationIds})&select=annotation_id`, {
            headers: userAuthHeaders
          });
          
          if (likesResponse.ok) {
            const userLikes = await likesResponse.json();
            const likedIds = new Set(userLikes.map(like => like.annotation_id));
            
            // Add isLiked property to annotations
            annotations.forEach(annotation => {
              annotation.isLiked = likedIds.has(annotation.id);
            });
          }
          
          // Fetch follow status for annotation authors
          if (authorIds.length > 0) {
            const followsResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_follows?follower_id=eq.${userId}&following_id=in.(${authorIds.join(',')})&select=following_id`, {
              headers: userAuthHeaders
            });
            
            if (followsResponse.ok) {
              const userFollows = await followsResponse.json();
              const followedIds = new Set(userFollows.map(follow => follow.following_id));
              
              // Add isFollowed property to annotations
              annotations.forEach(annotation => {
                annotation.isFollowed = followedIds.has(annotation.user_id);
                annotation.isFromFollowedUser = followedIds.has(annotation.user_id);
              });
            }
          }
          
        } catch (socialError) {
          Zotero.debug("Researchopia: Failed to fetch social status: " + socialError.message);
          // Continue without social status
        }
      }
    }
    
    // Apply intelligent sorting
    const sortedAnnotations = applyIntelligentSorting(annotations);
    
    return sortedAnnotations || [];
    
  } catch (error) {
    Zotero.debug("Researchopia: Fetch shared annotations error: " + error.message);
    // Return empty array on error instead of throwing
    return [];
  }
}

// Filter duplicate annotations to avoid re-uploading
async function filterDuplicateAnnotations(documentId, annotations, userId) {
  try {
    const authHeaders = ResearchopiaAuth.getAuthHeaders();
    
    // Fetch existing annotations for this user and document from annotations table
    const response = await fetch(`${SUPABASE_URL}/rest/v1/annotations?document_id=eq.${documentId}&user_id=eq.${userId}&select=original_id,content`, {
      headers: authHeaders
    });
    
    if (response.status === 401) {
      const errorInfo = ResearchopiaAuth.handleApiError(response);
      throw new Error(errorInfo.message);
    }
    
    if (!response.ok) {
      Zotero.debug("Researchopia: Failed to fetch existing annotations, proceeding with all");
      return annotations; // If we can't check, upload all
    }
    
    const existingAnnotations = await response.json();
    const existingIds = new Set(existingAnnotations.map(a => a.original_id));
    const existingContents = new Set(existingAnnotations.map(a => a.content));
    
    // Filter out duplicates based on original_id or content
    const uniqueAnnotations = annotations.filter(annotation => {
      // Check by original Zotero ID
      if (annotation.id && existingIds.has(annotation.id)) {
        return false;
      }
      
      // Check by content (for similar annotations)
      if (annotation.text && existingContents.has(annotation.text)) {
        return false;
      }
      
      return true;
    });
    
    Zotero.debug(`Researchopia: Filtered ${annotations.length - uniqueAnnotations.length} duplicate annotations`);
    return uniqueAnnotations;
    
  } catch (error) {
    Zotero.debug("Researchopia: Error filtering duplicates: " + error.message);
    return annotations; // If error, return all annotations
  }
}

// Utility functions
function getItemDOI(item) {
  if (!item) return null;
  try {
    return item.getField("DOI") || null;
  } catch (e) {
    return null;
  }
}

function getItemAuthors(item) {
  if (!item) return [];
  try {
    const creators = item.getCreators();
    return creators.map(creator => {
      if (creator.firstName && creator.lastName) {
        return `${creator.firstName} ${creator.lastName}`;
      }
      return creator.lastName || creator.name || 'Unknown Author';
    });
  } catch (e) {
    return [];
  }
}

function getItemAbstract(item) {
  if (!item) return null;
  try {
    return item.getField("abstractNote") || null;
  } catch (e) {
    return null;
  }
}

function getItemDate(item) {
  if (!item) return null;
  try {
    const date = item.getField("date");
    if (date) {
      // Try to parse date and return in YYYY-MM-DD format
      const parsed = new Date(date);
      if (!isNaN(parsed)) {
        return parsed.toISOString().split('T')[0];
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function getItemJournal(item) {
  if (!item) return null;
  try {
    return item.getField("publicationTitle") || item.getField("journalAbbreviation") || null;
  } catch (e) {
    return null;
  }
}

function showLoading(contentArea, message) {
  while (contentArea.firstChild) {
    contentArea.removeChild(contentArea.firstChild);
  }
  
  const loading = contentArea.ownerDocument.createElement('div');
  loading.style.cssText = 'padding: 40px; text-align: center; color: #666;';
  
  const spinner = contentArea.ownerDocument.createElement('div');
  spinner.style.cssText = 'font-size: 32px; margin-bottom: 16px;';
  spinner.textContent = '⏳';
  
  const text = contentArea.ownerDocument.createElement('div');
  text.style.cssText = 'font-size: 14px;';
  text.textContent = message;
  
  loading.appendChild(spinner);
  loading.appendChild(text);
  contentArea.appendChild(loading);
}

function showError(contentArea, message) {
  while (contentArea.firstChild) {
    contentArea.removeChild(contentArea.firstChild);
  }
  
  const error = contentArea.ownerDocument.createElement('div');
  error.style.cssText = 'padding: 40px; text-align: center; color: #d32f2f;';
  
  const icon = contentArea.ownerDocument.createElement('div');
  icon.style.cssText = 'font-size: 32px; margin-bottom: 16px;';
  icon.textContent = '❌';
  
  const text = contentArea.ownerDocument.createElement('div');
  text.style.cssText = 'font-size: 14px;';
  text.textContent = message;
  
  error.appendChild(icon);
  error.appendChild(text);
  contentArea.appendChild(error);
}

async function shutdown() {
  Zotero.debug("Researchopia: Shutdown called");
  
  try {
    if (Zotero.ItemPaneManager) {
      Zotero.ItemPaneManager.unregisterSection("researchopia-annotations");
      Zotero.debug("Researchopia: ItemPaneManager section unregistered");
    }
  } catch (error) {
    Zotero.debug("Researchopia: Error during shutdown: " + error.message);
  }
}

async function uninstall() {
  Zotero.debug("Researchopia: Uninstall called");
}

// Generate or retrieve a persistent anonymous user ID
function getAnonymousUserId() {
  const prefKey = 'extensions.researchopia.anonymousUserId';
  let userId = Zotero.Prefs.get(prefKey);
  
  if (!userId) {
    // Generate a new UUID for this anonymous user
    userId = generateUUID();
    Zotero.Prefs.set(prefKey, userId);
    Zotero.debug(`Researchopia: Generated new anonymous user ID: ${userId}`);
  }
  
  return userId;
}

// Ensure anonymous user exists in database
async function ensureAnonymousUser(userId) {
  try {
    // For now, let's use a fixed anonymous user ID that should exist in the database
    // We'll return the fixed anonymous user ID instead of the generated one
    const ANONYMOUS_USER_ID = '00000000-0000-0000-0000-000000000000';
    return ANONYMOUS_USER_ID;
  } catch (error) {
    Zotero.debug(`Researchopia: Error ensuring anonymous user: ${error.message}`);
    return null;
  }
}

// Simple UUID generation function
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Toggle annotation like
async function toggleAnnotationLike(annotationId, buttonElement) {
  try {
    // Reload auth state to ensure we have the latest status
    ResearchopiaAuth.loadAuthState();
    
    if (!ResearchopiaAuth.isLoggedIn()) {
      new ztoolkit.ProgressWindow("Researchopia")
        .createLine({
          text: "请先登录后再点赞",
          type: "fail",
          progress: 100
        })
        .show();
      return;
    }
    
    const authHeaders = ResearchopiaAuth.getAuthHeaders();
    const userId = ResearchopiaAuth.getCurrentUserId();
    
    if (!userId) {
      new ztoolkit.ProgressWindow("Researchopia")
        .createLine({
          text: "用户ID获取失败，请重新登录",
          type: "fail",
          progress: 100
        })
        .show();
      return;
    }
    
    // Check if already liked
    const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/annotation_likes?annotation_id=eq.${annotationId}&user_id=eq.${userId}`, {
      headers: authHeaders
    });
    
    if (!checkResponse.ok) {
      throw new Error('Failed to check like status');
    }
    
    const existingLikes = await checkResponse.json();
    const isCurrentlyLiked = existingLikes.length > 0;
    
    if (isCurrentlyLiked) {
      // Unlike
      const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/annotation_likes?annotation_id=eq.${annotationId}&user_id=eq.${userId}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      
      if (!deleteResponse.ok) {
        throw new Error('Failed to remove like');
      }
      
      // Update UI
      const currentCount = parseInt(buttonElement.textContent.match(/\d+/) || ['0'])[0];
      buttonElement.innerHTML = `<span style="font-size: 14px;">🤍</span> ${Math.max(0, currentCount - 1)}`;
      
    } else {
      // Like
      const likeResponse = await fetch(`${SUPABASE_URL}/rest/v1/annotation_likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          annotation_id: annotationId,
          user_id: userId
        })
      });
      
      if (!likeResponse.ok) {
        throw new Error('Failed to add like');
      }
      
      // Update UI
      const currentCount = parseInt(buttonElement.textContent.match(/\d+/) || ['0'])[0];
      buttonElement.innerHTML = `<span style="font-size: 14px;">❤️</span> ${currentCount + 1}`;
    }
    
  } catch (error) {
    Zotero.debug("Researchopia: Toggle like error: " + error.message);
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: "点赞操作失败：" + error.message,
        type: "fail",
        progress: 100
      })
      .show();
  }
}

// Toggle comments section
function toggleCommentsSection(annotationId, annotationElement) {
  const doc = annotationElement.ownerDocument;
  
  // Check if comments section already exists
  let commentsSection = annotationElement.querySelector('.comments-section');
  
  if (commentsSection) {
    // Toggle visibility
    commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
    return;
  }
  
  // Create comments section
  commentsSection = doc.createElement('div');
  commentsSection.className = 'comments-section';
  commentsSection.style.cssText = 'margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;';
  
  // Comments list
  const commentsList = doc.createElement('div');
  commentsList.className = 'comments-list';
  commentsList.style.cssText = 'margin-bottom: 12px;';
  
  // Load and display existing comments
  loadAnnotationComments(annotationId, commentsList);
  
  // Comment input (only for logged in users)
  if (ResearchopiaAuth.isLoggedIn()) {
    const commentInput = doc.createElement('div');
    commentInput.style.cssText = 'display: flex; gap: 8px; align-items: flex-start;';
    
    const textarea = doc.createElement('textarea');
    textarea.placeholder = '写个评论...';
    textarea.style.cssText = 'flex: 1; min-height: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; font-size: 12px; font-family: inherit;';
    
    const submitBtn = doc.createElement('button');
    submitBtn.textContent = '发布';
    submitBtn.style.cssText = 'padding: 8px 16px; border: none; background: #007acc; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; white-space: nowrap;';
    submitBtn.addEventListener('click', async () => {
      await submitComment(annotationId, textarea.value, commentsList, textarea);
    });
    
    // Submit on Ctrl+Enter
    textarea.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        submitBtn.click();
      }
    });
    
    commentInput.appendChild(textarea);
    commentInput.appendChild(submitBtn);
    commentsSection.appendChild(commentInput);
  } else {
    const loginPrompt = doc.createElement('div');
    loginPrompt.style.cssText = 'text-align: center; color: #666; font-size: 12px; padding: 16px;';
    loginPrompt.textContent = '请登录后参与评论';
    commentsSection.appendChild(loginPrompt);
  }
  
  commentsSection.insertBefore(commentsList, commentsSection.firstChild);
  annotationElement.appendChild(commentsSection);
}

// Load annotation comments
async function loadAnnotationComments(annotationId, containerElement) {
  try {
    const authHeaders = ResearchopiaAuth.getAuthHeaders();
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/annotation_comments?annotation_id=eq.${annotationId}&select=*,users!inner(username)&order=created_at.asc`, {
      headers: authHeaders
    });
    
    if (!response.ok) {
      throw new Error('Failed to load comments');
    }
    
    const comments = await response.json();
    
    // Clear existing comments
    while (containerElement.firstChild) {
      containerElement.removeChild(containerElement.firstChild);
    }
    
    if (comments.length === 0) {
      const emptyMsg = containerElement.ownerDocument.createElement('div');
      emptyMsg.style.cssText = 'text-align: center; color: #999; font-size: 12px; padding: 16px;';
      emptyMsg.textContent = '还没有评论';
      containerElement.appendChild(emptyMsg);
      return;
    }
    
    // Display comments
    comments.forEach(comment => {
      const commentElement = createCommentElement(containerElement.ownerDocument, comment);
      containerElement.appendChild(commentElement);
    });
    
  } catch (error) {
    Zotero.debug("Researchopia: Load comments error: " + error.message);
    const errorMsg = containerElement.ownerDocument.createElement('div');
    errorMsg.style.cssText = 'text-align: center; color: #999; font-size: 12px; padding: 16px;';
    errorMsg.textContent = '加载评论失败';
    containerElement.appendChild(errorMsg);
  }
}

// Create comment element
function createCommentElement(doc, comment) {
  const commentDiv = doc.createElement('div');
  commentDiv.style.cssText = 'padding: 8px 0; border-bottom: 1px solid #f0f0f0;';
  
  const header = doc.createElement('div');
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;';
  
  const author = doc.createElement('span');
  author.style.cssText = 'font-size: 12px; font-weight: 500; color: #333;';
  author.textContent = comment.users?.username || '匿名用户';
  
  const timestamp = doc.createElement('span');
  timestamp.style.cssText = 'font-size: 11px; color: #999;';
  timestamp.textContent = new Date(comment.created_at).toLocaleDateString();
  
  header.appendChild(author);
  header.appendChild(timestamp);
  
  const content = doc.createElement('div');
  content.style.cssText = 'font-size: 12px; line-height: 1.4; color: #333; word-wrap: break-word;';
  content.textContent = comment.content;
  
  commentDiv.appendChild(header);
  commentDiv.appendChild(content);
  
  return commentDiv;
}

// Submit comment
async function submitComment(annotationId, content, containerElement, textareaElement) {
  try {
    if (!content.trim()) {
      return;
    }
    
    // Reload auth state to ensure we have the latest status
    ResearchopiaAuth.loadAuthState();
    
    if (!ResearchopiaAuth.isLoggedIn()) {
      new ztoolkit.ProgressWindow("Researchopia")
        .createLine({
          text: "请先登录后再评论",
          type: "fail",
          progress: 100
        })
        .show();
      return;
    }
    
    const authHeaders = ResearchopiaAuth.getAuthHeaders();
    const userId = ResearchopiaAuth.getCurrentUserId();
    
    if (!userId) {
      new ztoolkit.ProgressWindow("Researchopia")
        .createLine({
          text: "用户ID获取失败，请重新登录",
          type: "fail",
          progress: 100
        })
        .show();
      return;
    }
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/annotation_comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({
        annotation_id: annotationId,
        user_id: userId,
        content: content.trim()
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit comment');
    }
    
    // Clear textarea
    textareaElement.value = '';
    
    // Reload comments
    await loadAnnotationComments(annotationId, containerElement);
    
    // Update comment count in the main UI
    // TODO: Find and update the comment button
    
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: "评论发布成功！",
        type: "success",
        progress: 100
      })
      .show();
      
  } catch (error) {
    Zotero.debug("Researchopia: Submit comment error: " + error.message);
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: "评论发布失败：" + error.message,
        type: "fail",
        progress: 100
      })
      .show();
  }
}

// Apply intelligent sorting to annotations based on quality metrics
function applyIntelligentSorting(annotations) {
  if (!annotations || annotations.length === 0) {
    return annotations;
  }
  
  // Calculate quality score for each annotation
  const scoredAnnotations = annotations.map(annotation => {
    const score = calculateAnnotationQualityScore(annotation);
    return { ...annotation, _qualityScore: score };
  });
  
  // Sort by quality score (highest first), then by creation time (newest first)
  scoredAnnotations.sort((a, b) => {
    const scoreDiff = b._qualityScore - a._qualityScore;
    if (Math.abs(scoreDiff) > 0.1) { // Only prioritize by score if there's a significant difference
      return scoreDiff;
    }
    // If scores are similar, sort by creation time
    return new Date(b.created_at) - new Date(a.created_at);
  });
  
  return scoredAnnotations;
}

// Calculate quality score for an annotation
function calculateAnnotationQualityScore(annotation) {
  let score = 0;
  
  // Base score factors
  const factors = {
    // Social engagement (most important)
    likes: (annotation.likes_count || 0) * 2.0,
    comments: (annotation.comments_count || 0) * 1.5,
    
    // Content quality
    hasComment: annotation.comment && annotation.comment.trim().length > 0 ? 1.0 : 0,
    contentLength: Math.min(2.0, (annotation.content?.length || 0) / 100), // Max 2 points for content length
    
    // Recency (newer annotations get slight boost)
    recency: Math.max(0, 1 - (Date.now() - new Date(annotation.created_at)) / (30 * 24 * 60 * 60 * 1000)) * 0.5, // 30 days decay
    
    // Platform bonus (zotero gets slight preference as it's more curated)
    platform: annotation.platform === 'zotero' ? 0.3 : 0,
    
    // Type bonus (notes and comments are more valuable than simple highlights)
    annotationType: getAnnotationTypeBonus(annotation.type),
    
    // Followed user bonus (prioritize content from followed users)
    followedUser: annotation.isFromFollowedUser ? 3.0 : 0
  };
  
  // Calculate weighted sum
  score = factors.likes + factors.comments + factors.hasComment + 
         factors.contentLength + factors.recency + factors.platform + 
         factors.annotationType + factors.followedUser;
  
  // Apply diminishing returns for extremely high scores
  if (score > 10) {
    score = 10 + Math.log(score - 9);
  }
  
  return Math.max(0, score);
}

// Get annotation type bonus
function getAnnotationTypeBonus(type) {
  const typeScores = {
    'note': 1.0,      // Notes are most valuable
    'text': 0.8,      // Text annotations are also valuable
    'comment': 0.8,   // Comments are valuable
    'highlight': 0.5, // Highlights are less valuable but still useful
    'underline': 0.3,
    'strikeout': 0.2,
    'ink': 0.4,
    'image': 0.6,
    'shape': 0.3
  };
  
  return typeScores[type] || 0;
}

// Toggle user follow
async function toggleUserFollow(targetUserId, buttonElement) {
  try {
    if (!ResearchopiaAuth.isLoggedIn()) {
      new ztoolkit.ProgressWindow("Researchopia")
        .createLine({
          text: "请先登录后再关注用户",
          type: "fail",
          progress: 100
        })
        .show();
      return;
    }
    
    const authHeaders = ResearchopiaAuth.getAuthHeaders();
    const currentUserId = ResearchopiaAuth.getCurrentUserId();
    
    Zotero.debug("Researchopia: Toggle follow - current user: " + currentUserId + ", target user: " + targetUserId);
    
    if (currentUserId === targetUserId) {
      return; // Cannot follow yourself
    }
    
    if (!targetUserId || !currentUserId) {
      throw new Error('Invalid user IDs');
    }
    
    // Check if already following
    const checkUrl = `${SUPABASE_URL}/rest/v1/user_follows?follower_id=eq.${currentUserId}&following_id=eq.${targetUserId}`;
    Zotero.debug("Researchopia: Checking follow status at: " + checkUrl);
    
    const checkResponse = await fetch(checkUrl, {
      headers: authHeaders
    });
    
    if (!checkResponse.ok) {
      const errorText = await checkResponse.text();
      Zotero.debug("Researchopia: Check follow status error: " + checkResponse.status + " - " + errorText);
      throw new Error('Failed to check follow status: ' + checkResponse.status);
    }
    
    const existingFollows = await checkResponse.json();
    const isCurrentlyFollowing = existingFollows.length > 0;
    
    Zotero.debug("Researchopia: Current follow status: " + isCurrentlyFollowing);
    
    if (isCurrentlyFollowing) {
      // Unfollow
      const deleteUrl = `${SUPABASE_URL}/rest/v1/user_follows?follower_id=eq.${currentUserId}&following_id=eq.${targetUserId}`;
      Zotero.debug("Researchopia: Unfollowing at: " + deleteUrl);
      
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: authHeaders
      });
      
      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        Zotero.debug("Researchopia: Unfollow error: " + deleteResponse.status + " - " + errorText);
        throw new Error('Failed to unfollow user: ' + deleteResponse.status);
      }
      
      // Update UI
      buttonElement.textContent = '关注';
      buttonElement.style.backgroundColor = 'white';
      buttonElement.style.color = '#666';
      buttonElement.style.borderColor = '#ddd';
      
      new ztoolkit.ProgressWindow("Researchopia")
        .createLine({
          text: "已取消关注",
          type: "success",
          progress: 100
        })
        .show();
      
    } else {
      // Follow
      const followUrl = `${SUPABASE_URL}/rest/v1/user_follows`;
      const followData = {
        follower_id: currentUserId,
        following_id: targetUserId
      };
      
      Zotero.debug("Researchopia: Following with data: " + JSON.stringify(followData));
      
      const followResponse = await fetch(followUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(followData)
      });
      
      if (!followResponse.ok) {
        const errorText = await followResponse.text();
        Zotero.debug("Researchopia: Follow error: " + followResponse.status + " - " + errorText);
        throw new Error('Failed to follow user: ' + followResponse.status + ' - ' + errorText);
      }
      
      // Update UI
      buttonElement.textContent = '已关注';
      buttonElement.style.backgroundColor = '#e3f2fd';
      buttonElement.style.color = '#1976d2';
      buttonElement.style.borderColor = '#1976d2';
      
      new ztoolkit.ProgressWindow("Researchopia")
        .createLine({
          text: "关注成功！",
          type: "success",
          progress: 100
        })
        .show();
    }
    
  } catch (error) {
    Zotero.debug("Researchopia: Toggle follow error: " + error.message);
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: "关注操作失败：" + error.message,
        type: "fail",
        progress: 100
      })
      .show();
  }
}

// Toggle annotation privacy setting
async function toggleAnnotationPrivacy(annotationId, showAuthorName, statusContainer, doc, annotation) {
  try {
    const authHeaders = ResearchopiaAuth.getAuthHeaders();
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/annotations?id=eq.${annotationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({
        show_author_name: showAuthorName
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update privacy setting');
    }
    
    // Reload status display
    loadSharingStatus(annotation, statusContainer, doc);
    
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: showAuthorName ? "已设置为显示用户名" : "已设置为匿名显示",
        type: "success",
        progress: 100
      })
      .show();
      
  } catch (error) {
    Zotero.debug("Researchopia: Toggle privacy error: " + error.message);
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: "隐私设置更新失败：" + error.message,
        type: "fail",
        progress: 100
      })
      .show();
  }
}

// Unshare annotation
async function unshareAnnotation(annotationId, statusContainer, doc, annotation) {
  try {
    if (!ResearchopiaAuth.isLoggedIn()) {
      statusContainer.innerHTML = `
        <div style="color: #dc3545; font-size: 11px;">
          ❌ 请先登录
        </div>
      `;
      return;
    }
    
    const authHeaders = ResearchopiaAuth.getAuthHeaders();
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/annotations?id=eq.${annotationId}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    
    if (!response.ok) {
      throw new Error('Failed to unshare annotation');
    }
    
    // Reload status display
    loadSharingStatus(annotation, statusContainer, doc);
    
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: "标注已取消共享",
        type: "success",
        progress: 100
      })
      .show();
      
  } catch (error) {
    Zotero.debug("Researchopia: Unshare annotation error: " + error.message);
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: "取消共享失败：" + error.message,
        type: "fail",
        progress: 100
      })
      .show();
  }
}

// Quick share single annotation
async function quickShareAnnotation(annotation, statusContainer, doc) {
  try {
    if (!ResearchopiaAuth.isLoggedIn()) {
      statusContainer.innerHTML = `
        <div style="color: #dc3545; font-size: 11px;">
          ❌ 请先登录
        </div>
      `;
      return;
    }
    
    const doi = getItemDOI(ResearchopiaState.currentItem);
    if (!doi) {
      throw new Error('无法获取DOI');
    }
    
    // Show loading state
    statusContainer.innerHTML = `
      <div style="color: #007acc; font-size: 11px;">
        🔄 正在共享...
      </div>
    `;
    
    // Use the same logic as bulk sharing but for single annotation
    const currentUserId = ResearchopiaAuth.getCurrentUserId();
    
    if (!currentUserId) {
      throw new Error('用户ID获取失败');
    }
    
    const authHeaders = ResearchopiaAuth.getAuthHeaders();
    const showRealName = Zotero.Prefs.get('extensions.researchopia.showRealName', true) !== false;
    
    // Find or create document
    let documentId = await findOrCreateDocument(doi, ResearchopiaState.currentItem);
    
    // Check for duplicates
    const uniqueAnnotations = await filterDuplicateAnnotations(documentId, [annotation], currentUserId);
    
    if (uniqueAnnotations.length === 0) {
      statusContainer.innerHTML = `
        <div style="color: #6c757d; font-size: 11px;">
          ⚠️ 该标注已存在
        </div>
      `;
      return;
    }
    
    // Create payload matching annotations table structure
    const payload = {
      document_id: documentId,
      user_id: currentUserId,
      type: annotation.type || 'highlight',
      content: annotation.text || '',
      comment: annotation.comment || '',
      color: annotation.color || '#ffff00',
      position: {
        page: annotation.page || '',
        zotero_annotation_id: annotation.id,
        platform: 'zotero'
      },
      platform: 'zotero',
      original_id: annotation.id,
      visibility: 'public' // All users are authenticated, this controls public visibility
    };
    
    // Upload annotation
    const response = await fetch(`${SUPABASE_URL}/rest/v1/annotations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        'Prefer': 'return=minimal',
        // Disable triggers that might cause RLS issues
        'X-Client-Info': 'zotero-plugin'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.status === 401) {
      const errorInfo = ResearchopiaAuth.handleApiError(response);
      throw new Error(errorInfo.message);
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      
      // If it's an annotation_stats RLS error, try manual stats update
      if (errorText.includes('annotation_stats') && errorText.includes('row-level security')) {
        Zotero.debug("Researchopia: Annotation_stats trigger failed, skipping stats update");
        // TODO: Could implement manual stats update here if needed
        throw new Error("数据库统计更新失败，但这不影响标注共享功能");
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    // Reload status display
    loadSharingStatus(annotation, statusContainer, doc);
    
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: "标注共享成功！",
        type: "success",
        progress: 100
      })
      .show();
      
  } catch (error) {
    Zotero.debug("Researchopia: Quick share error: " + error.message);
    statusContainer.innerHTML = `
      <div style="color: #dc3545; font-size: 11px;">
        ❌ 共享失败
      </div>
    `;
    new ztoolkit.ProgressWindow("Researchopia")
      .createLine({
        text: "快速共享失败：" + error.message,
        type: "fail",
        progress: 100
      })
      .show();
  }
}