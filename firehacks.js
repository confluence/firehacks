// firehacks.js -- single-file userChrome.js plus loader
// loader works in 134+; adapted from:
// https://www.userchrome.org/what-is-userchrome-js.html#combinedloader
// https://support.mozilla.org/mk/questions/1484805

function applyCustomScriptToNewWindow(win){
    let searchbar = win.document.getElementById("searchbar");
    let urlbar = win.gURLBar;
    let tabbrowser = win.gBrowser;
    let tabcontainer = tabbrowser.tabContainer;
    
    // Clear searchbar term after search and always open search in a background tab
    
    searchbar._firehacks_originalDoSearch = searchbar.doSearch;
    searchbar.doSearch = function(aData, aWhere, aEngine, aParams, isOneOff = false) {
        if (aWhere == "tab") {
            aWhere = "tabshifted";
        }
        this._firehacks_originalDoSearch(aData, aWhere, aEngine, aParams, isOneOff);
        this._textbox.value = "";
    }
    
    // Never select all when clicking in urlbar or searchbar
    
    searchbar._maybeSelectAll = function() {};
    urlbar._maybeSelectAll = function() {};
    
    // set a hue on new tabs
        
    tabcontainer._firehacks_setHueFromUrl = function(tab) {
        let uri = tab.linkedBrowser.currentURI;
        if (tab._firehacks_lastHueURI !== undefined && tab._firehacks_lastHueURI === uri) {
            return;
        }
        
        let domain;

        try {
            domain = uri.host;
        } catch(e) {
            // No host; assume an about: page or similar
            domain = uri.scheme;
        };

        // From TST-Colored-tabs
        for(var i = 0, hash = 1; i < domain.length; i++) {
            hash = Math.imul(hash + domain.charCodeAt(i) | 0, 2654435761);
            hash = (hash ^ hash >>> 17) >>> 0;
        }
        
        tab.querySelector(".tab-background").style.setProperty("--firehacks-hue", `${hash % 360}deg`);
        tab._firehacks_lastHueURI = uri;
    }
    
    tabcontainer.addEventListener('TabAttrModified', function(event) {
        tabcontainer._firehacks_setHueFromUrl(event.target);
    });
    
    // Restore unread tab property
    
    tabcontainer._firehacks_originalHandleNewTab = tabcontainer._handleNewTab;
    tabcontainer._handleNewTab = function(tab) {
        tab.setAttribute("unread", true);
        tabbrowser._tabAttrModified(tab, ["unread"]);
        this._firehacks_originalHandleNewTab(tab);
    }
    
    tabcontainer._firehacks_originalHandleTabSelect = tabcontainer._handleTabSelect;
    tabcontainer._handleTabSelect = function(aInstant) {
        this._firehacks_originalHandleTabSelect(aInstant);
        this.selectedItem.removeAttribute("unread");
        tabbrowser._tabAttrModified(this.selectedItem, ["unread"]);
    }
}

try {
    let { classes: Cc, interfaces: Ci, manager: Cm  } = Components;
    const Services = globalThis.Services;
    
    function ConfigJS() {
        Services.obs.addObserver(this, 'chrome-document-global-created', false);
    }
    
    ConfigJS.prototype = {
        observe: function (aSubject) {
            aSubject.addEventListener('load', this, {once: true}); 
        },
        
        handleEvent: function (aEvent) {
            let document = aEvent.originalTarget;
            let window = document.defaultView;
            let location = window.location;
            
            if (/^(chrome:(?!\/\/(global\/content\/commonDialog|browser\/content\/webext-panels)\.x?html)|about:(?!blank))/i.test(location.href)) {
                if (window.gBrowser) {
                    applyCustomScriptToNewWindow(window);
                }
            }
        }
    };
    
    if (!Services.appinfo.inSafeMode) {
        new ConfigJS();
    }
} catch(e) {
    Components.utils.reportError(e);
};
