import React, { useState } from 'react';
import {
  Layers,
  RotateCw,
  Camera,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Cpu,
  Radio,
  Eye,
  Disc,
  Compass,
  Sliders,
  Shield,
  Maximize
} from 'lucide-react';
import { RenderMode, ViewPreset } from '../../types/robot';
import { JETBOT_COMPONENTS } from '../../data/componentsData';

interface BottomDockProps {
  explodedValue: number;
  onExplodedChange: (val: number) => void;
  renderMode: RenderMode;
  onRenderModeChange: (mode: RenderMode) => void;
  isAutoRotate: boolean;
  onToggleAutoRotate: () => void;
  selectedComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
  onViewPreset: (preset: ViewPreset) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onResetView: () => void;
  modelScale?: number;
  onModelScaleChange?: (scale: number) => void;
  isMobile?: boolean;
  isMobileLandscape?: boolean;
  onCloseMobileSheet?: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  explodedValue,
  onExplodedChange,
  renderMode,
  onRenderModeChange,
  isAutoRotate,
  onToggleAutoRotate,
  selectedComponentId,
  onSelectComponent,
  onViewPreset,
  isMuted,
  onToggleMute,
  onResetView,
  modelScale = 1.4,
  onModelScaleChange,
  isMobile = false,
  isMobileLandscape = false,
  onCloseMobileSheet,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'explode' | 'components' | 'camera' | 'display'>('explode');

  const containerStyle = isMobile ? undefined : { width: 'min(920px, 94vw)' };

  return (
    <div
      data-testid="inspect-bottom-dock"
      className={
        isMobile
          ? isMobileLandscape
            ? 'fixed bottom-11 left-2 w-[340px] max-w-[49vw] z-30 pointer-events-auto'
            : 'fixed bottom-[86px] left-2 right-2 z-30 pointer-events-auto'
          : `fixed z-20 left-1/2 -translate-x-1/2 transition-all duration-300 pointer-events-auto ${
              isCollapsed ? 'bottom-2' : 'bottom-5'
            }`
      }
      style={containerStyle}
    >
      {/* Collapse/Expand Handle Bar (Desktop) OR Close Sheet Handle (Mobile) */}
      {isMobile ? (
        <div className={`flex ${isMobileLandscape ? 'justify-start' : 'justify-center'} mb-1`}>
          <button
            type="button"
            onClick={onCloseMobileSheet}
            className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold text-slate-200 bg-slate-900/95 border border-slate-700/80 rounded-full shadow-lg cursor-pointer"
          >
            <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>Thu gọn thanh 3D</span>
          </button>
        </div>
      ) : (
        <div className="flex justify-center mb-1.5">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-full shadow-lg transition-colors cursor-pointer"
          >
            {isCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hiện thanh điều khiển 3D</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                <span>Thu gọn điều khiển (Zen Mode)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Main Dock Container */}
      {(isMobile || !isCollapsed) && (
        <div
          className={`bg-slate-900/95 border border-slate-700/90 shadow-2xl text-slate-200 ${
            isMobile
              ? isMobileLandscape
                ? 'rounded-xl p-2 max-h-[calc(100dvh-6.25rem)] overflow-y-auto'
                : 'rounded-xl p-2 max-h-[34dvh] overflow-y-auto'
              : 'rounded-2xl p-3'
          }`}
        >
          {/* Tabs row */}
          <div className={`flex items-center justify-between gap-1.5 border-b border-slate-800 ${isMobile ? 'pb-1.5 mb-2 px-0.5' : 'pb-2 mb-2.5 px-1'}`}>
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none min-w-0">
              <button
                onClick={() => setActiveTab('explode')}
                className={`flex items-center gap-1 ${isMobile ? 'px-1.5 py-1 text-[10.5px]' : 'px-2.5 py-1.5 text-xs'} font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'explode'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isMobile ? 'Phân rã' : 'Phân rã linh kiện'}</span>
              </button>

              <button
                onClick={() => setActiveTab('components')}
                className={`flex items-center gap-1 ${isMobile ? 'px-1.5 py-1 text-[10.5px]' : 'px-2.5 py-1.5 text-xs'} font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'components'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>{isMobile ? 'Linh kiện' : `Linh kiện (${JETBOT_COMPONENTS.length})`}</span>
              </button>

              <button
                onClick={() => setActiveTab('camera')}
                className={`flex items-center gap-1 ${isMobile ? 'px-1.5 py-1 text-[10.5px]' : 'px-2.5 py-1.5 text-xs'} font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'camera'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{isMobile ? 'Góc nhìn' : 'Góc quan sát'}</span>
              </button>

              <button
                onClick={() => setActiveTab('display')}
                className={`flex items-center gap-1 ${isMobile ? 'px-1.5 py-1 text-[10.5px]' : 'px-2.5 py-1.5 text-xs'} font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'display'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Hiệu ứng</span>
              </button>
            </div>

            {/* Quick Actions Right */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onToggleAutoRotate}
                title={isAutoRotate ? 'Dừng xoay 360°' : 'Tự động xoay 360°'}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isAutoRotate
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onToggleMute}
                title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              </button>

              <button
                onClick={onResetView}
                title="Đặt lại góc nhìn chuẩn"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tab 1: Exploded View Slider */}
          {activeTab === 'explode' && (
            <div className="flex flex-col sm:flex-row items-center gap-3 px-1 py-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 min-w-36">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Độ phân rã 3D:</span>
                <span className="font-mono text-emerald-400 text-sm">
                  {Math.round(explodedValue * 100)}%
                </span>
              </div>

              <div className="flex-1 w-full flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={explodedValue}
                  onChange={(e) => onExplodedChange(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onExplodedChange(0)}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                    explodedValue === 0
                      ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Lắp ráp (0%)
                </button>
                <button
                  onClick={() => onExplodedChange(0.5)}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                    Math.abs(explodedValue - 0.5) < 0.05
                      ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  50%
                </button>
                <button
                  onClick={() => onExplodedChange(1.0)}
                  className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                    explodedValue === 1.0
                      ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tối đa (100%)
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Quick Component Focus Selector */}
          {activeTab === 'components' && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              <button
                onClick={() => onSelectComponent(null)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedComponentId === null
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Toàn bộ Robot
              </button>
              {JETBOT_COMPONENTS.map((comp) => {
                const isSelected = selectedComponentId === comp.id;
                return (
                  <button
                    key={comp.id}
                    onClick={() => onSelectComponent(comp.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: comp.colorHex }}
                    />
                    <span>{comp.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab 3: Camera View Angles */}
          {activeTab === 'camera' && (
            <div className="flex items-center justify-between gap-1.5 overflow-x-auto py-1 scrollbar-none">
              <button
                onClick={() => onViewPreset('iso')}
                className="flex-1 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isMobile ? 'Góc 3D' : 'Góc 3D Đẳng cự'}</span>
              </button>
              <button
                onClick={() => onViewPreset('top')}
                className="flex-1 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Radio className="w-3.5 h-3.5 text-red-400" />
                <span>{isMobile ? 'Mặt trên' : 'Mặt trên (Lidar/Nano)'}</span>
              </button>
              <button
                onClick={() => onViewPreset('front')}
                className="flex-1 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Camera className="w-3.5 h-3.5 text-blue-400" />
                <span>{isMobile ? 'Mặt trước' : 'Mặt trước (Camera CSI)'}</span>
              </button>
              <button
                onClick={() => onViewPreset('bottom')}
                className="flex-1 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Disc className="w-3.5 h-3.5 text-amber-400" />
                <span>{isMobile ? 'Gầm xe' : 'Gầm xe (2 Động cơ DC)'}</span>
              </button>
              <button
                onClick={() => onViewPreset('side')}
                className="flex-1 py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Layers className="w-3.5 h-3.5 text-pink-400" />
                <span>{isMobile ? 'Cạnh bên' : 'Cạnh bên (Tầng mạch)'}</span>
              </button>
            </div>
          )}

          {/* Tab 4: Display & Materials */}
          {activeTab === 'display' && (
            <div className="flex flex-wrap items-center gap-2 py-1">
              <span className="text-xs text-slate-400 mr-2 font-medium">Chế độ hiển thị:</span>
              <button
                onClick={() => onRenderModeChange('realistic')}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                  renderMode === 'realistic'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Chân thực (PBR)
              </button>
              <button
                onClick={() => onRenderModeChange('wireframe')}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                  renderMode === 'wireframe'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Khung dây (Wireframe)
              </button>
              <button
                onClick={() => onRenderModeChange('xray')}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                  renderMode === 'xray'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Tia X (X-Ray)
              </button>

              {onModelScaleChange && (
                <>
                  <div className="h-4 w-px bg-slate-700 mx-1.5" />
                  <span className="text-xs text-slate-400 font-medium">Kích thước:</span>
                  <button
                    onClick={() => onModelScaleChange(1.0)}
                    className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                      modelScale === 1.0
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    100%
                  </button>
                  <button
                    onClick={() => onModelScaleChange(1.4)}
                    className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                      modelScale === 1.4
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    140% (To rõ)
                  </button>
                  <button
                    onClick={() => onModelScaleChange(1.8)}
                    className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                      modelScale === 1.8
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    180% (Cận cảnh)
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
