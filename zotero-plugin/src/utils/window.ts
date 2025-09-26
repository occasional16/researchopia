export function getMainWindow(): _ZoteroTypes.MainWindow | null {
  return Zotero.getMainWindow();
}

export function getActiveWindow(): Window | null {
  return Services.wm.getMostRecentWindow("navigator:browser");
}
