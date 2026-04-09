(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('jss')) :
  typeof define === 'function' && define.amd ? define(['exports', 'jss'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.jssPresetDefault = {}, global.jss));
}(this, (function (exports, jss) { 'use strict';

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

  var now = Date.now();
  var fnValuesNs = "fnValues" + now;
  var fnRuleNs = "fnStyle" + ++now;

  var functionPlugin = function functionPlugin() {
    return {
      onCreateRule: function onCreateRule(name, decl, options) {
        if (typeof decl !== 'function') return null;
        var rule = jss.createRule(name, {}, options);
        rule[fnRuleNs] = decl;
        return rule;
      },
      onProcessStyle: function onProcessStyle(style, rule) {
        // We need to extract function values from the declaration, so that we can keep core unaware of them.
        // We need to do that only once.
        // We don't need to extract functions on each style update, since this can happen only once.
        // We don't support function values inside of function rules.
        if (fnValuesNs in rule || fnRuleNs in rule) return style;
        var fnValues = {};

        for (var prop in style) {
          var value = style[prop];
          if (typeof value !== 'function') continue;
          delete style[prop];
          fnValues[prop] = value;
        }

        rule[fnValuesNs] = fnValues;
        return style;
      },
      onUpdate: function onUpdate(data, rule, sheet, options) {
        var styleRule = rule;
        var fnRule = styleRule[fnRuleNs]; // If we have a style function, the entire rule is dynamic and style object
        // will be returned from that function.

        if (fnRule) {
          // Empty object will remove all currently defined props
          // in case function rule returns a falsy value.
          styleRule.style = fnRule(data) || {};

          {
            for (var prop in styleRule.style) {
              if (typeof styleRule.style[prop] === 'function') {
                  warning(false, '[JSS] Function values inside function rules are not supported.')  ;
                break;
              }
            }
          }
        }

        var fnValues = styleRule[fnValuesNs]; // If we have a fn values map, it is a rule with function values.

        if (fnValues) {
          for (var _prop in fnValues) {
            styleRule.prop(_prop, fnValues[_prop](data), options);
          }
        }
      }
    };
  };

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
          warning(false, "[JSS] Malformed CSS string \"" + decl + "\"")  ;
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

  function _extends() {
    _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }

      return target;
    };

    return _extends.apply(this, arguments);
  }

  var at = '@global';
  var atPrefix = '@global ';

  var GlobalContainerRule =
  /*#__PURE__*/
  function () {
    function GlobalContainerRule(key, styles, options) {
      this.type = 'global';
      this.at = at;
      this.isProcessed = false;
      this.key = key;
      this.options = options;
      this.rules = new jss.RuleList(_extends({}, options, {
        parent: this
      }));

      for (var selector in styles) {
        this.rules.add(selector, styles[selector]);
      }

      this.rules.process();
    }
    /**
     * Get a rule.
     */


    var _proto = GlobalContainerRule.prototype;

    _proto.getRule = function getRule(name) {
      return this.rules.get(name);
    }
    /**
     * Create and register rule, run plugins.
     */
    ;

    _proto.addRule = function addRule(name, style, options) {
      var rule = this.rules.add(name, style, options);
      if (rule) this.options.jss.plugins.onProcessRule(rule);
      return rule;
    }
    /**
     * Replace rule, run plugins.
     */
    ;

    _proto.replaceRule = function replaceRule(name, style, options) {
      var newRule = this.rules.replace(name, style, options);
      if (newRule) this.options.jss.plugins.onProcessRule(newRule);
      return newRule;
    }
    /**
     * Get index of a rule.
     */
    ;

    _proto.indexOf = function indexOf(rule) {
      return this.rules.indexOf(rule);
    }
    /**
     * Generates a CSS string.
     */
    ;

    _proto.toString = function toString(options) {
      return this.rules.toString(options);
    };

    return GlobalContainerRule;
  }();

  var GlobalPrefixedRule =
  /*#__PURE__*/
  function () {
    function GlobalPrefixedRule(key, style, options) {
      this.type = 'global';
      this.at = at;
      this.isProcessed = false;
      this.key = key;
      this.options = options;
      var selector = key.substr(atPrefix.length);
      this.rule = options.jss.createRule(selector, style, _extends({}, options, {
        parent: this
      }));
    }

    var _proto2 = GlobalPrefixedRule.prototype;

    _proto2.toString = function toString(options) {
      return this.rule ? this.rule.toString(options) : '';
    };

    return GlobalPrefixedRule;
  }();

  var separatorRegExp = /\s*,\s*/g;

  function addScope(selector, scope) {
    var parts = selector.split(separatorRegExp);
    var scoped = '';

    for (var i = 0; i < parts.length; i++) {
      scoped += scope + " " + parts[i].trim();
      if (parts[i + 1]) scoped += ', ';
    }

    return scoped;
  }

  function handleNestedGlobalContainerRule(rule, sheet) {
    var options = rule.options,
        style = rule.style;
    var rules = style ? style[at] : null;
    if (!rules) return;

    for (var name in rules) {
      sheet.addRule(name, rules[name], _extends({}, options, {
        selector: addScope(name, rule.selector)
      }));
    }

    delete style[at];
  }

  function handlePrefixedGlobalRule(rule, sheet) {
    var options = rule.options,
        style = rule.style;

    for (var prop in style) {
      if (prop[0] !== '@' || prop.substr(0, at.length) !== at) continue;
      var selector = addScope(prop.substr(at.length), rule.selector);
      sheet.addRule(selector, style[prop], _extends({}, options, {
        selector: selector
      }));
      delete style[prop];
    }
  }
  /**
   * Convert nested rules to separate, remove them from original styles.
   */


  function jssGlobal() {
    function onCreateRule(name, styles, options) {
      if (!name) return null;

      if (name === at) {
        return new GlobalContainerRule(name, styles, options);
      }

      if (name[0] === '@' && name.substr(0, atPrefix.length) === atPrefix) {
        return new GlobalPrefixedRule(name, styles, options);
      }

      var parent = options.parent;

      if (parent) {
        if (parent.type === 'global' || parent.options.parent && parent.options.parent.type === 'global') {
          options.scoped = false;
        }
      }

      if (!options.selector && options.scoped === false) {
        options.selector = name;
      }

      return null;
    }

    function onProcessRule(rule, sheet) {
      if (rule.type !== 'style' || !sheet) return;
      handleNestedGlobalContainerRule(rule, sheet);
      handlePrefixedGlobalRule(rule, sheet);
    }

    return {
      onCreateRule: onCreateRule,
      onProcessRule: onProcessRule
    };
  }

  var isObject = function isObject(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj);
  };

  var valueNs = "extendCurrValue" + Date.now();

  function mergeExtend(style, rule, sheet, newStyle) {
    var extendType = typeof style.extend; // Extend using a rule name.

    if (extendType === 'string') {
      if (!sheet) return;
      var refRule = sheet.getRule(style.extend);
      if (!refRule) return;

      if (refRule === rule) {
          warning(false, "[JSS] A rule tries to extend itself \n" + rule.toString())  ;
        return;
      }

      var parent = refRule.options.parent;

      if (parent) {
        var originalStyle = parent.rules.raw[style.extend];
        extend(originalStyle, rule, sheet, newStyle);
      }

      return;
    } // Extend using an array.


    if (Array.isArray(style.extend)) {
      for (var index = 0; index < style.extend.length; index++) {
        var singleExtend = style.extend[index];
        var singleStyle = typeof singleExtend === 'string' ? _extends({}, style, {
          extend: singleExtend
        }) : style.extend[index];
        extend(singleStyle, rule, sheet, newStyle);
      }

      return;
    } // Extend is a style object.


    for (var prop in style.extend) {
      if (prop === 'extend') {
        extend(style.extend.extend, rule, sheet, newStyle);
        continue;
      }

      if (isObject(style.extend[prop])) {
        if (!(prop in newStyle)) newStyle[prop] = {};
        extend(style.extend[prop], rule, sheet, newStyle[prop]);
        continue;
      }

      newStyle[prop] = style.extend[prop];
    }
  }

  function mergeRest(style, rule, sheet, newStyle) {
    // Copy base style.
    for (var prop in style) {
      if (prop === 'extend') continue;

      if (isObject(newStyle[prop]) && isObject(style[prop])) {
        extend(style[prop], rule, sheet, newStyle[prop]);
        continue;
      }

      if (isObject(style[prop])) {
        newStyle[prop] = extend(style[prop], rule, sheet);
        continue;
      }

      newStyle[prop] = style[prop];
    }
  }
  /**
   * Recursively extend styles.
   */


  function extend(style, rule, sheet, newStyle) {
    if (newStyle === void 0) {
      newStyle = {};
    }

    mergeExtend(style, rule, sheet, newStyle);
    mergeRest(style, rule, sheet, newStyle);
    return newStyle;
  }
  /**
   * Handle `extend` property.
   */


  function jssExtend() {
    function onProcessStyle(style, rule, sheet) {
      if ('extend' in style) return extend(style, rule, sheet);
      return style;
    }

    function onChangeValue(value, prop, rule) {
      if (prop !== 'extend') return value; // Value is empty, remove properties set previously.

      if (value == null || value === false) {
        for (var key in rule[valueNs]) {
          rule.prop(key, null);
        }

        rule[valueNs] = null;
        return null;
      }

      if (typeof value === 'object') {
        for (var _key in value) {
          rule.prop(_key, value[_key]);
        }

        rule[valueNs] = value;
      } // Make sure we don't set the value in the core.


      return null;
    }

    return {
      onProcessStyle: onProcessStyle,
      onChangeValue: onChangeValue
    };
  }

  var separatorRegExp$1 = /\s*,\s*/g;
  var parentRegExp = /&/g;
  var refRegExp = /\$([\w-]+)/g;
  /**
   * Convert nested rules to separate, remove them from original styles.
   */

  function jssNested() {
    // Get a function to be used for $ref replacement.
    function getReplaceRef(container, sheet) {
      return function (match, key) {
        var rule = container.getRule(key) || sheet && sheet.getRule(key);

        if (rule) {
          return rule.selector;
        }

          warning(false, "[JSS] Could not find the referenced rule \"" + key + "\" in \"" + (container.options.meta || container.toString()) + "\".")  ;
        return key;
      };
    }

    function replaceParentRefs(nestedProp, parentProp) {
      var parentSelectors = parentProp.split(separatorRegExp$1);
      var nestedSelectors = nestedProp.split(separatorRegExp$1);
      var result = '';

      for (var i = 0; i < parentSelectors.length; i++) {
        var parent = parentSelectors[i];

        for (var j = 0; j < nestedSelectors.length; j++) {
          var nested = nestedSelectors[j];
          if (result) result += ', '; // Replace all & by the parent or prefix & with the parent.

          result += nested.indexOf('&') !== -1 ? nested.replace(parentRegExp, parent) : parent + " " + nested;
        }
      }

      return result;
    }

    function getOptions(rule, container, prevOptions) {
      // Options has been already created, now we only increase index.
      if (prevOptions) return _extends({}, prevOptions, {
        index: prevOptions.index + 1
      });
      var nestingLevel = rule.options.nestingLevel;
      nestingLevel = nestingLevel === undefined ? 1 : nestingLevel + 1;

      var options = _extends({}, rule.options, {
        nestingLevel: nestingLevel,
        index: container.indexOf(rule) + 1 // We don't need the parent name to be set options for chlid.

      });

      delete options.name;
      return options;
    }

    function onProcessStyle(style, rule, sheet) {
      if (rule.type !== 'style') return style;
      var styleRule = rule;
      var container = styleRule.options.parent;
      var options;
      var replaceRef;

      for (var prop in style) {
        var isNested = prop.indexOf('&') !== -1;
        var isNestedConditional = prop[0] === '@';
        if (!isNested && !isNestedConditional) continue;
        options = getOptions(styleRule, container, options);

        if (isNested) {
          var selector = replaceParentRefs(prop, styleRule.selector); // Lazily create the ref replacer function just once for
          // all nested rules within the sheet.

          if (!replaceRef) replaceRef = getReplaceRef(container, sheet); // Replace all $refs.

          selector = selector.replace(refRegExp, replaceRef);
          var name = styleRule.key + "-" + prop;

          if ('replaceRule' in container) {
            // for backward compatibility
            container.replaceRule(name, style[prop], _extends({}, options, {
              selector: selector
            }));
          } else {
            container.addRule(name, style[prop], _extends({}, options, {
              selector: selector
            }));
          }
        } else if (isNestedConditional) {
          // Place conditional right after the parent rule to ensure right ordering.
          container.addRule(prop, {}, options).addRule(styleRule.key, style[prop], {
            selector: styleRule.selector
          });
        }

        delete style[prop];
      }

      return style;
    }

    return {
      onProcessStyle: onProcessStyle
    };
  }

  /**
   * Set selector.
   *
   * @param original rule
   * @param className class string
   * @return flag indicating function was successfull or not
   */

  function registerClass(rule, className) {
    // Skip falsy values
    if (!className) return true; // Support array of class names `{composes: ['foo', 'bar']}`

    if (Array.isArray(className)) {
      for (var index = 0; index < className.length; index++) {
        var isSetted = registerClass(rule, className[index]);
        if (!isSetted) return false;
      }

      return true;
    } // Support space separated class names `{composes: 'foo bar'}`


    if (className.indexOf(' ') > -1) {
      return registerClass(rule, className.split(' '));
    }

    var parent = rule.options.parent; // It is a ref to a local rule.

    if (className[0] === '$') {
      var refRule = parent.getRule(className.substr(1));

      if (!refRule) {
          warning(false, "[JSS] Referenced rule is not defined. \n" + rule.toString())  ;
        return false;
      }

      if (refRule === rule) {
          warning(false, "[JSS] Cyclic composition detected. \n" + rule.toString())  ;
        return false;
      }

      parent.classes[rule.key] += " " + parent.classes[refRule.key];
      return true;
    }

    parent.classes[rule.key] += " " + className;
    return true;
  }
  /**
   * Convert compose property to additional class, remove property from original styles.
   */


  function jssCompose() {
    function onProcessStyle(style, rule) {
      if (!('composes' in style)) return style;
      registerClass(rule, style.composes); // Remove composes property to prevent infinite loop.

      delete style.composes;
      return style;
    }

    return {
      onProcessStyle: onProcessStyle
    };
  }

  /* eslint-disable no-var, prefer-template */
  var uppercasePattern = /[A-Z]/g;
  var msPattern = /^ms-/;
  var cache = {};

  function toHyphenLower(match) {
    return '-' + match.toLowerCase()
  }

  function hyphenateStyleName(name) {
    if (cache.hasOwnProperty(name)) {
      return cache[name]
    }

    var hName = name.replace(uppercasePattern, toHyphenLower);
    return (cache[name] = msPattern.test(hName) ? '-' + hName : hName)
  }

  /**
   * Convert camel cased property names to dash separated.
   */

  function convertCase(style) {
    var converted = {};

    for (var prop in style) {
      var key = prop.indexOf('--') === 0 ? prop : hyphenateStyleName(prop);
      converted[key] = style[prop];
    }

    if (style.fallbacks) {
      if (Array.isArray(style.fallbacks)) converted.fallbacks = style.fallbacks.map(convertCase);else converted.fallbacks = convertCase(style.fallbacks);
    }

    return converted;
  }
  /**
   * Allow camel cased property names by converting them back to dasherized.
   */


  function camelCase() {
    function onProcessStyle(style) {
      if (Array.isArray(style)) {
        // Handle rules like @font-face, which can have multiple styles in an array
        for (var index = 0; index < style.length; index++) {
          style[index] = convertCase(style[index]);
        }

        return style;
      }

      return convertCase(style);
    }

    function onChangeValue(value, prop, rule) {
      if (prop.indexOf('--') === 0) {
        return value;
      }

      var hyphenatedProp = hyphenateStyleName(prop); // There was no camel case in place

      if (prop === hyphenatedProp) return value;
      rule.prop(hyphenatedProp, value); // Core will ignore that property value we set the proper one above.

      return null;
    }

    return {
      onProcessStyle: onProcessStyle,
      onChangeValue: onChangeValue
    };
  }

  var px = jss.hasCSSTOMSupport && CSS ? CSS.px : 'px';
  var ms = jss.hasCSSTOMSupport && CSS ? CSS.ms : 'ms';
  var percent = jss.hasCSSTOMSupport && CSS ? CSS.percent : '%';
  /**
   * Generated jss-plugin-default-unit CSS property units
   */

  var defaultUnits = {
    // Animation properties
    'animation-delay': ms,
    'animation-duration': ms,
    // Background properties
    'background-position': px,
    'background-position-x': px,
    'background-position-y': px,
    'background-size': px,
    // Border Properties
    border: px,
    'border-bottom': px,
    'border-bottom-left-radius': px,
    'border-bottom-right-radius': px,
    'border-bottom-width': px,
    'border-left': px,
    'border-left-width': px,
    'border-radius': px,
    'border-right': px,
    'border-right-width': px,
    'border-top': px,
    'border-top-left-radius': px,
    'border-top-right-radius': px,
    'border-top-width': px,
    'border-width': px,
    'border-block': px,
    'border-block-end': px,
    'border-block-end-width': px,
    'border-block-start': px,
    'border-block-start-width': px,
    'border-block-width': px,
    'border-inline': px,
    'border-inline-end': px,
    'border-inline-end-width': px,
    'border-inline-start': px,
    'border-inline-start-width': px,
    'border-inline-width': px,
    'border-start-start-radius': px,
    'border-start-end-radius': px,
    'border-end-start-radius': px,
    'border-end-end-radius': px,
    // Margin properties
    margin: px,
    'margin-bottom': px,
    'margin-left': px,
    'margin-right': px,
    'margin-top': px,
    'margin-block': px,
    'margin-block-end': px,
    'margin-block-start': px,
    'margin-inline': px,
    'margin-inline-end': px,
    'margin-inline-start': px,
    // Padding properties
    padding: px,
    'padding-bottom': px,
    'padding-left': px,
    'padding-right': px,
    'padding-top': px,
    'padding-block': px,
    'padding-block-end': px,
    'padding-block-start': px,
    'padding-inline': px,
    'padding-inline-end': px,
    'padding-inline-start': px,
    // Mask properties
    'mask-position-x': px,
    'mask-position-y': px,
    'mask-size': px,
    // Width and height properties
    height: px,
    width: px,
    'min-height': px,
    'max-height': px,
    'min-width': px,
    'max-width': px,
    // Position properties
    bottom: px,
    left: px,
    top: px,
    right: px,
    inset: px,
    'inset-block': px,
    'inset-block-end': px,
    'inset-block-start': px,
    'inset-inline': px,
    'inset-inline-end': px,
    'inset-inline-start': px,
    // Shadow properties
    'box-shadow': px,
    'text-shadow': px,
    // Column properties
    'column-gap': px,
    'column-rule': px,
    'column-rule-width': px,
    'column-width': px,
    // Font and text properties
    'font-size': px,
    'font-size-delta': px,
    'letter-spacing': px,
    'text-decoration-thickness': px,
    'text-indent': px,
    'text-stroke': px,
    'text-stroke-width': px,
    'word-spacing': px,
    // Motion properties
    motion: px,
    'motion-offset': px,
    // Outline properties
    outline: px,
    'outline-offset': px,
    'outline-width': px,
    // Perspective properties
    perspective: px,
    'perspective-origin-x': percent,
    'perspective-origin-y': percent,
    // Transform properties
    'transform-origin': percent,
    'transform-origin-x': percent,
    'transform-origin-y': percent,
    'transform-origin-z': percent,
    // Transition properties
    'transition-delay': ms,
    'transition-duration': ms,
    // Alignment properties
    'vertical-align': px,
    'flex-basis': px,
    // Some random properties
    'shape-margin': px,
    size: px,
    gap: px,
    // Grid properties
    grid: px,
    'grid-gap': px,
    'row-gap': px,
    'grid-row-gap': px,
    'grid-column-gap': px,
    'grid-template-rows': px,
    'grid-template-columns': px,
    'grid-auto-rows': px,
    'grid-auto-columns': px,
    // Not existing properties.
    // Used to avoid issues with jss-plugin-expand integration.
    'box-shadow-x': px,
    'box-shadow-y': px,
    'box-shadow-blur': px,
    'box-shadow-spread': px,
    'font-line-height': px,
    'text-shadow-x': px,
    'text-shadow-y': px,
    'text-shadow-blur': px
  };
  /**
   * Clones the object and adds a camel cased property version.
   */

  function addCamelCasedVersion(obj) {
    var regExp = /(-[a-z])/g;

    var replace = function replace(str) {
      return str[1].toUpperCase();
    };

    var newObj = {};

    for (var key in obj) {
      newObj[key] = obj[key];
      newObj[key.replace(regExp, replace)] = obj[key];
    }

    return newObj;
  }

  var units = addCamelCasedVersion(defaultUnits);
  /**
   * Recursive deep style passing function
   */

  function iterate(prop, value, options) {
    if (value == null) return value;

    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        value[i] = iterate(prop, value[i], options);
      }
    } else if (typeof value === 'object') {
      if (prop === 'fallbacks') {
        for (var innerProp in value) {
          value[innerProp] = iterate(innerProp, value[innerProp], options);
        }
      } else {
        for (var _innerProp in value) {
          value[_innerProp] = iterate(prop + "-" + _innerProp, value[_innerProp], options);
        }
      } // eslint-disable-next-line no-restricted-globals

    } else if (typeof value === 'number' && isNaN(value) === false) {
      var unit = options[prop] || units[prop]; // Add the unit if available, except for the special case of 0px.

      if (unit && !(value === 0 && unit === px)) {
        return typeof unit === 'function' ? unit(value).toString() : "" + value + unit;
      }

      return value.toString();
    }

    return value;
  }
  /**
   * Add unit to numeric values.
   */


  function defaultUnit(options) {
    if (options === void 0) {
      options = {};
    }

    var camelCasedOptions = addCamelCasedVersion(options);

    function onProcessStyle(style, rule) {
      if (rule.type !== 'style') return style;

      for (var prop in style) {
        style[prop] = iterate(prop, style[prop], camelCasedOptions);
      }

      return style;
    }

    function onChangeValue(value, prop) {
      return iterate(prop, value, camelCasedOptions);
    }

    return {
      onProcessStyle: onProcessStyle,
      onChangeValue: onChangeValue
    };
  }

  /**
   * A scheme for converting properties from array to regular style.
   * All properties listed below will be transformed to a string separated by space.
   */
  var propArray = {
    'background-size': true,
    'background-position': true,
    border: true,
    'border-bottom': true,
    'border-left': true,
    'border-top': true,
    'border-right': true,
    'border-radius': true,
    'border-image': true,
    'border-width': true,
    'border-style': true,
    'border-color': true,
    'box-shadow': true,
    flex: true,
    margin: true,
    padding: true,
    outline: true,
    'transform-origin': true,
    transform: true,
    transition: true
    /**
     * A scheme for converting arrays to regular styles inside of objects.
     * For e.g.: "{position: [0, 0]}" => "background-position: 0 0;".
     */

  };
  var propArrayInObj = {
    position: true,
    // background-position
    size: true // background-size

    /**
     * A scheme for parsing and building correct styles from passed objects.
     */

  };
  var propObj = {
    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    margin: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    background: {
      attachment: null,
      color: null,
      image: null,
      position: null,
      repeat: null
    },
    border: {
      width: null,
      style: null,
      color: null
    },
    'border-top': {
      width: null,
      style: null,
      color: null
    },
    'border-right': {
      width: null,
      style: null,
      color: null
    },
    'border-bottom': {
      width: null,
      style: null,
      color: null
    },
    'border-left': {
      width: null,
      style: null,
      color: null
    },
    outline: {
      width: null,
      style: null,
      color: null
    },
    'list-style': {
      type: null,
      position: null,
      image: null
    },
    transition: {
      property: null,
      duration: null,
      'timing-function': null,
      timingFunction: null,
      // Needed for avoiding comilation issues with jss-plugin-camel-case
      delay: null
    },
    animation: {
      name: null,
      duration: null,
      'timing-function': null,
      timingFunction: null,
      // Needed to avoid compilation issues with jss-plugin-camel-case
      delay: null,
      'iteration-count': null,
      iterationCount: null,
      // Needed to avoid compilation issues with jss-plugin-camel-case
      direction: null,
      'fill-mode': null,
      fillMode: null,
      // Needed to avoid compilation issues with jss-plugin-camel-case
      'play-state': null,
      playState: null // Needed to avoid compilation issues with jss-plugin-camel-case

    },
    'box-shadow': {
      x: 0,
      y: 0,
      blur: 0,
      spread: 0,
      color: null,
      inset: null
    },
    'text-shadow': {
      x: 0,
      y: 0,
      blur: null,
      color: null
      /**
       * A scheme for converting non-standart properties inside object.
       * For e.g.: include 'border-radius' property inside 'border' object.
       */

    }
  };
  var customPropObj = {
    border: {
      radius: 'border-radius',
      image: 'border-image',
      width: 'border-width',
      style: 'border-style',
      color: 'border-color'
    },
    'border-bottom': {
      width: 'border-bottom-width',
      style: 'border-bottom-style',
      color: 'border-bottom-color'
    },
    'border-top': {
      width: 'border-top-width',
      style: 'border-top-style',
      color: 'border-top-color'
    },
    'border-left': {
      width: 'border-left-width',
      style: 'border-left-style',
      color: 'border-left-color'
    },
    'border-right': {
      width: 'border-right-width',
      style: 'border-right-style',
      color: 'border-right-color'
    },
    background: {
      size: 'background-size',
      image: 'background-image'
    },
    font: {
      style: 'font-style',
      variant: 'font-variant',
      weight: 'font-weight',
      stretch: 'font-stretch',
      size: 'font-size',
      family: 'font-family',
      lineHeight: 'line-height',
      // Needed to avoid compilation issues with jss-plugin-camel-case
      'line-height': 'line-height'
    },
    flex: {
      grow: 'flex-grow',
      basis: 'flex-basis',
      direction: 'flex-direction',
      wrap: 'flex-wrap',
      flow: 'flex-flow',
      shrink: 'flex-shrink'
    },
    align: {
      self: 'align-self',
      items: 'align-items',
      content: 'align-content'
    },
    grid: {
      'template-columns': 'grid-template-columns',
      templateColumns: 'grid-template-columns',
      'template-rows': 'grid-template-rows',
      templateRows: 'grid-template-rows',
      'template-areas': 'grid-template-areas',
      templateAreas: 'grid-template-areas',
      template: 'grid-template',
      'auto-columns': 'grid-auto-columns',
      autoColumns: 'grid-auto-columns',
      'auto-rows': 'grid-auto-rows',
      autoRows: 'grid-auto-rows',
      'auto-flow': 'grid-auto-flow',
      autoFlow: 'grid-auto-flow',
      row: 'grid-row',
      column: 'grid-column',
      'row-start': 'grid-row-start',
      rowStart: 'grid-row-start',
      'row-end': 'grid-row-end',
      rowEnd: 'grid-row-end',
      'column-start': 'grid-column-start',
      columnStart: 'grid-column-start',
      'column-end': 'grid-column-end',
      columnEnd: 'grid-column-end',
      area: 'grid-area',
      gap: 'grid-gap',
      'row-gap': 'grid-row-gap',
      rowGap: 'grid-row-gap',
      'column-gap': 'grid-column-gap',
      columnGap: 'grid-column-gap'
    }
  };
  /* eslint-disable no-use-before-define */

  /**
   * Map values by given prop.
   *
   * @param {Array} array of values
   * @param {String} original property
   * @param {String} original rule
   * @return {String} mapped values
   */

  function mapValuesByProp(value, prop, rule) {
    return value.map(function (item) {
      return objectToArray(item, prop, rule, false, true);
    });
  }
  /**
   * Convert array to nested array, if needed
   */


  function processArray(value, prop, scheme, rule) {
    if (scheme[prop] == null) return value;
    if (value.length === 0) return [];
    if (Array.isArray(value[0])) return processArray(value[0], prop, scheme, rule);

    if (typeof value[0] === 'object') {
      return mapValuesByProp(value, prop, rule);
    }

    return [value];
  }
  /**
   * Convert object to array.
   */


  function objectToArray(value, prop, rule, isFallback, isInArray) {
    if (!(propObj[prop] || customPropObj[prop])) return [];
    var result = []; // Check if exists any non-standard property

    if (customPropObj[prop]) {
      // eslint-disable-next-line no-param-reassign
      value = customPropsToStyle(value, rule, customPropObj[prop], isFallback);
    } // Pass throught all standart props


    if (Object.keys(value).length) {
      for (var baseProp in propObj[prop]) {
        if (value[baseProp]) {
          if (Array.isArray(value[baseProp])) {
            result.push(propArrayInObj[baseProp] === null ? value[baseProp] : value[baseProp].join(' '));
          } else result.push(value[baseProp]);

          continue;
        } // Add default value from props config.


        if (propObj[prop][baseProp] != null) {
          result.push(propObj[prop][baseProp]);
        }
      }
    }

    if (!result.length || isInArray) return result;
    return [result];
  }
  /**
   * Convert custom properties values to styles adding them to rule directly
   */


  function customPropsToStyle(value, rule, customProps, isFallback) {
    for (var prop in customProps) {
      var propName = customProps[prop]; // If current property doesn't exist already in rule - add new one

      if (typeof value[prop] !== 'undefined' && (isFallback || !rule.prop(propName))) {
        var _styleDetector;

        var appendedValue = styleDetector((_styleDetector = {}, _styleDetector[propName] = value[prop], _styleDetector), rule)[propName]; // Add style directly in rule

        if (isFallback) rule.style.fallbacks[propName] = appendedValue;else rule.style[propName] = appendedValue;
      } // Delete converted property to avoid double converting


      delete value[prop];
    }

    return value;
  }
  /**
   * Detect if a style needs to be converted.
   */


  function styleDetector(style, rule, isFallback) {
    for (var prop in style) {
      var value = style[prop];

      if (Array.isArray(value)) {
        // Check double arrays to avoid recursion.
        if (!Array.isArray(value[0])) {
          if (prop === 'fallbacks') {
            for (var index = 0; index < style.fallbacks.length; index++) {
              style.fallbacks[index] = styleDetector(style.fallbacks[index], rule, true);
            }

            continue;
          }

          style[prop] = processArray(value, prop, propArray, rule); // Avoid creating properties with empty values

          if (!style[prop].length) delete style[prop];
        }
      } else if (typeof value === 'object') {
        if (prop === 'fallbacks') {
          style.fallbacks = styleDetector(style.fallbacks, rule, true);
          continue;
        }

        style[prop] = objectToArray(value, prop, rule, isFallback); // Avoid creating properties with empty values

        if (!style[prop].length) delete style[prop];
      } // Maybe a computed value resulting in an empty string
      else if (style[prop] === '') delete style[prop];
    }

    return style;
  }
  /**
   * Adds possibility to write expanded styles.
   */


  function jssExpand() {
    function onProcessStyle(style, rule) {
      if (!style || rule.type !== 'style') return style;

      if (Array.isArray(style)) {
        // Pass rules one by one and reformat them
        for (var index = 0; index < style.length; index++) {
          style[index] = styleDetector(style[index], rule);
        }

        return style;
      }

      return styleDetector(style, rule);
    }

    return {
      onProcessStyle: onProcessStyle
    };
  }

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

  var isBrowser = (typeof window === "undefined" ? "undefined" : _typeof(window)) === "object" && (typeof document === "undefined" ? "undefined" : _typeof(document)) === 'object' && document.nodeType === 9;

  function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;

    for (var i = 0, arr2 = new Array(len); i < len; i++) {
      arr2[i] = arr[i];
    }

    return arr2;
  }

  function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) return _arrayLikeToArray(arr);
  }

  function _iterableToArray(iter) {
    if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
  }

  function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
  }

  function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
  }

  // Export javascript style and css style vendor prefixes.
  var js = '';
  var css = '';
  var vendor = '';
  var browser = '';
  var isTouch = isBrowser && 'ontouchstart' in document.documentElement; // We should not do anything if required serverside.

  if (isBrowser) {
    // Order matters. We need to check Webkit the last one because
    // other vendors use to add Webkit prefixes to some properties
    var jsCssMap = {
      Moz: '-moz-',
      ms: '-ms-',
      O: '-o-',
      Webkit: '-webkit-'
    };

    var _document$createEleme = document.createElement('p'),
        style = _document$createEleme.style;

    var testProp = 'Transform';

    for (var key in jsCssMap) {
      if (key + testProp in style) {
        js = key;
        css = jsCssMap[key];
        break;
      }
    } // Correctly detect the Edge browser.


    if (js === 'Webkit' && 'msHyphens' in style) {
      js = 'ms';
      css = jsCssMap.ms;
      browser = 'edge';
    } // Correctly detect the Safari browser.


    if (js === 'Webkit' && '-apple-trailing-word' in style) {
      vendor = 'apple';
    }
  }
  /**
   * Vendor prefix string for the current browser.
   *
   * @type {{js: String, css: String, vendor: String, browser: String}}
   * @api public
   */


  var prefix = {
    js: js,
    css: css,
    vendor: vendor,
    browser: browser,
    isTouch: isTouch
  };

  /**
   * Test if a keyframe at-rule should be prefixed or not
   *
   * @param {String} vendor prefix string for the current browser.
   * @return {String}
   * @api public
   */

  function supportedKeyframes(key) {
    // Keyframes is already prefixed. e.g. key = '@-webkit-keyframes a'
    if (key[1] === '-') return key; // No need to prefix IE/Edge. Older browsers will ignore unsupported rules.
    // https://caniuse.com/#search=keyframes

    if (prefix.js === 'ms') return key;
    return "@" + prefix.css + "keyframes" + key.substr(10);
  }

  // https://caniuse.com/#search=appearance

  var appearence = {
    noPrefill: ['appearance'],
    supportedProperty: function supportedProperty(prop) {
      if (prop !== 'appearance') return false;
      if (prefix.js === 'ms') return "-webkit-" + prop;
      return prefix.css + prop;
    }
  };

  // https://caniuse.com/#search=color-adjust

  var colorAdjust = {
    noPrefill: ['color-adjust'],
    supportedProperty: function supportedProperty(prop) {
      if (prop !== 'color-adjust') return false;
      if (prefix.js === 'Webkit') return prefix.css + "print-" + prop;
      return prop;
    }
  };

  var regExp = /[-\s]+(.)?/g;
  /**
   * Replaces the letter with the capital letter
   *
   * @param {String} match
   * @param {String} c
   * @return {String}
   * @api private
   */

  function toUpper(match, c) {
    return c ? c.toUpperCase() : '';
  }
  /**
   * Convert dash separated strings to camel-cased.
   *
   * @param {String} str
   * @return {String}
   * @api private
   */


  function camelize(str) {
    return str.replace(regExp, toUpper);
  }

  /**
   * Convert dash separated strings to pascal cased.
   *
   * @param {String} str
   * @return {String}
   * @api private
   */

  function pascalize(str) {
    return camelize("-" + str);
  }

  // but we can use a longhand property instead.
  // https://caniuse.com/#search=mask

  var mask = {
    noPrefill: ['mask'],
    supportedProperty: function supportedProperty(prop, style) {
      if (!/^mask/.test(prop)) return false;

      if (prefix.js === 'Webkit') {
        var longhand = 'mask-image';

        if (camelize(longhand) in style) {
          return prop;
        }

        if (prefix.js + pascalize(longhand) in style) {
          return prefix.css + prop;
        }
      }

      return prop;
    }
  };

  // https://caniuse.com/#search=text-orientation

  var textOrientation = {
    noPrefill: ['text-orientation'],
    supportedProperty: function supportedProperty(prop) {
      if (prop !== 'text-orientation') return false;

      if (prefix.vendor === 'apple' && !prefix.isTouch) {
        return prefix.css + prop;
      }

      return prop;
    }
  };

  // https://caniuse.com/#search=transform

  var transform = {
    noPrefill: ['transform'],
    supportedProperty: function supportedProperty(prop, style, options) {
      if (prop !== 'transform') return false;

      if (options.transform) {
        return prop;
      }

      return prefix.css + prop;
    }
  };

  // https://caniuse.com/#search=transition

  var transition = {
    noPrefill: ['transition'],
    supportedProperty: function supportedProperty(prop, style, options) {
      if (prop !== 'transition') return false;

      if (options.transition) {
        return prop;
      }

      return prefix.css + prop;
    }
  };

  // https://caniuse.com/#search=writing-mode

  var writingMode = {
    noPrefill: ['writing-mode'],
    supportedProperty: function supportedProperty(prop) {
      if (prop !== 'writing-mode') return false;

      if (prefix.js === 'Webkit' || prefix.js === 'ms' && prefix.browser !== 'edge') {
        return prefix.css + prop;
      }

      return prop;
    }
  };

  // https://caniuse.com/#search=user-select

  var userSelect = {
    noPrefill: ['user-select'],
    supportedProperty: function supportedProperty(prop) {
      if (prop !== 'user-select') return false;

      if (prefix.js === 'Moz' || prefix.js === 'ms' || prefix.vendor === 'apple') {
        return prefix.css + prop;
      }

      return prop;
    }
  };

  // https://caniuse.com/#search=multicolumn
  // https://github.com/postcss/autoprefixer/issues/491
  // https://github.com/postcss/autoprefixer/issues/177

  var breakPropsOld = {
    supportedProperty: function supportedProperty(prop, style) {
      if (!/^break-/.test(prop)) return false;

      if (prefix.js === 'Webkit') {
        var jsProp = "WebkitColumn" + pascalize(prop);
        return jsProp in style ? prefix.css + "column-" + prop : false;
      }

      if (prefix.js === 'Moz') {
        var _jsProp = "page" + pascalize(prop);

        return _jsProp in style ? "page-" + prop : false;
      }

      return false;
    }
  };

  // See https://github.com/postcss/autoprefixer/issues/324.

  var inlineLogicalOld = {
    supportedProperty: function supportedProperty(prop, style) {
      if (!/^(border|margin|padding)-inline/.test(prop)) return false;
      if (prefix.js === 'Moz') return prop;
      var newProp = prop.replace('-inline', '');
      return prefix.js + pascalize(newProp) in style ? prefix.css + newProp : false;
    }
  };

  // Camelization is required because we can't test using.
  // CSS syntax for e.g. in FF.

  var unprefixed = {
    supportedProperty: function supportedProperty(prop, style) {
      return camelize(prop) in style ? prop : false;
    }
  };

  var prefixed = {
    supportedProperty: function supportedProperty(prop, style) {
      var pascalized = pascalize(prop); // Return custom CSS variable without prefixing.

      if (prop[0] === '-') return prop; // Return already prefixed value without prefixing.

      if (prop[0] === '-' && prop[1] === '-') return prop;
      if (prefix.js + pascalized in style) return prefix.css + prop; // Try webkit fallback.

      if (prefix.js !== 'Webkit' && "Webkit" + pascalized in style) return "-webkit-" + prop;
      return false;
    }
  };

  // https://caniuse.com/#search=scroll-snap

  var scrollSnap = {
    supportedProperty: function supportedProperty(prop) {
      if (prop.substring(0, 11) !== 'scroll-snap') return false;

      if (prefix.js === 'ms') {
        return "" + prefix.css + prop;
      }

      return prop;
    }
  };

  // https://caniuse.com/#search=overscroll-behavior

  var overscrollBehavior = {
    supportedProperty: function supportedProperty(prop) {
      if (prop !== 'overscroll-behavior') return false;

      if (prefix.js === 'ms') {
        return prefix.css + "scroll-chaining";
      }

      return prop;
    }
  };

  var propMap = {
    'flex-grow': 'flex-positive',
    'flex-shrink': 'flex-negative',
    'flex-basis': 'flex-preferred-size',
    'justify-content': 'flex-pack',
    order: 'flex-order',
    'align-items': 'flex-align',
    'align-content': 'flex-line-pack' // 'align-self' is handled by 'align-self' plugin.

  }; // Support old flex spec from 2012.

  var flex2012 = {
    supportedProperty: function supportedProperty(prop, style) {
      var newProp = propMap[prop];
      if (!newProp) return false;
      return prefix.js + pascalize(newProp) in style ? prefix.css + newProp : false;
    }
  };

  var propMap$1 = {
    flex: 'box-flex',
    'flex-grow': 'box-flex',
    'flex-direction': ['box-orient', 'box-direction'],
    order: 'box-ordinal-group',
    'align-items': 'box-align',
    'flex-flow': ['box-orient', 'box-direction'],
    'justify-content': 'box-pack'
  };
  var propKeys = Object.keys(propMap$1);

  var prefixCss = function prefixCss(p) {
    return prefix.css + p;
  }; // Support old flex spec from 2009.


  var flex2009 = {
    supportedProperty: function supportedProperty(prop, style, _ref) {
      var multiple = _ref.multiple;

      if (propKeys.indexOf(prop) > -1) {
        var newProp = propMap$1[prop];

        if (!Array.isArray(newProp)) {
          return prefix.js + pascalize(newProp) in style ? prefix.css + newProp : false;
        }

        if (!multiple) return false;

        for (var i = 0; i < newProp.length; i++) {
          if (!(prefix.js + pascalize(newProp[0]) in style)) {
            return false;
          }
        }

        return newProp.map(prefixCss);
      }

      return false;
    }
  };

  // plugins = [
  //   ...plugins,
  //    breakPropsOld,
  //    inlineLogicalOld,
  //    unprefixed,
  //    prefixed,
  //    scrollSnap,
  //    flex2012,
  //    flex2009
  // ]
  // Plugins without 'noPrefill' value, going last.
  // 'flex-*' plugins should be at the bottom.
  // 'flex2009' going after 'flex2012'.
  // 'prefixed' going after 'unprefixed'

  var plugins = [appearence, colorAdjust, mask, textOrientation, transform, transition, writingMode, userSelect, breakPropsOld, inlineLogicalOld, unprefixed, prefixed, scrollSnap, overscrollBehavior, flex2012, flex2009];
  var propertyDetectors = plugins.filter(function (p) {
    return p.supportedProperty;
  }).map(function (p) {
    return p.supportedProperty;
  });
  var noPrefill = plugins.filter(function (p) {
    return p.noPrefill;
  }).reduce(function (a, p) {
    a.push.apply(a, _toConsumableArray(p.noPrefill));
    return a;
  }, []);

  var el;
  var cache$1 = {};

  if (isBrowser) {
    el = document.createElement('p'); // We test every property on vendor prefix requirement.
    // Once tested, result is cached. It gives us up to 70% perf boost.
    // http://jsperf.com/element-style-object-access-vs-plain-object
    //
    // Prefill cache with known css properties to reduce amount of
    // properties we need to feature test at runtime.
    // http://davidwalsh.name/vendor-prefix

    var computed = window.getComputedStyle(document.documentElement, '');

    for (var key$1 in computed) {
      // eslint-disable-next-line no-restricted-globals
      if (!isNaN(key$1)) cache$1[computed[key$1]] = computed[key$1];
    } // Properties that cannot be correctly detected using the
    // cache prefill method.


    noPrefill.forEach(function (x) {
      return delete cache$1[x];
    });
  }
  /**
   * Test if a property is supported, returns supported property with vendor
   * prefix if required. Returns `false` if not supported.
   *
   * @param {String} prop dash separated
   * @param {Object} [options]
   * @return {String|Boolean}
   * @api public
   */


  function supportedProperty(prop, options) {
    if (options === void 0) {
      options = {};
    }

    // For server-side rendering.
    if (!el) return prop; // Remove cache for benchmark tests or return property from the cache.

    if ( cache$1[prop] != null) {
      return cache$1[prop];
    } // Check if 'transition' or 'transform' natively supported in browser.


    if (prop === 'transition' || prop === 'transform') {
      options[prop] = prop in el.style;
    } // Find a plugin for current prefix property.


    for (var i = 0; i < propertyDetectors.length; i++) {
      cache$1[prop] = propertyDetectors[i](prop, el.style, options); // Break loop, if value found.

      if (cache$1[prop]) break;
    } // Reset styles for current property.
    // Firefox can even throw an error for invalid properties, e.g., "0".


    try {
      el.style[prop] = '';
    } catch (err) {
      return false;
    }

    return cache$1[prop];
  }

  var cache$1$1 = {};
  var transitionProperties = {
    transition: 1,
    'transition-property': 1,
    '-webkit-transition': 1,
    '-webkit-transition-property': 1
  };
  var transPropsRegExp = /(^\s*[\w-]+)|, (\s*[\w-]+)(?![^()]*\))/g;
  var el$1;
  /**
   * Returns prefixed value transition/transform if needed.
   *
   * @param {String} match
   * @param {String} p1
   * @param {String} p2
   * @return {String}
   * @api private
   */

  function prefixTransitionCallback(match, p1, p2) {
    if (p1 === 'var') return 'var';
    if (p1 === 'all') return 'all';
    if (p2 === 'all') return ', all';
    var prefixedValue = p1 ? supportedProperty(p1) : ", " + supportedProperty(p2);
    if (!prefixedValue) return p1 || p2;
    return prefixedValue;
  }

  if (isBrowser) el$1 = document.createElement('p');
  /**
   * Returns prefixed value if needed. Returns `false` if value is not supported.
   *
   * @param {String} property
   * @param {String} value
   * @return {String|Boolean}
   * @api public
   */

  function supportedValue(property, value) {
    // For server-side rendering.
    var prefixedValue = value;
    if (!el$1 || property === 'content') return value; // It is a string or a number as a string like '1'.
    // We want only prefixable values here.
    // eslint-disable-next-line no-restricted-globals

    if (typeof prefixedValue !== 'string' || !isNaN(parseInt(prefixedValue, 10))) {
      return prefixedValue;
    } // Create cache key for current value.


    var cacheKey = property + prefixedValue; // Remove cache for benchmark tests or return value from cache.

    if ( cache$1$1[cacheKey] != null) {
      return cache$1$1[cacheKey];
    } // IE can even throw an error in some cases, for e.g. style.content = 'bar'.


    try {
      // Test value as it is.
      el$1.style[property] = prefixedValue;
    } catch (err) {
      // Return false if value not supported.
      cache$1$1[cacheKey] = false;
      return false;
    } // If 'transition' or 'transition-property' property.


    if (transitionProperties[property]) {
      prefixedValue = prefixedValue.replace(transPropsRegExp, prefixTransitionCallback);
    } else if (el$1.style[property] === '') {
      // Value with a vendor prefix.
      prefixedValue = prefix.css + prefixedValue; // Hardcode test to convert "flex" to "-ms-flexbox" for IE10.

      if (prefixedValue === '-ms-flex') el$1.style[property] = '-ms-flexbox'; // Test prefixed value.

      el$1.style[property] = prefixedValue; // Return false if value not supported.

      if (el$1.style[property] === '') {
        cache$1$1[cacheKey] = false;
        return false;
      }
    } // Reset styles for current property.


    el$1.style[property] = ''; // Write current value to cache.

    cache$1$1[cacheKey] = prefixedValue;
    return cache$1$1[cacheKey];
  }

  /**
   * Add vendor prefix to a property name when needed.
   */

  function jssVendorPrefixer() {
    function onProcessRule(rule) {
      if (rule.type === 'keyframes') {
        var atRule = rule;
        atRule.at = supportedKeyframes(atRule.at);
      }
    }

    function prefixStyle(style) {
      for (var prop in style) {
        var value = style[prop];

        if (prop === 'fallbacks' && Array.isArray(value)) {
          style[prop] = value.map(prefixStyle);
          continue;
        }

        var changeProp = false;
        var supportedProp = supportedProperty(prop);
        if (supportedProp && supportedProp !== prop) changeProp = true;
        var changeValue = false;
        var supportedValue$1 = supportedValue(supportedProp, jss.toCssValue(value));
        if (supportedValue$1 && supportedValue$1 !== value) changeValue = true;

        if (changeProp || changeValue) {
          if (changeProp) delete style[prop];
          style[supportedProp || prop] = supportedValue$1 || value;
        }
      }

      return style;
    }

    function onProcessStyle(style, rule) {
      if (rule.type !== 'style') return style;
      return prefixStyle(style);
    }

    function onChangeValue(value, prop) {
      return supportedValue(prop, jss.toCssValue(value)) || value;
    }

    return {
      onProcessRule: onProcessRule,
      onProcessStyle: onProcessStyle,
      onChangeValue: onChangeValue
    };
  }

  /**
   * Sort props by length.
   */
  function jssPropsSort() {
    var sort = function sort(prop0, prop1) {
      if (prop0.length === prop1.length) {
        return prop0 > prop1 ? 1 : -1;
      }

      return prop0.length - prop1.length;
    };

    return {
      onProcessStyle: function onProcessStyle(style, rule) {
        if (rule.type !== 'style') return style;
        var newStyle = {};
        var props = Object.keys(style).sort(sort);

        for (var i = 0; i < props.length; i++) {
          newStyle[props[i]] = style[props[i]];
        }

        return newStyle;
      }
    };
  }

  var create = function create(options) {
    if (options === void 0) {
      options = {};
    }

    return {
      plugins: [functionPlugin(), observablePlugin(options.observable), templatePlugin(), jssGlobal(), jssExtend(), jssNested(), jssCompose(), camelCase(), defaultUnit(options.defaultUnit), jssExpand(), jssVendorPrefixer(), jssPropsSort()]
    };
  };

  exports.default = create;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=jss-preset-default.js.map
