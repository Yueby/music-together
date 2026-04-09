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
  HiddenInput: () => OneTimePasswordFieldHiddenInput,
  Input: () => OneTimePasswordFieldInput,
  OneTimePasswordField: () => OneTimePasswordField,
  OneTimePasswordFieldHiddenInput: () => OneTimePasswordFieldHiddenInput,
  OneTimePasswordFieldInput: () => OneTimePasswordFieldInput,
  Root: () => OneTimePasswordField
});
module.exports = __toCommonJS(index_exports);

// src/one-time-password-field.tsx
var Primitive = __toESM(require("@radix-ui/react-primitive"));
var import_react_compose_refs = require("@radix-ui/react-compose-refs");
var import_react_use_controllable_state = require("@radix-ui/react-use-controllable-state");
var import_primitive = require("@radix-ui/primitive");
var import_react_collection = require("@radix-ui/react-collection");
var RovingFocusGroup = __toESM(require("@radix-ui/react-roving-focus"));
var import_react_roving_focus = require("@radix-ui/react-roving-focus");
var import_react_use_is_hydrated = require("@radix-ui/react-use-is-hydrated");
var React = __toESM(require("react"));
var import_react_dom = require("react-dom");
var import_react_context = require("@radix-ui/react-context");
var import_react_direction = require("@radix-ui/react-direction");
var import_number = require("@radix-ui/number");
var import_react_use_effect_event = require("@radix-ui/react-use-effect-event");
var import_jsx_runtime = require("react/jsx-runtime");
var INPUT_VALIDATION_MAP = {
  numeric: {
    type: "numeric",
    regexp: /[^\d]/g,
    pattern: "\\d{1}",
    inputMode: "numeric"
  },
  alpha: {
    type: "alpha",
    regexp: /[^a-zA-Z]/g,
    pattern: "[a-zA-Z]{1}",
    inputMode: "text"
  },
  alphanumeric: {
    type: "alphanumeric",
    regexp: /[^a-zA-Z0-9]/g,
    pattern: "[a-zA-Z0-9]{1}",
    inputMode: "text"
  },
  none: null
};
var ONE_TIME_PASSWORD_FIELD_NAME = "OneTimePasswordField";
var [Collection, { useCollection, createCollectionScope, useInitCollection }] = (0, import_react_collection.unstable_createCollection)(ONE_TIME_PASSWORD_FIELD_NAME);
var [createOneTimePasswordFieldContext] = (0, import_react_context.createContextScope)(ONE_TIME_PASSWORD_FIELD_NAME, [
  createCollectionScope,
  import_react_roving_focus.createRovingFocusGroupScope
]);
var useRovingFocusGroupScope = (0, import_react_roving_focus.createRovingFocusGroupScope)();
var [OneTimePasswordFieldContext, useOneTimePasswordFieldContext] = createOneTimePasswordFieldContext(ONE_TIME_PASSWORD_FIELD_NAME);
var OneTimePasswordField = React.forwardRef(
  function OneTimePasswordFieldImpl({
    __scopeOneTimePasswordField,
    defaultValue,
    value: valueProp,
    onValueChange,
    autoSubmit = false,
    children,
    onPaste,
    onAutoSubmit,
    disabled = false,
    readOnly = false,
    autoComplete = "one-time-code",
    autoFocus = false,
    form,
    name,
    placeholder,
    type = "text",
    // TODO: Change default to vertical when inputs use vertical writing mode
    orientation = "horizontal",
    dir,
    validationType = "numeric",
    sanitizeValue: sanitizeValueProp,
    ...domProps
  }, forwardedRef) {
    const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeOneTimePasswordField);
    const direction = (0, import_react_direction.useDirection)(dir);
    const collectionState = useInitCollection();
    const [collection] = collectionState;
    const validation = INPUT_VALIDATION_MAP[validationType] ? INPUT_VALIDATION_MAP[validationType] : null;
    const sanitizeValue = React.useCallback(
      (value2) => {
        if (Array.isArray(value2)) {
          value2 = value2.map(removeWhitespace).join("");
        } else {
          value2 = removeWhitespace(value2);
        }
        if (validation) {
          const regexp = new RegExp(validation.regexp);
          value2 = value2.replace(regexp, "");
        } else if (sanitizeValueProp) {
          value2 = sanitizeValueProp(value2);
        }
        return value2.split("");
      },
      [validation, sanitizeValueProp]
    );
    const controlledValue = React.useMemo(() => {
      return valueProp != null ? sanitizeValue(valueProp) : void 0;
    }, [valueProp, sanitizeValue]);
    const [value, setValue] = (0, import_react_use_controllable_state.useControllableState)({
      caller: "OneTimePasswordField",
      prop: controlledValue,
      defaultProp: defaultValue != null ? sanitizeValue(defaultValue) : [],
      onChange: React.useCallback(
        (value2) => onValueChange?.(value2.join("")),
        [onValueChange]
      )
    });
    const dispatch = (0, import_react_use_effect_event.useEffectEvent)((action) => {
      switch (action.type) {
        case "SET_CHAR": {
          const { index, char } = action;
          const currentTarget = collection.at(index)?.element;
          if (value[index] === char) {
            const next = currentTarget && collection.from(currentTarget, 1)?.element;
            focusInput(next);
            return;
          }
          if (char === "") {
            return;
          }
          if (validation) {
            const regexp = new RegExp(validation.regexp);
            const clean = char.replace(regexp, "");
            if (clean !== char) {
              return;
            }
          }
          if (value.length >= collection.size) {
            const newValue2 = [...value];
            newValue2[index] = char;
            (0, import_react_dom.flushSync)(() => setValue(newValue2));
            const next = currentTarget && collection.from(currentTarget, 1)?.element;
            focusInput(next);
            return;
          }
          const newValue = [...value];
          newValue[index] = char;
          const lastElement = collection.at(-1)?.element;
          (0, import_react_dom.flushSync)(() => setValue(newValue));
          if (currentTarget !== lastElement) {
            const next = currentTarget && collection.from(currentTarget, 1)?.element;
            focusInput(next);
          } else {
            currentTarget?.select();
          }
          return;
        }
        case "CLEAR_CHAR": {
          const { index, reason } = action;
          if (!value[index]) {
            return;
          }
          const newValue = value.filter((_, i) => i !== index);
          const currentTarget = collection.at(index)?.element;
          const previous = currentTarget && collection.from(currentTarget, -1)?.element;
          (0, import_react_dom.flushSync)(() => setValue(newValue));
          if (reason === "Backspace") {
            focusInput(previous);
          } else if (reason === "Delete" || reason === "Cut") {
            focusInput(currentTarget);
          }
          return;
        }
        case "CLEAR": {
          if (value.length === 0) {
            return;
          }
          if (action.reason === "Backspace" || action.reason === "Delete") {
            (0, import_react_dom.flushSync)(() => setValue([]));
            focusInput(collection.at(0)?.element);
          } else {
            setValue([]);
          }
          return;
        }
        case "PASTE": {
          const { value: pastedValue } = action;
          const value2 = sanitizeValue(pastedValue);
          if (!value2) {
            return;
          }
          (0, import_react_dom.flushSync)(() => setValue(value2));
          focusInput(collection.at(value2.length - 1)?.element);
          return;
        }
      }
    });
    const validationTypeRef = React.useRef(validation);
    React.useEffect(() => {
      if (!validation) {
        return;
      }
      if (validationTypeRef.current?.type !== validation.type) {
        validationTypeRef.current = validation;
        setValue(sanitizeValue(value.join("")));
      }
    }, [sanitizeValue, setValue, validation, value]);
    const hiddenInputRef = React.useRef(null);
    const userActionRef = React.useRef(null);
    const rootRef = React.useRef(null);
    const composedRefs = (0, import_react_compose_refs.useComposedRefs)(forwardedRef, rootRef);
    const firstInput = collection.at(0)?.element;
    const locateForm = React.useCallback(() => {
      let formElement;
      if (form) {
        const associatedElement = (rootRef.current?.ownerDocument ?? document).getElementById(form);
        if (isFormElement(associatedElement)) {
          formElement = associatedElement;
        }
      } else if (hiddenInputRef.current) {
        formElement = hiddenInputRef.current.form;
      } else if (firstInput) {
        formElement = firstInput.form;
      }
      return formElement ?? null;
    }, [form, firstInput]);
    const attemptSubmit = React.useCallback(() => {
      const formElement = locateForm();
      formElement?.requestSubmit();
    }, [locateForm]);
    React.useEffect(() => {
      const form2 = locateForm();
      if (form2) {
        const reset = () => dispatch({ type: "CLEAR", reason: "Reset" });
        form2.addEventListener("reset", reset);
        return () => form2.removeEventListener("reset", reset);
      }
    }, [dispatch, locateForm]);
    const currentValue = value.join("");
    const valueRef = React.useRef(currentValue);
    const length = collection.size;
    React.useEffect(() => {
      const previousValue = valueRef.current;
      valueRef.current = currentValue;
      if (previousValue === currentValue) {
        return;
      }
      if (autoSubmit && value.every((char) => char !== "") && value.length === length) {
        onAutoSubmit?.(value.join(""));
        attemptSubmit();
      }
    }, [attemptSubmit, autoSubmit, currentValue, length, onAutoSubmit, value]);
    const isHydrated = (0, import_react_use_is_hydrated.useIsHydrated)();
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      OneTimePasswordFieldContext,
      {
        scope: __scopeOneTimePasswordField,
        value,
        attemptSubmit,
        disabled,
        readOnly,
        autoComplete,
        autoFocus,
        form,
        name,
        placeholder,
        type,
        hiddenInputRef,
        userActionRef,
        dispatch,
        validationType,
        orientation,
        isHydrated,
        sanitizeValue,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Collection.Provider, { scope: __scopeOneTimePasswordField, state: collectionState, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Collection.Slot, { scope: __scopeOneTimePasswordField, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          RovingFocusGroup.Root,
          {
            asChild: true,
            ...rovingFocusGroupScope,
            orientation,
            dir: direction,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              Primitive.Root.div,
              {
                ...domProps,
                role: "group",
                ref: composedRefs,
                onPaste: (0, import_primitive.composeEventHandlers)(
                  onPaste,
                  (event) => {
                    event.preventDefault();
                    const pastedValue = event.clipboardData.getData("Text");
                    dispatch({ type: "PASTE", value: pastedValue });
                  }
                ),
                children
              }
            )
          }
        ) }) })
      }
    );
  }
);
var OneTimePasswordFieldHiddenInput = React.forwardRef(function OneTimePasswordFieldHiddenInput2({ __scopeOneTimePasswordField, ...props }, forwardedRef) {
  const { value, hiddenInputRef, name } = useOneTimePasswordFieldContext(
    "OneTimePasswordFieldHiddenInput",
    __scopeOneTimePasswordField
  );
  const ref = (0, import_react_compose_refs.useComposedRefs)(hiddenInputRef, forwardedRef);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "input",
    {
      ref,
      name,
      value: value.join("").trim(),
      autoComplete: "off",
      autoFocus: false,
      autoCapitalize: "off",
      autoCorrect: "off",
      autoSave: "off",
      spellCheck: false,
      ...props,
      type: "hidden",
      readOnly: true
    }
  );
});
var OneTimePasswordFieldInput = React.forwardRef(function OneTimePasswordFieldInput2({
  __scopeOneTimePasswordField,
  onInvalidChange,
  index: indexProp,
  ...props
}, forwardedRef) {
  const {
    value: _value,
    defaultValue: _defaultValue,
    disabled: _disabled,
    readOnly: _readOnly,
    autoComplete: _autoComplete,
    autoFocus: _autoFocus,
    form: _form,
    name: _name,
    placeholder: _placeholder,
    type: _type,
    ...domProps
  } = props;
  const context = useOneTimePasswordFieldContext(
    "OneTimePasswordFieldInput",
    __scopeOneTimePasswordField
  );
  const { dispatch, userActionRef, validationType, isHydrated, disabled } = context;
  const collection = useCollection(__scopeOneTimePasswordField);
  const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeOneTimePasswordField);
  const inputRef = React.useRef(null);
  const [element, setElement] = React.useState(null);
  const index = indexProp ?? (element ? collection.indexOf(element) : -1);
  const canSetPlaceholder = indexProp != null || isHydrated;
  let placeholder;
  if (canSetPlaceholder && context.placeholder && context.value.length === 0) {
    placeholder = context.placeholder[index];
  }
  const composedInputRef = (0, import_react_compose_refs.useComposedRefs)(forwardedRef, inputRef, setElement);
  const char = context.value[index] ?? "";
  const keyboardActionTimeoutRef = React.useRef(null);
  React.useEffect(() => {
    return () => {
      window.clearTimeout(keyboardActionTimeoutRef.current);
    };
  }, []);
  const totalValue = context.value.join("").trim();
  const lastSelectableIndex = (0, import_number.clamp)(totalValue.length, [0, collection.size - 1]);
  const isFocusable = index <= lastSelectableIndex;
  const validation = validationType in INPUT_VALIDATION_MAP ? INPUT_VALIDATION_MAP[validationType] : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Collection.ItemSlot, { scope: __scopeOneTimePasswordField, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    RovingFocusGroup.Item,
    {
      ...rovingFocusGroupScope,
      asChild: true,
      focusable: !context.disabled && isFocusable,
      active: index === lastSelectableIndex,
      children: ({ hasTabStop, isCurrentTabStop }) => {
        const supportsAutoComplete = hasTabStop ? isCurrentTabStop : index === 0;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          Primitive.Root.input,
          {
            ref: composedInputRef,
            type: context.type,
            disabled,
            "aria-label": `Character ${index + 1} of ${collection.size}`,
            autoComplete: supportsAutoComplete ? context.autoComplete : "off",
            "data-1p-ignore": supportsAutoComplete ? void 0 : "true",
            "data-lpignore": supportsAutoComplete ? void 0 : "true",
            "data-protonpass-ignore": supportsAutoComplete ? void 0 : "true",
            "data-bwignore": supportsAutoComplete ? void 0 : "true",
            inputMode: validation?.inputMode,
            maxLength: 1,
            pattern: validation?.pattern,
            readOnly: context.readOnly,
            value: char,
            placeholder,
            "data-radix-otp-input": "",
            "data-radix-index": index,
            ...domProps,
            onFocus: (0, import_primitive.composeEventHandlers)(props.onFocus, (event) => {
              event.currentTarget.select();
            }),
            onCut: (0, import_primitive.composeEventHandlers)(props.onCut, (event) => {
              const currentValue = event.currentTarget.value;
              if (currentValue !== "") {
                userActionRef.current = {
                  type: "cut"
                };
                keyboardActionTimeoutRef.current = window.setTimeout(() => {
                  userActionRef.current = null;
                }, 10);
              }
            }),
            onInput: (0, import_primitive.composeEventHandlers)(props.onInput, (event) => {
              const value = event.currentTarget.value;
              if (value.length > 1) {
                event.preventDefault();
                dispatch({ type: "PASTE", value });
              }
            }),
            onChange: (0, import_primitive.composeEventHandlers)(props.onChange, (event) => {
              const value = event.target.value;
              event.preventDefault();
              const action = userActionRef.current;
              userActionRef.current = null;
              if (action) {
                switch (action.type) {
                  case "cut":
                    dispatch({ type: "CLEAR_CHAR", index, reason: "Cut" });
                    return;
                  case "keydown": {
                    if (action.key === "Char") {
                      return;
                    }
                    const isClearing = action.key === "Backspace" && (action.metaKey || action.ctrlKey);
                    if (action.key === "Clear" || isClearing) {
                      dispatch({ type: "CLEAR", reason: "Backspace" });
                    } else {
                      dispatch({ type: "CLEAR_CHAR", index, reason: action.key });
                    }
                    return;
                  }
                  default:
                    return;
                }
              }
              if (event.target.validity.valid) {
                if (value === "") {
                  let reason = "Backspace";
                  if (isInputEvent(event.nativeEvent)) {
                    const inputType = event.nativeEvent.inputType;
                    if (inputType === "deleteContentBackward") {
                      reason = "Backspace";
                    } else if (inputType === "deleteByCut") {
                      reason = "Cut";
                    }
                  }
                  dispatch({ type: "CLEAR_CHAR", index, reason });
                } else {
                  dispatch({ type: "SET_CHAR", char: value, index, event });
                }
              } else {
                const element2 = event.target;
                onInvalidChange?.(element2.value);
                requestAnimationFrame(() => {
                  if (element2.ownerDocument.activeElement === element2) {
                    element2.select();
                  }
                });
              }
            }),
            onKeyDown: (0, import_primitive.composeEventHandlers)(props.onKeyDown, (event) => {
              switch (event.key) {
                case "Clear":
                case "Delete":
                case "Backspace": {
                  const currentValue = event.currentTarget.value;
                  if (currentValue === "") {
                    if (event.key === "Delete") return;
                    const isClearing = event.key === "Clear" || event.metaKey || event.ctrlKey;
                    if (isClearing) {
                      dispatch({ type: "CLEAR", reason: "Backspace" });
                    } else {
                      const element2 = event.currentTarget;
                      requestAnimationFrame(() => {
                        focusInput(collection.from(element2, -1)?.element);
                      });
                    }
                  } else {
                    userActionRef.current = {
                      type: "keydown",
                      key: event.key,
                      metaKey: event.metaKey,
                      ctrlKey: event.ctrlKey
                    };
                    keyboardActionTimeoutRef.current = window.setTimeout(() => {
                      userActionRef.current = null;
                    }, 10);
                  }
                  return;
                }
                case "Enter": {
                  event.preventDefault();
                  context.attemptSubmit();
                  return;
                }
                case "ArrowDown":
                case "ArrowUp": {
                  if (context.orientation === "horizontal") {
                    event.preventDefault();
                  }
                  return;
                }
                // TODO: Handle left/right arrow keys in vertical writing mode
                default: {
                  if (event.currentTarget.value === event.key) {
                    const element2 = event.currentTarget;
                    event.preventDefault();
                    focusInput(collection.from(element2, 1)?.element);
                    return;
                  } else if (
                    // input already has a value, but...
                    event.currentTarget.value && // the value is not selected
                    !(event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd != null && event.currentTarget.selectionEnd > 0)
                  ) {
                    const attemptedValue = event.key;
                    if (event.key.length > 1 || event.key === " ") {
                      return;
                    } else {
                      const nextInput = collection.from(event.currentTarget, 1)?.element;
                      const lastInput = collection.at(-1)?.element;
                      if (nextInput !== lastInput && event.currentTarget !== lastInput) {
                        if (event.currentTarget.selectionStart === 0) {
                          dispatch({ type: "SET_CHAR", char: attemptedValue, index, event });
                        } else {
                          dispatch({
                            type: "SET_CHAR",
                            char: attemptedValue,
                            index: index + 1,
                            event
                          });
                        }
                        userActionRef.current = {
                          type: "keydown",
                          key: "Char",
                          metaKey: event.metaKey,
                          ctrlKey: event.ctrlKey
                        };
                        keyboardActionTimeoutRef.current = window.setTimeout(() => {
                          userActionRef.current = null;
                        }, 10);
                      }
                    }
                  }
                }
              }
            }),
            onPointerDown: (0, import_primitive.composeEventHandlers)(props.onPointerDown, (event) => {
              event.preventDefault();
              const indexToFocus = Math.min(index, lastSelectableIndex);
              const element2 = collection.at(indexToFocus)?.element;
              focusInput(element2);
            })
          }
        );
      }
    }
  ) });
});
function isFormElement(element) {
  return element?.tagName === "FORM";
}
function removeWhitespace(value) {
  return value.replace(/\s/g, "");
}
function focusInput(element) {
  if (!element) return;
  if (element.ownerDocument.activeElement === element) {
    window.requestAnimationFrame(() => {
      element.select?.();
    });
  } else {
    element.focus();
  }
}
function isInputEvent(event) {
  return event.type === "input";
}
//# sourceMappingURL=index.js.map
