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
export {
  extractDOI,
  extractDOIFromURL,
  getDOIUrl,
  normalizeDOI,
  validateDOI
};
//# sourceMappingURL=index.js.map