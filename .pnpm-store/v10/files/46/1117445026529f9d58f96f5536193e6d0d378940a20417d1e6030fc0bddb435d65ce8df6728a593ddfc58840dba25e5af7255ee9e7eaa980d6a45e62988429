"use client";

// src/one-time-password-field.tsx
import * as Primitive from "@radix-ui/react-primitive";
import { useComposedRefs } from "@radix-ui/react-compose-refs";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { composeEventHandlers } from "@radix-ui/primitive";
import { unstable_createCollection as createCollection } from "@radix-ui/react-collection";
import * as RovingFocusGroup from "@radix-ui/react-roving-focus";
import { createRovingFocusGroupScope } from "@radix-ui/react-roving-focus";
import { useIsHydrated } from "@radix-ui/react-use-is-hydrated";
import * as React from "react";
import { flushSync } from "react-dom";
import { createContextScope } from "@radix-ui/react-context";
import { useDirection } from "@radix-ui/react-direction";
import { clamp } from "@radix-ui/number";
import { useEffectEvent } from "@radix-ui/react-use-effect-event";
import { jsx } from "react/jsx-runtime";
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
var [Collection, { useCollection, createCollectionScope, useInitCollection }] = createCollection(ONE_TIME_PASSWORD_FIELD_NAME);
var [createOneTimePasswordFieldContext] = createContextScope(ONE_TIME_PASSWORD_FIELD_NAME, [
  createCollectionScope,
  createRovingFocusGroupScope
]);
var useRovingFocusGroupScope = createRovingFocusGroupScope();
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
    const direction = useDirection(dir);
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
    const [value, setValue] = useControllableState({
      caller: "OneTimePasswordField",
      prop: controlledValue,
      defaultProp: defaultValue != null ? sanitizeValue(defaultValue) : [],
      onChange: React.useCallback(
        (value2) => onValueChange?.(value2.join("")),
        [onValueChange]
      )
    });
    const dispatch = useEffectEvent((action) => {
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
            flushSync(() => setValue(newValue2));
            const next = currentTarget && collection.from(currentTarget, 1)?.element;
            focusInput(next);
            return;
          }
          const newValue = [...value];
          newValue[index] = char;
          const lastElement = collection.at(-1)?.element;
          flushSync(() => setValue(newValue));
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
          flushSync(() => setValue(newValue));
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
            flushSync(() => setValue([]));
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
          flushSync(() => setValue(value2));
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
    const composedRefs = useComposedRefs(forwardedRef, rootRef);
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
    const isHydrated = useIsHydrated();
    return /* @__PURE__ */ jsx(
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
        children: /* @__PURE__ */ jsx(Collection.Provider, { scope: __scopeOneTimePasswordField, state: collectionState, children: /* @__PURE__ */ jsx(Collection.Slot, { scope: __scopeOneTimePasswordField, children: /* @__PURE__ */ jsx(
          RovingFocusGroup.Root,
          {
            asChild: true,
            ...rovingFocusGroupScope,
            orientation,
            dir: direction,
            children: /* @__PURE__ */ jsx(
              Primitive.Root.div,
              {
                ...domProps,
                role: "group",
                ref: composedRefs,
                onPaste: composeEventHandlers(
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
  const ref = useComposedRefs(hiddenInputRef, forwardedRef);
  return /* @__PURE__ */ jsx(
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
  const composedInputRef = useComposedRefs(forwardedRef, inputRef, setElement);
  const char = context.value[index] ?? "";
  const keyboardActionTimeoutRef = React.useRef(null);
  React.useEffect(() => {
    return () => {
      window.clearTimeout(keyboardActionTimeoutRef.current);
    };
  }, []);
  const totalValue = context.value.join("").trim();
  const lastSelectableIndex = clamp(totalValue.length, [0, collection.size - 1]);
  const isFocusable = index <= lastSelectableIndex;
  const validation = validationType in INPUT_VALIDATION_MAP ? INPUT_VALIDATION_MAP[validationType] : void 0;
  return /* @__PURE__ */ jsx(Collection.ItemSlot, { scope: __scopeOneTimePasswordField, children: /* @__PURE__ */ jsx(
    RovingFocusGroup.Item,
    {
      ...rovingFocusGroupScope,
      asChild: true,
      focusable: !context.disabled && isFocusable,
      active: index === lastSelectableIndex,
      children: ({ hasTabStop, isCurrentTabStop }) => {
        const supportsAutoComplete = hasTabStop ? isCurrentTabStop : index === 0;
        return /* @__PURE__ */ jsx(
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
            onFocus: composeEventHandlers(props.onFocus, (event) => {
              event.currentTarget.select();
            }),
            onCut: composeEventHandlers(props.onCut, (event) => {
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
            onInput: composeEventHandlers(props.onInput, (event) => {
              const value = event.currentTarget.value;
              if (value.length > 1) {
                event.preventDefault();
                dispatch({ type: "PASTE", value });
              }
            }),
            onChange: composeEventHandlers(props.onChange, (event) => {
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
            onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
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
            onPointerDown: composeEventHandlers(props.onPointerDown, (event) => {
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
export {
  OneTimePasswordFieldHiddenInput as HiddenInput,
  OneTimePasswordFieldInput as Input,
  OneTimePasswordField,
  OneTimePasswordFieldHiddenInput,
  OneTimePasswordFieldInput,
  OneTimePasswordField as Root
};
//# sourceMappingURL=index.mjs.map
