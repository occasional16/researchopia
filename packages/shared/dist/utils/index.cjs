"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/index.ts
var utils_exports = {};
__export(utils_exports, {
  extractDOI: () => extractDOI,
  extractDOIFromURL: () => extractDOIFromURL,
  getDOIUrl: () => getDOIUrl,
  normalizeDOI: () => normalizeDOI,
  validateDOI: () => validateDOI
});
module.exports = __toCommonJS(utils_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  extractDOI,
  extractDOIFromURL,
  getDOIUrl,
  normalizeDOI,
  validateDOI
});
//# sourceMappingURL=index.cjs.map