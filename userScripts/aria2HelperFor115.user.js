// ==UserScript==
// @name         Aria2 Helper for 115
// @name:zh-CN   115 网盘 Aria2 助手
// @namespace    Watsilla
// @version      0.1.5
// @description  Add 115 download links to Aria2 via RPC
// @description:zh-CN 直接将所选 115 下载链接发送至 Aria2
// @author       Chao QU
// @match        *://115.com/?ct=file*
// @encoding     utf-8
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_log
// @grant        GM_notification
// @grant        unsafeWindow
// @run-at       document-end
// @license      MIT
// @homepage     https://quchao.com/entry/aira2-helper-for-115
// downloadURL   https://github.com/QuChao/Watsilla/raw/master/userScripts/aria2HelperFor115.user.js
// ==/UserScript==
// @version      0.1.0 @ 2017-04-21: Initialize release.
// @version      0.1.1 @ 2017-04-22: One could still copy download link when failed to send it to Aria2.
// @version      0.1.2 @ 2017-04-24: Add comments on configuration items.
// @version      0.1.3 @ 2017-07-28: Fix download link fetching & copying issue on non-Chrome explorers.
// @version      0.1.4 @ 2017-10-18: Fix an issue that a batch task only sends the first file to Aria2.
// @version      0.1.5 @ 2018-06-19: New cookie and user-agent auth method is supported now. Fixed by MartianZ <fzyadmin@gmail.com>.
// @inspiredBy   https://greasyfork.org/en/scripts/7749-115-download-helper
// @inspiredBy   https://github.com/robbielj/chrome-aria2-integration
/* jshint -W097 */
'use strict';

// Configs
let Configs = {
    'debug_mode'    : false, // 是否开启调试模式
    "sync_clipboard": true,  // 是否将下载链接同步到剪贴板，部分浏览器（如 Safari ）不支持
    'use_http'      : false, // 115 下载链接是否从 https 转换为 http （老版本 Aria2 需要）
    "rpc_path"      : 'http://localhost:6800/jsonrpc', // RPC 地址
    "rpc_user"      : '',    // RPC 用户名（若设置密码，请填写至 token 项）
    "rpc_token"     : ''     // RPC Token ，v1.18.4+ 支持，与用户名认证方式互斥
};

// Debug Func
let debug = Configs.debug_mode ? GM_log : function () {};
let emptyFunc = function () {};

// Aria2RPC
let Aria2RPC = (function ($win, $doc) {
    // privates

    // send
    function _addTask() {
        let rpcHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };

        // auth method, pt.1
        if ('' !== Configs.rpc_user) {
            // user/password
            rpcHeaders['Authorization'] = 'Basic ' + $win.btoa(Configs.rpc_user + ':' + Configs.rpc_token);
        }

        return function (link, options, loadHandler, errorHandler) {
            // new task
            let reqParams = {
                'jsonrpc': '2.0',
                'method' : 'aria2.addUri',
                'id'     : (+new Date()).toString(),
                'params' : []
            };

            // auth method, pt.2
            if ('' === Configs.rpc_user && '' !== Configs.rpc_token) {
                // secret, since v1.18.4
                reqParams.params.unshift('token:' + Configs.rpc_token);
            }

            // download link
            if ('undefined' !== typeof link) {
                // @todo: multiple sources?
                reqParams.params.push([link]);
            } else {
                // link is required
                //errorHandler({});
                return;
            }

            // options
            if ('undefined' !== typeof options) {
                reqParams.params.push(options);
            }

            // send to aria2, @todo: support metalink?
            GM_xmlhttpRequest({
                method : 'POST',
                url    : Configs.rpc_path,
                headers: rpcHeaders,
                data   : JSON.stringify(reqParams),
                onload : loadHandler || emptyFunc,
                onerror: errorHandler || emptyFunc
            });
        };
    }

    return {
        // public
        add: _addTask()
    };
})(unsafeWindow, unsafeWindow.document);

// Queue Manager
let QueueManager = (function ($win, $doc) {
    // constants
    const STATUS_SENT_TO_ARIA2 = 1;
    const STATUS_UNFINISHED = 0;
    const STATUS_DOWNLOAD_FAILURE = -1;
    const STATUS_LINK_FETCH_FAILURE = -2;
    const STATUS_UNDOWNLOADABLE = -3;

    // constructor
    function Mgr(options) {
        // options
        this.options = Mgr.validateOptions(options);

        // err msgs
        this.errMsgs = [];

        // get selected ones
        let selectedNodes = $doc.getElementById('js_cantain_box').querySelectorAll('li.selected');

        // build the queue
        this.queue = Array.from(selectedNodes).map(function (node) {
            return {
                'name'  : node.getAttribute('title'),
                'code'  : node.getAttribute('pick_code'),
                'link'  : null,
				'cookie' : null,
                // -3: , -2: failed to fetch link, -1: failed to download, 0: unfinished, 1: sent to aria2
                'status': '1' === node.getAttribute('file_type') ? STATUS_UNFINISHED : STATUS_UNDOWNLOADABLE
            };
        }, this);
    }

    // static
    Mgr.defaultOptions = {
        'copyOnly': false
    };
    Mgr.validateOptions = function (options) {
        // validation
        for (let key in options) {
            // skip the inherit ones
            if (!options.hasOwnProperty(key)) {
                continue;
            }
            if (!(key in Mgr.defaultOptions)) {
                // check existence
                throw Error('Invalid option: ' + key);
            } else if (typeof options[key] !== typeof Mgr.defaultOptions[key]) {
                // check type
                throw Error('Invalid option type: ' + key);
            }
        }

        // merge the options
        return Object.assign({}, Mgr.defaultOptions, options);
    };

    // methods
    Mgr.prototype.errorHandler = function (errCode, idx, resp) {
        debug(resp);

        this.errMsgs.push('File #' + idx + ': ');
        this.errMsgs.push("\t" + 'File Info: ' + JSON.stringify(this.queue[idx]));
        this.errMsgs.push("\t" + 'HTTP Status: ' + resp.status + ' - ' + resp.statusText);

        let errMsg = 'Unknown';
        if ('responseText' in resp) {
            try {
                let err = JSON.parse(resp.responseText);
                errMsg = err.error.message;
            } catch (e) {
                errMsg = e;
            }
        } else if ('msg' in resp) {
            errMsg = resp.msg;
        }

        this.errMsgs.push("\t" + 'Err Msg:' + errMsg);

        // update the status
        this.queue[idx].status = errCode;
        this.next();
    };
    Mgr.prototype.downloadHandler = function (idx, resp) {
        debug(resp);

        if (200 === resp.status && 'responseText' in resp) {
            // update the status
            this.queue[idx].status = STATUS_SENT_TO_ARIA2;
            this.next();
        } else {
            // failed
            this.errorHandler.call(this, STATUS_DOWNLOAD_FAILURE, idx, resp);
        }
    };
    Mgr.prototype.download = function (idx) {
        // send to aria2
        if (!this.options.copyOnly) {
            Aria2RPC.add(this.queue[idx].link,
                {
                    'referer': $doc.URL,
                    'header' : ['Cookie: ' + this.queue[idx].cookie, 'User-Agent: ' + $win.navigator.userAgent]
                },
                this.downloadHandler.bind(this, idx),
                this.errorHandler.bind(this, STATUS_DOWNLOAD_FAILURE, idx)
            );
        } else {
            // update the status, @todo: another status code?
            this.queue[idx].status = STATUS_SENT_TO_ARIA2;
            this.next();
        }
    };
    Mgr.prototype.fetchLinkHandler = function (idx, raw_resp) {

		debug(raw_resp.responseHeaders);
		let header_arr = raw_resp.responseHeaders.trim().split(/[\r\n]+/);
		var headerMap = {};
		header_arr.forEach(function (line) {
		  var parts = line.split(': ');
		  var header = parts.shift();
		  var value = parts.join(': ');
		  headerMap[header] = value;
		});

		let set_cookie_string = headerMap["set-cookie"];
		let final_cookie = set_cookie_string.split(';')[0];
		debug(final_cookie);

		let resp = JSON.parse(raw_resp.responseText);

        if ('file_url' in resp) {
            // update the link
            this.queue[idx].link = Configs.use_http
                ? resp.file_url.replace('https://', 'http://') // http only?
                : resp.file_url;
			this.queue[idx].cookie = final_cookie;
            this.next();
        } else {
            this.errorHandler.call(this, STATUS_LINK_FETCH_FAILURE, idx, resp);
        }
    };
    Mgr.prototype.fetchLink = function (idx) {
        // get the download link first
        // $win.top.UA$.ajax({
        debug('http://webapi.115.com/files/download?pickcode=' + this.queue[idx].code);
		GM_xmlhttpRequest({
            url      : 'http://webapi.115.com/files/download?pickcode=' + this.queue[idx].code,
            method   : 'GET',
            ignoreCache : true,
            onload   : this.fetchLinkHandler.bind(this, idx),
            onerror  : this.errorHandler.bind(this, STATUS_LINK_FETCH_FAILURE, idx)
        })
    };
    Mgr.prototype.next = function () {
        // check if it's the queue is empty
        let nextIdx = this.queue.findIndex(function (file) {
            return STATUS_UNFINISHED === file.status;
        });

        // handle the next file
        if (-1 === nextIdx) {
            let report = this.queue.reduce(function (accumulator, file) {
                switch (file.status) {
                    // task finished
                    case STATUS_SENT_TO_ARIA2:
                        accumulator.finished += 1;
                    case STATUS_DOWNLOAD_FAILURE:
                        accumulator.links.push(file.link);
                        break;
                    // task finished
                    case STATUS_UNDOWNLOADABLE:
                        accumulator.undownloadable += 1;
                        break;
                }

                return accumulator;
            }, {
                'links'         : [],
                'finished'      : 0,
                'undownloadable': 0
            });

            let queueSize = this.queue.length;
            let msg = [];
            if (queueSize === report.undownloadable) {
                msg.push('所选 ' + queueSize + ' 项类型均为目录，暂不支持。');
            } else {
                msg.push('所选 ' + queueSize + ' 项已处理完毕：');

                if (!this.options.copyOnly) {
                    if (0 < report.finished) {
                        msg.push((queueSize === report.finished ? '全部' : '其中 ' + report.finished + ' 项') + '成功发送至 Aria2 进行下载。');
                    } else {
                        msg.push((0 === report.undownloadable ? '全部' : '其中 ' + (queueSize - report.undownloadable) + ' 项') + '发送至 Aria2 失败。');
                    }
                }

                if (this.options.copyOnly || Configs.sync_clipboard) {
                    let downloadLinks = report.links.join("\n");
                    if (false === /\sSafari\/\d+\.\d+\.\d+/.test($win.navigator.userAgent)) {
                        // sync to clipboard
                        GM_setClipboard(downloadLinks, 'text');
                        msg.push('下载地址已同步至剪贴板。');
                    } else if (this.options.copyOnly) {
                        prompt('本浏览器不支持访问剪贴板，请手动全选复制', downloadLinks);
                    }
                }

                if (0 < report.undownloadable) {
                    msg.push('另有 ' + report.undownloadable + ' 项类型为目录，暂不支持。');
                }
            }

            // notify the user
            GM_notification(msg.join("\n"));

            if (this.errMsgs.length) {
                throw Error(this.errMsgs.join("\n"));
            }
        } else if (null === this.queue[nextIdx].link) {
            // fetch link with the code
            this.fetchLink(nextIdx);
        } else {
            // download it
            this.download(nextIdx);
        }
    };

    return Mgr;
})(unsafeWindow, unsafeWindow.document);

// UI Helper
let UiHelper = (function ($win, $doc) {
    // privates
    let _triggerId = 'aria2Trigger';

    function _clickHandler(evt) {
        (new QueueManager({
            'copyOnly': evt.ctrlKey || evt.metaKey // press ctrl/cmd key while clicking to copy the download link only
        })).next();

        // kill the listener
        evt.target.removeEventListener('click', _clickHandler, false);
    }

    function _recordHandler(record) {
        //debug(record);

        // place the trigger
        let ariaTrigger = $doc.createElement('li');
        ariaTrigger.id = _triggerId;
        ariaTrigger.title = '按住 Ctrl 点击可仅复制下载链接';
        ariaTrigger.innerHTML = '<span>发送至 Aria2</span>';
        record.target.firstChild.appendChild(ariaTrigger);

        // make it clickable
        ariaTrigger.addEventListener('click', _clickHandler, false);

        // stop the observation
        //_observer.disconnect();

        return true;
    }

    // initialization
    function _init() {
        let container = $doc.getElementById('js_operate_box');

        // create a observer on the container
        new MutationObserver(function (records) {
            records.filter(function () {
                return null === $doc.getElementById(_triggerId);
            }).some(_recordHandler);
        }).observe(container, {
            'childList': true,
        });
    }

    return {
        // public
        init: _init
    };
})(unsafeWindow, unsafeWindow.document);

// fire
UiHelper.init();
