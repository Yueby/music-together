"use strict";
"use client";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Icon: () => PasswordToggleFieldIcon,
  Input: () => PasswordToggleFieldInput,
  PasswordToggleField: () => PasswordToggleField,
  PasswordToggleFieldIcon: () => PasswordToggleFieldIcon,
  PasswordToggleFieldInput: () => PasswordToggleFieldInput,
  PasswordToggleFieldSlot: () => PasswordToggleFieldSlot,
  PasswordToggleFieldToggle: () => PasswordToggleFieldToggle,
  Root: () => PasswordToggleField,
  Slot: () => PasswordToggleFieldSlot,
  Toggle: () => PasswordToggleFieldToggle
});
module.exports = __toCommonJS(index_exports);

// src/password-toggle-field.tsx
var React = __toESM(require("react"));
var import_react_dom = require("react-dom");
var import_primitive = require("@radix-ui/primitive");
var import_react_use_controllable_state = require("@radix-ui/react-use-controllable-state");
var import_react_primitive = require("@radix-ui/react-primitive");
var import_react_compose_refs = require("@radix-ui/react-compose-refs");
var import_react_id = require("@radix-ui/react-id");
var import_react_use_is_hydrated = require("@radix-ui/react-use-is-hydrated");
var import_react_use_effect_event = require("@radix-ui/react-use-effect-event");
var import_react_context = require("@radix-ui/react-context");
var import_jsx_runtime = require("react/jsx-runtime");
var PASSWORD_TOGGLE_FIELD_NAME = "PasswordToggleField";
var [createPasswordToggleFieldContext] = (0, import_react_context.createContextScope)(PASSWORD_TOGGLE_FIELD_NAME);
var [PasswordToggleFieldProvider, usePasswordToggleFieldContext] = createPasswordToggleFieldContext(PASSWORD_TOGGLE_FIELD_NAME);
var INITIAL_FOCUS_STATE = {
  clickTriggered: false,
  selectionStart: null,
  selectionEnd: null
};
var PasswordToggleField = ({
  __scopePasswordToggleField,
  ...props
}) => {
  const baseId = (0, import_react_id.useId)(props.id);
  const defaultInputId = `${baseId}-input`;
  const [inputIdState, setInputIdState] = React.useState(defaultInputId);
  const inputId = inputIdState ?? defaultInputId;
  const syncInputId = React.useCallback(
    (providedId) => setInputIdState(providedId != null ? String(providedId) : null),
    []
  );
  const { visible: visibleProp, defaultVisible, onVisiblityChange, children } = props;
  const [visible = false, setVisible] = (0, import_react_use_controllable_state.useControllableState)({
    caller: PASSWORD_TOGGLE_FIELD_NAME,
    prop: visibleProp,
    defaultProp: defaultVisible ?? false,
    onChange: onVisiblityChange
  });
  const inputRef = React.useRef(null);
  const focusState = React.useRef(INITIAL_FOCUS_STATE);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    PasswordToggleFieldProvider,
    {
      scope: __scopePasswordToggleField,
      inputId,
      inputRef,
      setVisible,
      syncInputId,
      visible,
      focusState,
      children
    }
  );
};
PasswordToggleField.displayName = PASSWORD_TOGGLE_FIELD_NAME;
var PASSWORD_TOGGLE_FIELD_INPUT_NAME = PASSWORD_TOGGLE_FIELD_NAME + "Input";
var PasswordToggleFieldInput = React.forwardRef(
  ({
    __scopePasswordToggleField,
    autoComplete = "current-password",
    autoCapitalize = "off",
    spellCheck = false,
    id: idProp,
    ...props
  }, forwardedRef) => {
    const { visible, inputRef, inputId, syncInputId, setVisible, focusState } = usePasswordToggleFieldContext(PASSWORD_TOGGLE_FIELD_INPUT_NAME, __scopePasswordToggleField);
    React.useEffect(() => {
      syncInputId(idProp);
    }, [idProp, syncInputId]);
    const _setVisible = (0, import_react_use_effect_event.useEffectEvent)(setVisible);
    React.useEffect(() => {
      const inputElement = inputRef.current;
      const form = inputElement?.form;
      if (!form) {
        return;
      }
      const controller = new AbortController();
      form.addEventListener(
        "reset",
        (event) => {
          if (!event.defaultPrevented) {
            _setVisible(false);
          }
        },
        { signal: controller.signal }
      );
      form.addEventListener(
        "submit",
        () => {
          _setVisible(false);
        },
        { signal: controller.signal }
      );
      return () => {
        controller.abort();
      };
    }, [inputRef, _setVisible]);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_react_primitive.Primitive.input,
      {
        ...props,
        id: idProp ?? inputId,
        autoCapitalize,
        autoComplete,
        ref: (0, import_react_compose_refs.useComposedRefs)(forwardedRef, inputRef),
        spellCheck,
        type: visible ? "text" : "password",
        onBlur: (0, import_primitive.composeEventHandlers)(props.onBlur, (event) => {
          const { selectionStart, selectionEnd } = event.currentTarget;
          focusState.current.selectionStart = selectionStart;
          focusState.current.selectionEnd = selectionEnd;
        })
      }
    );
  }
);
PasswordToggleFieldInput.displayName = PASSWORD_TOGGLE_FIELD_INPUT_NAME;
var PASSWORD_TOGGLE_FIELD_TOGGLE_NAME = PASSWORD_TOGGLE_FIELD_NAME + "Toggle";
var PasswordToggleFieldToggle = React.forwardRef(
  ({
    __scopePasswordToggleField,
    onClick,
    onPointerDown,
    onPointerCancel,
    onPointerUp,
    onFocus,
    children,
    "aria-label": ariaLabelProp,
    "aria-controls": ariaControls,
    "aria-hidden": ariaHidden,
    tabIndex,
    ...props
  }, forwardedRef) => {
    const { setVisible, visible, inputRef, inputId, focusState } = usePasswordToggleFieldContext(
      PASSWORD_TOGGLE_FIELD_TOGGLE_NAME,
      __scopePasswordToggleField
    );
    const [internalAriaLabel, setInternalAriaLabel] = React.useState(void 0);
    const elementRef = React.useRef(null);
    const ref = (0, import_react_compose_refs.useComposedRefs)(forwardedRef, elementRef);
    const isHydrated = (0, import_react_use_is_hydrated.useIsHydrated)();
    React.useEffect(() => {
      const element = elementRef.current;
      if (!element || ariaLabelProp) {
        setInternalAriaLabel(void 0);
        return;
      }
      const DEFAULT_ARIA_LABEL = visible ? "Hide password" : "Show password";
      function checkForInnerTextLabel(textContent) {
        const text = textContent ? textContent : void 0;
        setInternalAriaLabel(text ? void 0 : DEFAULT_ARIA_LABEL);
      }
      checkForInnerTextLabel(element.textContent);
      const observer = new MutationObserver((entries) => {
        let textContent;
        for (const entry of entries) {
          if (entry.type === "characterData") {
            if (element.textContent) {
              textContent = element.textContent;
            }
          }
        }
        checkForInnerTextLabel(textContent);
      });
      observer.observe(element, { characterData: true, subtree: true });
      return () => {
        observer.disconnect();
      };
    }, [visible, ariaLabelProp]);
    const ariaLabel = ariaLabelProp || internalAriaLabel;
    if (!isHydrated) {
      ariaHidden ??= true;
      tabIndex ??= -1;
    } else {
      ariaControls ??= inputId;
    }
    React.useEffect(() => {
      let cleanup = () => {
      };
      const ownerWindow = elementRef.current?.ownerDocument?.defaultView || window;
      const reset = () => focusState.current.clickTriggered = false;
      const handlePointerUp = () => cleanup = requestIdleCallback(ownerWindow, reset);
      ownerWindow.addEventListener("pointerup", handlePointerUp);
      return () => {
        cleanup();
        ownerWindow.removeEventListener("pointerup", handlePointerUp);
      };
    }, [focusState]);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_react_primitive.Primitive.button,
      {
        "aria-controls": ariaControls,
        "aria-hidden": ariaHidden,
        "aria-label": ariaLabel,
        ref,
        id: inputId,
        ...props,
        onPointerDown: (0, import_primitive.composeEventHandlers)(onPointerDown, () => {
          focusState.current.clickTriggered = true;
        }),
        onPointerCancel: (event) => {
          onPointerCancel?.(event);
          focusState.current = INITIAL_FOCUS_STATE;
        },
        onClick: (event) => {
          onClick?.(event);
          if (event.defaultPrevented) {
            focusState.current = INITIAL_FOCUS_STATE;
            return;
          }
          (0, import_react_dom.flushSync)(() => {
            setVisible((s) => !s);
          });
          if (focusState.current.clickTriggered) {
            const input = inputRef.current;
            if (input) {
              const { selectionStart, selectionEnd } = focusState.current;
              input.focus();
              if (selectionStart !== null || selectionEnd !== null) {
                requestAnimationFrame(() => {
                  if (input.ownerDocument.activeElement === input) {
                    input.selectionStart = selectionStart;
                    input.selectionEnd = selectionEnd;
                  }
                });
              }
            }
          }
          focusState.current = INITIAL_FOCUS_STATE;
        },
        onPointerUp: (event) => {
          onPointerUp?.(event);
          setTimeout(() => {
            focusState.current = INITIAL_FOCUS_STATE;
          }, 50);
        },
        type: "button",
        children
      }
    );
  }
);
PasswordToggleFieldToggle.displayName = PASSWORD_TOGGLE_FIELD_TOGGLE_NAME;
var PASSWORD_TOGGLE_FIELD_SLOT_NAME = PASSWORD_TOGGLE_FIELD_NAME + "Slot";
var PasswordToggleFieldSlot = ({
  __scopePasswordToggleField,
  ...props
}) => {
  const { visible } = usePasswordToggleFieldContext(
    PASSWORD_TOGGLE_FIELD_SLOT_NAME,
    __scopePasswordToggleField
  );
  return "render" in props ? (
    //
    props.render({ visible })
  ) : visible ? props.visible : props.hidden;
};
PasswordToggleFieldSlot.displayName = PASSWORD_TOGGLE_FIELD_SLOT_NAME;
var PASSWORD_TOGGLE_FIELD_ICON_NAME = PASSWORD_TOGGLE_FIELD_NAME + "Icon";
var PasswordToggleFieldIcon = React.forwardRef(
  ({
    __scopePasswordToggleField,
    // @ts-expect-error
    children,
    ...props
  }, forwardedRef) => {
    const { visible } = usePasswordToggleFieldContext(
      PASSWORD_TOGGLE_FIELD_ICON_NAME,
      __scopePasswordToggleField
    );
    const { visible: visibleIcon, hidden: hiddenIcon, ...domProps } = props;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_primitive.Primitive.svg, { ...domProps, ref: forwardedRef, "aria-hidden": true, asChild: true, children: visible ? visibleIcon : hiddenIcon });
  }
);
PasswordToggleFieldIcon.displayName = PASSWORD_TOGGLE_FIELD_ICON_NAME;
function requestIdleCallback(window2, callback, options) {
  if (window2.requestIdleCallback) {
    const id2 = window2.requestIdleCallback(callback, options);
    return () => {
      window2.cancelIdleCallback(id2);
    };
  }
  const start = Date.now();
  const id = window2.setTimeout(() => {
    const timeRemaining = () => Math.max(0, 50 - (Date.now() - start));
    callback({ didTimeout: false, timeRemaining });
  }, 1);
  return () => {
    window2.clearTimeout(id);
  };
}
//# sourceMappingURL=index.js.map
