import { jsx as j, jsxs as C, Fragment as I } from "react/jsx-runtime";
import { MeshGradientRenderer as z, BackgroundRender as D, LyricPlayer as J } from "@applemusic-like-lyrics/core";
import { BaseRenderer as Y, MeshGradientRenderer as V, PixiRenderer as b } from "@applemusic-like-lyrics/core";
import { forwardRef as P, useRef as w, useEffect as r, useImperativeHandle as W, useState as K, useLayoutEffect as g } from "react";
import { createPortal as M } from "react-dom";
const U = P(
  ({
    album: m,
    albumIsVideo: R,
    fps: d,
    playing: o,
    flowSpeed: f,
    renderScale: p,
    staticMode: E,
    lowFreqVolume: l,
    hasLyric: a,
    renderer: v,
    style: B,
    ...L
  }, y) => {
    const n = w(null), i = w(null), h = w(null), t = v ?? z;
    return r(() => {
      (h.current !== t || n.current === void 0) && (h.current = t, n.current?.dispose(), n.current = D.new(t));
    }, [t]), r(() => {
      t && m && n.current?.setAlbum(m, R);
    }, [t, m, R]), r(() => {
      t && d && n.current?.setFPS(d);
    }, [t, d]), r(() => {
      t && (o === void 0 || o ? n.current?.resume() : n.current?.pause());
    }, [t, o]), r(() => {
      t && f && n.current?.setFlowSpeed(f);
    }, [t, f]), r(() => {
      t && n.current?.setStaticMode(E ?? !1);
    }, [t, E]), r(() => {
      t && p && n.current?.setRenderScale(p ?? 0.5);
    }, [t, p]), r(() => {
      t && l && n.current?.setLowFreqVolume(l ?? 1);
    }, [t, l]), r(() => {
      t && a !== void 0 && n.current?.setHasLyric(a ?? !0);
    }, [t, a]), r(() => {
      if (n.current) {
        const u = n.current.getElement();
        u.style.width = "100%", u.style.height = "100%", u.style.minHeight = "0", u.style.minWidth = "0", u.style.overflow = "hidden", i.current?.appendChild(u);
      }
    }, [n.current]), W(
      y,
      () => ({
        wrapperEl: i.current,
        bgRender: n.current
      }),
      [i.current, n.current]
    ), /* @__PURE__ */ j(
      "div",
      {
        style: {
          display: "contents",
          ...B
        },
        ...L,
        ref: i
      }
    );
  }
), Z = P(
  ({
    disabled: m,
    playing: R,
    alignAnchor: d,
    alignPosition: o,
    enableSpring: f,
    enableBlur: p,
    enableScale: E,
    hidePassedLines: l,
    lyricLines: a,
    currentTime: v,
    isSeeking: B,
    wordFadeWidth: L,
    linePosXSpringParams: y,
    linePosYSpringParams: n,
    lineScaleSpringParams: i,
    bottomLine: h,
    lyricPlayer: t,
    onLyricLineClick: u,
    onLyricLineContextMenu: x,
    ...$
  }, q) => {
    const [e, H] = K(), F = w(null), k = w(v);
    return g(() => {
      const s = new (t ?? J)();
      return H(s), F.current?.appendChild(s.getElement()), () => {
        s?.dispose(), H(void 0);
      };
    }, [t]), g(() => {
      a !== void 0 ? (e?.setLyricLines(a, k.current), e?.update()) : (e?.setLyricLines([]), e?.update());
    }, [e, a]), r(() => {
      if (!m) {
        let s = !1, c = -1;
        const G = (A) => {
          s || (c === -1 && (c = A), e?.update(A - c), c = A, requestAnimationFrame(G));
        };
        return e?.calcLayout(), requestAnimationFrame(G), () => {
          s = !0;
        };
      }
    }, [e, m]), r(() => {
      R !== void 0 ? R ? e?.resume() : e?.pause() : e?.resume();
    }, [e, R]), r(() => {
      d !== void 0 && e?.setAlignAnchor(d);
    }, [e, d]), r(() => {
      l !== void 0 && e?.setHidePassedLines(l);
    }, [e, l]), r(() => {
      o !== void 0 && e?.setAlignPosition(o);
    }, [e, o]), r(() => {
      f !== void 0 ? e?.setEnableSpring(f) : e?.setEnableSpring(!0);
    }, [e, f]), r(() => {
      E !== void 0 ? e?.setEnableScale(E) : e?.setEnableScale(!0);
    }, [e, E]), r(() => {
      e?.setEnableBlur(p ?? !0);
    }, [e, p]), r(() => {
      v !== void 0 ? (e?.setCurrentTime(v), k.current = v) : e?.setCurrentTime(0);
    }, [e, v]), r(() => {
      e?.setIsSeeking(!!B);
    }, [e, B]), r(() => {
      e?.setWordFadeWidth(L);
    }, [e, L]), r(() => {
      y !== void 0 && e?.setLinePosXSpringParams(y);
    }, [e, y]), r(() => {
      n !== void 0 && e?.setLinePosYSpringParams(n);
    }, [e, n]), r(() => {
      i !== void 0 && e?.setLineScaleSpringParams(i);
    }, [e, i]), r(() => {
      if (u) {
        const s = (c) => u(c);
        return e?.addEventListener("line-click", s), () => e?.removeEventListener("line-click", s);
      }
    }, [e, u]), r(() => {
      if (x) {
        const s = (c) => x(c);
        return e?.addEventListener("line-contextmenu", s), () => e?.removeEventListener("line-contextmenu", s);
      }
    }, [e, x]), W(
      q,
      () => ({
        wrapperEl: F.current,
        lyricPlayer: e
      }),
      [e]
    ), /* @__PURE__ */ C(I, { children: [
      /* @__PURE__ */ j("div", { ...$, ref: F }),
      e?.getBottomLineElement() && h ? M(h, e?.getBottomLineElement()) : null
    ] });
  }
);
export {
  U as BackgroundRender,
  Y as BaseRenderer,
  Z as LyricPlayer,
  V as MeshGradientRenderer,
  b as PixiRenderer
};
//# sourceMappingURL=amll-react.js.map
