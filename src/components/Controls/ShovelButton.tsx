import React from 'react';
import { Shovel, Sparkles, Loader2, PackageCheck, Bot, UserRound } from 'lucide-react';
import { AstronautDigStatus, DigMode } from '../../types/robot';

interface ShovelButtonProps {
  canDig: boolean;
  isDigging: boolean;
  digProgress: number; // 0 to 100
  digSiteName?: string;
  onDig: () => void;
  digMode: DigMode;
  onDigModeChange: (mode: DigMode) => void;
  astronautStatus?: AstronautDigStatus;
  astronautName?: string;
  astronautDistanceToBot?: number;
  astronautCanReceiveZ?: boolean;
  pendingItemName?: string;
  onReceiveFromAstronaut?: () => void;
  positionClass?: string;
  isMobile?: boolean;
  isMobileLandscape?: boolean;
  alignLeft?: boolean;
}

export const ShovelButton: React.FC<ShovelButtonProps> = ({
  canDig,
  isDigging,
  digProgress,
  digSiteName,
  onDig,
  digMode,
  onDigModeChange,
  astronautStatus = 'idle',
  astronautName,
  astronautDistanceToBot,
  astronautCanReceiveZ = false,
  pendingItemName,
  onReceiveFromAstronaut,
  positionClass = 'bottom-24 right-6 sm:bottom-28 sm:right-10',
  isMobile = false,
  isMobileLandscape = false,
  alignLeft = false,
}) => {
  const isAstronautBusy = astronautStatus !== 'idle';
  if (!canDig && !isDigging && !isAstronautBusy) return null;

  const isActionLocked = isDigging || (digMode === 'astronaut' && isAstronautBusy);
  const useHorizontalMobile = isMobile && isMobileLandscape;

  return (
    <div
      data-testid="dig-hud-container"
      className={`fixed ${positionClass} z-25 flex ${
        useHorizontalMobile
          ? alignLeft
            ? 'flex-row-reverse items-end gap-1.5'
            : 'flex-row items-end gap-1.5'
          : alignLeft
          ? 'flex-col items-start gap-1.5'
          : 'flex-col items-end gap-1.5'
      } animate-fade-in pointer-events-auto`}
    >
      <div
        className={`flex flex-col ${
          alignLeft ? 'items-start' : 'items-end'
        } ${isMobile ? 'gap-1' : 'gap-1.5'}`}
      >
        {/* Active Astronaut Excavation / Delivery Banner & [Z] Receive Action */}
        {isAstronautBusy && (
          <div
            data-testid="astronaut-delivery-banner"
            className={`rounded-xl border shadow-2xl backdrop-blur-md transition-all ${
              astronautCanReceiveZ
                ? 'bg-emerald-950/92 border-emerald-400/80 text-emerald-100 ring-2 ring-emerald-400/40'
                : 'bg-slate-950/92 border-amber-500/60 text-amber-200'
            } ${isMobile ? 'p-1.5 max-w-[185px] text-[10px]' : 'p-2.5 max-w-[290px] text-xs'}`}
          >
            {astronautStatus === 'digging' && (
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-amber-300 truncate">
                    👨‍🚀 {astronautName || 'Phi hành gia'} đang đào...
                  </div>
                  {!isMobile && (
                    <div className="text-[10px] text-slate-300 truncate">
                      Đang tìm linh kiện để mang lại gần JetBot
                    </div>
                  )}
                </div>
              </div>
            )}

            {(astronautStatus === 'carrying' || astronautStatus === 'ready-handoff') && !astronautCanReceiveZ && (
              <div className="flex items-center gap-1.5">
                <PackageCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-cyan-300 truncate">
                    📦 {astronautName || 'Phi hành gia'} đang lại gần
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">
                    <span className="text-amber-300 font-semibold">{pendingItemName || 'linh kiện'}</span>
                    {typeof astronautDistanceToBot === 'number' ? ` · ${astronautDistanceToBot.toFixed(1)}m` : ''}
                  </div>
                </div>
              </div>
            )}

            {astronautCanReceiveZ && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-emerald-300 truncate">
                      {astronautName || 'Phi hành gia'} đã mang tới!
                    </div>
                    {pendingItemName && (
                      <div className="text-[10px] text-amber-300 font-semibold truncate">
                        🎁 {pendingItemName}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="astronaut-receive-btn"
                  onClick={onReceiveFromAstronaut}
                  className={`w-full flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black uppercase tracking-wide shadow-lg cursor-pointer active:scale-95 transition-all ${
                    isMobile ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'
                  }`}
                  title="Nhấn phím Z hoặc bấm để JetBot nhận linh kiện từ phi hành gia"
                >
                  <span className="px-1.5 py-0.5 rounded bg-slate-950/20 font-mono font-black">
                    Z
                  </span>
                  <span>Nhận linh kiện</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dig Mode Switcher: Direct JetBot Dig vs Astronaut Dig & Deliver */}
        <div
          role="group"
          aria-label="Chọn cách đào"
          className={`flex items-center rounded-xl bg-slate-950/90 border border-slate-700/80 p-0.5 shadow-xl backdrop-blur-md ${
            isMobile ? 'text-[10px]' : 'text-[11px]'
          }`}
        >
          <button
            type="button"
            data-testid="dig-mode-jetbot"
            disabled={isDigging || isAstronautBusy}
            onClick={() => onDigModeChange('jetbot')}
            className={`flex items-center gap-1 ${
              isMobile ? 'px-1.5 py-0.5' : 'px-2 py-1'
            } rounded-lg font-bold transition-colors whitespace-nowrap ${
              digMode === 'jetbot'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            } ${isDigging || isAstronautBusy ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            title="Xe JetBot tự đào trực tiếp tại chỗ"
          >
            <Bot className="w-3 h-3 shrink-0" />
            <span>{isMobile ? 'Xe đào' : 'Xe tự đào'}</span>
          </button>

          <button
            type="button"
            data-testid="dig-mode-astronaut"
            disabled={isDigging || isAstronautBusy}
            onClick={() => onDigModeChange('astronaut')}
            className={`flex items-center gap-1 ${
              isMobile ? 'px-1.5 py-0.5' : 'px-2 py-1'
            } rounded-lg font-bold transition-colors whitespace-nowrap ${
              digMode === 'astronaut'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            } ${isDigging || isAstronautBusy ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            title="Phi hành gia sẽ đào bới, mang lại gần JetBot rồi nhấn Z để nhận"
          >
            <UserRound className="w-3 h-3 shrink-0" />
            <span>{isMobile ? 'Phi hành' : 'Phi hành gia đào'}</span>
          </button>
        </div>

        {/* Dig Site Tooltip / Hotkey Notification (Hidden in ultra-compact landscape unless actively digging to keep HUD small) */}
        {!isAstronautBusy && (!useHorizontalMobile || isDigging) && (
          <div
            className={`flex items-center gap-1 rounded-xl bg-slate-950/90 border border-amber-500/60 shadow-xl backdrop-blur-md font-medium text-amber-300 ${
              isMobile ? 'px-2 py-0.5 text-[9.5px] max-w-[165px]' : 'px-3 py-1.5 text-xs gap-2'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">
              {isDigging
                ? 'Đang đào...'
                : digMode === 'astronaut'
                ? isMobile
                  ? 'Phi hành gia đào → [Z]'
                  : 'Phi hành gia đào & mang lại [Z]'
                : digSiteName
                ? isMobile
                  ? digSiteName
                  : `Điểm đào: ${digSiteName}`
                : isMobile
                ? 'Có linh kiện!'
                : 'Phát hiện tín hiệu linh kiện!'}
            </span>
            {!isMobile && (
              <span className="text-[10px] bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded font-mono font-bold border border-amber-500/40">
                [Phím E]
              </span>
            )}
          </div>
        )}
      </div>

      {/* Primary Shovel Button */}
      <button
        type="button"
        data-testid="dig-action-btn"
        onClick={onDig}
        disabled={isActionLocked}
        className={`relative group flex items-center justify-center shrink-0 ${
          isMobile ? 'w-11 h-11 rounded-xl' : 'w-16 h-16 sm:w-18 sm:h-18 rounded-2xl'
        } transition-all duration-200 shadow-2xl active:scale-95 ${
          isActionLocked
            ? 'bg-amber-600/80 text-white cursor-wait ring-4 ring-amber-400/70'
            : digMode === 'astronaut'
            ? 'bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-slate-950 font-bold ring-2 sm:ring-4 ring-cyan-400/50 hover:ring-cyan-300 shadow-cyan-950/60 hover:scale-105 cursor-pointer'
            : 'bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold ring-2 sm:ring-4 ring-amber-400/50 hover:ring-amber-300 shadow-orange-950/60 hover:scale-105 cursor-pointer'
        }`}
        title={
          digMode === 'astronaut'
            ? 'Bấm để cử phi hành gia đi đào và mang linh kiện lại gần JetBot (Phím E)'
            : 'Bấm để dùng xẻng đào bới linh kiện dưới lòng đất Sao Hỏa (Phím E)'
        }
      >
        {isDigging ? (
          <div className="flex flex-col items-center justify-center">
            <Loader2 className={`${isMobile ? 'w-4 h-4' : 'w-7 h-7 sm:w-8 sm:h-8'} animate-spin text-white mb-0.5`} />
            <span className="text-[9px] font-mono font-bold text-amber-100">
              {Math.round(digProgress)}%
            </span>
          </div>
        ) : digMode === 'astronaut' && isAstronautBusy ? (
          <div className="flex flex-col items-center justify-center">
            <UserRound className={`${isMobile ? 'w-4 h-4' : 'w-7 h-7'} text-white mb-0.5`} />
            <span className="text-[8.5px] font-mono font-bold text-amber-100">
              {astronautCanReceiveZ ? 'NHẤN Z' : 'ĐANG ĐI'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <Shovel
                className={`${isMobile ? 'w-4 h-4' : 'w-8 h-8 sm:w-9 sm:h-9'} text-slate-950 drop-shadow group-hover:rotate-[-12deg] transition-transform duration-200`}
              />
              {digMode === 'astronaut' && (
                <UserRound className="w-3 h-3 text-slate-950 bg-white rounded-full p-0.5 absolute -bottom-1 -right-1.5 shadow" />
              )}
            </div>
            <span
              className={`${isMobile ? 'text-[8.5px]' : 'text-[10px]'} font-black uppercase tracking-wider text-slate-950 mt-0.5`}
            >
              ĐÀO
            </span>
          </div>
        )}
      </button>
    </div>
  );
};
