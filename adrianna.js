// adrianna.js -- single-file userChrome.js plus loader
// loader works in 134+; adapted from:
// https://www.userchrome.org/what-is-userchrome-js.html#combinedloader
// https://support.mozilla.org/mk/questions/1484805

function applyCustomScriptToNewWindow(win){
    let searchbar = win.document.getElementById("searchbar");
    let urlbar = win.gURLBar;
    let tabbrowser = win.gBrowser;
    let tabcontainer = tabbrowser.tabContainer;
    
    // Clear searchbar term after search and always open search in a background tab
    
    searchbar._originalDoSearch = searchbar.doSearch;
    searchbar.doSearch = function(aData, aWhere, aEngine, aParams, isOneOff = false) {
        if (aWhere == "tab") {
            aWhere = "tabshifted";
        }
        this._originalDoSearch(aData, aWhere, aEngine, aParams, isOneOff);
        this._textbox.value = "";
    }
    
    // Never select all when clicking in urlbar or searchbar
    
    searchbar._maybeSelectAll = function() {};
    urlbar._maybeSelectAll = function() {};
    
    // set a hue on new tabs
        
    tabcontainer.setHueFromUrl = function(tab) {
        let domain;
        try {
            domain = tab.linkedBrowser.currentURI.host;
            // TODO proper handling for subdomains
            // TODO do pips here
        } catch(e) {
            // No host; assume an about: page or similar (TODO make this more granular; use uri for about and protocol otherwise)
            domain = tab.linkedBrowser.currentURI.spec;
        };
        
        // From TST-Colored-tabs TODO change the random number until most colours are nice? Reduce the number of hues for better distribution?
        for(var i = 0, hash = 1; i < domain.length; i++) {
            hash = Math.imul(hash + domain.charCodeAt(i) | 0, 2654435761);
            hash = (hash ^ hash >>> 17) >>> 0;
        }
        
        tab.querySelector(".tab-background").style.setProperty("--firehacks-hue-domain", `${hash % 360}deg`);
    }
    
    tabcontainer.addEventListener('TabAttrModified', function(event) {
        if (!event.detail.changed.includes("label")) {
            return;
        }
        tabcontainer.setHueFromUrl(event.target);
    });
    
    // Restore unread tab property TODO can these also be listeners?
    
    tabcontainer._originalHandleNewTab = tabcontainer._handleNewTab;
    tabcontainer._handleNewTab = function(tab) {
        tab.setAttribute("unread", true);
        tabbrowser._tabAttrModified(tab, ["unread"]);
        this._originalHandleNewTab(tab);
    }
    
    tabcontainer._originalHandleTabSelect = tabcontainer._handleTabSelect;
    tabcontainer._handleTabSelect = function(aInstant) {
        this._originalHandleTabSelect(aInstant);
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
