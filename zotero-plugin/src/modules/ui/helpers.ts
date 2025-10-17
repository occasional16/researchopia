export function createSearchBox(doc: Document, onSearch: (query: string) => void, placeholder = "🔍 搜索标注内容或评论..."): HTMLElement {
  const container = doc.createElement("div");
  container.style.cssText = `
      padding: 14px 16px;
      background: #ffffff;
      border-radius: 10px;
      margin-bottom: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border: 1px solid #e5e7eb;
    `;

  const searchInput = doc.createElement("input") as HTMLInputElement;
  searchInput.type = "text";
  searchInput.placeholder = placeholder;
  searchInput.style.cssText = `
      width: 100%;
      padding: 10px 14px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      background: #f9fafb;
      color: #1f2937;
      box-sizing: border-box;
      transition: all 0.2s;
    `;

  // 添加focus效果
  searchInput.addEventListener("focus", () => {
    searchInput.style.borderColor = "#3b82f6";
    searchInput.style.background = "#ffffff";
    searchInput.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
  });

  searchInput.addEventListener("blur", () => {
    searchInput.style.borderColor = "#e5e7eb";
    searchInput.style.background = "#f9fafb";
    searchInput.style.boxShadow = "none";
  });

  let debounceTimer: number | null = null;
  searchInput.addEventListener("input", () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      onSearch(searchInput.value.trim());
    }, 300) as unknown as number;
  });

  container.appendChild(searchInput);
  return container;
}

export function highlightText(text: string, query: string): string {
  if (!query) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.replace(regex, '<mark style="background: #ffd400; padding: 0 2px;">$1</mark>');
}

export function matchesSearch(annotation: any, query: string): boolean {
  if (!query) return true;

  const lowerQuery = query.toLowerCase();

  if (annotation.text?.toLowerCase().includes(lowerQuery)) return true;
  if (annotation.content?.toLowerCase().includes(lowerQuery)) return true;
  if (annotation.comment?.toLowerCase().includes(lowerQuery)) return true;
  if (annotation.tags?.some((tag: string) => tag.toLowerCase().includes(lowerQuery))) return true;

  return false;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

const ANONYMOUS_FALLBACK = "匿名用户";

function extractUsernameLike(source: any): string | undefined {
  if (!source) {
    return undefined;
  }

  if (typeof source === "string") {
    return source;
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const value = extractUsernameLike(item);
      if (value) {
        return value;
      }
    }
    return undefined;
  }

  if (typeof source === "object") {
    const {
      username,
      userName,
      display_name,
      displayName,
      full_name,
      fullName,
      name,
      profile
    } = source as Record<string, any>;

    const candidates = [username, userName, display_name, displayName, full_name, fullName, name];
    const direct = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
    if (direct) {
      return direct;
    }

    if (profile && typeof profile === "object") {
      return extractUsernameLike(profile);
    }
  }

  return undefined;
}

export function sanitizeDisplayName(name?: string | null, fallback: string = ANONYMOUS_FALLBACK): string {
  if (!name) {
    return fallback;
  }

  const trimmed = String(name).trim();
  if (!trimmed) {
    return fallback;
  }

  let candidate = trimmed;
  if (candidate.includes("@")) {
    const localPart = candidate.split("@")[0]?.trim();
    candidate = localPart && localPart.length > 0 ? localPart : fallback;
  }

  const sanitized = candidate.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });

  return sanitized || fallback;
}

export function resolveAnnotationDisplayName(annotation: any): string {
  if (!annotation?.show_author_name) {
    return ANONYMOUS_FALLBACK;
  }

  const candidates = [
    extractUsernameLike(annotation?.users),
    annotation?.author_username,
    annotation?.username,
    annotation?.user_display_name,
    annotation?.display_name,
    annotation?.author_display_name
  ];

  const name = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return sanitizeDisplayName(name);
}

export function resolveCommentDisplayInfo(comment: any): { name: string; isAnonymous: boolean } {
  const isAnonymous = Boolean(comment?.is_anonymous) || comment?.show_author_name === false;
  if (isAnonymous) {
    return { name: ANONYMOUS_FALLBACK, isAnonymous: true };
  }

  const candidates = [
    extractUsernameLike(comment?.users),
    comment?.username,
    comment?.author_username,
    comment?.user_display_name,
    comment?.display_name,
    comment?.author_display_name,
    comment?.author_name
  ];

  const name = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return { name: sanitizeDisplayName(name), isAnonymous: false };
}

/**
 * 创建开关样式的复选框
 * @param doc Document对象
 * @param id 复选框ID
 * @param checked 是否选中
 * @param color 开关颜色（选中时）
 * @param onChange 变化回调
 * @returns 开关容器元素
 */
export function createToggleSwitch(
  doc: Document,
  id: string,
  checked: boolean,
  color: string = '#3b82f6',
  onChange?: (checked: boolean) => void
): HTMLElement {
  const switchContainer = doc.createElement('div');
  switchContainer.style.cssText = `
    position: relative;
    width: 40px;
    height: 22px;
    flex-shrink: 0;
  `;

  const checkbox = doc.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = id;
  checkbox.checked = checked;
  checkbox.style.cssText = 'display: none;';

  const switchTrack = doc.createElement('div');
  switchTrack.style.cssText = `
    width: 40px;
    height: 22px;
    background: ${checked ? color : '#d1d5db'};
    border-radius: 11px;
    position: relative;
    transition: all 0.2s;
    cursor: pointer;
  `;

  const switchThumb = doc.createElement('div');
  switchThumb.style.cssText = `
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: ${checked ? '20px' : '2px'};
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  `;

  switchTrack.appendChild(switchThumb);
  switchContainer.appendChild(checkbox);
  switchContainer.appendChild(switchTrack);

  // 点击切换
  switchTrack.addEventListener('click', () => {
    checkbox.checked = !checkbox.checked;
    switchTrack.style.background = checkbox.checked ? color : '#d1d5db';
    switchThumb.style.left = checkbox.checked ? '20px' : '2px';
    if (onChange) {
      onChange(checkbox.checked);
    }
  });

  return switchContainer;
}
