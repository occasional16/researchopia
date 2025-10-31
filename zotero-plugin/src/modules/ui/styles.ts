/**
 * 共享UI样式常量
 * 统一管理所有视图的样式定义
 */

export const colors = {
  primary: '#0d6efd',
  primaryHover: '#0b5ed7',
  success: '#28a745',
  successHover: '#218838',
  danger: '#dc3545',
  dangerHover: '#c82333',
  warning: '#ffc107',
  secondary: '#6c757d',
  light: '#f8f9fa',
  dark: '#212529',
  gray: '#6b7280',
  grayLight: '#9ca3af',
  border: '#dee2e6',
  background: '#ffffff',
  shadow: 'rgba(0, 0, 0, 0.1)',
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
};

/**
 * 容器内边距常量（用于统一管理所有页面容器的padding）
 */
export const containerPadding = {
  content: '1px',      // researchopia-content 等主内容区域
  view: '4px',         // 各种view容器(sessionListView等)
  card: '12px',        // 卡片内容
};

export const fontSize = {
  xs: '11px',
  sm: '12px',
  md: '13px',
  base: '14px',
  lg: '15px',
  xl: '16px',
};

export const borderRadius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  round: '20px',
  circle: '50%',
};

/**
 * 通用容器样式
 */
export const containerStyle = `
  padding: 0;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: auto;
  overflow-y: auto;
`;

/**
 * 卡片基础样式
 */
export const cardStyle = `
  background: ${colors.background};
  border: 1px solid ${colors.border};
  border-radius: ${borderRadius.lg};
  padding: ${containerPadding.card};
  cursor: pointer;
  transition: all 0.2s;
`;

/**
 * 按钮基础样式
 */
export const buttonBaseStyle = `
  padding: ${spacing.md} ${spacing.lg};
  border: none;
  border-radius: ${borderRadius.md};
  cursor: pointer;
  font-size: ${fontSize.md};
  font-weight: 600;
  transition: all 0.2s;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/**
 * 按钮样式变体
 */
export const buttonStyles = {
  primary: `
    ${buttonBaseStyle}
    background: ${colors.primary};
    color: white;
  `,
  success: `
    ${buttonBaseStyle}
    background: ${colors.success};
    color: white;
  `,
  danger: `
    ${buttonBaseStyle}
    background: ${colors.danger};
    color: white;
  `,
  warning: `
    ${buttonBaseStyle}
    background: ${colors.warning};
    color: #000;
  `,
  secondary: `
    ${buttonBaseStyle}
    background: ${colors.secondary};
    color: white;
  `,
};

/**
 * 输入框样式
 */
export const inputStyle = `
  width: 100%;
  padding: ${spacing.sm} ${spacing.md};
  border: 1px solid ${colors.border};
  border-radius: ${borderRadius.sm};
  font-size: ${fontSize.md};
  box-sizing: border-box;
  transition: border-color 0.2s;
`;

/**
 * 标题样式
 */
export const titleStyles = {
  h1: `
    font-size: ${fontSize.xl};
    font-weight: 700;
    color: ${colors.dark};
    margin: 0 0 ${spacing.lg} 0;
  `,
  h2: `
    font-size: ${fontSize.lg};
    font-weight: 600;
    color: ${colors.dark};
    margin: 0 0 ${spacing.md} 0;
  `,
  h3: `
    font-size: ${fontSize.base};
    font-weight: 600;
    color: ${colors.dark};
    margin: 0 0 ${spacing.sm} 0;
  `,
};
