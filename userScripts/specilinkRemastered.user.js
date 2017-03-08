// ==UserScript==
// @name         Specilink Remastered
// @namespace    Watsilla
// @version      0.3.1
// @description  Register 115, Thunder, QQ & MiWifi as a handler for magnet, ed2k, thunder, flashget & qqdl pseudo-protocols.
// @author       Chao QU
// @match        *://115.com/?tab=offline*
// @match        http://dynamic.cloud.vip.xunlei.com/user_task*
// @match        http://cloud.vip.xunlei.com/folders/lx3_task.html*
// @match        http://lixian.qq.com/main.html*
// @match        https://d.miwifi.com/d2r/*
// @match        https://thepiratebay.uk.net/*
// @match        https://kickass.cd/*
// @match        http://www.ed2000.com/ShowFile/*
// @match        http://www.hd1080.cn/*
// @match        https://www.torrentkitty.tld/*
// @match        http://www.zimuzu.tv/*
// @match        http://www.1080time.com/*
// @match        http://www.cililian.com/*
// @match        https://www.utorrentmui.com/*
// @match        http://seedpeer.eu/*
// @encoding     utf-8
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/rafaelw/mutation-summary/master/src/mutation-summary.js
// @run-at       document-end
// @license      MIT
// @homepage     https://quchao.com/entry/specilink-remastered
// downloadURL   https://github.com/QuChao/Watsilla/raw/master/userScripts/specilinkRemastered.user.js
// ==/UserScript==
// @version      0.3.1 @ 2017-03-08: Upgrade to https for handlers if possible, and set 115 as the default handler.
// @version      0.3.0 @ 2016-09-28: Download services can be registered as handlers, only magnet is allowed for now.
// @version      0.2.3 @ 2016-03-21: More resource sites are added by default.
// @version      0.2.2 @ 2016-01-29: Fix issues that auto-add-task feature is not working in thunder & miwifi.
// @version      0.2.1 @ 2016-01-29: Add ed2k, thunder, flashget & qqdl to the supported pseudo-protocol list.
// @version      0.2.0 @ 2015-12-04: Add Thunder, QQ & MiWifi as download services.
// @version      0.1.0 @ 2015-12-03: Initialize release.
/* jshint -W097 */
'use strict';

// Configs
var Configs = {
    'enabled_handler'       : '115', // options: 115, thunder, qq, miwifi
    'auto_add_task'         : true,  // or just paste the link instead
    'auto_add_task_timeout' : 10000, // in msec
    'register_protocols'    : false, // go & check chrome://settings/handlers
    'debug_mode'            : false,
};

// Vars
var specilinkFlag = 'ref=specilink&';

// Debug Func
var emptyFunc = function() {};
var debug = Configs.debug_mode ? console.debug.bind(console) : emptyFunc;

// Handler Helper
var HandlerHelper = (function ($win, $doc) {
    // constructor
    function Helper(options) {
        // alias
        var _this = this;

        // options
        this.options = Helper.validateOptions(options);

        // check if it's in the handler
        if (true === this.options.handlerEntry.test($doc.URL)) {
            // for thunder only, pt.1
            if ('thunder' === Configs.enabled_handler) {
                // try to update the user id
                var thunderUserId = /; userid=(\d+);/.exec($doc.cookie);
                if (null !== thunderUserId) {
                    GM_setValue('thunder_user_id', thunderUserId[1]);
                } else {
                    GM_deleteValue('thunder_user_id');
                }
            }

            // check if it's needed to register protocols
            if (true === Configs.register_protocols) {
                // https://developers.google.com/web/updates/2011/06/Registering-a-custom-protocol-handler?hl=en
                // however thunder/ed2k/flashget/qqdl don't belong to the scheme whitelist
                GM_setValue('protocols_registered', 1);
                try {
                    $win.navigator.registerProtocolHandler('magnet', this.getHandledBase() + '%s', $doc.title);
                } catch (e) {
                    GM_deleteValue('protocols_registered');
                    debug(e);
                }
            } else if (GM_getValue('protocols_registered')) {
                GM_deleteValue('protocols_registered');
            }

            // check if it needs a helper
            if (true !== Configs.auto_add_task) {
                return;
            }

            // check the speciLink from the url
            var speciLinkPos = $doc.URL.indexOf(specilinkFlag);
            if (-1 === speciLinkPos) {
                // no speciLink at all, just stop here
                debug('No specilink found from upstream.');
                return;
            }

            // for thunder only, pt.2
            if ('thunder' === Configs.enabled_handler && undefined === GM_getValue('thunder_user_id')) {
                var specilink = /&furl=([^&]+)/.exec(location.search);
                if (null !== specilink) {
                    $doc.location.replace(this.options.handlerBase + specilink[1]);
                }
                return;
            }

            // run the helper
            debug('Observing Mutations.');
            var helperObserver = this.options.newTaskHelper();

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
        'handlerBase': '',
        'altHandlerBase': '',
        'handlerEntry': new RegExp(),
        'base64Encode': false,
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
    Helper.getUpdatedThunderHandlerUrl = function (url) {
        if (undefined !== GM_getValue('thunder_user_id')) {
            url = url.replace(specilinkFlag, specilinkFlag + 'userid=' + GM_getValue('thunder_user_id') + '&');
        }
        return url;
    };

    // methods
    Helper.prototype.getHandledBase = function () {
        if ('thunder' === Configs.enabled_handler && undefined !== GM_getValue('thunder_user_id')) {
            return Helper.getUpdatedThunderHandlerUrl(this.options.altHandlerBase);
        } else {
            return this.options.handlerBase;
        }
    };
    Helper.prototype.getHandledUrl = function (link) {
        // need to be base64-encoded?
        if (true === this.options.base64Encode) {
            link = $win.btoa(link);
        }

        return this.getHandledBase() + encodeURIComponent(link);
    };
    Helper.prototype.getSupportedProtocols = function () {
        // find out enabled & available protocols
        var availableProtocols = [
            'magnet',
            'ed2k',
            'thunder',
            'qqdl',
            'flashget'
        ];
        this.options.supportedProtocols = this.options.supportedProtocols.filter(function (protocol) {
            return -1 !== availableProtocols.indexOf(protocol);
        });

        return this.options.supportedProtocols;
    };
    Helper.prototype.getSelectors = function () {
        // combine the selectors
        return this.getSupportedProtocols().filter(function (protocol) {
            // only magnet is registerable for now
            return false === Configs.register_protocols || 'magnet' !== protocol || undefined === GM_getValue('protocols_registered');
        }).map(function(protocol){
            return 'a[href^="' + protocol + ':"]';
        }).join(',');
    };

    return Helper;
})(unsafeWindow, unsafeWindow.document);

// SpeciLink Handler
var SpeciLinkHandler = (function ($win, $doc) {
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

        // pass it to the handler
        var handlerUrl = handlerHelper.getHandledUrl(target.getAttribute('specilink'));
        'function' === typeof GM_openInTab ? GM_openInTab(handlerUrl) : $win.open(handlerUrl);
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
                    'handlerBase': 'https://115.com/?tab=offline&mode=wangpan&' + specilinkFlag + 'download=',
                    'handlerEntry': /^https?:\/\/115\.com\/\?tab=offline/,
                    'supportedProtocols': ['magnet', 'ed2k', 'thunder'],
                    'newTaskHelper': function () {
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
                            //newTaskContainer.querySelector('#js_offline_new_add').value = res.link;

                            // do add the task
                            setTimeout(function () {
                                newTaskContainer.querySelector('a[data-btn="start"]').click();
                            }, 1000);
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
                    'handlerBase': 'http://lixian.vip.xunlei.com/lixian_login.html?' + specilinkFlag + 'furl=',
                    'altHandlerBase': 'http://dynamic.cloud.vip.xunlei.com/user_task?' + specilinkFlag + 'furl=',
                    'handlerEntry': /^https?:\/\/dynamic\.cloud\.vip\.xunlei\.com\/user_task/,
                    'supportedProtocols': ['magnet', 'ed2k', 'thunder', 'qqdl', 'flashget'],
                    'newTaskHelper': function () {
                        var newTaskHandler = function (summaries) {
                            var summary = summaries[0];
                            if (0 === summary.attributeChanged['disabled'].length) {
                                // unexpected summary
                                return;
                            }

                            // disconnect from the observer first
                            observer.disconnect();

                            // do add the task
                            summary.attributeChanged['disabled'][0].click();
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
                    'handlerBase': 'http://lixian.qq.com/main.html?' + specilinkFlag + 'url=',
                    'handlerEntry': /^http:\/\/lixian\.qq\.com\/main\.html/,
                    'supportedProtocols': ['magnet', 'ed2k', 'qqdl'],
                    'newTaskHelper': function () {
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
                    'handlerBase': 'https://d.miwifi.com/d2r/?' + specilinkFlag + 'url=',
                    'handlerEntry': /^https:\/\/d\.miwifi\.com\/d2r/,
                    'base64Encode': true,
                    'supportedProtocols': ['magnet', 'ed2k', 'thunder']
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
})(unsafeWindow, unsafeWindow.document);

// fire
SpeciLinkHandler.init();
