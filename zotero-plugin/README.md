# 研学港 Researchopia — Zotero 插件
To install the plugin:

### Method: Manual build
1. Create an XPI file: zip the plugin folder contents and rename to `.xpi`
2. In Zotero 8 beta, open Tools → Plugins → Install Plugin From File...
3. Select the generated `researchopia-zotero-<version>.xpi` file
4. Open the Item Pane for any item — you will see a new section "研学港 Researchopia"

This is a Zotero 8-compatible bootstrapped plugin that integrates the Researchopia site inside Zotero.

Goals:
- Add a custom Item Pane section that embeds your site for the selected item
- Support beta builds of Zotero 8
- Reuse parts of the existing browser extension logic when appropriate

## Features (MVP)
- Adds a toolbar button and context menu to open a Page View with Researchopia for the selected item
- A sidebar panel to show quick rating/altmetric summary
- Message passing between background and content (for future use)

## Structure
- `manifest.json` — WebExtension-style manifest for Zotero bootstrap plugins
- `bootstrap.js` — registers Item Pane section and lifecycle hooks
- `prefs.js` — default preferences (e.g., base URL)
- `panel/` — HTML+JS iframe that loads your site with item identifiers

## Build/Load
No build step is required for the MVP. To load temporarily:
1. In Zotero 8 beta, open Tools → Add-ons → Debug Add-ons
2. Click “Load Temporary Add-on…” and select this folder’s `manifest.json`
3. Open the Item Pane for any item — you will see a new section “研学港 Researchopia”

During development, the Item Pane section loads `panel/panel.html` and passes item identifiers via hash.

Known limitations (MVP):
- Identifier extraction uses item fields (DOI, arXiv). Extend this mapping as needed (e.g., PMID).

## Next steps
- Tighten integration with the Item Pane (embedded page tied to selected item)
- Authentication/session sharing with Researchopia if needed
- Port more UI from your existing browser extension

Note: For development/testing, you can also use Tools → Plugins → Debug Add-ons → Load Temporary Add-on to load the folder directly without creating XPI.
