import React, { useState } from 'react';
import { Camera, Eye, Zap, Crosshair, Maximize2, Minimize2 } from 'lucide-react';
import { DriveState } from '../../types/robot';

interface CameraFPVProps {
  driveState: DriveState;
  isMobile?: boolean;
  isMobileLandscape?: boolean;
  onCloseMobile?: () => void;
}

export const CameraFPV: React.FC<CameraFPVProps> = ({
  driveState,
  isMobile = false,
  isMobileLandscape = false,
  onCloseMobile,
}) => {
  const [isAiOverlayActive, setIsAiOverlayActive] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  // Compute simulated AI bounding box positions based on robot heading and obstacle distance
  const obsDist = driveState.nearestObstacleDistance;
  const isClose = obsDist < 0.9;
  const boxScale = Math.max(0.3, Math.min(1.4, 1.2 / Math.max(0.2, obsDist)));

  if (!isMobile && isCollapsed) {
    return (
      <div className="fixed top-16 right-6 z-30 pointer-events-auto">
        <button
          type="button"
          data-testid="open-camera-fpv-btn"
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 px-3 py-2 bg-slate-950/45 hover:bg-emerald-500/85 hover:text-slate-950 text-white border border-white/20 rounded-xl shadow-xl backdrop-blur-md text-xs font-bold transition-all cursor-pointer"
          title="Mở lại Camera FPV"
        >
          <Camera className="w-4 h-4 text-emerald-400" />
          <span>CSI Camera (Live 30 FPS)</span>
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="camera-fpv-card"
      className={`fixed z-30 transition-all duration-300 pointer-events-auto ${
        isMobile
          ? isMobileLandscape
            ? isExpanded
              ? 'top-10 right-2 w-[300px] max-w-[46vw] h-[178px]'
              : 'top-10 right-2 w-[216px] max-w-[40vw] h-[118px]'
            : isExpanded
            ? 'top-11 right-2 w-[calc(100vw-1rem)] h-44'
            : 'top-11 right-2 w-[204px] max-w-[calc(100vw-1rem)] h-[124px]'
          : isExpanded
          ? 'top-16 right-6 w-96 sm:w-[460px] h-72'
          : 'top-16 right-6 w-72 h-48'
      } rounded-xl overflow-hidden border border-emerald-400/35 bg-slate-950/30 shadow-2xl backdrop-blur-md flex flex-col [text-shadow:0_1px_2px_rgba(0,0,0,0.75)]`}
    >
      {/* Top Header Bar */}
      <div className={`flex items-center justify-between ${isMobile ? 'px-2 py-1 text-[11px]' : 'px-2.5 sm:px-3 py-1.5 text-xs'} bg-slate-950/40 border-b border-white/15`}>
        <div className="flex items-center gap-1.5 font-mono text-emerald-400 min-w-0">
          <Camera className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold truncate">
            {isMobile ? 'CSI CAM' : 'CSI CAM · SONY IMX219'}
          </span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-sans whitespace-nowrap shrink-0">
            {isMobile ? '30 FPS' : 'LIVE 30 FPS'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsAiOverlayActive(!isAiOverlayActive)}
            title={isAiOverlayActive ? 'Tắt AI Detection' : 'Bật AI Detection'}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isAiOverlayActive
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Thu nhỏ kích thước' : 'Phóng to'}
            className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => {
              if (isMobile && onCloseMobile) {
                onCloseMobile();
              } else {
                setIsCollapsed(true);
              }
            }}
            title="Thu gọn camera"
            className="p-1 rounded text-slate-400 hover:text-red-400 transition-colors cursor-pointer text-[10px] px-1.5"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Camera Viewfinder & HUD Canvas */}
      <div className="relative flex-1 bg-slate-950/15 overflow-hidden flex items-center justify-center">
        {/* Fisheye grid background representing 160° FOV lens */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Center reticle */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
          <Crosshair className="w-8 h-8 text-emerald-400 stroke-1" />
        </div>

        {/* Horizon & Heading Line */}
        <div className="absolute w-full top-1/2 flex items-center justify-center pointer-events-none opacity-30">
          <div className="w-24 h-px bg-emerald-400" />
          <div className="mx-2 text-[9px] font-mono text-emerald-400">
            {Math.round(driveState.heading)}°
          </div>
          <div className="w-24 h-px bg-emerald-400" />
        </div>

        {/* Simulated Simulated Line Tracking (Yellow lane guides) */}
        {isAiOverlayActive && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {/* Left lane line */}
            <line
              x1="20%"
              y1="100%"
              x2="45%"
              y2="55%"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeDasharray="4 4"
              opacity="0.8"
            />
            {/* Right lane line */}
            <line
              x1="80%"
              y1="100%"
              x2="55%"
              y2="55%"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeDasharray="4 4"
              opacity="0.8"
            />
            {/* Target trajectory center point */}
            <circle cx="50%" cy="55%" r="4" fill="#10b981" />
          </svg>
        )}

        {/* Simulated Object Detection Bounding Box */}
        {isAiOverlayActive && obsDist < 2.5 && (
          <div
            className={`absolute transition-all duration-150 border-2 rounded ${
              isClose
                ? 'border-red-500 bg-red-500/10'
                : 'border-emerald-400 bg-emerald-500/10'
            }`}
            style={{
              width: `${Math.min(isMobile && !isExpanded ? 110 : 180, (isMobile && !isExpanded ? 36 : 50) * boxScale)}px`,
              height: `${Math.min(isMobile && !isExpanded ? 74 : 130, (isMobile && !isExpanded ? 28 : 40) * boxScale)}px`,
              top: isMobile && !isExpanded ? '34%' : '35%',
              left: isMobile && !isExpanded ? '38%' : '42%',
            }}
          >
            <div
              className={`absolute ${
                isMobile && !isExpanded
                  ? '-top-4 left-0 px-1 py-0 text-[8px] whitespace-nowrap'
                  : '-top-5 left-0 px-1 py-0.5 text-[9px]'
              } font-mono font-bold rounded ${
                isClose ? 'bg-red-500 text-white' : 'bg-emerald-500 text-slate-950'
              }`}
            >
              {isMobile && !isExpanded
                ? `${isClose ? 'CẢN' : 'VẬT'}: ${obsDist.toFixed(1)}m`
                : `${isClose ? 'CẢNH BÁO CẢN' : 'VẬT CẢN'}: ${obsDist.toFixed(2)}m (96%)`}
            </div>
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-current" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-current" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-current" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-current" />
          </div>
        )}

        {/* Bottom Telemetry Overlay */}
        {isMobile && !isExpanded ? (
          <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[8px] font-mono text-emerald-200 bg-slate-950/50 px-1.5 py-0.5 rounded border border-emerald-400/25">
            <span className="flex items-center gap-0.5 truncate">
              <Zap className="w-2 h-2 text-yellow-400 shrink-0" /> MIPI-CSI
            </span>
            <span className="text-cyan-300 shrink-0">8ms</span>
          </div>
        ) : (
          <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between text-[9px] font-mono text-emerald-200 bg-slate-950/40 px-2 py-0.5 rounded border border-emerald-400/25">
            <span className="flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-yellow-400" /> MIPI-CSI ZERO-COPY
            </span>
            <span>LATENCY: 8ms</span>
            <span className="text-cyan-300">SSD-MobileNet V2</span>
          </div>
        )}
      </div>
    </div>
  );
};
