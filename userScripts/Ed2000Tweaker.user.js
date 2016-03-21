// ==UserScript==
// @name         Ed2000.COM Tweaker
// @namespace    Watsilla
// @version      0.1.0
// @description  Several fixes & improvements for ED2000.COM.
// @author       Chao QU
// @match        http://www.ed2000.com/ShowFile/*
// @encoding     utf-8
// @grant		 GM_setClipboard
// @grant        unsafeWindow
// @run-at       document-end
// @license      MIT
// @homepage     http://quchao.com/entry/watsilla
// downloadURL   https://github.com/QuChao/Watsilla/raw/master/userScripts/Ed2000Tweaker.user.js
// ==/UserScript==
// @version      0.1.0 @ 2016-03-21: Initialize release. Fix the copy feature.
/* jshint -W097 */
'use strict';

// Configs
var Configs = {
    'debug_mode' : false,
};

// Funcs
var emptyFunc = function() {};
var debug = Configs.debug_mode ? console.debug.bind(console) : emptyFunc;

// Ed2000 Tweaker
var Ed2000Tweaker = (function ($doc) {
    // fix the copy feature
    function _fixCopy() {
        // get available products
        var clipContent = Array.from($doc.querySelectorAll('input[name^="File"]')).filter(function (node) {
            // get all checked checkboxes
            return node.checked;
        }).map(function(node, idx){
            return node.value;
        }).join("\n").replace(/\(ED2000\.COM\)/gi, '');
        GM_setClipboard(clipContent, 'text');
        debug('ED2K links captured.');
    }

    // initialization
    function _init() {
        // fix the copy button
        $doc.querySelector('.filebutton[value="复制选中的链接"]').onclick = _fixCopy;
    }

    return {
        // public
        init : _init
    };
})(unsafeWindow.document);

// fire
Ed2000Tweaker.init();
