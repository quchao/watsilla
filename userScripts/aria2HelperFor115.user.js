// ==UserScript==
// @name         Aria2 Helper for 115
// @namespace    Watsilla
// @version      0.1.1
// @description  Add 115 download links to Aria2 via RPC
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
/* jshint -W097 */
'use strict';

// Configs
let Configs = {
    'debug_mode'    : false,
    "sync_clipboard": true,
    'use_http'      : false,
    "rpc_path"      : 'http://localhost:6800/jsonrpc',
    "rpc_user"      : '',
    "rpc_token"     : ''
};

// Debug Func
let debug = Configs.debug_mode ? GM_log : function () {
};
let getTS = function () {
    return (+new Date()).toString();
};

// Aria2RPC
let Aria2RPC = (function ($win, $doc) {
    // privates

    // send
    function _addTask() {
        let rpcHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };
        let reqParams = {
            'jsonrpc': '2.0',
            'method' : 'aria2.addUri',
            'id'     : +getTS(),
            'params' : []
        };

        // auth method
        if ('' !== Configs.rpc_user) {
            // user/password
            rpcHeaders['Authorization'] = 'Basic ' + $win.btoa(Configs.rpc_user + ':' + Configs.rpc_token);
        } else if ('' !== Configs.rpc_token) {
            // secret, since v1.18.4
            reqParams.params.unshift('token:' + Configs.rpc_token);
        }

        return function (link, options, loadHandler, errorHandler) {
            // download link
            if ('undefined' !== typeof options) {
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
                url    : Configs.rpc_path + '?tm=' + getTS(),
                headers: rpcHeaders,
                data   : JSON.stringify(reqParams),
                onload : loadHandler,
                onerror: errorHandler
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
    function Queue(options) {
        // options
        this.options = Queue.validateOptions(options);

        // err msgs
        this.errMsgs = [];

        // get selected ones
        let selectedNodes = $doc.getElementById('js_cantain_box').querySelectorAll('li.selected');

        // build the queue
        this.queue = Array.from(selectedNodes).map(function (node) {
            return {
                'name' : node.getAttribute('title'),
                'code' : node.getAttribute('pick_code'),
                'link' : null,
                // -3: , -2: failed to fetch link, -1: failed to download, 0: unfinished, 1: sent to aria2
                'status' : '1' === node.getAttribute('file_type') ? STATUS_UNFINISHED : STATUS_UNDOWNLOADABLE
            };
        }, this);
    }

    // static
    Queue.defaultOptions = {
        'copyOnly': false
    };
    Queue.validateOptions = function (options) {
        // validation
        for (let key in options) {
            // skip the inherit ones
            if (!options.hasOwnProperty(key)) {
                continue;
            }
            if (!(key in Queue.defaultOptions)) {
                // check existence
                throw Error('Invalid option: ' + key);
            } else if (typeof options[key] !== typeof Queue.defaultOptions[key]) {
                // check type
                throw Error('Invalid option type: ' + key);
            }
        }

        // merge the options
        return Object.assign({}, Queue.defaultOptions, options);
    };

    // methods
    Queue.prototype.errorHandler = function (errCode, idx, resp) {
        debug(resp);

        this.errMsgs.push('File #' + idx + ': ');
        this.errMsgs.push("\t" + 'File Info: ' + JSON.stringify(this.queue[idx]));
        this.errMsgs.push("\t" + 'HTTP Status: ' + resp.status + ' - ' + resp.statusText);
        if ('responseText' in resp) {
            try {
                let err = JSON.parse(resp.responseText).error;
                this.errMsgs.push("\t" + 'Err Msg: ' + err.code + ' - ' + err.message);
            } catch (e) {}
        }

        // update the status
        this.queue[idx].status = errCode;
        this.next();
    };
    Queue.prototype.downloadHandler = function (idx, resp) {
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
    Queue.prototype.download = function (idx) {
        // send to aria2
        if (!this.options.copyOnly) {
            Aria2RPC.add(this.queue[idx].link,
                {
                   'referer': $doc.URL,
                   'header' : 'Cookie:' + $doc.cookie // @todo: http cookie?
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
    Queue.prototype.fetchLinkHandler = function (idx, resp) {
        debug(resp);

        let res = JSON.parse(resp.responseText);
        if ('file_url' in res) {
            // update the link
            this.queue[idx].link = Configs.use_http
                ? res.file_url.replace('https://', 'http://') // http only?
                : res.file_url;
            this.next();
        } else {
            this.errorHandler.call(this, STATUS_LINK_FETCH_FAILURE, idx, resp);
        }
    };
    Queue.prototype.fetchLink = function (idx) {
        // get the download link first
        GM_xmlhttpRequest({
            method : 'GET',
            url    : 'http://web.api.115.com/files/download?pickcode=' + this.queue[idx].code + '&_=' + getTS(),
            headers: {
                'Referer': 'http://web.api.115.com/bridge_2.0.html?namespace=Core.DataAccess&api=UDataAPI&_t=v5',
                'Accept' : '*/*'
            },
            onload : this.fetchLinkHandler.bind(this, idx),
            onerror: this.errorHandler.bind(this, STATUS_LINK_FETCH_FAILURE, idx)
        });
    };
    Queue.prototype.next = function () {
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
                'links' : [],
                'finished' : 0,
                'undownloadable': 0
            });

            let queueSize = this.queue.length;
            let msg = [];
            if (queueSize === report.undownloadable) {
                msg.push('所选 ' + queueSize + ' 项类型均为目录，暂不支持。');
            } else {
                msg.push('所选 ' +queueSize + ' 项已处理完毕：');

                if (!this.options.copyOnly) {
                    if (0 < report.finished) {
                            msg.push((queueSize === report.finished ? '全部' : '其中 ' + report.finished + ' 项') + '成功发送至 Aria2 进行下载。');
                    } else {
                        msg.push((0 === report.undownloadable ? '全部' : '其中 ' + (queueSize - report.undownloadable) + ' 项') + '发送至 Aria2 失败。');
                    }
                }

                if (this.options.copyOnly || Configs.sync_clipboard) {
                    // sync to clipboard
                    GM_setClipboard(report.links.join("\n"));
                    msg.push('下载地址已同步至剪贴板。');
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
            // fetch link with the code, then download it
            this.fetchLink(nextIdx);
        } else {
            // fetch link with the code, then download it
            this.download(nextIdx);
        }
    };

    return Queue;
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
