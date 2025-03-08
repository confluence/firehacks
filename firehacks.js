// firehacks.js -- single-file userChrome.js plus loader
// loader works in 134+; adapted from:
// https://www.userchrome.org/what-is-userchrome-js.html#combinedloader
// https://support.mozilla.org/mk/questions/1484805

function applyFirehacks(window){
    let searchbar = window.document.getElementById("searchbar");
    let urlbar = window.gURLBar;
    let tabbrowser = window.gBrowser;
    let tabcontainer = tabbrowser.tabContainer;

    let defaultPrefs = Services.prefs.getDefaultBranch("extensions.firehacks.");
    defaultPrefs.setIntPref("num_hues", 360);

    let prefs = Services.prefs.getBranch("extensions.firehacks.");
    let num_hues = Math.min(prefs.getIntPref("num_hues"), 360);

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

    searchbar._maybeSelectAll = function() {}
    urlbar._maybeSelectAll = function() {}

    // set a hue on new tabs

    tabcontainer._firehacks_setHueFromUrl = async function(tab) {
        let uri = tab.linkedBrowser.currentURI;
        if (tab._firehacks_lastHueURI === uri) {
            return;
        }

        let domain;

        try {
            domain = uri.host;
        } catch(e) {
            // No host; assume an about: page or similar
            domain = uri.scheme;
        };

        let digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(domain));
        let hash = new Uint32Array(digest.slice(0, 4))[0]; // truncate to 4 bytes = 32 bits
        let hue = Math.round((hash % num_hues) * 360 / num_hues);

        tab.querySelector(".tab-background").style.setProperty("--firehacks-hue", `${hue}deg`);
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
    const Services = globalThis.Services;
    Components.utils.importGlobalProperties(['crypto', 'TextEncoder']);

    function ConfigFirehacks() {
        Services.obs.addObserver(this, 'chrome-document-global-created', false);
    }

    ConfigFirehacks.prototype = {
        observe: function (aSubject) {
            aSubject.addEventListener('load', this, {once: true}); 
        },

        handleEvent: function (aEvent) {
            let document = aEvent.originalTarget;
            let window = document.defaultView;
            let location = window.location;

            if (/^(chrome:(?!\/\/(global\/content\/commonDialog|browser\/content\/webext-panels)\.x?html)|about:(?!blank))/i.test(location.href)) {
                if (window.gBrowser) {
                    applyFirehacks(window);
                }
            }
        }
    };

    if (!Services.appinfo.inSafeMode) {
        new ConfigFirehacks();
    }
} catch(e) {
    Components.utils.reportError(e);
};
