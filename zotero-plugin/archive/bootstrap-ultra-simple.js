var ResearchopiaTest;

function log(msg) {
  Zotero.debug("Researchopia Test: " + msg);
}

function install() {
  log("Installed");
}

async function startup({ id, version, rootURI }) {
  log("Starting");
  
  ResearchopiaTest = {
    id: id,
    version: version,
    rootURI: rootURI,
    
    init: function() {
      log("Initialized");
    },
    
    main: async function() {
      log("Main function");
      // 显示成功消息
      setTimeout(() => {
        try {
          Zotero.alert(null, 'Researchopia Test', 'Plugin loaded successfully!');
        } catch (e) {
          log("Alert failed: " + e.message);
        }
      }, 1000);
    }
  };
  
  ResearchopiaTest.init();
  await ResearchopiaTest.main();
}

function shutdown() {
  log("Shutting down");
  ResearchopiaTest = undefined;
}

function uninstall() {
  log("Uninstalled");
}
