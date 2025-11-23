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

// src/auth/index.ts
var auth_exports = {};
__export(auth_exports, {
  validateEmail: () => validateEmail,
  validatePassword: () => validatePassword,
  validateUsername: () => validateUsername
});
module.exports = __toCommonJS(auth_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  validateEmail,
  validatePassword,
  validateUsername
});
//# sourceMappingURL=index.cjs.map