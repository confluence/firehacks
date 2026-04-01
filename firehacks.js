// firehacks.js -- single-file userChrome.js plus loader
// loader works in 134+; adapted from:
// https://www.userchrome.org/what-is-userchrome-js.html#combinedloader
// https://support.mozilla.org/mk/questions/1484805

function applyFirehacks(window){
    let searchbar = window.document.getElementById("searchbar");
    let searchbar_new = window.document.getElementById("searchbar-new");
    let urlbar = window.gURLBar;
    let tabbrowser = window.gBrowser;
    let tabcontainer = tabbrowser.tabContainer;

    let defaultPrefs = Services.prefs.getDefaultBranch("extensions.firehacks.");
    defaultPrefs.setIntPref("numHues", 360);
    defaultPrefs.setIntPref("hueOffset", 0);

    let prefs = Services.prefs.getBranch("extensions.firehacks.");
    let numHues = Math.max(Math.min(prefs.getIntPref("numHues"), 360), 1);
    let hueOffset = prefs.getIntPref("hueOffset");

    // Clear searchbar term after search and always open search in a background tab
    // Updated from legacy scripts
    // This should work for the OLD searchbar widget (restore by setting 'browser.search.widget.new' to false)
    // It now also hardcodes a new background tab as the search target, so you don't need the additional config value

    searchbar._firehacks_originalDoSearch = searchbar.doSearch;
    searchbar.doSearch = function(aData, aWhere, aEngine, aParams, isOneOff = false) {
        aWhere = "tab";
        aParams.inBackground = true;
        this._firehacks_originalDoSearch(aData, aWhere, aEngine, aParams, isOneOff);
        this._textbox.value = "";
        window.gBrowser.selectedBrowser.focus();
    }

    // Partial fix for the NEW searchbar widget
    // It hardcodes a new background tab as the search target
    // Currently not working correctly: affects the normal urlbar; also doesn't load in background if once-off search engine is used.
    // To be fixed later. For now I'm using the old searchbar anyway.

//     searchbar_new._firehacks_originalLoadURL = searchbar_new._loadURL;
//     searchbar_new._loadURL = function(url, event, openUILinkWhere, params, resultDetails=null, browser=this.window.gBrowser.selectedBrowser) {
//         openUILinkWhere  = "tab";
//         params.inBackground = true;
//         this._firehacks_originalLoadURL(url, event, openUILinkWhere, params, resultDetails, browser);
//         this.value = "";
//         window.gBrowser.selectedBrowser.focus();
//     }

    // Never select all when clicking in urlbar or searchbar
    // Thanks to https://github.com/SebastianSimon/firefox-omni-tweaks for pointing me in the right direction

    // This should work for the old searchbar widget (restore by setting 'browser.search.widget.new' to false)
    searchbar._maybeSelectAll = function() {}

    // This should work for the old urlbar widget (obsolete on newer versions)
    urlbar._maybeSelectAll = function() {}

    // This should work for the new urlbar widget
    // We can no longer use maybeSelectAll because it's a private function now!
    urlbar._firehacks_originalOnMousedown = urlbar._on_mousedown;
    urlbar._on_mousedown = function(event) {
        this._firehacks_originalOnMousedown(event);
        this._preventClickSelectsAll = true;
    }

    // This should work for the new searchbar widget
    // We can no longer use maybeSelectAll because it's a private function now!
    searchbar_new._firehacks_originalOnMousedown = searchbar_new._on_mousedown;
    searchbar_new._on_mousedown = function(event) {
        this._firehacks_originalOnMousedown(event);
        this._preventClickSelectsAll = true;
    }

    // Set a hue on new tabs
    // Inspired by ChromaTabs and TST Colored Tabs
    // Additional overlays for subdomains, and first two path elements on GitHub
    
    tabcontainer._firehacks_getHues = async function(toHash, num = numHues, offset = hueOffset) {
        toHash = toHash.toLowerCase().replace(/[^0-9a-z]/g, "0") + "000000"; // right-pad to ensure length >= 6
        let parts = [toHash.substring(0, 3), toHash.substring(3, 6)];
        let hues = [];

        for (const part of parts) {
            let hash = parseInt(part, 36) % 33325; // mod aaa - zzz range only; numbers seldom appear
            let hue = Math.round(360 / num) * Math.round(hash * num / 33325);
            hues.push(hue + offset);
        }

        return hues;
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
        let [hue_from, hue_to] = await this._firehacks_getHues(toHash);
        bgStyle.setProperty("--firehacks-hue-from", `${hue_from}deg`);
        bgStyle.setProperty("--firehacks-hue-to", `${hue_to}deg`);
        
        if (toHashSubdomain) {
            let [subdomainHue_from, subdomainHue_to] = await this._firehacks_getHues(toHashSubdomain);
            bgStyle.setProperty("--firehacks-subdomain-hue-from", `${subdomainHue_from}deg`);
            bgStyle.setProperty("--firehacks-subdomain-hue-to", `${subdomainHue_to}deg`);
            bgStyle.setProperty("--firehacks-subdomain-alpha", "100%");
        } else {
            bgStyle.removeProperty("--firehacks-subdomain-hue-from");
            bgStyle.removeProperty("--firehacks-subdomain-hue-to");
            bgStyle.removeProperty("--firehacks-subdomain-alpha");
        }
        
        // GitHub; first two parts of path if they exist
        let ghOne, ghTwo;
        let ghMatch = /https:\/\/github.com\/(.*?)(?:\/(.*?))?(?:\/.*|$)/.exec(uri.spec);
        if (ghMatch) {
            [ghOne, ghTwo] = ghMatch.slice(1);
        }
        if (ghOne) {
            let [ghHueOne_from, ghHueOne_to] = await this._firehacks_getHues(ghOne);
            bgStyle.setProperty("--firehacks-github-hue-one-from", `${ghHueOne_from}deg`);
            bgStyle.setProperty("--firehacks-github-hue-one-to", `${ghHueOne_to}deg`);
            bgStyle.setProperty("--firehacks-github-alpha-one", "100%");
        } else {
            bgStyle.removeProperty("--firehacks-github-hue-one-from");
            bgStyle.removeProperty("--firehacks-github-hue-one-to");
            bgStyle.removeProperty("--firehacks-github-alpha-one");
        }
        if (ghTwo) {
            let [ghHueTwo_from, ghHueTwo_to] = await this._firehacks_getHues(ghTwo);
            bgStyle.setProperty("--firehacks-github-hue-two-from", `${ghHueTwo_from}deg`);
            bgStyle.setProperty("--firehacks-github-hue-two-to", `${ghHueTwo_to}deg`);
            bgStyle.setProperty("--firehacks-github-alpha-two", "100%");
        } else {
            bgStyle.removeProperty("--firehacks-github-hue-two-from");
            bgStyle.removeProperty("--firehacks-github-hue-two-to");
            bgStyle.removeProperty("--firehacks-github-alpha-two");
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
