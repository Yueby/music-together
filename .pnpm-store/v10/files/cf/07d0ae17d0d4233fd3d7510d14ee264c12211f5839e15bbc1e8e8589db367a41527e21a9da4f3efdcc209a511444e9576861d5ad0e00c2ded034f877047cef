"use client";

// src/password-toggle-field.tsx
import * as React from "react";
import { flushSync } from "react-dom";
import { composeEventHandlers } from "@radix-ui/primitive";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { Primitive } from "@radix-ui/react-primitive";
import { useComposedRefs } from "@radix-ui/react-compose-refs";
import { useId } from "@radix-ui/react-id";
import { useIsHydrated } from "@radix-ui/react-use-is-hydrated";
import { useEffectEvent } from "@radix-ui/react-use-effect-event";
import { createContextScope } from "@radix-ui/react-context";
import { jsx } from "react/jsx-runtime";
var PASSWORD_TOGGLE_FIELD_NAME = "PasswordToggleField";
var [createPasswordToggleFieldContext] = createContextScope(PASSWORD_TOGGLE_FIELD_NAME);
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
  const baseId = useId(props.id);
  const defaultInputId = `${baseId}-input`;
  const [inputIdState, setInputIdState] = React.useState(defaultInputId);
  const inputId = inputIdState ?? defaultInputId;
  const syncInputId = React.useCallback(
    (providedId) => setInputIdState(providedId != null ? String(providedId) : null),
    []
  );
  const { visible: visibleProp, defaultVisible, onVisiblityChange, children } = props;
  const [visible = false, setVisible] = useControllableState({
    caller: PASSWORD_TOGGLE_FIELD_NAME,
    prop: visibleProp,
    defaultProp: defaultVisible ?? false,
    onChange: onVisiblityChange
  });
  const inputRef = React.useRef(null);
  const focusState = React.useRef(INITIAL_FOCUS_STATE);
  return /* @__PURE__ */ jsx(
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
    const _setVisible = useEffectEvent(setVisible);
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
    return /* @__PURE__ */ jsx(
      Primitive.input,
      {
        ...props,
        id: idProp ?? inputId,
        autoCapitalize,
        autoComplete,
        ref: useComposedRefs(forwardedRef, inputRef),
        spellCheck,
        type: visible ? "text" : "password",
        onBlur: composeEventHandlers(props.onBlur, (event) => {
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
    const ref = useComposedRefs(forwardedRef, elementRef);
    const isHydrated = useIsHydrated();
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
    return /* @__PURE__ */ jsx(
      Primitive.button,
      {
        "aria-controls": ariaControls,
        "aria-hidden": ariaHidden,
        "aria-label": ariaLabel,
        ref,
        id: inputId,
        ...props,
        onPointerDown: composeEventHandlers(onPointerDown, () => {
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
          flushSync(() => {
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
    return /* @__PURE__ */ jsx(Primitive.svg, { ...domProps, ref: forwardedRef, "aria-hidden": true, asChild: true, children: visible ? visibleIcon : hiddenIcon });
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
export {
  PasswordToggleFieldIcon as Icon,
  PasswordToggleFieldInput as Input,
  PasswordToggleField,
  PasswordToggleFieldIcon,
  PasswordToggleFieldInput,
  PasswordToggleFieldSlot,
  PasswordToggleFieldToggle,
  PasswordToggleField as Root,
  PasswordToggleFieldSlot as Slot,
  PasswordToggleFieldToggle as Toggle
};
//# sourceMappingURL=index.mjs.map
