(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('jss')) :
	typeof define === 'function' && define.amd ? define(['exports', 'jss'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.jssPluginRuleValueObservable = {}, global.jss));
}(this, (function (exports, jss) { 'use strict';

	function symbolObservablePonyfill(root) {
		var result;
		var Symbol = root.Symbol;

		if (typeof Symbol === 'function') {
			if (Symbol.observable) {
				result = Symbol.observable;
			} else {
				result = Symbol('observable');
				Symbol.observable = result;
			}
		} else {
			result = '@@observable';
		}

		return result;
	}

	/* global window */

	var root;

	if (typeof self !== 'undefined') {
	  root = self;
	} else if (typeof window !== 'undefined') {
	  root = window;
	} else if (typeof global !== 'undefined') {
	  root = global;
	} else if (typeof module !== 'undefined') {
	  root = module;
	} else {
	  root = Function('return this')();
	}

	var result = symbolObservablePonyfill(root);

	var isObservable = function isObservable(value) {
	  return value && value[result] && value === value[result]();
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

	Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=jss-plugin-rule-value-observable.js.map
