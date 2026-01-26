import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ShiftMode = "off" | "once" | "lock";

type Direction = "center" | "up" | "down" | "left" | "right";

export type KeyboardApi = {
  insert: (text: string) => void;
  /** return true if replaced, false if caller should insert normally */
  replacePrevAtom: (text: string) => boolean;
  backspace: () => void;
  moveLeft: () => void;
  moveRight: () => void;
  enterStructure: () => void;
  exitStructure: () => void;
  insertStructure: (type: string) => void;
};

type Props = {
  api: KeyboardApi;
};

type T9KeyId =
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9";

type T9Def = {
  id: T9KeyId;
  letters: string[]; // 0..4
  digit: string;
};

const LONG_PRESS_MS = 300;
const MULTI_TAP_MS = 650;
const DIRECTION_DEADZONE_PX = 14;

function isDigit(ch: string) {
  return ch.length === 1 && ch >= "0" && ch <= "9";
}

export default function FormulaKeyboard({ api }: Props) {
  const structures = useMemo(
    () => [
      { label: "ᵃ⁄ᵦ", type: "fraction" },
      { label: "x²", type: "superscript" },
      { label: "xₐ", type: "subscript" },
      { label: "√", type: "sqrt" },
      { label: "Σ", type: "sum" },
      { label: "∫", type: "integral" },
      { label: "|x|", type: "abs" },
    ],
    [],
  );

  const greek = useMemo(
    () => [
      "α",
      "β",
      "γ",
      "δ",
      "ε",
      "ζ",
      "η",
      "θ",
      "ι",
      "κ",
      "λ",
      "μ",
      "ν",
      "ξ",
      "ο",
      "π",
      "ρ",
      "σ",
      "τ",
      "υ",
      "φ",
      "χ",
      "ψ",
      "ω",
    ],
    [],
  );

  const symbolsPrimary = useMemo(
    () => ["=", "+", "−", "×", "÷"],
    [],
  );
  const symbolsMore = useMemo(
    () => [
      "·",
      "(",
      ")",
      "[",
      "]",
      "≠",
      "≤",
      "≥",
      "±",
      "≈",
      "∝",
      "→",
      "∞",
      "°",
    ],
    [],
  );

  const t9: T9Def[] = useMemo(
    () => [
      { id: "1", letters: [], digit: "1" },
      { id: "2", letters: ["a", "b", "c"], digit: "2" },
      { id: "3", letters: ["d", "e", "f"], digit: "3" },
      { id: "4", letters: ["g", "h", "i"], digit: "4" },
      { id: "5", letters: ["j", "k", "l"], digit: "5" },
      { id: "6", letters: ["m", "n", "o"], digit: "6" },
      { id: "7", letters: ["p", "q", "r", "s"], digit: "7" },
      { id: "8", letters: ["t", "u", "v"], digit: "8" },
      { id: "9", letters: ["w", "x", "y", "z"], digit: "9" },
    ],
    [],
  );

  const [shift, setShift] = useState<ShiftMode>("off");
  const shiftTapRef = useRef<number>(0);

  const applyShift = (ch: string) => {
    if (!ch) return ch;
    const out = shift === "off" ? ch : ch.toUpperCase();
    if (shift === "once") setShift("off");
    return out;
  };

  const onShiftTap = () => {
    const now = Date.now();
    if (now - shiftTapRef.current < 350) {
      // double tap
      setShift((prev) => (prev === "lock" ? "off" : "lock"));
      shiftTapRef.current = 0;
      return;
    }
    shiftTapRef.current = now;
    setShift((prev) => {
      if (prev === "lock") return "off";
      if (prev === "once") return "off";
      return "once";
    });
  };

  // multi-tap cycling state
  const lastTapRef = useRef<{
    id: T9KeyId;
    at: number;
    idx: number;
  } | null>(null);

  const cycleForKey = (def: T9Def) => {
    const letters = def.letters;
    const seq: string[] = letters.length
      ? [...letters, def.digit]
      : [def.digit];
    return seq;
  };

  const handleKeyTap = (def: T9Def) => {
    const seq = cycleForKey(def);
    const now = Date.now();
    const last = lastTapRef.current;
    const same =
      last &&
      last.id === def.id &&
      now - last.at <= MULTI_TAP_MS;
    const nextIdx = same ? (last!.idx + 1) % seq.length : 0;
    const raw = seq[nextIdx];
    const ch = isDigit(raw) ? raw : applyShift(raw);

    if (same) {
      const replaced = api.replacePrevAtom(ch);
      if (!replaced) api.insert(ch);
    } else {
      api.insert(ch);
    }

    lastTapRef.current = { id: def.id, at: now, idx: nextIdx };
  };

  useEffect(() => {
    const t = setInterval(() => {
      const last = lastTapRef.current;
      if (!last) return;
      if (Date.now() - last.at > MULTI_TAP_MS)
        lastTapRef.current = null;
    }, 200);
    return () => clearInterval(t);
  }, []);

  // long press direction overlay
  const [lp, setLp] = useState<null | {
    def: T9Def;
    anchor: { x: number; y: number };
    direction: Direction;
  }>(null);
  const pressTimer = useRef<number | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(
    null,
  );
  const activeKey = useRef<T9Def | null>(null);

  // Measure center keypad height so side columns can scroll without
  // expanding the overall keyboard height.
  const centerRef = useRef<HTMLDivElement | null>(null);
  const [centerHeight, setCenterHeight] = useState<
    number | null
  >(null);

  useEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    const update = () =>
      setCenterHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clearPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const directionFromDelta = (
    dx: number,
    dy: number,
  ): Direction => {
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (
      adx < DIRECTION_DEADZONE_PX &&
      ady < DIRECTION_DEADZONE_PX
    )
      return "center";
    if (adx > ady) return dx > 0 ? "right" : "left";
    return dy > 0 ? "down" : "up";
  };

  const commitLongPress = (def: T9Def, dir: Direction) => {
    // mapping rule: 3 letters occupy ↑←→, digit on ↓, and for 7/9 center is 4th letter.
    // For 2-6,8, center is first letter.
    const letters = def.letters;
    let out = "";

    if (letters.length === 0) {
      out = def.digit;
    } else if (letters.length === 3) {
      if (dir === "down") out = def.digit;
      else if (dir === "up") out = letters[0];
      else if (dir === "left") out = letters[1];
      else if (dir === "right") out = letters[2];
      else out = letters[0];
    } else {
      // 4 letters
      if (dir === "down") out = def.digit;
      else if (dir === "up") out = letters[0];
      else if (dir === "left") out = letters[1];
      else if (dir === "right") out = letters[2];
      else out = letters[3];
    }

    if (!isDigit(out)) out = applyShift(out);
    api.insert(out);
  };

  const onKeyPointerDown = (
    e: React.PointerEvent,
    def: T9Def,
  ) => {
    // iOS Safari: if we don't block default touch actions, dragging after a long-press
    // can scroll the page and prevent selecting the directional letters.
    // We combine: (1) CSS `touch-action: none` on the key, and (2) preventDefault here.
    if (e.pointerType === "touch") e.preventDefault();

    (e.currentTarget as HTMLElement).setPointerCapture(
      e.pointerId,
    );
    startPoint.current = { x: e.clientX, y: e.clientY };
    activeKey.current = def;
    clearPress();
    pressTimer.current = window.setTimeout(() => {
      const sp = startPoint.current;
      if (!sp) return;
      setLp({
        def,
        anchor: { x: sp.x, y: sp.y },
        direction: "center",
      });
    }, LONG_PRESS_MS);
  };

  const onKeyPointerMove = (e: React.PointerEvent) => {
    if (!lp || !startPoint.current) return;
    if (e.pointerType === "touch") e.preventDefault();

    const dx = e.clientX - startPoint.current.x;
    const dy = e.clientY - startPoint.current.y;
    const d = directionFromDelta(dx, dy);
    if (d !== lp.direction) setLp({ ...lp, direction: d });
  };

  const onKeyPointerUp = (
    e: React.PointerEvent,
    def: T9Def,
  ) => {
    if (e.pointerType === "touch") e.preventDefault();

    const wasLong = !!lp;
    clearPress();
    startPoint.current = null;
    activeKey.current = null;
    if (wasLong) {
      commitLongPress(def, lp!.direction);
      setLp(null);
      return;
    }
    // short tap
    handleKeyTap(def);
  };

  const onKeyPointerCancel = () => {
    clearPress();
    startPoint.current = null;
    activeKey.current = null;
    setLp(null);
  };

  const renderLongPressOverlay = () => {
    if (!lp) return null;
    const { anchor, direction, def } = lp;

    const letters = def.letters;
    const slots: { dir: Direction; label: string }[] = [];

    // arrows label
    if (letters.length === 0) {
      slots.push({ dir: "center", label: def.digit });
    } else if (letters.length === 3) {
      slots.push({ dir: "up", label: letters[0] });
      slots.push({ dir: "left", label: letters[1] });
      slots.push({ dir: "right", label: letters[2] });
      slots.push({ dir: "down", label: def.digit });
      slots.push({ dir: "center", label: letters[0] });
    } else {
      slots.push({ dir: "up", label: letters[0] });
      slots.push({ dir: "left", label: letters[1] });
      slots.push({ dir: "right", label: letters[2] });
      slots.push({ dir: "down", label: def.digit });
      slots.push({ dir: "center", label: letters[3] });
    }

    const box = (dir: Direction) => {
      const item = slots.find((s) => s.dir === dir);
      if (!item) return null;
      const active = direction === dir;
      const base =
        "w-10 h-10 rounded-xl flex items-center justify-center text-base select-none " +
        (active
          ? "bg-primary text-primary-foreground shadow-lg"
          : "bg-card border border-border/60 text-foreground");
      return (
        <div className={base}>{applyShift(item.label)}</div>
      );
    };

    const POP_SIZE = 140;
    const HALF = POP_SIZE / 2;
    const MARGIN = 10;
    const vw =
      typeof window !== "undefined" ? window.innerWidth : 0;
    const vh =
      typeof window !== "undefined" ? window.innerHeight : 0;
    const clampedX = vw
      ? Math.min(
          Math.max(anchor.x, MARGIN + HALF),
          vw - MARGIN - HALF,
        )
      : anchor.x;
    const clampedY = vh
      ? Math.min(
          Math.max(anchor.y, MARGIN + HALF),
          vh - MARGIN - HALF,
        )
      : anchor.y;

    const style: React.CSSProperties = {
      position: "fixed",
      left: clampedX,
      top: clampedY,
      transform: "translate(-50%, -50%)",
      zIndex: 1000,
      pointerEvents: "none",
    };

    return (
      <div style={style}>
        <div className="relative w-[140px] h-[140px]">
          <div className="absolute left-1/2 top-0 -translate-x-1/2">
            {box("up")}
          </div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2">
            {box("left")}
          </div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2">
            {box("right")}
          </div>
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2">
            {box("down")}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {box("center")}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="w-full bg-card border-t safe-area-bottom"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {renderLongPressOverlay()}

      {/* Greek row */}
      <div className="flex gap-2 px-3 py-2 border-b overflow-x-auto">
        {greek.map((g) => (
          <button
            key={g}
            type="button"
            className="shrink-0 px-3 py-2 rounded-lg bg-muted"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => api.insert(g)}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Structure row */}
      <div className="flex gap-2 px-3 py-2 border-b overflow-x-auto">
        {structures.map((s) => (
          <button
            key={s.type}
            type="button"
            className="shrink-0 px-4 py-2 rounded-lg bg-muted"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => api.insertStructure(s.type)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-3 py-3">
        <div className="flex gap-3 items-stretch">
          {/* Left symbol column */}
          <div
            className="w-14 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0"
            style={{
              height: centerHeight ?? 240,
              maxHeight: centerHeight ?? 240,
            }}
          >
            {[...symbolsPrimary, ...symbolsMore].map((s) => (
              <button
                key={s}
                type="button"
                className="h-12 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => api.insert(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Center keypad */}
          <div
            ref={centerRef}
            className="flex-1 flex flex-col gap-2"
            // Don't let touch-drag on the keypad scroll the page.
            style={{ touchAction: "none" }}
          >
            <div className="grid grid-cols-3 gap-2">
              {t9.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className="h-14 rounded-2xl bg-muted flex flex-col items-center justify-center"
                  // Required for iOS: allow custom pointer-drag behavior without scrolling.
                  style={{ touchAction: "none" }}
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => onKeyPointerDown(e, k)}
                  onPointerMove={onKeyPointerMove}
                  onPointerUp={(e) => onKeyPointerUp(e, k)}
                  onPointerCancel={onKeyPointerCancel}
                >
                  <div className="text-lg leading-none">
                    {k.id}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-none mt-1">
                    {k.letters.length ? k.letters.join("") : ""}
                  </div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className="h-12 rounded-2xl bg-muted flex items-center justify-center"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => api.insert(" ")}
              >
                空格
              </button>
              <button
                type="button"
                className="h-12 rounded-2xl bg-muted flex items-center justify-center text-lg"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => api.insert("0")}
              >
                0
              </button>
              <button
                type="button"
                className="h-12 rounded-2xl bg-muted flex items-center justify-center text-lg"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => api.insert(".")}
              >
                .
              </button>
            </div>
          </div>

          {/* Right control column */}
          <div
            className="w-14 flex flex-col gap-2"
            style={{
              height: centerHeight ?? 240,
              maxHeight: centerHeight ?? 240,
            }}
          >
            <button
              type="button"
              className="h-14 rounded-2xl bg-muted flex items-center justify-center text-lg"
              // Keep long-press from triggering page scroll on iOS.
              style={{ touchAction: "none" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={api.backspace}
              onPointerDown={(e) => {
                if (e.pointerType === "touch")
                  e.preventDefault();
                // long press repeat delete
                (
                  e.currentTarget as HTMLElement
                ).setPointerCapture(e.pointerId);
                const start = window.setTimeout(() => {
                  const id = window.setInterval(
                    api.backspace,
                    80,
                  );
                  const stop = () => {
                    window.clearInterval(id);
                    window.removeEventListener(
                      "pointerup",
                      stop,
                    );
                    window.removeEventListener(
                      "pointercancel",
                      stop,
                    );
                  };
                  window.addEventListener("pointerup", stop);
                  window.addEventListener(
                    "pointercancel",
                    stop,
                  );
                }, 320);
                const cancel = () => {
                  window.clearTimeout(start);
                  window.removeEventListener(
                    "pointerup",
                    cancel,
                  );
                  window.removeEventListener(
                    "pointercancel",
                    cancel,
                  );
                };
                window.addEventListener("pointerup", cancel);
                window.addEventListener(
                  "pointercancel",
                  cancel,
                );
              }}
            >
              ⌫
            </button>

            {/* Left arrow: short move; long press enter */}
            <HoldButton
              label="←"
              onClick={api.moveLeft}
              onHold={api.enterStructure}
            />

            {/* Right arrow: short move; long press exit */}
            <HoldButton
              label="→"
              onClick={api.moveRight}
              onHold={api.exitStructure}
            />

            <button
              type="button"
              className="h-14 rounded-2xl bg-muted flex items-center justify-center text-lg"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onShiftTap}
            >
              {shift === "off"
                ? "⇧"
                : shift === "once"
                  ? "⇧"
                  : "⇧⇧"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HoldButton({
  label,
  onClick,
  onHold,
}: {
  label: string;
  onClick: () => void;
  onHold: () => void;
}) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);

  const clear = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return (
    <button
      type="button"
      className="h-14 rounded-2xl bg-muted flex items-center justify-center text-lg"
      // Keep long-press from triggering page scroll on iOS.
      style={{ touchAction: "none" }}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.pointerType === "touch") e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(
          e.pointerId,
        );
        held.current = false;
        clear();
        timer.current = window.setTimeout(() => {
          held.current = true;
          onHold();
        }, 350);
      }}
      onPointerUp={() => {
        const wasHeld = held.current;
        clear();
        held.current = false;
        if (!wasHeld) onClick();
      }}
      onPointerCancel={() => {
        clear();
        held.current = false;
      }}
    >
      {label}
    </button>
  );
}