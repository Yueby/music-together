"use client";
import { createContext as l, Component as y, createElement as d, useContext as f, useState as p, useMemo as E, forwardRef as B } from "react";
const h = l(null), c = {
  didCatch: !1,
  error: null
};
class m extends y {
  constructor(e) {
    super(e), this.resetErrorBoundary = this.resetErrorBoundary.bind(this), this.state = c;
  }
  static getDerivedStateFromError(e) {
    return { didCatch: !0, error: e };
  }
  resetErrorBoundary(...e) {
    const { error: t } = this.state;
    t !== null && (this.props.onReset?.({
      args: e,
      reason: "imperative-api"
    }), this.setState(c));
  }
  componentDidCatch(e, t) {
    this.props.onError?.(e, t);
  }
  componentDidUpdate(e, t) {
    const { didCatch: o } = this.state, { resetKeys: s } = this.props;
    o && t.error !== null && C(e.resetKeys, s) && (this.props.onReset?.({
      next: s,
      prev: e.resetKeys,
      reason: "keys"
    }), this.setState(c));
  }
  render() {
    const { children: e, fallbackRender: t, FallbackComponent: o, fallback: s } = this.props, { didCatch: n, error: a } = this.state;
    let i = e;
    if (n) {
      const u = {
        error: a,
        resetErrorBoundary: this.resetErrorBoundary
      };
      if (typeof t == "function")
        i = t(u);
      else if (o)
        i = d(o, u);
      else if (s !== void 0)
        i = s;
      else
        throw a;
    }
    return d(
      h.Provider,
      {
        value: {
          didCatch: n,
          error: a,
          resetErrorBoundary: this.resetErrorBoundary
        }
      },
      i
    );
  }
}
function C(r = [], e = []) {
  return r.length !== e.length || r.some((t, o) => !Object.is(t, e[o]));
}
function g(r) {
  return r !== null && typeof r == "object" && "didCatch" in r && typeof r.didCatch == "boolean" && "error" in r && "resetErrorBoundary" in r && typeof r.resetErrorBoundary == "function";
}
function x(r) {
  if (!g(r))
    throw new Error("ErrorBoundaryContext not found");
}
function k() {
  const r = f(h);
  x(r);
  const { error: e, resetErrorBoundary: t } = r, [o, s] = p({
    error: null,
    hasError: !1
  }), n = E(
    () => ({
      error: e,
      resetBoundary: () => {
        t(), s({ error: null, hasError: !1 });
      },
      showBoundary: (a) => s({
        error: a,
        hasError: !0
      })
    }),
    [e, t]
  );
  if (o.hasError)
    throw o.error;
  return n;
}
function S(r) {
  switch (typeof r) {
    case "object": {
      if (r !== null && "message" in r && typeof r.message == "string")
        return r.message;
      break;
    }
    case "string":
      return r;
  }
}
function w(r, e) {
  const t = B(
    (s, n) => d(
      m,
      e,
      d(r, { ...s, ref: n })
    )
  ), o = r.displayName || r.name || "Unknown";
  return t.displayName = `withErrorBoundary(${o})`, t;
}
export {
  m as ErrorBoundary,
  h as ErrorBoundaryContext,
  S as getErrorMessage,
  k as useErrorBoundary,
  w as withErrorBoundary
};
//# sourceMappingURL=react-error-boundary.js.map
