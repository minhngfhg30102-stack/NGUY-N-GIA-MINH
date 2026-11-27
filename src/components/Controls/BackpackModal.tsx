import React, { useState } from 'react';
import {
  Backpack,
  X,
  Sparkles,
  Lock,
  Eye,
  CheckCircle2,
  ShieldAlert,
  Award,
  Layers,
  Info
} from 'lucide-react';
import { ComponentTier, InventoryItem } from '../../types/excavation';
import { EXCAVATION_COMPONENTS } from '../../data/excavationData';

interface BackpackModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<string, InventoryItem>; // map of compId -> InventoryItem
  onInspect3D: (id: string) => void;
  isMobile?: boolean;
}

export const BackpackModal: React.FC<BackpackModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onInspect3D,
  isMobile = false,
}) => {
  const [selectedTier, setSelectedTier] = useState<ComponentTier | 'all'>('all');
  const [activeItemDetail, setActiveItemDetail] = useState<InventoryItem | null>(null);

  if (!isOpen) return null;

  const totalPossible = EXCAVATION_COMPONENTS.length; // 15
  const uniqueCollected = Object.keys(inventory).length;
  const progressPercent = Math.round((uniqueCollected / totalPossible) * 100);

  // Filter items
  const filteredCatalog = EXCAVATION_COMPONENTS.filter((comp) => {
    if (selectedTier === 'all') return true;
    return comp.tier === selectedTier;
  });

  const getTierBorder = (tier: ComponentTier) => {
    switch (tier) {
      case 'red':
        return 'border-2 border-red-500 shadow-lg shadow-red-500/20 bg-red-950/30';
      case 'purple':
        return 'border-2 border-purple-500 shadow-lg shadow-purple-500/20 bg-purple-950/30';
      case 'blue':
        return 'border-2 border-blue-500 shadow-lg shadow-blue-500/20 bg-blue-950/30';
      case 'green':
        return 'border-2 border-emerald-500 shadow-lg shadow-emerald-500/20 bg-emerald-950/30';
      case 'gray':
      default:
        return 'border-2 border-slate-500 shadow-md shadow-slate-500/10 bg-slate-900/40';
    }
  };

  const getTierTag = (tier: ComponentTier) => {
    switch (tier) {
      case 'red':
        return { label: '🔴 Đỏ (Tối quan trọng)', class: 'bg-red-500/20 text-red-300 border-red-500/50' };
      case 'purple':
        return { label: '🟣 Tím (Rất quan trọng)', class: 'bg-purple-500/20 text-purple-300 border-purple-500/50' };
      case 'blue':
        return { label: '🔵 Lam (Quan trọng)', class: 'bg-blue-500/20 text-blue-300 border-blue-500/50' };
      case 'green':
        return { label: '🟢 Lục (Hữu ích)', class: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' };
      case 'gray':
      default:
        return { label: '⚪ Xám (Cơ bản)', class: 'bg-slate-500/20 text-slate-300 border-slate-500/50' };
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isMobile ? 'p-2' : 'p-3 sm:p-6'} bg-slate-950/80 backdrop-blur-md animate-fade-in pointer-events-auto`}>
      <div
        className={`relative w-full max-w-4xl bg-slate-900/95 border border-slate-700/90 shadow-2xl flex flex-col overflow-hidden text-slate-100 ${
          isMobile ? 'h-[94dvh] max-h-[94dvh] rounded-2xl' : 'h-[90vh] max-h-[820px] rounded-3xl'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b border-slate-800 bg-slate-950/60 ${
            isMobile ? 'px-3.5 py-2.5' : 'px-5 sm:px-7 py-4'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`${isMobile ? 'w-8 h-8 rounded-xl' : 'w-10 h-10 rounded-2xl'} bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow shrink-0`}>
              <Backpack className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className={`${isMobile ? 'text-sm' : 'text-base sm:text-lg'} font-black text-white truncate`}>
                  BALO LINH KIỆN SAO HỎA
                </h2>
                <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 shrink-0">
                  {uniqueCollected}/{totalPossible} Món
                </span>
              </div>
              {!isMobile && (
                <p className="text-xs text-slate-400 font-mono">
                  Linh kiện khai quật từ các đồi cát và hố va chạm · Xếp hạng theo độ quan trọng khi lắp ráp JetBot
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar & Tier Legend Banner */}
        <div className={`${isMobile ? 'px-3.5 py-2 space-y-1.5' : 'px-5 sm:px-7 py-3 space-y-2.5'} bg-slate-950/40 border-b border-slate-800/80`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-medium text-slate-300">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Tiến độ thu thập & Hoàn thiện JetBot:</span>
              <strong className="text-emerald-400 font-bold">{progressPercent}%</strong>
            </div>

            {/* Rarity Ranking Legend & Drop Rates */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
              <span className="text-slate-400">Tỉ lệ rơi:</span>
              <span className="px-1.5 py-0.5 rounded border border-red-500 text-red-400 bg-red-950/40" title="Tối quan trọng: Tỉ lệ siêu hiếm 2% - 3%">🔴 Đỏ (2% - 3%)</span>
              <span className="px-1.5 py-0.5 rounded border border-purple-500 text-purple-400 bg-purple-950/40" title="Rất quan trọng: Tỉ lệ 5% - 6%">🟣 Tím (5% - 6%)</span>
              <span className="px-1.5 py-0.5 rounded border border-blue-500 text-blue-400 bg-blue-950/40" title="Quan trọng: Tỉ lệ 7% - 9%">🔵 Lam (7% - 9%)</span>
              <span className="px-1.5 py-0.5 rounded border border-emerald-500 text-emerald-400 bg-emerald-950/40" title="Hữu ích: Tỉ lệ 9% - 11%">🟢 Lục (9% - 11%)</span>
              <span className="px-1.5 py-0.5 rounded border border-slate-500 text-slate-400 bg-slate-900/40" title="Cơ bản: Tỉ lệ phổ thông 6% - 6.5%">⚪ Xám (6% - 6.5%)</span>
            </div>
          </div>

          {/* Progress bar line */}
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Filter Tabs by Tier */}
        <div className={`flex items-center gap-1.5 ${isMobile ? 'px-3.5 py-1.5' : 'px-5 sm:px-7 py-2.5'} bg-slate-950/20 border-b border-slate-800/60 overflow-x-auto scrollbar-none text-xs font-semibold shrink-0`}>
          <button
            onClick={() => setSelectedTier('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              selectedTier === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Tất cả ({totalPossible})
          </button>
          <button
            onClick={() => setSelectedTier('red')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              selectedTier === 'red'
                ? 'bg-red-500 text-white border-red-400 font-bold'
                : 'border-red-500/40 text-red-400 hover:bg-red-950/40'
            }`}
          >
            🔴 Đỏ (Tối quan trọng)
          </button>
          <button
            onClick={() => setSelectedTier('purple')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              selectedTier === 'purple'
                ? 'bg-purple-500 text-white border-purple-400 font-bold'
                : 'border-purple-500/40 text-purple-400 hover:bg-purple-950/40'
            }`}
          >
            🟣 Tím (Rất quan trọng)
          </button>
          <button
            onClick={() => setSelectedTier('blue')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              selectedTier === 'blue'
                ? 'bg-blue-500 text-white border-blue-400 font-bold'
                : 'border-blue-500/40 text-blue-400 hover:bg-blue-950/40'
            }`}
          >
            🔵 Lam (Quan trọng)
          </button>
          <button
            onClick={() => setSelectedTier('green')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              selectedTier === 'green'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/40'
            }`}
          >
            🟢 Lục (Hữu ích)
          </button>
          <button
            onClick={() => setSelectedTier('gray')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
              selectedTier === 'gray'
                ? 'bg-slate-400 text-slate-950 border-slate-300 font-bold'
                : 'border-slate-500/40 text-slate-400 hover:bg-slate-800'
            }`}
          >
            ⚪ Xám (Cơ bản)
          </button>
        </div>

        {/* Content Area: Grid of components + Inspection Drawer */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredCatalog.map((comp) => {
            const collected = inventory[comp.id];
            const isUnlocked = !!collected;
            const tag = getTierTag(comp.tier);
            const borderStyle = isUnlocked
              ? getTierBorder(comp.tier)
              : 'border-2 border-slate-800/80 bg-slate-950/40 opacity-60';

            return (
              <div
                key={comp.id}
                onClick={() => isUnlocked && setActiveItemDetail(collected)}
                className={`relative rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 ${borderStyle} ${
                  isUnlocked ? 'hover:scale-[1.02] cursor-pointer' : 'cursor-not-allowed'
                }`}
              >
                {/* Top Badge & Quantity */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tag.class}`}>
                        {tag.label}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-amber-300/90 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-700/80" title="Tỉ lệ đào trúng">
                        {comp.dropRatePercent}%
                      </span>
                    </div>

                    {isUnlocked ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        x{collected.count}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                        <Lock className="w-3 h-3" />
                        Chưa tìm thấy
                      </span>
                    )}
                  </div>

                  {/* Thumbnail & Title */}
                  <div className="flex items-center gap-3 mb-2.5">
                    {comp.realPhotoUrl && isUnlocked ? (
                      <img
                        src={comp.realPhotoUrl}
                        alt={comp.name}
                        className="w-14 h-14 object-contain bg-white p-0.5 rounded-xl border border-slate-700 shadow flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center flex-shrink-0">
                        {isUnlocked ? (
                          <Sparkles className="w-6 h-6 text-amber-400" />
                        ) : (
                          <Lock className="w-6 h-6 text-slate-600" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h4 className={`text-sm font-bold truncate ${isUnlocked ? 'text-white' : 'text-slate-400'}`}>
                        {comp.name}
                      </h4>
                      <p className="text-[11px] font-mono text-slate-500 truncate">
                        {comp.englishName}
                      </p>
                      <div className="text-[11px] text-amber-400 font-semibold mt-0.5">
                        {comp.importanceLabel}
                      </div>
                    </div>
                  </div>

                  {/* Summary / Hint */}
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {isUnlocked ? comp.functionSummary : 'Hãy lái JetBot tới các đồi cát có cờ mốc khoa học để dùng xẻng đào bới linh kiện này!'}
                  </p>
                </div>

                {/* Footer actions */}
                {isUnlocked && (
                  <div className="pt-3 mt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 font-mono truncate max-w-[160px]">
                      📍 {collected.foundLocationName}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        onInspect3D(comp.id);
                      }}
                      className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold text-[11px] hover:underline cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem 3D</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Item Detail Drawer Modal */}
        {activeItemDetail && (
          <div className="absolute inset-0 z-20 bg-slate-950/95 p-5 sm:p-7 flex flex-col justify-between overflow-y-auto animate-fade-in">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getTierTag(activeItemDetail.tier).class}`}>
                    {getTierTag(activeItemDetail.tier).label}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Đã đào được: x{activeItemDetail.count} chiếc
                  </span>
                </div>

                <button
                  onClick={() => setActiveItemDetail(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-5 items-start mb-5">
                {activeItemDetail.realPhotoUrl && (
                  <img
                    src={activeItemDetail.realPhotoUrl}
                    alt={activeItemDetail.name}
                    className="w-32 h-32 object-contain bg-white p-1.5 rounded-2xl border-2 border-slate-700 shadow-xl flex-shrink-0"
                  />
                )}
                <div>
                  <h3 className="text-xl font-black text-white mb-1">
                    {activeItemDetail.name}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono mb-2">
                    {activeItemDetail.englishName} · Vị trí: {activeItemDetail.location}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {activeItemDetail.functionSummary}
                  </p>
                </div>
              </div>

              {/* JetBot Role Explanation */}
              <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 mb-4 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-400 text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Độ quan trọng khi lắp ráp vào JetBot: {activeItemDetail.importanceLabel}</span>
                </div>
                <p className="text-slate-200 leading-relaxed">
                  {activeItemDetail.importanceReason}
                </p>
                <div className="text-emerald-300 pt-1 font-medium">
                  <strong>Ý nghĩa bài học CMU 10A: </strong>
                  {activeItemDetail.cmuRole}
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {activeItemDetail.keySpecs.map((s, idx) => (
                  <div key={idx} className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">{s.label}</span>
                    <strong className="text-slate-200 font-semibold">{s.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setActiveItemDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
              >
                Quay lại danh sách
              </button>

              <button
                onClick={() => {
                  onClose();
                  onInspect3D(activeItemDetail.id);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-950 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Xem vị trí 3D trên JetBot</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
