// ==UserScript==
// @name           Privacy Plus
// @namespace      http://www.quchao.com/entry/privacy-plus
// @author         Chappell
// @include        main
// @version        1.0
// @compatibility  Firefox 13
// ==/UserScript==

(function() {

    // privacy Plus
    var privacyPlus = function () {

        // configuration
        const BLACKLIST = [
            'google.com',
            'baidu.com',
       ];
        const PURGE_TIME = 900000; // in millisec

        // XPCOM shortcuts
        const Cc = Components.classes,
            Ci = Components.interfaces;

        // shortcuts
        const TAB_STOP_STATE = Ci.nsIWebProgressListener.STATE_STOP,
            historyManager = Cc['@mozilla.org/browser/nav-history-service;1'].getService(Ci.nsIBrowserHistory);

        // properties
        var purgeTimer = null,
            domainList = [];

        // states
        var isInitialized = false,
            debugging = false;

        // handlers
        var tabCloseHandler = function (evt) {
            debug('tabCloseHandler');
            // get taget
            let evtTar = evt.target;

            // get the uri to the tab
            let tabUri = evtTar.linkedBrowser.currentURI;

            // push into the domain list
            pushIntoDomainList(tabUri);
        };
        var tabProgressHandler = {
            'onStateChange' : function (aBrowser, aWebProgress, aRequest, aStateFlag, aStatus) {
                // Only gets into this if statement when a page is completely done rendering.
                // Fires on HTML, XML, GIFs, etc.
                if (aRequest && (aStateFlag & TAB_STOP_STATE) && 0 === aStatus) {
                    debug('tabProgressStateChangeHandler');
                    // get hostname
                    let hostname = aBrowser.currentURI;
            
                    // push into the domain list
                    pushIntoDomainList(hostname);
                }
            }
        };

        // debugging
        var debug = function () {
            let consoles = Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService);
            
            return function (msg) {
                if (!debugging) {
                    return;
                }
                consoles.logStringMessage('[privacyPlus] ' + msg);
            };
        }();
        var alert = function () {
            let prompts = Cc['@mozilla.org/embedcomp/prompt-service;1'].getService(Ci.nsIPromptService);
        
            return function (msg) {
                if (!debugging) {
                    return;
                }
                prompts.alert(null, 'debug', msg);
            };
        }();

        // motheds
        var purgeHistory = function () {
            // to remove 
            var removeHistoryByDomain = function (domain) {
                historyManager.removePagesFromHost(domain, false); // set to 'true' to remove all from the (sub)domain(s)
            };
            
            return function (ending) {
                // stop the timer
                clearTimeout(purgeTimer);
                
                // save current list
                var currentDomainStack = domainList.concat();
                
                // reset the list
                domainList = [];
                
                // remove them from the history manager
                debug('purgeHistory: ' + currentDomainStack.join(', '));
                currentDomainStack.forEach(removeHistoryByDomain);
                currentDomainStack = null;
                
                // reset the timer
                if (ending) {
                    purgeTimer = null;
                } else {
                    purgeTimer = setTimeout(purgeHistory, PURGE_TIME);
                }
            };
        }();
        var pushIntoDomainList = function () {
            // create a new regex for the domain blacklist
            var blacklistRegex = new RegExp('^(?:[^:]+):\\/\\/((?:\\w+(?:[-.]\\w+)*\\.)*(?:' + BLACKLIST.map(function(domain) {
                domain = domain.toLowerCase().trim();
                domain = domain.replace(/\./g, '\\.');
                domain = domain.replace(/\//g, '');
                return domain;
            }).join('|') + '))\\/');

            // the real func
            return function (nsIURI) {
                // get the domain
                let historyDomain = null;

                // remove it from the history
                debug('pushIntoDomainList: ' + nsIURI.spec);
                if (null !== (historyDomain = blacklistRegex.exec(nsIURI.spec))) {
                    // get the domain
                    historyDomain = historyDomain[1];

                    // push into the domain list
                    if (-1 === domainList.indexOf(historyDomain)) {
                        domainList.push(historyDomain);
                        debug('pushedIntoDomainStack: ' + historyDomain);
                    }
                }
            };
        }();
        var shutdown = function () {
            // state check
            if (!isInitialized) {
                return;
            }

            // remove itself
            window.removeEventListener('unload', shutdown, false);

            // remove listeners
            gBrowser.tabContainer.removeEventListener('TabClose', tabCloseHandler, false);
            gBrowser.removeTabsProgressListener(tabProgressHandler);

            // destroy the timer
            purgeHistory(true);

            // state changed
            isInitialized = false;
        };
        var init = function () {
            // feature check
            if('TM_init' in window || 'InformationalTabService' in window) {
                return;
            }
            
            // state check
            if (isInitialized) {
                return;
            }

            // remove itself
            //window.removeEventListener('load', init, false);

            // add listeners
            gBrowser.tabContainer.addEventListener('TabClose', tabCloseHandler, false);
            gBrowser.addTabsProgressListener(tabProgressHandler);
            
            // setup a timer
            purgeTimer = setTimeout(purgeHistory, PURGE_TIME);

            // add a shutdown listener
            window.addEventListener('unload', shutdown, false);

            // state changed
            isInitialized = true;
        };

        // public methods
        return {
            'init' : init
        };

    }();

    // starts here
    //window.addEventListener('load', privacyPlus.init, false);
    privacyPlus.init();

})();
