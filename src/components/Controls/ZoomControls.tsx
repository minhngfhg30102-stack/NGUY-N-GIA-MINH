import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Mouse, Search, X, EyeOff } from 'lucide-react';

interface ZoomControlsProps {
  onZoomInStart: () => void;
  onZoomInEnd: () => void;
  onZoomOutStart: () => void;
  onZoomOutEnd: () => void;
  onResetZoom: () => void;
  isIActive?: boolean;
  isOActive?: boolean;
  positionClass?: string;
  isMobile?: boolean;
  isMobileLandscape?: boolean;
  inline?: boolean;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  onZoomInStart,
  onZoomInEnd,
  onZoomOutStart,
  onZoomOutEnd,
  onResetZoom,
  isIActive = false,
  isOActive = false,
  positionClass = 'top-16 left-6',
  isMobile = false,
  isMobileLandscape = false,
  inline = false,
}) => {
  // Mặc định ẩn (Hidden by default as requested by user)
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveredRef = useRef<boolean>(false);

  // Clear timers
  const clearTimers = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Start auto-close timer with countdown
  const startAutoClose = useCallback((seconds: number = 5) => {
    clearTimers();
    setCountdown(seconds);

    // Interval to update countdown seconds badge
    let remaining = seconds;
    countdownIntervalRef.current = setInterval(() => {
      if (!isHoveredRef.current) {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        }
      }
    }, 1000);

    // Timeout to close
    autoCloseTimerRef.current = setTimeout(() => {
      if (!isHoveredRef.current) {
        setIsOpen(false);
      }
    }, seconds * 1000);
  }, [clearTimers]);

  // Handle open
  const handleOpen = () => {
    setIsOpen(true);
    startAutoClose(5);
  };

  // Handle manual close / hide
  const handleClose = () => {
    clearTimers();
    setIsOpen(false);
  };

  // Reset timer on user interaction
  const handleUserActivity = () => {
    if (isOpen) {
      startAutoClose(5);
    }
  };

  // Pause on hover, resume on mouse leave
  const handlePointerEnter = () => {
    isHoveredRef.current = true;
    clearTimers();
  };

  const handlePointerLeave = () => {
    isHoveredRef.current = false;
    if (isOpen) {
      startAutoClose(4);
    }
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // If closed: show only the compact trigger button (Mặc định ẩn, chỉ khi mở mới hiện)
  if (!isOpen) {
    return (
      <aside
        aria-label="Mở bộ điều khiển thu phóng 3D"
        className={inline ? 'relative z-20 pointer-events-auto' : `fixed ${positionClass} z-20 pointer-events-auto`}
      >
        <button
          onClick={handleOpen}
          data-testid="zoom-trigger-btn"
          className={`flex items-center ${
            isMobile
              ? isMobileLandscape
                ? 'gap-1 px-2 py-1 text-[10px]'
                : 'gap-1 px-2 py-1.5 text-[11px]'
              : 'gap-2 px-3 py-2 text-xs'
          } bg-slate-900/95 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 border border-slate-700/80 rounded-xl shadow-xl backdrop-blur-md font-semibold transition-all cursor-pointer group`}
          title="Mở cụm phím thu phóng & hướng dẫn (Tự động ẩn sau 5 giây)"
        >
          <Search className={`${isMobile ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-emerald-400 group-hover:text-slate-950 transition-colors`} />
          <span>{isMobile ? 'Zoom' : 'Thu phóng 3D'}</span>
          {!isMobile && (
            <span className="text-[10px] bg-slate-800 text-slate-400 group-hover:bg-emerald-600 group-hover:text-white px-1.5 py-0.5 rounded font-mono">
              I / O
            </span>
          )}
        </button>
      </aside>
    );
  }

  // When open: show full zoom controls with auto-close countdown and explicit hide button
  return (
    <aside
      aria-label="Bộ điều khiển thu phóng 3D"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className={`${
        inline ? 'relative' : `fixed ${positionClass}`
      } z-20 pointer-events-auto flex flex-col gap-2 transition-all duration-200 animate-in fade-in zoom-in-95`}
    >
      {/* Zoom Buttons Capsule */}
      <div
        className={`bg-slate-900/95 border border-slate-700/90 shadow-2xl backdrop-blur-md flex flex-col items-center text-slate-200 ${
          isMobile ? 'rounded-xl p-1.5 gap-1.5 w-36' : 'rounded-2xl p-2.5 gap-2 w-44'
        }`}
      >
        {/* Header with Title, Auto-close indicator & Explicit Hide / Close Button */}
        <div className="flex items-center justify-between w-full border-b border-slate-800 pb-1 px-0.5">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className={`${isMobile ? 'text-[10px]' : 'text-[11px]'} font-bold text-slate-200 uppercase tracking-wide`}>
              Thu phóng
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Auto-close countdown badge */}
            <span
              className="text-[9px] font-mono text-amber-300/90 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20"
              title="Sẽ tự động đóng sau thời gian này nếu không thao tác"
            >
              {countdown}s
            </span>

            {/* Explicit Close / Hide Button */}
            <button
              onClick={handleClose}
              className="p-0.5 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/40 transition-colors cursor-pointer"
              title="Ẩn bảng thu phóng này"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Buttons Row */}
        <div className={`flex items-center w-full justify-center ${isMobile ? 'gap-1' : 'gap-2'}`}>
          {/* Zoom In Button (Key I) */}
          <button
            onPointerDown={() => {
              handleUserActivity();
              onZoomInStart();
            }}
            onPointerUp={onZoomInEnd}
            onPointerLeave={onZoomInEnd}
            className={`flex-1 ${isMobile ? 'h-9 rounded-lg' : 'h-11 rounded-xl'} flex flex-col items-center justify-center transition-all cursor-pointer select-none border ${
              isIActive
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 scale-95 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] ring-2 ring-emerald-400/50'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-600/80 active:scale-95'
            }`}
            title="Phóng to (Nhấn hoặc giữ phím I, hoặc cuộn chuột lên)"
          >
            <ZoomIn className="w-4 h-4 text-emerald-400" />
            {!isMobile && <span className="text-[9px] font-mono font-bold leading-none mt-0.5">I</span>}
          </button>

          {/* Zoom Out Button (Key O) */}
          <button
            onPointerDown={() => {
              handleUserActivity();
              onZoomOutStart();
            }}
            onPointerUp={onZoomOutEnd}
            onPointerLeave={onZoomOutEnd}
            className={`flex-1 ${isMobile ? 'h-9 rounded-lg' : 'h-11 rounded-xl'} flex flex-col items-center justify-center transition-all cursor-pointer select-none border ${
              isOActive
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 scale-95 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] ring-2 ring-emerald-400/50'
                : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-600/80 active:scale-95'
            }`}
            title="Thu nhỏ (Nhấn hoặc giữ phím O, hoặc cuộn chuột xuống)"
          >
            <ZoomOut className="w-4 h-4 text-cyan-400" />
            {!isMobile && <span className="text-[9px] font-mono font-bold leading-none mt-0.5">O</span>}
          </button>

          {/* Reset View Button (1:1) */}
          <button
            onClick={() => {
              handleUserActivity();
              onResetZoom();
            }}
            className={`${isMobile ? 'w-9 h-9 rounded-lg' : 'w-10 h-11 rounded-xl'} flex flex-col items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer border border-slate-700/80 active:scale-95`}
            title="Đặt lại khoảng cách nhìn chuẩn (Góc 3D ban đầu)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="text-[8px] font-mono leading-none mt-0.5">1:1</span>
          </button>
        </div>

        {/* Quick Close Button at bottom of card */}
        <button
          onClick={handleClose}
          className="w-full py-1 rounded-lg bg-slate-800/60 hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-700/60 hover:border-red-500/40 text-[10px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
          title="Đóng bảng thu phóng (hoặc tự động đóng sau 5s)"
        >
          <EyeOff className="w-3 h-3" />
          <span>{isMobile ? 'Đóng' : 'Ẩn phần này'}</span>
        </button>
      </div>

      {/* Floating Mouse & Key Zoom Guide Tooltip Tag (Desktop Only to save space on mobile) */}
      {!isMobile && (
        <div className="flex flex-col gap-1 px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-xl backdrop-blur-md text-[10px] text-slate-300 font-medium w-56">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <Mouse className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Giữ chuột Trái / Phải để xoay 360°</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Cuộn chuột /</span>
            <span
              className={`px-1 py-0.2 rounded font-mono font-bold text-[9px] border transition-colors ${
                isIActive
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                  : 'bg-slate-800 text-emerald-300 border-slate-700'
              }`}
            >
              I
            </span>
            <span>&</span>
            <span
              className={`px-1 py-0.2 rounded font-mono font-bold text-[9px] border transition-colors ${
                isOActive
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                  : 'bg-slate-800 text-emerald-300 border-slate-700'
              }`}
            >
              O
            </span>
            <span>để phóng to / thu nhỏ</span>
          </div>
          <div className="text-[9px] text-slate-500 text-center italic border-t border-slate-800/80 pt-1 mt-0.5">
            Tự động đóng khi không dùng
          </div>
        </div>
      )}
    </aside>
  );
};
