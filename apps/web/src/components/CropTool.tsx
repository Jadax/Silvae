import { useEffect, useRef, useState } from "react";
import { loadImage } from "../lib/identify";
import {
  clampRect,
  fitDimensions,
  normalizeRect,
  pointInRect,
  translateRect,
  type Rect,
} from "../lib/crop";

interface Props {
  file: File;
  /** Natural-coord selection to start with (e.g. auto-trimmed screenshot bounds). */
  preset: Rect | null;
  busy: boolean;
  /** Called with the cropped image blob, or null for the full photo. */
  onSubmit: (crop: Blob | null) => void;
  onCancel: () => void;
}

const MAX_DISPLAY_W = 560;
const MAX_DISPLAY_H = 440;
const MIN_SELECT = 32; // natural px
const CROP_MAX_SIDE = 1024; // matches MAX_ID_IMAGE_DIM in lib/identify

type Gesture =
  | { mode: "move"; startX: number; startY: number; rect: Rect }
  | { mode: "new"; startX: number; startY: number };

export default function CropTool({ file, preset, busy, onSubmit, onCancel }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const touched = useRef(false);
  const gesture = useRef<Gesture | null>(null);

  useEffect(() => {
    let alive = true;
    void loadImage(file).then((image) => {
      if (!alive) return;
      setImg(image);
      setRect({
        x: 0,
        y: 0,
        w: image.naturalWidth,
        h: image.naturalHeight,
      });
    });
    return () => {
      alive = false;
    };
  }, [file]);

  // Once the auto-trim preset lands, adopt it unless the user already moved the box.
  useEffect(() => {
    if (!preset || !img || touched.current) return;
    setRect(clampRect(preset, img.naturalWidth, img.naturalHeight, MIN_SELECT));
  }, [preset, img]);

  const display = img
    ? fitDimensions(img.naturalWidth, img.naturalHeight, MAX_DISPLAY_W, MAX_DISPLAY_H)
    : null;
  const scale = img && display ? display.w / img.naturalWidth : 1;

  // Draw the preview onto a canvas (StrictMode-safe: no revocable blob URLs).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img || !display) return;
    canvas.width = display.w;
    canvas.height = display.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, display.w, display.h);
  }, [img, display]);

  function toNatural(clientX: number, clientY: number): { x: number; y: number } {
    const box = stageRef.current!.getBoundingClientRect();
    return {
      x: (clientX - box.left) / scale,
      y: (clientY - box.top) / scale,
    };
  }

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (!img || !rect) return;
    e.preventDefault();
    touched.current = true;
    const p = toNatural(e.clientX, e.clientY);
    if (pointInRect(p, rect)) {
      gesture.current = { mode: "move", startX: p.x, startY: p.y, rect };
    } else {
      gesture.current = { mode: "new", startX: p.x, startY: p.y };
      setRect({ x: p.x, y: p.y, w: 0, h: 0 });
    }
    try {
      stageRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // no active pointer (e.g. synthetic events) — move() still works via move events
    }
  }

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || !img) return;
    e.preventDefault();
    const p = toNatural(e.clientX, e.clientY);
    if (g.mode === "move") {
      const moved = translateRect(g.rect, p.x - g.startX, p.y - g.startY);
      setRect(clampRect(moved, img.naturalWidth, img.naturalHeight, MIN_SELECT));
    } else {
      const next = normalizeRect({ x: g.startX, y: g.startY }, p);
      setRect(clampRect(next, img.naturalWidth, img.naturalHeight, MIN_SELECT));
    }
  }

  function up(e: React.PointerEvent<HTMLDivElement>) {
    gesture.current = null;
    try {
      stageRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // pointer may have left the stage — ignore
    }
  }

  function submitCrop() {
    if (!img || !rect) return;
    const side = Math.max(rect.w, rect.h);
    const s = Math.min(1, CROP_MAX_SIDE / side);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.w * s));
    canvas.height = Math.max(1, Math.round(rect.h * s));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) onSubmit(blob);
    }, "image/webp");
  }

  const fullSelection = img && rect && rect.x === 0 && rect.y === 0;

  return (
    <div>
      <div
        ref={stageRef}
        className="crop-stage"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        aria-label="Drag over the plant or draw a new selection to crop the photo"
        style={{
          position: "relative",
          width: display?.w,
          height: display?.h,
          maxWidth: "100%",
          touchAction: "none",
          overflow: "hidden",
          borderRadius: 8,
          background: "var(--muted, #333)",
        }}
      >
        <canvas
          ref={canvasRef}
          aria-label="Plant photo to crop"
          style={{ display: "block", width: display?.w, height: display?.h }}
        />
        {img && rect && (
          <div
            className="crop-select"
            style={{
              position: "absolute",
              left: rect.x * scale,
              top: rect.y * scale,
              width: rect.w * scale,
              height: rect.h * scale,
              border: "2px solid #fff",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
              cursor: "move",
            }}
          >
            {rect.w * scale >= 60 && (
              <>
                <i style={verticalLine(1 / 3, rect.h * scale)} />
                <i style={verticalLine(2 / 3, rect.h * scale)} />
              </>
            )}
          </div>
        )}
      </div>

      <div className="actions" style={{ marginTop: "0.5rem" }}>
        <button className="btn" type="button" disabled={busy || !rect} onClick={submitCrop}>
          {busy ? "Identifying…" : "Identify this area"}
        </button>
        <button
          className="btn secondary"
          type="button"
          disabled={busy}
          onClick={() => onSubmit(null)}
        >
          Use full photo
        </button>
        <button className="btn secondary" type="button" disabled={busy} onClick={onCancel}>
          {fullSelection ? "Clear" : "Reset"}
        </button>
      </div>
      <p className="muted">
        Screenshot? Drag over the plant or draw a new box. Cropping out app chrome and other
        plants helps the model see it properly.
      </p>
    </div>
  );
}

/** Rule-of-thirds vertical gridlines inside the selection. */
function verticalLine(frac: number, h: number): React.CSSProperties {
  return {
    position: "absolute",
    left: `${frac * 100}%`,
    top: 0,
    width: 1,
    height: h,
    background: "rgba(255,255,255,0.5)",
    pointerEvents: "none",
  } as React.CSSProperties;
}
