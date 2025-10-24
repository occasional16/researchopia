import type { SupabaseManager } from "../supabase";

export type ViewMode = "none" | "my-annotations" | "shared-annotations" | "paper-evaluation" | "quick-search" | "reading-session";

export type BatchDisplayFilter = "all" | "quality" | "recent" | "following" | "toggle-native" | "clear";

export interface PaperInfo {
  title: string;
  doi?: string;
  authors: string[];
  year?: string;
  journal?: string;
}

export interface PanelElements {
  root: HTMLElement;
  paperInfoSection: HTMLElement | null;
  titleElement: HTMLElement | null;
  authorsElement: HTMLElement | null;
  authorsTextElement: HTMLElement | null;
  yearElement: HTMLElement | null;
  journalElement: HTMLElement | null;
  doiElement: HTMLElement | null;
  contentSection: HTMLElement | null;
}

export type MessageType = "info" | "warning" | "error";

export interface BaseViewContext {
  supabaseManager: SupabaseManager;
  showMessage(message: string, type?: MessageType): void;
  getPanelsForCurrentItem(): PanelElements[];
  getCurrentItem(): any;
  isActive(): boolean;
  handleButtonClick(mode: ViewMode, originElement?: HTMLElement): Promise<void>;
}
