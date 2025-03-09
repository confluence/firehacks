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
    defaultPrefs.setIntPref("hue_offset", 0);

    let prefs = Services.prefs.getBranch("extensions.firehacks.");
    let num_hues = Math.max(Math.min(prefs.getIntPref("num_hues"), 360), 1);
    let hue_offset = prefs.getIntPref("hue_offset");

    // Clear searchbar term after search and always open search in a background tab
    // Updated from legacy scripts

    searchbar._firehacks_originalDoSearch = searchbar.doSearch;
    searchbar.doSearch = function(aData, aWhere, aEngine, aParams, isOneOff = false) {
        if (aWhere == "tab") {
            aWhere = "tabshifted";
        }
        this._firehacks_originalDoSearch(aData, aWhere, aEngine, aParams, isOneOff);
        this._textbox.value = "";
    }

    // Never select all when clicking in urlbar or searchbar
    // Thanks to https://github.com/SebastianSimon/firefox-omni-tweaks for pointing me in the right direction

    searchbar._maybeSelectAll = function() {}
    urlbar._maybeSelectAll = function() {}

    // Set a hue on new tabs
    // Inspired by ChromaTabs and TST Colored Tabs
    // Hash algorithm adapted from SHA1 suggestion in https://stackoverflow.com/questions/3426404/create-a-hexadecimal-colour-based-on-a-string-with-javascript
    
    // Additional overlays for first two path elements on GitHub 
    
    tabcontainer._firehacks_getHue = async function(toHash) {
        let digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(toHash));
        let hash = new Uint32Array(digest.slice(0, 4))[0]; // truncate to 4 bytes = 32 bits
        let hue = Math.round((hash % num_hues) * 360 / num_hues);
        return hue + hue_offset;
    }

    tabcontainer._firehacks_setHueFromUrl = async function(event) {
        let tab = event.target;
        let uri = tab.linkedBrowser.currentURI;
        if (event.detail.changed.includes("visuallyselected") || tab._firehacks_lastHueURI === uri.spec) {
            return;
        }
        tab._firehacks_lastHueURI = uri.spec;
        
        let toHash, toHashSubdomain;
        
        try {
            let host = uri.host;
            let baseDomain = Services.eTLD.getBaseDomainFromHost(host);
            let subdomain = host.replace(new RegExp(`\.?${baseDomain}$`), "").replace(/^www\.?/, "");
            [toHash, toHashSubdomain] = [baseDomain, subdomain];
        } catch(e) {
            if (e.result == Cr.NS_ERROR_FAILURE) {
                toHash = uri.scheme;
            } else if (e.result == Cr.NS_ERROR_HOST_IS_IP_ADDRESS) {
                toHash = uri.host;
            }
        };
        
        let bgStyle = tab.querySelector(".tab-background").style;
        let hue = await this._firehacks_getHue(toHash);
        bgStyle.setProperty("--firehacks-hue", `${hue}deg`);
        
        if (toHashSubdomain) {
            let subdomainHue = await this._firehacks_getHue(toHashSubdomain);
            bgStyle.setProperty("--firehacks-subdomain-hue", `${subdomainHue}deg`);
            bgStyle.setProperty("--firehacks-subdomain-alpha", "100%");
        }
        
        // GitHub; first two parts of path if they exist
        let ghMatch = /https:\/\/github.com\/(.*?)(?:\/(.*?))?(?:\/.*|$)/.exec(uri.spec);
        if (ghMatch) {
            let [ghOne, ghTwo] = ghMatch.slice(1);
            if (ghOne) {
                let ghHueOne = await this._firehacks_getHue(ghOne);
                bgStyle.setProperty("--firehacks-github-hue-one", `${ghHueOne}deg`);
                bgStyle.setProperty("--firehacks-github-alpha-one", "100%");
            }
            if (ghTwo) {
                let ghHueTwo = await this._firehacks_getHue(ghTwo);
                bgStyle.setProperty("--firehacks-github-hue-two", `${ghHueTwo}deg`);
                bgStyle.setProperty("--firehacks-github-alpha-two", "100%");
            }
        }
    }

    tabcontainer.addEventListener('TabAttrModified', tabcontainer._firehacks_setHueFromUrl);

    // Restore unread tab property
    // Partial reversal of https://bugzilla.mozilla.org/show_bug.cgi?id=1453957

    tabcontainer._firehacks_originalHandleNewTab = tabcontainer._handleNewTab;
    tabcontainer._handleNewTab = function(tab) {
        tab.setAttribute("unread", true);
        this._firehacks_originalHandleNewTab(tab);
    }

    tabcontainer._firehacks_originalHandleTabSelect = tabcontainer._handleTabSelect;
    tabcontainer._handleTabSelect = function(aInstant) {
        this._firehacks_originalHandleTabSelect(aInstant);
        this.selectedItem.removeAttribute("unread");
    }
}

try {
    let {classes: Cc, interfaces: Ci, utils: Cu, results: Cr, manager: Cm} = Components;
    const Services = globalThis.Services;
    Cu.importGlobalProperties(['crypto', 'TextEncoder']);

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
    Cu.reportError(e);
};
