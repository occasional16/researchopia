/**
 * Auth验证工具
 */

/**
 * 验证邮箱格式
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证密码强度
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('密码长度至少8位');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('密码需包含大写字母');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('密码需包含小写字母');
  }
  if (!/\d/.test(password)) {
    errors.push('密码需包含数字');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证用户名格式
 */
export function validateUsername(username: string): boolean {
  return username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_]+$/.test(username);
}
