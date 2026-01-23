
import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  readOnly?: boolean;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ value, onChange, readOnly = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  // Initial load or value change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (value) {
      const img = new Image();
      img.onload = () => {
        resizeCanvas(); // Ensure size is correct before drawing
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasInk(true);
      };
      img.src = value;
    } else {
      if (!isDrawing) { // Only clear if we are not actively drawing (prevents loop clear)
        resizeCanvas();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasInk(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Only resize if dimensions differ to avoid clearing context unnecessarily
    const targetW = Math.floor(rect.width * dpr);
    const targetH = Math.floor(rect.height * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
       canvas.width = targetW;
       canvas.height = targetH;
       const ctx = canvas.getContext('2d');
       if (ctx) {
         ctx.setTransform(1, 0, 0, 1, 0, 0);
         ctx.scale(dpr, dpr);
         ctx.lineWidth = 2.4;
         ctx.lineCap = 'round';
         ctx.lineJoin = 'round';
         ctx.strokeStyle = '#111';
       }
    }
  };

  useEffect(() => {
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    e.preventDefault(); // Prevent scroll on touch
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  const endDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasInk(false);
      onChange(null); // Notify parent
    }
  };

  const saveSignature = () => {
    if (!hasInk) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  return (
    <div className="border border-gray-300 rounded-xl bg-white p-2">
       <div className="relative w-full h-28 bg-white border-2 border-dashed border-gray-200 rounded-lg overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-full block cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
        />
         {(!hasInk && !value) && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400 text-sm select-none">
             서명란 (여기에 서명하세요)
           </div>
         )}
      </div>

      {!readOnly && (
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Eraser size={12} />
            지우기
          </button>
          <button
            type="button"
            onClick={saveSignature}
            disabled={!hasInk}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ml-auto ${
              hasInk 
                ? 'text-white bg-emerald-600 hover:bg-emerald-700' 
                : 'text-gray-400 bg-gray-100 cursor-not-allowed'
            }`}
          >
            <Check size={12} />
            서명 확정(저장)
          </button>
        </div>
      )}
      <div className="mt-1 text-[10px] text-gray-500 text-right">
        {value ? "✅ 서명이 저장되었습니다." : "⚠️ 서명 후 '서명 확정'을 눌러주세요."}
      </div>
    </div>
  );
};

export default SignaturePad;
