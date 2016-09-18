define(function () {
    var _list = null,
        _conf = {
            hideAsInit: true,
            mode: 0, // 1: active, to get element pos in time; 0: passive, to keep element pos and wait for changes to come.
            _liveRangeOffset: 0,
            get liveRangeOffset() {
                if(this._liveRangeOffset) return this._liveRangeOffset;
                this._liveRangeOffset = Math.ceil(this.screenMaxHeight / _cache.minHeight * this.liveRatio);
                return this._liveRangeOffset;
            },
            set liveRangeOffset(ro) {
                this._liveRangeOffset = ro;
            },
            _liveRange: 0,
            get liveRange() {
                if(this._liveRange) return this._liveRange;
                this._liveRange = Math.ceil(this.screenMaxHeight / _cache.minHeight * (1 + this.liveRatio));
                return this._liveRange;
            },
            set liveRange(r) {
                this._liveRange = r;
            },
            liveRatio: 1,
            displayNeeded: false,
            ifRequestAnimationFrame: false,
            screenMaxHeight: window.screen.height * 2
        },
        _cache = {
            touchStartLock: false,
            touchEndLock: false,
            showBegin: 0,
            showEnd: 0,
            childrenLen: 0,
            begin: 0, // 刚好没过(<=)pos的元素索引，从1到len-2
            pos: 0,
            dir: 0, // 0: down, 1: up
            hIndex: [], // height
            hIndexOf: function(i, children) {
                return _conf.mode === 0 ? this.hIndex[i] : children[i].offsetHeight;
            },
            pIndex: [], // position
            pIndexOf: function(i, children) {
                return _conf.mode === 0 ? this.pIndex[i] : children[i].offsetTop; // or use getBoundingClientRect() ?
            },
            vIndex: [], // visible
            dIndex: [], // display
            preHeight: 0,
            subHeight: 0,
            minHeight: 1000000 // minimum height of a child node
        };

    var helper = {};

    var _requestAnimationFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        function(callback){ window.setTimeout(callback, 1000/60) };

    var _getStyle = function (oElm, strCssRule) {
        var strValue = '';
        if (document.defaultView && document.defaultView.getComputedStyle) {
            strValue = document.defaultView.getComputedStyle(oElm, '').getPropertyValue(strCssRule);
        } else if (oElm.currentStyle) {
            strCssRule = strCssRule.replace(/\-(\w)/g, function (strMatch, p1) {
                return p1.toUpperCase();
            });
            strValue = oElm.currentStyle[strCssRule];
        }
        return strValue;
    };

    var _initBlank = function () {
        _cache.preHeight = 0;
        _cache.subHeight = 0;
    };

    var _initIndex = function () {
        var children = _list.childNodes;
        var len = children.length;
        var h = 0;
        var curH, minH = 1000000;
        // children[0].setAttribute('data-key', 0);
        for (var i = 0; i < len; i++) {
            children[i].setAttribute('data-key', i);
            _cache.pIndex[i] = h;
            curH = _cache.hIndex[i] = children[i].offsetHeight;
            if(curH < minH && curH > 12) {
                minH = curH;
            }
            h += curH;
            _cache.vIndex[i] = true;
            if (_conf.displayNeeded) _cache.dIndex[i] = _getStyle(children[i], 'display');
        }
        _cache.showBegin = 0;
        _cache.showEnd = len - 1;
        // debugger
        _cache.minHeight = minH;
    };

    var init = function (list) {
        var children = list.childNodes;
        if (!children || !children.length) {
            return;
        }

        _list = list;

        _initBlank();

        _initIndex();

        if(_conf.hideAsInit) { // 隐藏首尾
            var tempBegin = 0 - _conf.liveRangeOffset,
                tempEnd = 0 + _conf.liveRange,
                len = children.length;
            if(tempBegin < 0) tempBegin = 0;
            if(tempEnd > len) tempEnd = len;
            var i;
            for(i = tempBegin - 1; i >= 0; i--) {
                _cache.preHeight += _cache.hIndexOf(i, children);
                children[i].style.display = 'none';
                _cache.vIndex[i] = false;
            }
            _list.style.paddingTop = _cache.preHeight + 'px';

            for(i = tempEnd; i < len; i++) {
                _cache.subHeight += _cache.hIndexOf(i, children);
                children[i].style.display = 'none';
                _cache.vIndex[i] = false;
            }
            _list.style.paddingBottom = _cache.subHeight + 'px';

            _cache.showBegin = tempBegin;
            _cache.showEnd = tempEnd - 1;

            console.log({
                initTop: _cache.preHeight,
                initBottom: _cache.subHeight
            });
        }
    };

    var _getBeginOfScrollEnd = function(pos, len, children) {
        console.log('end pos: ' + pos);
        var begin = -1, i;
        if (_cache.dir == 0) { // 向下移动
            for (i = _cache.begin; i >= 0; i--) {
                if (_cache.pIndexOf(i, children) <= pos) { // 第i个元素刚好没过pos
                    begin = i;
                    break;
                }
            }
            if(begin < 0) begin = 0;
        } else { // 向上移动
            var pi;
            for (i = _cache.begin; i < len; i++) {
                pi = _cache.pIndexOf(i, children);
                if (pi > pos) { // 第i个元素刚好超过pos
                    begin = i - 1;
                    break;
                }
            }
            if(begin < 0) begin = len - 1;
        }
        return begin;
    };

    var _getBeginOfTouchStart = function(pos, len, children) {
        console.log('start pos: ' + pos);
        var begin = _cache.begin, i;
        if (_cache.dir == 0) { // 向下移动
            for (i = _cache.begin; i < len; i++) {
                if (_cache.pIndexOf(i, children) <= pos) { // 第i个元素刚好没过pos
                    begin = i;
                } else break;
            }
        } else { // 向上移动
            for (i = _cache.begin; i >= 0; i--) {
                if (_cache.pIndexOf(i, children) > pos) { // 第i个元素刚好超过pos
                    continue;
                } else {
                    begin = i;
                    break;
                }
            }
        }
        return begin;
    };

    var updateOnTouchEnd = function (pos) {
        if(_cache.touchStartLock) {
            window.setTimeout(function() {
                updateOnTouchEnd(pos);
            }, 100);
            return;
        }

        _cache.touchEndLock = true;

        var children = _list.childNodes;
        var len = children.length;
        var begin = 0;
        var i = 0, j = 0;

        if (pos < 0) pos = -pos;
        if (pos == _cache.pos) {
            _cache.touchEndLock = false;
            return;
        }
        if (pos < _cache.pos) {
            _cache.dir = 0; // 向下移动
        } else {
            _cache.dir = 1; // 向上移动
        }
        _cache.pos = pos;

        begin = _getBeginOfScrollEnd(pos, len, children);
        console.log('begin of scroll end: ' + begin);

        if(_cache.dir == 0) {

            var upTo = begin;// - _conf.liveRangeOffset;//Math.min(begin, _cache.begin - _conf.liveRangeOffset);
            // console.log({
            //     touch: 'end',
            //     dir: _cache.dir,
            //     from: _cache.begin + _conf.liveRange - 1,
            //     upTo: upTo
            // });

            // console.log('touch end:');

            rshow(_cache.begin, upTo, len, children, true);
        } else {

            var downTo = begin + _conf.liveRange - 1;//Math.max(begin, _cache.begin + _conf.liveRange - 1);
            // console.log({
            //     touch: 'end',
            //     dir: _cache.dir,
            //     from: _cache.begin,
            //     downTo: downTo
            // });

            // console.log('touch end:');

            show(_cache.begin, downTo, len, children, true);
        }
        _cache.begin = begin;

        _cache.touchEndLock = false;
    };

    var updateOnTouchStart = function(pos) {
        if(_cache.touchEndLock) {
            window.setTimeout(function() {
                updateOnTouchStart(pos);
            }, 100);
            return;
        }

        _cache.touchStartLock = true;
        var children = _list.childNodes;
        var len = children.length;
        if(_cache.childrenLen !== len) {
            //TODO

            _cache.childrenLen = len;
        }
        if (pos < 0) pos = -pos;
        var begin = _getBeginOfTouchStart(pos, len, children);
        // console.log('begin of touch start: ' + begin);

        // console.log({
        //     touch: 'start',
        //     begin: begin,
        //     upTo: begin - _conf.liveRangeOffset,
        //     downTo: begin + _conf.liveRange - 1
        // });

        // console.log('touch start:');

        show(begin, begin + _conf.liveRange - 1, len, children, true);
        rshow(begin, begin - _conf.liveRangeOffset, len, children, true);

        _cache.touchStartLock = false;
    };

    var show = function(begin, end, len, children, ifCheck) { // go down
        if(begin < 0) begin = 0;
        if(end > len - 1) end = len - 1;

        console.log({
            from: begin,
            downTo: end
        });

        var displayNeeded = _conf.displayNeeded;
        for (var j = begin; j <= end; j++) {
            if(_cache.vIndex[j]) continue;
            _cache.vIndex[j] = true;
            children[j].style.display = displayNeeded ? _cache.dIndex[j] : 'block';
            _cache.subHeight -= _cache.hIndexOf(j, children);
        }

        if(ifCheck) {
            for (var j = end + 1; j < len; j++) {
                if(!_cache.vIndex[j]) break;
                var hj = _cache.hIndexOf(j, children);
                children[j].style.display = 'none';
                _cache.vIndex[j] = false;
                _cache.subHeight += hj;
            }
        }

        console.log('padding bottom: ' + _cache.subHeight);
        _list.style.paddingBottom = (_cache.subHeight < 0 ? 0 : _cache.subHeight) + 'px';
    };

    var rshow = function(begin, end, len, children, ifCheck) { // go up
        if(end < 0) end = 0;
        if(begin > len - 1) begin = len - 1;

        console.log({
            from: begin,
            upTo: end
        });

        var displayNeeded = _conf.displayNeeded;
        for (var j = begin; j >= end; j--) {
            if(_cache.vIndex[j]) continue;
            _cache.vIndex[j] = true;
            children[j].style.display = displayNeeded ? _cache.dIndex[j] : 'block';
            _cache.preHeight -= _cache.hIndexOf(j, children);
        }

        if(ifCheck) {
            for (var j = end - 1; j >= 0; j--) {
                if(!_cache.vIndex[j]) break;
                var hj = _cache.hIndexOf(j, children);
                children[j].style.display = 'none';
                _cache.vIndex[j] = false;
                _cache.preHeight += hj;
            }
        }

        // console.log('padding top: ' + _cache.preHeight);
        _list.style.paddingTop = (_cache.preHeight < 0 ? 0 : _cache.preHeight) + 'px';
    };

    var updateHeightOf = function (index, newHeight) {
        //TODO
    };

    return {
        onScrollInit: init,
        onScrollStart: function(el, data) {
            updateOnTouchStart(-data.position);
        },
        onScrollEnd: function(el, data) {
            updateOnTouchEnd(-data.endPosition);
        },
        reflow: updateHeightOf
    }
});
