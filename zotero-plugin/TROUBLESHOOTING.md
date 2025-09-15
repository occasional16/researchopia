# Troubleshooting Guide - Academic Rating Zotero Plugin

## Installation Failed Error

If you see "The add-on could not be installed, it may be incompatible with this version of Zotero", try these steps:

### 1. Check Zotero Version
- This plugin requires **Zotero 7.0 or later** (including Zotero 8 beta)
- Check your version: Help → About Zotero
- Download latest beta: https://www.zotero.org/support/beta_builds

### 2. Verify Plugin File
- Make sure you're using the `.xpi` file (not `.zip` or folder)
- File should be about 4-5KB in size
- Rebuild if necessary: run `.\build.ps1` in the plugin directory

### 3. Installation Method
- Use **Tools → Plugins → Install Plugin From File...**
- NOT "Debug Add-ons" (that's for development)
- Restart Zotero after installation

### 4. Check Browser Console
If installation still fails:
1. Enable debugging: Help → Preferences → Advanced → Config Editor
2. Search for `extensions.zotero.debug.log` and set to `true`
3. Try installing again
4. Check Tools → Developer → Error Console for error messages

### 5. Manual Troubleshooting
Common issues and solutions:

**"bootstrapped plugin not loading"**
- Check that `bootstrap.js` is in the root of the XPI
- Verify manifest.json has correct plugin ID format

**"ItemPaneManager not found"**
- This API was introduced in Zotero 7
- Update to latest Zotero beta

**"Section not appearing"**
- Check if Item Pane is visible (View → Layout → Item Pane)
- Try selecting different items
- Look for "Academic Rating" section in the Item Pane

### 6. Development Mode (Alternative)
For testing, you can temporarily load:
1. Tools → Plugins → Debug Add-ons → Load Temporary Add-on
2. Select `manifest.json` directly (not XPI)
3. Plugin will unload when Zotero restarts

## Success Indicators
✅ No error during installation
✅ Plugin appears in Tools → Plugins list
✅ "Academic Rating" section visible in Item Pane
✅ Iframe loads www.researchopia.com when item is selected
✅ URL contains parameters like `?doi=...` for items with DOI

## Still Having Issues?
1. Check the browser console in Zotero (Ctrl+Shift+I or Cmd+Option+I)
2. Look for "Academic Rating plugin" log messages
3. Verify your Zotero version is 7.0+ or 8.0 beta
4. Try the development installation method as a test