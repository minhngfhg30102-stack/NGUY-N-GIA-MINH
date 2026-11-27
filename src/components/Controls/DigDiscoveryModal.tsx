import React from 'react';
import { Sparkles, Backpack, Eye, X, Award, ShieldAlert, Cpu } from 'lucide-react';
import { ExcavationComponent } from '../../types/excavation';

interface DigDiscoveryModalProps {
  item: ExcavationComponent | null;
  collectedByAstronaut?: boolean;
  onClose: () => void;
  onOpenBackpack: () => void;
  onInspect3D: (id: string) => void;
  isMobile?: boolean;
}

export const DigDiscoveryModal: React.FC<DigDiscoveryModalProps> = ({
  item,
  collectedByAstronaut = false,
  onClose,
  onOpenBackpack,
  onInspect3D,
  isMobile = false,
}) => {
  if (!item) return null;

  // Tier color styling
  const getTierBadge = () => {
    switch (item.tier) {
      case 'red':
        return {
          title: '🔴 BẬC TỐI QUAN TRỌNG (ĐỎ - CAO NHẤT)',
          badgeClass: 'bg-red-500/20 text-red-300 border-red-500/60',
          borderClass: 'border-4 border-red-500 shadow-2xl shadow-red-500/60 ring-4 ring-red-500/30',
          gradientBg: 'from-red-950/90 via-slate-900 to-slate-950',
          barColor: 'bg-gradient-to-r from-red-600 to-rose-400',
        };
      case 'purple':
        return {
          title: '🟣 BẬC RẤT QUAN TRỌNG (TÍM)',
          badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/60',
          borderClass: 'border-4 border-purple-500 shadow-2xl shadow-purple-500/60 ring-4 ring-purple-500/30',
          gradientBg: 'from-purple-950/90 via-slate-900 to-slate-950',
          barColor: 'bg-gradient-to-r from-purple-600 to-fuchsia-400',
        };
      case 'blue':
        return {
          title: '🔵 BẬC QUAN TRỌNG (LAM)',
          badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/60',
          borderClass: 'border-4 border-blue-500 shadow-2xl shadow-blue-500/60 ring-4 ring-blue-500/30',
          gradientBg: 'from-blue-950/90 via-slate-900 to-slate-950',
          barColor: 'bg-gradient-to-r from-blue-600 to-cyan-400',
        };
      case 'green':
        return {
          title: '🟢 BẬC HỮU ÍCH (LỤC)',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60',
          borderClass: 'border-4 border-emerald-500 shadow-2xl shadow-emerald-500/60 ring-4 ring-emerald-500/30',
          gradientBg: 'from-emerald-950/90 via-slate-900 to-slate-950',
          barColor: 'bg-gradient-to-r from-emerald-600 to-teal-400',
        };
      case 'gray':
      default:
        return {
          title: '⚪ BẬC CƠ BẢN (XÁM - THẤP NHẤT)',
          badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/60',
          borderClass: 'border-4 border-slate-400 shadow-xl shadow-slate-400/30 ring-2 ring-slate-500/30',
          gradientBg: 'from-slate-900/95 via-slate-900 to-slate-950',
          barColor: 'bg-gradient-to-r from-slate-500 to-slate-300',
        };
    }
  };

  const style = getTierBadge();

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isMobile ? 'p-2' : 'p-4'} bg-slate-950/80 backdrop-blur-md animate-fade-in pointer-events-auto`}>
      {/* Container with dynamic tier border color */}
      <div
        className={`relative w-full max-w-lg rounded-3xl bg-gradient-to-b ${style.gradientBg} ${style.borderClass} ${
          isMobile ? 'p-4 max-h-[92dvh] overflow-y-auto' : 'p-5 sm:p-7 overflow-hidden'
        } text-white`}
      >
        {/* Background Sparkles Glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Discovery Header Banner */}
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
            <Sparkles className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
              {collectedByAstronaut
                ? 'Phi Hành Gia Đã Đào & Bàn Giao Cho JetBot!'
                : 'Khai Quật Thành Công Dưới Lòng Đất Sao Hỏa!'}
            </span>
            {collectedByAstronaut && (
              <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-[11px] font-bold text-emerald-300">
                <span>👨‍🚀 Nhấn phím [Z] nhận thành công từ phi hành gia</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${style.badgeClass}`}>
                <Award className="w-3.5 h-3.5" />
                <span>{style.title}</span>
              </div>
              <span className="text-[10px] bg-slate-900/90 text-amber-300 font-mono font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                🎯 Tỉ lệ rơi: {item.dropRatePercent}% ({item.dropRatePercent <= 3 ? 'Cực kỳ hiếm' : item.dropRatePercent <= 6 ? 'Hiếm có' : 'Phổ thông'})
              </span>
            </div>
          </div>
        </div>

        {/* Main Component Card Info */}
        <div className="flex flex-col sm:flex-row gap-4 items-start bg-slate-950/70 p-4 rounded-2xl border border-slate-800/90 mb-4">
          {item.realPhotoUrl ? (
            <img
              src={item.realPhotoUrl}
              alt={item.name}
              className="w-24 h-24 sm:w-28 sm:h-28 object-contain bg-white p-1 rounded-xl border border-slate-700 shadow-md flex-shrink-0"
            />
          ) : (
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
              <Cpu className="w-10 h-10 text-amber-400" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-black text-white leading-snug">
              {item.name}
            </h3>
            <p className="text-xs font-mono text-slate-400 mb-2">
              {item.englishName}
            </p>
            <p className="text-xs text-slate-300 line-clamp-2">
              {item.functionSummary}
            </p>
          </div>
        </div>

        {/* Importance Rating & JetBot Assembly Role */}
        <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 mb-5 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold flex items-center gap-1 text-slate-200">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Độ quan trọng khi lắp vào JetBot:
              </span>
              <span className="font-mono font-bold text-sm text-amber-300">
                {item.importanceLabel}
              </span>
            </div>
            {/* Importance Bar */}
            <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${style.barColor} transition-all duration-700`}
                style={{ width: `${item.importanceScore}%` }}
              />
            </div>
          </div>

          <div className="text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
            <strong className="text-amber-300 font-semibold">Vai trò cốt lõi: </strong>
            {item.importanceReason}
          </div>

          {/* Quick Specs */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
            {item.keySpecs.slice(0, 4).map((spec, idx) => (
              <div key={idx} className="bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                <span className="text-slate-400 block">{spec.label}:</span>
                <span className="font-medium text-slate-200 truncate block">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <button
            onClick={() => {
              onClose();
              onOpenBackpack();
            }}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-orange-950/50 cursor-pointer"
          >
            <Backpack className="w-4 h-4" />
            <span>Cất vào Balo & Xem bộ sưu tập</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onInspect3D(item.id);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-xs transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4 text-emerald-400" />
            <span>Xem trên mô hình 3D</span>
          </button>
        </div>
      </div>
    </div>
  );
};
