(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.jssPluginTemplate = {}));
}(this, (function (exports) { 'use strict';

  function warning(condition, message) {
    {
      if (condition) {
        return;
      }

      var text = "Warning: " + message;

      if (typeof console !== 'undefined') {
        console.warn(text);
      }

      try {
        throw Error(text);
      } catch (x) {}
    }
  }

  var semiWithNl = /;\n/;
  /**
   * Naive CSS parser.
   * - Supports only rule body (no selectors)
   * - Requires semicolon and new line after the value (except of last line)
   * - No nested rules support
   */

  var parse = function parse(cssText) {
    var style = {};
    var split = cssText.split(semiWithNl);

    for (var i = 0; i < split.length; i++) {
      var decl = (split[i] || '').trim();
      if (!decl) continue;
      var colonIndex = decl.indexOf(':');

      if (colonIndex === -1) {
         warning(false, "[JSS] Malformed CSS string \"" + decl + "\"") ;
        continue;
      }

      var prop = decl.substr(0, colonIndex).trim();
      var value = decl.substr(colonIndex + 1).trim();
      style[prop] = value;
    }

    return style;
  };

  var onProcessRule = function onProcessRule(rule) {
    if (typeof rule.style === 'string') {
      rule.style = parse(rule.style);
    }
  };

  function templatePlugin() {
    return {
      onProcessRule: onProcessRule
    };
  }

  exports.default = templatePlugin;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=jss-plugin-template.js.map
