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
export {
  validateEmail,
  validatePassword,
  validateUsername
};
//# sourceMappingURL=index.js.map