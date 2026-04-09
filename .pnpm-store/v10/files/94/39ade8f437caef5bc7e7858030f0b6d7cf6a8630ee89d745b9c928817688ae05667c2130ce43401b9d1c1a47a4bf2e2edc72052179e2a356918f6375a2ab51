'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var $$observable = require('symbol-observable');
var jss = require('jss');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var $$observable__default = /*#__PURE__*/_interopDefaultLegacy($$observable);

var isObservable = function isObservable(value) {
  return value && value[$$observable__default['default']] && value === value[$$observable__default['default']]();
};

var observablePlugin = function observablePlugin(updateOptions) {
  return {
    onCreateRule: function onCreateRule(name, decl, options) {
      if (!isObservable(decl)) return null;
      var style$ = decl;
      var rule = jss.createRule(name, {}, options); // TODO
      // Call `stream.subscribe()` returns a subscription, which should be explicitly
      // unsubscribed from when we know this sheet is no longer needed.

      style$.subscribe(function (style) {
        for (var prop in style) {
          rule.prop(prop, style[prop], updateOptions);
        }
      });
      return rule;
    },
    onProcessRule: function onProcessRule(rule) {
      if (rule && rule.type !== 'style') return;
      var styleRule = rule;
      var style = styleRule.style;

      var _loop = function _loop(prop) {
        var value = style[prop];
        if (!isObservable(value)) return "continue";
        delete style[prop];
        value.subscribe({
          next: function next(nextValue) {
            styleRule.prop(prop, nextValue, updateOptions);
          }
        });
      };

      for (var prop in style) {
        var _ret = _loop(prop);

        if (_ret === "continue") continue;
      }
    }
  };
};

exports.default = observablePlugin;
