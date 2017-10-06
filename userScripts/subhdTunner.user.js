// ==UserScript==
// @name         SubHD Tunner
// @name:zh-CN   SubHD 助手
// @namespace    Watsilla
// @version      0.1.0
// @description  Enable the disabled download buttons on SubHD.com.
// @description:zh-CN 启用 SubHD.com 的下载按钮。
// @author       Chao QU
// @match        http://subhd.com/ar0/*
// @encoding     utf-8
// @grant        unsafeWindow
// @run-at       document-end
// @license      MIT
// @homepage     https://quchao.com/entry/watsilla
// downloadURL   https://github.com/QuChao/Watsilla/raw/master/userScripts/subhdTunner.user.js
// ==/UserScript==
// @version      0.1.0 @ 2017-10-06: Initialize release.
/* jshint -W097 */
'use strict';

// download btn enabler
(function(win, doc) {
    if (null !== doc.getElementById('down')) {
        return;
    }

    let btn = doc.body.querySelector('button.btn-danger:disabled');
    btn.id = 'down';
    btn.innerText = '点击下载字幕文件';
    btn.setAttribute('sid', doc.getElementById('sub_ID').value);
    btn.onclick = down;
    btn.disabled = false;
})(unsafeWindow, unsafeWindow.document);
