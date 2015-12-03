// ==UserScript==
// @name         115 Cloud Tweaker
// @namespace    Watsilla
// @version      0.1.0
// @description  Register 115 Cloud as a handler for the magnet protocol.
// @author       Chao QU
// @match        http://115.com/?tab=offline&mode=wangpan*
// @match        https://btdigg.org/search*
// @match        http://cili007.com/*
// @match        http://www.ed2000.com/ShowFile.asp?FileID=*
// @match        http://www.hd1080.cn/*
// @encoding     utf-8
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        unsafeWindow
// @run-at		 document-end
// @license		 MIT
// @homepage     http://quchao.com/entry/115-cloud-tweaker
// downloadURL	 https://github.com/QuChao/Watsilla/raw/master/userScripts/115CloudTweaker.user.js
// ==/UserScript==
// @version       1.0.0 @ 2015-12-03: Initialize release.
/* jshint esnext: true */

/*
 * @Todo:
 * 1. to handle ed2k/thunder protocols as well
 * 2. to transform flashget/qqdl protocols into the known ones
 */

// Configs
var Config = {
    'debug_mode' : false,
    'add_task'   : true, // or just paste the magnet link instead
};

// halt
function halt(err) {
    "use strict";

    err = err || 'Unknow Exceptions!';

    try {
        throw err;
    } catch (e) {
        console.log('Halt Msg: ' + e);
    }
}

// Debug Func
var debug = Config.debug_mode ? console.debug.bind(console) : function() {};


// Magnet Handler
var MagnetHandler = (function ($doc) {
    // initialization
    function _init() {
        "use strict";

        // deal with the links with a manget pseudo-protocol
        var magnetLinks = $doc.querySelectorAll('a[href^="magnet"]');
        Array.from(magnetLinks).forEach(function (node, idx) {
            // (keep the original href) to avoid the compatibility issues
            // while using other scripts
            node.addEventListener('mouseenter', function(evt) {
                evt.stopPropagation();

                // get the event target
                var target = evt.currentTarget;

                // change the href to prevent the browser from handling the pseudo-protocol
                !target.hasAttribute('magnet') && target.setAttribute('magnet', node.href);
                target.setAttribute('href', '###');
            }, false);
            node.addEventListener('mouseleave', function(evt) {
                evt.stopPropagation();

                // get the event target
                var target = evt.currentTarget;

                // restore the href
                target.setAttribute('href', target.getAttribute('magnet'));
            }, false);

            // use 'onclick' to make it a high priority
            node.onclick = function(evt) {
                evt.preventDefault();
                evt.stopPropagation();

                // get the event target
                var target = evt.currentTarget;

                // save the magnet to the datastore
                GM_setValue('magnet', target.getAttribute('magnet'));

                // pass it to the handler
                var handlerUrl = 'http://115.com/?tab=offline&mode=wangpan&download=' + encodeURIComponent(target.getAttribute('magnet'));
                'function' === typeof GM_openInTab ? GM_openInTab(handlerUrl) : window.open(handlerUrl);
            };
        });
    }

    return {
        // public
        init : _init
    };
})(document);

// 115 Cloud Helper
var The115Helper = (function ($doc) {
    // initialization
    function _init() {
        "use strict";

        // this maybe handy, however thunder/ed2k/flashget/qqdl don't belong to the scheme whitelist
        // navigator.registerProtocolHandler('magnet', 'http://115.com/?tab=offline&mode=wangpan&download=%s', '115');

        // get the magnet link from datastore
        var magnetLink = GM_getValue('magnet');
        if (magnetLink) {
            // clean clear
            GM_deleteValue('magnet');
        } else {
            // no magnet at all, just jump out
            debug('no magnet to handle');
            return;
        }

        // force to popup, hard to pull the trigger in this way
        //unsafeWindow.Core['OFFL5Plug'].OpenLink([magnetLink]);

        // add a download task ASAP
        if (Config.add_task) {
            var addTask = function (node, magnet) {
                // yep, it's duplicated, but it'll make it quick
                node.querySelector('#js_offline_new_add').value = magnet;

                // do add a task
                node.querySelector('a[data-btn="start"]').click();
            };

            if ('function' === typeof MutationObserver) {
                // create an observer instance
                var watcher = new MutationObserver(function (mutations) {
                    mutations.forEach(function (mutation) {
                        debug(mutation);

                        // filter the mutation records
                        var node = null;
                        if (1 !== mutation.addedNodes.length || ((node = mutation.addedNodes[0]) && !node.classList.contains('offline-box'))) {
                            return;
                        }

                        // stop the watcher first
                        watcher.disconnect();

                        // add a task now
                        addTask(node, magnetLink);
                    });
                });

                // pass in the target node, as well as the observer options
                watcher.observe($doc.body, {
                    childList: true,
                    attributeFilter : ['div'] // watch div only
                });

                //@todo: set up a timeout to stop the observer
                setTimeout(function () {
                    // stop the observe after timeout,
                    // then you should manually add a task
                    // @todo: remind the user to trigger the button?
                    watcher.disconnect();

                    // add a task now
                    addTask(node, magnetLink);
                }, 10000);
            } else {
                var node = null;
                var countdown = 40;
                var watcher = setInterval(function () {
                    // countdown first
                    countdown--;
                    debug(countdown);

                    if (0 === countdown || ((node = $doc.querySelector('div.offline-box')) && null !== node)) {
                        // stop the watcher first
                        clearInterval(watcher);

                        // do add task
                        addTask(node, magnetLink);
                    }
                }, 256);
            }
        }
    }

    return {
        // public
        init : _init
    };
})(document);

// fire
('115.com' === document.domain ? The115Helper : MagnetHandler).init();
