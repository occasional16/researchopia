/**
 * Auth验证工具
 */
/**
 * 验证邮箱格式
 */
declare function validateEmail(email: string): boolean;
/**
 * 验证密码强度
 */
declare function validatePassword(password: string): {
    valid: boolean;
    errors: string[];
};
/**
 * 验证用户名格式
 */
declare function validateUsername(username: string): boolean;

export { validateEmail, validatePassword, validateUsername };
