'use client';

import { useEffect, useRef, useState } from 'react';

type Tool = 'pen' | 'rect' | 'arrow' | 'crop';
type Pt = { x: number; y: number };
type Shape =
  | { kind: 'pen'; points: Pt[]; color: string; width: number }
  | { kind: 'rect'; p1: Pt; p2: Pt; color: string; width: number }
  | { kind: 'arrow'; p1: Pt; p2: Pt; color: string; width: number };

const COLORS = ['#E54B4B', '#F4A23C', '#3CB371', '#2C7BE5', '#1A1A1A'];
const STROKE_WIDTH = 3;

export function ScreenshotEditor({
  imageDataUrl,
  onDone,
  onCancel,
}: {
  imageDataUrl: string;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [drawing, setDrawing] = useState<Shape | null>(null);
  const [cropRect, setCropRect] = useState<{ p1: Pt; p2: Pt } | null>(null);
  const [scale, setScale] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDownRef = useRef(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  useEffect(() => {
    if (!image) return;
    const compute = () => {
      const maxW = window.innerWidth - 80;
      const maxH = window.innerHeight - 180;
      setScale(Math.min(1, maxW / image.naturalWidth, maxH / image.naturalHeight));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [image]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    c.width = image.naturalWidth;
    c.height = image.naturalHeight;
    ctx.drawImage(image, 0, 0);
    const all = drawing ? [...shapes, drawing] : shapes;
    for (const s of all) drawShape(ctx, s);
    if (cropRect) drawCropMask(ctx, cropRect, c.width, c.height);
  }, [image, shapes, drawing, cropRect]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setShapes((s) => (s.length ? s.slice(0, -1) : s));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  if (!image) {
    return (
      <div style={overlayStyle}>
        <div style={{ color: '#fff', margin: 'auto', fontSize: 14 }}>Loading screenshot…</div>
      </div>
    );
  }

  const toImageCoords = (e: React.MouseEvent | React.PointerEvent): Pt => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(image.naturalWidth, (e.clientX - rect.left) / scale)),
      y: Math.max(0, Math.min(image.naturalHeight, (e.clientY - rect.top) / scale)),
    };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    isDownRef.current = true;
    const p = toImageCoords(e);
    if (tool === 'crop') {
      setCropRect({ p1: p, p2: p });
      return;
    }
    if (tool === 'pen') setDrawing({ kind: 'pen', points: [p], color, width: STROKE_WIDTH });
    else setDrawing({ kind: tool, p1: p, p2: p, color, width: STROKE_WIDTH });
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDownRef.current) return;
    const p = toImageCoords(e);
    if (tool === 'crop') {
      setCropRect((r) => (r ? { p1: r.p1, p2: p } : null));
      return;
    }
    if (!drawing) return;
    if (drawing.kind === 'pen') setDrawing({ ...drawing, points: [...drawing.points, p] });
    else setDrawing({ ...drawing, p2: p });
  };

  const handleUp = () => {
    isDownRef.current = false;
    if (drawing) {
      setShapes((s) => [...s, drawing]);
      setDrawing(null);
    }
  };

  const undo = () => setShapes((s) => (s.length ? s.slice(0, -1) : s));

  const applyCrop = async () => {
    if (!cropRect) return;
    const x = Math.min(cropRect.p1.x, cropRect.p2.x);
    const y = Math.min(cropRect.p1.y, cropRect.p2.y);
    const w = Math.abs(cropRect.p2.x - cropRect.p1.x);
    const h = Math.abs(cropRect.p2.y - cropRect.p1.y);
    if (w < 4 || h < 4) {
      setCropRect(null);
      return;
    }
    const off = document.createElement('canvas');
    off.width = Math.round(w);
    off.height = Math.round(h);
    const oc = off.getContext('2d');
    if (!oc) return;
    oc.drawImage(image, -x, -y);
    for (const s of shapes) drawShape(oc, translateShape(s, -x, -y));
    const url = off.toDataURL('image/png');
    const next = new Image();
    await new Promise<void>((resolve) => {
      next.onload = () => resolve();
      next.src = url;
    });
    setImage(next);
    setShapes([]);
    setCropRect(null);
    setTool('pen');
  };

  const cancelCrop = () => setCropRect(null);

  const handleDone = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) onDone(blob);
    }, 'image/png');
  };

  return (
    <div style={overlayStyle} onPointerUp={handleUp} onPointerCancel={handleUp}>
      <div style={toolbarStyle}>
        <ToolButton active={tool === 'crop'} onClick={() => setTool('crop')} icon="ti-crop" label="Crop" />
        <ToolButton active={tool === 'pen'} onClick={() => { setTool('pen'); cancelCrop(); }} icon="ti-pencil" label="Pen" />
        <ToolButton active={tool === 'rect'} onClick={() => { setTool('rect'); cancelCrop(); }} icon="ti-square" label="Box" />
        <ToolButton active={tool === 'arrow'} onClick={() => { setTool('arrow'); cancelCrop(); }} icon="ti-arrow-up-right" label="Arrow" />
        <span style={dividerStyle} />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Color ${c}`}
            title={c}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: c,
              border: color === c ? '2px solid #fff' : '2px solid rgba(255,255,255,0.25)',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
        <span style={dividerStyle} />
        <ToolButton onClick={undo} icon="ti-arrow-back-up" label="Undo" disabled={!shapes.length} />
        {tool === 'crop' && cropRect ? (
          <>
            <button type="button" onClick={applyCrop} style={applyBtn}>
              <i className="ti ti-check" style={{ fontSize: 14, marginRight: 4 }} />
              Apply crop
            </button>
            <button type="button" onClick={cancelCrop} style={ghostBtn}>Cancel crop</button>
          </>
        ) : null}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
        <button type="button" onClick={handleDone} style={doneBtn}>Attach</button>
      </div>
      <div style={canvasWrapStyle}>
        <canvas
          ref={canvasRef}
          style={{
            width: image.naturalWidth * scale,
            height: image.naturalHeight * scale,
            cursor: 'crosshair',
            background: '#fff',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            touchAction: 'none',
          }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
        />
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      style={{
        background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 6,
        width: 32,
        height: 32,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 16 }} />
    </button>
  );
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (s.kind === 'pen') {
    if (s.points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    }
  } else if (s.kind === 'rect') {
    const x = Math.min(s.p1.x, s.p2.x);
    const y = Math.min(s.p1.y, s.p2.y);
    const w = Math.abs(s.p2.x - s.p1.x);
    const h = Math.abs(s.p2.y - s.p1.y);
    ctx.strokeRect(x, y, w, h);
  } else if (s.kind === 'arrow') {
    drawArrow(ctx, s.p1, s.p2);
  }
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, p1: Pt, p2: Pt) {
  const headLen = 14;
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(p2.x - headLen * Math.cos(angle - Math.PI / 6), p2.y - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(p2.x - headLen * Math.cos(angle + Math.PI / 6), p2.y - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function drawCropMask(ctx: CanvasRenderingContext2D, rect: { p1: Pt; p2: Pt }, w: number, h: number) {
  const x = Math.min(rect.p1.x, rect.p2.x);
  const y = Math.min(rect.p1.y, rect.p2.y);
  const rw = Math.abs(rect.p2.x - rect.p1.x);
  const rh = Math.abs(rect.p2.y - rect.p1.y);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, w, y);
  ctx.fillRect(0, y + rh, w, h - (y + rh));
  ctx.fillRect(0, y, x, rh);
  ctx.fillRect(x + rw, y, w - (x + rw), rh);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, rw, rh);
  ctx.restore();
}

function translateShape(s: Shape, dx: number, dy: number): Shape {
  if (s.kind === 'pen') {
    return { ...s, points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
  return { ...s, p1: { x: s.p1.x + dx, y: s.p1.y + dy }, p2: { x: s.p2.x + dx, y: s.p2.y + dy } };
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,15,17,0.92)',
  zIndex: 3000,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'var(--font-sans)',
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 16px',
  background: 'rgba(0,0,0,0.6)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  color: '#fff',
  flexWrap: 'wrap',
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 18,
  background: 'rgba(255,255,255,0.2)',
  margin: '0 4px',
};

const canvasWrapStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'auto',
  padding: 16,
};

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 13,
  cursor: 'pointer',
};

const doneBtn: React.CSSProperties = {
  background: '#F47832',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const applyBtn: React.CSSProperties = {
  background: '#3CB371',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
};
