var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};

// src/utils/doi.ts
function validateDOI(doi) {
  if (!doi) return false;
  const normalized = normalizeDOI(doi);
  return /^10\.\d{4,}\/[^\s]+$/.test(normalized);
}
function normalizeDOI(doi) {
  return doi.replace(/^doi:/i, "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
}
function extractDOI(text) {
  if (!text) return null;
  const patterns = [
    /\b(10\.\d{4,}\/[^\s]+)/gi,
    /doi:\s*(10\.\d{4,}\/[^\s]+)/gi,
    /dx\.doi\.org\/(10\.\d{4,}\/[^\s]+)/gi
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return normalizeDOI(match[1] || match[0]);
    }
  }
  return null;
}
function extractDOIFromURL(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes("doi.org")) {
      return normalizeDOI(urlObj.pathname.slice(1));
    }
  } catch (e) {
    return null;
  }
  return extractDOI(url);
}
function getDOIUrl(doi) {
  const normalized = normalizeDOI(doi);
  return `https://doi.org/${normalized}`;
}

// src/auth/validation.ts
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
function validatePassword(password) {
  const errors = [];
  if (password.length < 8) {
    errors.push("\u5BC6\u7801\u957F\u5EA6\u81F3\u5C118\u4F4D");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("\u5BC6\u7801\u9700\u5305\u542B\u5927\u5199\u5B57\u6BCD");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("\u5BC6\u7801\u9700\u5305\u542B\u5C0F\u5199\u5B57\u6BCD");
  }
  if (!/\d/.test(password)) {
    errors.push("\u5BC6\u7801\u9700\u5305\u542B\u6570\u5B57");
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function validateUsername(username) {
  return username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
}

// src/api-client/fetch.ts
async function fetchWithTimeout(url, options = {}) {
  const _a = options, { timeout = 3e4 } = _a, fetchOptions = __objRest(_a, ["timeout"]);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, __spreadProps(__spreadValues({}, fetchOptions), {
      signal: controller.signal
    }));
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`\u8BF7\u6C42\u8D85\u65F6: ${url}`);
    }
    throw error;
  }
}
function buildUrlWithParams(baseUrl, params) {
  const url = new URL(baseUrl, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== void 0 && value !== null) {
      url.searchParams.append(key, value);
    }
  });
  return url.toString();
}
function parseApiError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "Unknown error";
}

// src/constants/config.ts
var API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
var TIMEOUT_CONFIG = {
  DEFAULT: 3e4,
  LONG: 6e4,
  SHORT: 1e4
};
var STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_PREFERENCES: "user_preferences",
  THEME: "theme"
};
var ERROR_MESSAGES = {
  NETWORK_ERROR: "\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u60A8\u7684\u7F51\u7EDC\u8BBE\u7F6E",
  TIMEOUT_ERROR: "\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
  AUTH_ERROR: "\u8BA4\u8BC1\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55",
  NOT_FOUND: "\u8BF7\u6C42\u7684\u8D44\u6E90\u4E0D\u5B58\u5728",
  SERVER_ERROR: "\u670D\u52A1\u5668\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5"
};

// src/errors/index.ts
var ErrorCode = /* @__PURE__ */ ((ErrorCode2) => {
  ErrorCode2[ErrorCode2["NETWORK_ERROR"] = 1e3] = "NETWORK_ERROR";
  ErrorCode2[ErrorCode2["NETWORK_TIMEOUT"] = 1001] = "NETWORK_TIMEOUT";
  ErrorCode2[ErrorCode2["NETWORK_OFFLINE"] = 1002] = "NETWORK_OFFLINE";
  ErrorCode2[ErrorCode2["AUTH_INVALID_CREDENTIALS"] = 2e3] = "AUTH_INVALID_CREDENTIALS";
  ErrorCode2[ErrorCode2["AUTH_TOKEN_EXPIRED"] = 2001] = "AUTH_TOKEN_EXPIRED";
  ErrorCode2[ErrorCode2["AUTH_PERMISSION_DENIED"] = 2002] = "AUTH_PERMISSION_DENIED";
  ErrorCode2[ErrorCode2["AUTH_SESSION_INVALID"] = 2003] = "AUTH_SESSION_INVALID";
  ErrorCode2[ErrorCode2["DATA_NOT_FOUND"] = 3e3] = "DATA_NOT_FOUND";
  ErrorCode2[ErrorCode2["DATA_VALIDATION_FAILED"] = 3001] = "DATA_VALIDATION_FAILED";
  ErrorCode2[ErrorCode2["DATA_CONFLICT"] = 3002] = "DATA_CONFLICT";
  ErrorCode2[ErrorCode2["DATA_PARSE_ERROR"] = 3003] = "DATA_PARSE_ERROR";
  ErrorCode2[ErrorCode2["API_INVALID_REQUEST"] = 4e3] = "API_INVALID_REQUEST";
  ErrorCode2[ErrorCode2["API_RATE_LIMIT"] = 4001] = "API_RATE_LIMIT";
  ErrorCode2[ErrorCode2["API_SERVER_ERROR"] = 4002] = "API_SERVER_ERROR";
  ErrorCode2[ErrorCode2["API_BAD_RESPONSE"] = 4003] = "API_BAD_RESPONSE";
  ErrorCode2[ErrorCode2["ANNOTATION_SYNC_FAILED"] = 5e3] = "ANNOTATION_SYNC_FAILED";
  ErrorCode2[ErrorCode2["SESSION_JOIN_FAILED"] = 5001] = "SESSION_JOIN_FAILED";
  ErrorCode2[ErrorCode2["PAPER_REGISTRATION_FAILED"] = 5002] = "PAPER_REGISTRATION_FAILED";
  ErrorCode2[ErrorCode2["PDF_LOAD_FAILED"] = 5003] = "PDF_LOAD_FAILED";
  ErrorCode2[ErrorCode2["DOI_INVALID"] = 5004] = "DOI_INVALID";
  ErrorCode2[ErrorCode2["UNKNOWN_ERROR"] = 9e3] = "UNKNOWN_ERROR";
  return ErrorCode2;
})(ErrorCode || {});
var ResearchopiaError = class extends Error {
  constructor(code, message, source, context, originalError) {
    super(message);
    this.name = "ResearchopiaError";
    this.code = code;
    this.context = context;
    this.timestamp = Date.now();
    this.source = source;
    this.originalError = originalError;
    if (originalError && originalError.stack) {
      this.stack = `${this.stack}
Caused by: ${originalError.stack}`;
    }
  }
  /**
   * 转换为JSON格式（用于日志记录和网络传输）
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      source: this.source,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
  /**
   * 获取用户友好的错误消息
   */
  getUserMessage() {
    const errorMessages = {
      // 网络错误
      [1e3 /* NETWORK_ERROR */]: "\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8BBE\u7F6E",
      [1001 /* NETWORK_TIMEOUT */]: "\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
      [1002 /* NETWORK_OFFLINE */]: "\u5F53\u524D\u5904\u4E8E\u79BB\u7EBF\u72B6\u6001\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5",
      // 认证错误
      [2e3 /* AUTH_INVALID_CREDENTIALS */]: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF",
      [2001 /* AUTH_TOKEN_EXPIRED */]: "\u767B\u5F55\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55",
      [2002 /* AUTH_PERMISSION_DENIED */]: "\u60A8\u6CA1\u6709\u6743\u9650\u6267\u884C\u6B64\u64CD\u4F5C",
      [2003 /* AUTH_SESSION_INVALID */]: "\u4F1A\u8BDD\u65E0\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55",
      // 数据错误
      [3e3 /* DATA_NOT_FOUND */]: "\u672A\u627E\u5230\u8BF7\u6C42\u7684\u6570\u636E",
      [3001 /* DATA_VALIDATION_FAILED */]: "\u6570\u636E\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8F93\u5165",
      [3002 /* DATA_CONFLICT */]: "\u6570\u636E\u51B2\u7A81\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5",
      [3003 /* DATA_PARSE_ERROR */]: "\u6570\u636E\u89E3\u6790\u5931\u8D25",
      // API错误
      [4e3 /* API_INVALID_REQUEST */]: "\u8BF7\u6C42\u53C2\u6570\u9519\u8BEF",
      [4001 /* API_RATE_LIMIT */]: "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5",
      [4002 /* API_SERVER_ERROR */]: "\u670D\u52A1\u5668\u9519\u8BEF\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
      [4003 /* API_BAD_RESPONSE */]: "\u670D\u52A1\u5668\u54CD\u5E94\u5F02\u5E38",
      // 业务逻辑错误
      [5e3 /* ANNOTATION_SYNC_FAILED */]: "\u6807\u6CE8\u540C\u6B65\u5931\u8D25",
      [5001 /* SESSION_JOIN_FAILED */]: "\u52A0\u5165\u9605\u8BFB\u4F1A\u8BDD\u5931\u8D25",
      [5002 /* PAPER_REGISTRATION_FAILED */]: "\u8BBA\u6587\u6CE8\u518C\u5931\u8D25",
      [5003 /* PDF_LOAD_FAILED */]: "PDF\u52A0\u8F7D\u5931\u8D25",
      [5004 /* DOI_INVALID */]: "DOI\u683C\u5F0F\u65E0\u6548",
      // 系统错误
      [9e3 /* UNKNOWN_ERROR */]: "\u53D1\u751F\u672A\u77E5\u9519\u8BEF"
    };
    return errorMessages[this.code] || this.message;
  }
  /**
   * 判断是否为可重试错误
   */
  isRetryable() {
    const retryableCodes = [
      1e3 /* NETWORK_ERROR */,
      1001 /* NETWORK_TIMEOUT */,
      4001 /* API_RATE_LIMIT */,
      4002 /* API_SERVER_ERROR */
    ];
    return retryableCodes.includes(this.code);
  }
  /**
   * 判断是否为需要重新认证的错误
   */
  requiresReauth() {
    const reauthCodes = [
      2001 /* AUTH_TOKEN_EXPIRED */,
      2003 /* AUTH_SESSION_INVALID */
    ];
    return reauthCodes.includes(this.code);
  }
};
var ErrorHandler = class {
  /**
   * 将任意错误转换为ResearchopiaError
   */
  static normalize(error, source, defaultCode = 9e3 /* UNKNOWN_ERROR */) {
    if (error instanceof ResearchopiaError) {
      return error;
    }
    if (error instanceof Error) {
      return new ResearchopiaError(
        defaultCode,
        error.message,
        source,
        void 0,
        error
      );
    }
    return new ResearchopiaError(
      defaultCode,
      String(error),
      source
    );
  }
  /**
   * 记录错误（可扩展到远程日志服务）
   */
  static log(error) {
    console.error("[Researchopia Error]", {
      code: error.code,
      message: error.message,
      source: error.source,
      context: error.context,
      timestamp: new Date(error.timestamp).toISOString()
    });
    if (error.originalError) {
      console.error("[Original Error]", error.originalError);
    }
  }
  /**
   * 处理错误（记录 + 可选的用户提示）
   */
  static handle(error, source, options) {
    const normalizedError = this.normalize(error, source);
    this.log(normalizedError);
    if ((options == null ? void 0 : options.showToUser) && (options == null ? void 0 : options.onUserMessage)) {
      options.onUserMessage(normalizedError.getUserMessage());
    }
    return normalizedError;
  }
};
var createError = {
  network: (message, source, context) => new ResearchopiaError(1e3 /* NETWORK_ERROR */, message, source, context),
  auth: (message, source, context) => new ResearchopiaError(2e3 /* AUTH_INVALID_CREDENTIALS */, message, source, context),
  notFound: (message, source, context) => new ResearchopiaError(3e3 /* DATA_NOT_FOUND */, message, source, context),
  validation: (message, source, context) => new ResearchopiaError(3001 /* DATA_VALIDATION_FAILED */, message, source, context),
  api: (message, source, context) => new ResearchopiaError(4002 /* API_SERVER_ERROR */, message, source, context)
};
export {
  API_BASE_URL,
  ERROR_MESSAGES,
  ErrorCode,
  ErrorHandler,
  ResearchopiaError,
  STORAGE_KEYS,
  TIMEOUT_CONFIG,
  buildUrlWithParams,
  createError,
  extractDOI,
  extractDOIFromURL,
  fetchWithTimeout,
  getDOIUrl,
  normalizeDOI,
  parseApiError,
  validateDOI,
  validateEmail,
  validatePassword,
  validateUsername
};
//# sourceMappingURL=index.js.map