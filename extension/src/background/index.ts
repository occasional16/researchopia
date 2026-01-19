/**
 * Background Module Exports
 */

export { SidePanelManager, sidePanelManager } from './side-panel-manager';
export { MessageHandler, messageHandler } from './message-handler';
export { isAcademicSite, isValidDOI, cleanDOI, updateBadgeForSite } from './site-detector';
export { quickBookmarkCurrentTab, showBadgeNotification } from './quick-bookmark';
export type { MessageRequest, MessageResponse, PanelState, DOIContext } from './types';
