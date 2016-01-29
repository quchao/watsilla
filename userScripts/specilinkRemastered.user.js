// ==UserScript==
// @name         Specilink Remastered
// @namespace    Watsilla
// @version      0.2.1
// @description  Register 115, Thunder, QQ & MiWifi as a handler for magnet, ed2k, thunder, flashget && qqdl pseudo-protocols.
// @author       Chao QU
// @match        http://115.com/?tab=offline&mode=wangpan*
// @match        http://dynamic.cloud.vip.xunlei.com/user_task*
// @match        http://cloud.vip.xunlei.com/folders/lx3_task.html*
// @match        http://lixian.qq.com/main.html*
// @match        https://d.miwifi.com/d2r/*
// @match        https://btdigg.org/search*
// @match        http://btsearch.net/*
// @match        http://cili007.com/*
// @match        http://www.ed2000.com/ShowFile/*
// @match        http://www.hd1080.cn/*
// @encoding     utf-8
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/rafaelw/mutation-summary/master/src/mutation-summary.js
// @run-at       document-end
// @license      MIT
// @homepage     http://quchao.com/entry/specilink-remastered
// downloadURL   https://github.com/QuChao/Watsilla/raw/master/userScripts/specilinkRemastered.user.js
// ==/UserScript==
// @version      0.2.1 @ 2015-01-29: Add ed2k, thunder, flashget & qqdl to the supported pseudo-protocol list.
// @version      0.2.0 @ 2015-12-04: Add Thunder, QQ & MiWifi as handler services.
// @version      0.1.0 @ 2015-12-03: Initialize release.
/* jshint esnext: true */

/*
 * @Todo:
 * 1. take a specilink in text format as a link
 * 2. add specilink converter
 * 3. add a helper for miwifi
 * 4. register protocols
 */

// Configs
var Configs = {
    'enabled_handler'       : 'thunder', // options: 115, thunder, qq, miwifi
    'auto_add_task'         : true,  // or just paste the link instead
    'auto_add_task_timeout' : 10000, // in msec
    'debug_mode'            : true,
};

// Debug Func
var emptyFunc = function() {};
var debug = Configs.debug_mode ? console.debug.bind(console) : emptyFunc;

// Handler Helper
var HandlerHelper = (function () {
    "use strict";

    // constructor
    function Helper(options) {
        // alias
        var _this = this;

        this.options = Helper.validateOptions(options);
        this.getAvailableProtocols = function () {
            return [
                'magnet',
                'ed2k',
                'thunder',
                'qqdl',
                'flashget'
            ];
        };

        // check the speciLink from datastore
        var speciLink = GM_getValue('specilink');
        if (undefined === speciLink) {
            // no speciLink at all, just stop here
            debug('No specilink found from upstream.');
            /*} else if (this.options.helperUrls.some(function (item) {
             return 0 === document.URL.indexOf(item);
             })) {*/
        } else if (0 === document.URL.indexOf(this.options.helperUrl)) {
            // delete the cache
            GM_deleteValue('specilink');

            // run the helper
            debug('Observing Mutations.');
            var helperObserver = this.options.newTaskHelper({
                'link': speciLink
            });

            // stop the helper after timeout
            setTimeout(function () {
                // stop the observe after timeout,
                // then you should manually add a task
                // @todo: remind the user to trigger the button?
                debug('Observing timeout');
                if (helperObserver.connected) {
                    helperObserver.disconnect();
                }
            }, Configs.auto_add_task_timeout);
        }
    }

    // static
    Helper.defaultOptions = {
        'handlerUrl': '',
        'helperUrl': '',
        'needBase64Encode': false,
        'supportedProtocols': [],
        'newTaskHelper': emptyFunc,
    };
    Helper.validateOptions = function (options) {
        // validation
        for (var key in options) {
            // skip the inherit ones
            if (!options.hasOwnProperty(key)) {
                continue;
            }
            if (!(key in Helper.defaultOptions)) {
                // check existence
                throw Error('Invalid option: ' + key);
            } else if (typeof options[key] !== typeof Helper.defaultOptions[key]) {
                // check type
                throw Error('Invalid option type: ' + key);
            }
        }

        // merge the options
        return Object.assign({}, Helper.defaultOptions, options);
    };

    Helper.prototype.getHandledUrl = function (link) {
        // need to be base64-encoded?
        if (true === this.options.base64Encode) {
            link = window.btoa(link);
        }

        return this.options.handlerUrl + encodeURIComponent(link);
    };
    Helper.prototype.getSelectors = function () {
        var availableProtocols = this.getAvailableProtocols();

        // find out enabled & available protocols
        this.options.supportedProtocols = this.options.supportedProtocols.filter(function (protocol) {
            return -1 !== availableProtocols.indexOf(protocol);
        });

        // combine the selectors
        return this.options.supportedProtocols.map(function(protocol){
            return 'a[href^="' + protocol + ':"]';
        }).join(',');
    };

    return Helper;
})();

// SpeciLink Handler
var SpeciLinkHandler = (function ($doc) {
    'use strict';

    // privates
    var handlerHelper = null;

    // event handlers
    function _mouseEnterHandler (evt) {
        evt.stopPropagation();

        // get the event target
        var target = evt.currentTarget;

        // change the href to prevent the browser from handling the pseudo-protocol
        !target.hasAttribute('specilink') && target.setAttribute('specilink', target.href);
        target.setAttribute('href', '###');
    }
    function _mouseLeaveHandler (evt) {
        evt.stopPropagation();

        // get the event target
        var target = evt.currentTarget;

        // restore the href
        target.setAttribute('href', target.getAttribute('specilink'));
    }
    function _clickHandler (evt) {
        evt.preventDefault();
        evt.stopPropagation();

        // get the event target
        var target = evt.currentTarget;

        // save the speciLink to the GM storage
        GM_setValue('specilink', target.getAttribute('specilink'));
        // @todo: remove the value after timeout?

        // pass it to the handler
        var handlerUrl = handlerHelper.getHandledUrl(target.getAttribute('specilink'));
        'function' === typeof GM_openInTab ? GM_openInTab(handlerUrl) : window.open(handlerUrl);
    }

    // handle links
    function _handleLink (node, idx) {
        // (keep the original href) to avoid the compatibility issues
        // while using other scripts
        node.addEventListener('mouseenter', _mouseEnterHandler, false);
        node.addEventListener('mouseleave', _mouseLeaveHandler, false);

        // use 'onclick' to make it a high priority
        node.onclick = _clickHandler;
    }

    // initialization
    function _init() {
        // get a new handler instance of the enabled one
        switch (Configs.enabled_handler) {
            // 115 Cloud by default
            case '115':
                handlerHelper = new HandlerHelper({
                    'handlerUrl': 'http://115.com/?tab=offline&mode=wangpan&ref=specilink&download=',
                    'helperUrl': 'http://115.com/?tab=offline&ref=specilink&download=',
                    'supportedProtocols': ['magnet', 'ed2k', 'thunder'],
                    'newTaskHelper': function (res) {
                        // this maybe handy, however thunder/ed2k/flashget/qqdl don't belong to the scheme whitelist
                        // navigator.registerProtocolHandler('magnet', 'http://115.com/?tab=offline&mode=wangpan&download=%s', '115');

                        var newTaskHandler = function (summaries) {
                            var summary = summaries[0];
                            if (0 === summary['added'].length) {
                                // unexpected summary
                                return;
                            }

                            // disconnect from the observer first
                            observer.disconnect();

                            // get the container
                            var newTaskContainer = summary['added'][0];

                            // yeah, it's duplicated, but it'll make it be handled faster
                            newTaskContainer.querySelector('#js_offline_new_add').value = res.link;

                            // do add the task
                            newTaskContainer.querySelector('a[data-btn="start"]').click();
                        };

                        // create an watcher instance
                        var observer = new MutationSummary({
                            'callback': newTaskHandler,
                            'rootNode': $doc.body,
                            'queries': [{
                                'element': 'div.offline-box',
                            }]
                        });

                        return observer;
                    },
                });
                break;

            // Thunder Cloud ('XunLei Lixian')
            case 'thunder':
                handlerHelper = new HandlerHelper({
                    'handlerUrl': 'http://lixian.vip.xunlei.com/lixian_login.html?ref=specilink&furl=',
                    'helperUrl': 'http://dynamic.cloud.vip.xunlei.com/user_task',
                    'supportedProtocols': ['magnet', 'ed2k', 'thunder', 'qqdl', 'flashget'],
                    'newTaskHelper': function (res) {
                        var newTaskHandler = function (summaries) {
                            var summary = summaries[0];
                            if (0 === summary.attributeChanged['disabled'].length) {
                                // unexpected summary
                                return;
                            }

                            // disconnect from the observer first
                            observer.disconnect();

                            // do add the task
                            //summary.attributeChanged['disabled'][0].click();
                        };

                        // create an watcher instance
                        var observer = new MutationSummary({
                            'callback': newTaskHandler,
                            'rootNode': $doc.body,
                            'queries': [{
                                'element': '#down_but',
                                'elementAttributes': 'disabled',
                            }]
                        });

                        return observer;
                    },
                });
                break;

            // QQ Lixian
            case 'qq':
                handlerHelper = new HandlerHelper({
                    'handlerUrl': 'http://lixian.qq.com/main.html?ref=specilink&url=',
                    'helperUrl': 'http://lixian.qq.com/main.html?ref=specilink&url=',
                    'supportedProtocols': ['magnet', 'ed2k', 'qqdl'],
                    'newTaskHelper': function (res) {
                        var newTaskHandler = function (summaries) {
                            var summary = summaries[0];
                            if (0 === summary.attributeChanged['style'].length) {
                                // unexpected summary
                                return;
                            } else if ('block' !== summary.attributeChanged['style'][0].style.display) {
                                // still hidden
                                return;
                            }

                            // disconnect from the observer first
                            observer.disconnect();

                            // do add the task
                            $doc.getElementById('form_task_button').click();
                        };

                        // create an watcher instance
                        var observer = new MutationSummary({
                            'callback': newTaskHandler,
                            'rootNode': $doc.getElementById('pop_new_task'),
                            //'observeOwnChanges': true,
                            'queries': [{
                                'element': '#pop_new_task',
                                'elementAttributes': 'style',
                            }]
                        });

                        return observer;
                    },
                });
                break;

            // MiWifi ('XiaoMi Remote Downloader')
            case 'miwifi':
                handlerHelper = new HandlerHelper({
                    'handlerUrl': 'https://d.miwifi.com/d2r/?ref=specilink&url=',
                    'base64Encode': true,
                    'supportedProtocols': ['magnet', 'ed2k', 'thunder'],
                    'newTaskHelper': emptyFunc,
                });
                break;

            default:
                throw Error('Invalid handler: ' + Configs.enabled_handler);
        }

        // deal with the links with the pseudo-protocols
        var speciLinks = $doc.querySelectorAll(handlerHelper.getSelectors());
        Array.from(speciLinks).forEach(_handleLink);
    }

    return {
        // public
        init : _init
    };
})(unsafeWindow.document);

// fire
SpeciLinkHandler.init();
