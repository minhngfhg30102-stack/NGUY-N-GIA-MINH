import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Cpu,
  Eye,
  SlidersHorizontal,
  Workflow,
  Sparkles,
  Info,
  Maximize2,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  CheckCircle2,
  Layers,
  ChevronsUpDown,
  RotateCcw,
} from 'lucide-react';
import { JETBOT_COMPONENTS, CMU_LESSON_INFO } from '../../data/componentsData';
import { ComponentCategory, RobotComponent } from '../../types/robot';
import { CATEGORY_LABELS, filterComponents, getComponentPhotos } from './componentFilter';

interface ComponentTableProps {
  onInspect3D: (componentId: string) => void;
  selectedComponentId: string | null;
  onOpenAiGuide: (initialQuery?: string) => void;
  isMobile?: boolean;
  isMobileLandscape?: boolean;
}

const CATEGORY_ORDER: ComponentCategory[] = [
  'processing',
  'sensor',
  'actuator',
  'structure',
  'connectivity',
  'power',
];

export const ComponentTable: React.FC<ComponentTableProps> = ({
  onInspect3D,
  selectedComponentId,
  onOpenAiGuide,
  isMobile = false,
  isMobileLandscape = false,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'table' | 'cards' | 'architecture'>('table');
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(() => new Set());
  const [detailComponent, setDetailComponent] = useState<RobotComponent | null>(null);
  const [activeModalPhotoIdx, setActiveModalPhotoIdx] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActiveModalPhotoIdx(0);
  }, [detailComponent?.id]);

  const categoryCounts = useMemo(() => {
    const counts: Record<ComponentCategory, number> = {
      processing: 0,
      sensor: 0,
      actuator: 0,
      structure: 0,
      connectivity: 0,
      power: 0,
    };
    for (const comp of JETBOT_COMPONENTS) {
      counts[comp.category] += 1;
    }
    return counts;
  }, []);

  const filteredComponents = useMemo(
    () => filterComponents(JETBOT_COMPONENTS, searchQuery, selectedCategory),
    [searchQuery, selectedCategory]
  );

  const allFilteredExpanded =
    filteredComponents.length > 0 &&
    filteredComponents.every((comp) => expandedRowIds.has(comp.id));

  const toggleRowExpand = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleExpandAll = () => {
    if (allFilteredExpanded) {
      setExpandedRowIds(new Set());
    } else {
      setExpandedRowIds(new Set(filteredComponents.map((c) => c.id)));
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const modalList = filteredComponents.length > 0 ? filteredComponents : JETBOT_COMPONENTS;
  const activeDetailIndex = detailComponent
    ? modalList.findIndex((c) => c.id === detailComponent.id)
    : -1;

  const handleStepDetail = (delta: -1 | 1) => {
    if (!detailComponent || modalList.length === 0) return;
    const baseIdx = activeDetailIndex >= 0 ? activeDetailIndex : 0;
    const nextIdx = (baseIdx + delta + modalList.length) % modalList.length;
    setDetailComponent(modalList[nextIdx]);
  };

  useEffect(() => {
    if (!detailComponent) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetailComponent(null);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStepDetail(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleStepDetail(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className={`w-full max-w-7xl mx-auto text-slate-100 ${isMobile ? 'px-2.5 py-2.5' : 'px-4 py-6'}`}>
      {/* Header Banner */}
      <div
        className={`bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 shadow-xl ${
          isMobile
            ? isMobileLandscape
              ? 'rounded-xl p-2 mb-2'
              : 'rounded-xl p-2.5 mb-2.5'
            : 'rounded-2xl p-6 mb-6'
        }`}
      >
        <div className={`flex ${isMobileLandscape ? 'flex-row items-center' : 'flex-col md:flex-row items-start md:items-center'} justify-between ${isMobile ? 'gap-2' : 'gap-4'}`}>
          <div className="min-w-0">
            {!isMobileLandscape && (
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${
                  isMobile ? 'text-[10px] mb-1' : 'px-3 py-1 text-xs sm:text-sm mb-2.5'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>{CMU_LESSON_INFO.title}</span>
              </div>
            )}
            <h2
              className={`font-bold text-white tracking-tight flex items-center gap-2 ${
                isMobile
                  ? isMobileLandscape
                    ? 'text-sm truncate'
                    : 'text-[15px] leading-snug'
                  : 'text-2xl sm:text-3xl'
              }`}
            >
              <span>Bảng Phân Tích Linh Kiện &amp; Ảnh Minh Họa Thực Tế</span>
            </h2>
            {!isMobile && (
              <p className="text-sm sm:text-base text-slate-200 mt-1.5 max-w-3xl leading-relaxed">
                Tổng hợp hình ảnh chụp thực tế ngoài đời, thông số kỹ thuật và giải thích chi tiết từng bước <span className="text-emerald-400 font-semibold">cách thức hoạt động</span> của 15 bộ phận cấu thành đầy đủ nhất của robot JetBot.
              </p>
            )}
          </div>

          <div className={`flex items-center shrink-0 ${isMobileLandscape ? 'w-auto' : 'flex-wrap w-full md:w-auto'} ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isMobile ? 'px-2.5 py-1 text-xs' : 'gap-2 px-3.5 py-2 text-sm'
              } ${
                activeTab === 'table'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isMobile ? 'Bảng & Ảnh' : 'Bảng linh kiện & Ảnh'}</span>
            </button>

            <button
              onClick={() => setActiveTab('cards')}
              className={`flex items-center gap-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isMobile ? 'px-2.5 py-1 text-xs' : 'gap-2 px-3.5 py-2 text-sm'
              } ${
                activeTab === 'cards'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{isMobile ? 'Thẻ chi tiết' : 'Thẻ chi tiết hoạt động'}</span>
            </button>

            <button
              onClick={() => setActiveTab('architecture')}
              className={`flex items-center gap-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isMobile ? 'px-2.5 py-1 text-xs' : 'gap-2 px-3.5 py-2 text-sm'
              } ${
                activeTab === 'architecture'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>{isMobile ? 'Sơ đồ' : 'Sơ đồ hệ thống'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search Input, Type Selector, Category Chips & Expand All */}
      {(activeTab === 'table' || activeTab === 'cards') && (
        <div
          data-testid="component-search-toolbar"
          className={`bg-slate-900/85 border border-slate-800 rounded-xl ${
            isMobile
              ? isMobileLandscape
                ? 'p-2 mb-2 space-y-1.5'
                : 'p-2.5 mb-2.5 space-y-2'
              : 'p-4 mb-5 space-y-3.5'
          }`}
        >
          <div className={`flex ${isMobileLandscape ? 'flex-row items-center' : 'flex-col md:flex-row items-stretch md:items-center'} justify-between ${isMobile ? 'gap-1.5' : 'gap-2.5'}`}>
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className={`absolute ${isMobile ? 'left-2.5 w-3.5 h-3.5' : 'left-3.5 w-4 h-4'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`} />
              <input
                ref={searchInputRef}
                type="text"
                data-testid="component-search-input"
                aria-label="Tìm kiếm linh kiện theo tên hoặc loại"
                placeholder={isMobile ? 'Tìm theo tên, loại linh kiện...' : 'Tìm theo tên (Jetson, Lidar, Motor...), loại (Cảm biến, Nguồn...), giao thức hoặc cách hoạt động...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && searchQuery) {
                    e.stopPropagation();
                    setSearchQuery('');
                  }
                }}
                className={`w-full bg-slate-950 border border-slate-700/80 rounded-xl ${isMobile ? 'pl-8 pr-7 py-1.5 text-xs' : 'pl-10 pr-9 py-2.5 text-sm'} text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    requestAnimationFrame(() => searchInputRef.current?.focus());
                  }}
                  data-testid="clear-search-btn"
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Type Dropdown + Quick Bulk Inspection Actions */}
            <div className={`flex items-center ${isMobile ? 'gap-1.5 overflow-x-auto scrollbar-none' : 'flex-wrap gap-2'} shrink-0`}>
              <select
                aria-label="Lọc theo loại linh kiện"
                data-testid="component-type-select"
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value as ComponentCategory | 'all')
                }
                className={`bg-slate-950 border border-slate-700/80 rounded-xl ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'} font-medium text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer shrink-0`}
              >
                <option value="all">Tất cả loại ({JETBOT_COMPONENTS.length})</option>
                {CATEGORY_ORDER.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]} ({categoryCounts[cat]})
                  </option>
                ))}
              </select>

              {activeTab === 'table' && filteredComponents.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleExpandAll}
                  data-testid="toggle-expand-all-btn"
                  className={`flex items-center gap-1 rounded-xl border ${isMobile ? 'px-2.5 py-1.5 text-xs' : 'gap-1.5 px-3.5 py-2.5 text-sm'} font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    allFilteredExpanded
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                  }`}
                >
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                  <span>
                    {allFilteredExpanded ? (isMobile ? 'Thu gọn' : 'Thu gọn tất cả') : (isMobile ? 'Mở tất cả' : 'Mở chi tiết tất cả')}
                  </span>
                </button>
              )}

              {filteredComponents.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDetailComponent(filteredComponents[0])}
                  data-testid="open-all-details-modal-btn"
                  className={`flex items-center gap-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 ${isMobile ? 'px-2.5 py-1.5 text-xs' : 'gap-1.5 px-3.5 py-2.5 text-sm'} font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isMobile ? 'Xem từng bộ phận' : 'Xem chi tiết từng bộ phận'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Chips + Live Count Metadata */}
          <div className={`flex items-center justify-between gap-2 border-t border-slate-800/80 ${isMobile ? 'pt-1.5' : 'flex-wrap gap-2.5 pt-2.5'}`}>
            <div className={`flex items-center ${isMobile ? 'gap-1.5 overflow-x-auto scrollbar-none min-w-0 flex-1 text-[11px]' : 'flex-wrap gap-2 text-xs sm:text-sm'}`}>
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                data-testid="category-chip-all"
                className={`${isMobile ? 'px-2 py-1' : 'px-3 py-1.5'} rounded-lg font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer tabular-nums ${
                  selectedCategory === 'all'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                Tất cả ({JETBOT_COMPONENTS.length})
              </button>
              {CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  data-testid={`category-chip-${cat}`}
                  className={`${isMobile ? 'px-2 py-1' : 'px-3 py-1.5'} rounded-lg font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer tabular-nums ${
                    selectedCategory === cat
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {CATEGORY_LABELS[cat]} ({categoryCounts[cat]})
                </button>
              ))}
            </div>

            <div
              data-testid="component-filter-count"
              className={`${isMobile ? 'text-[11px]' : 'text-sm'} text-slate-300 whitespace-nowrap shrink-0 tabular-nums`}
            >
              {isMobile ? (
                <>
                  <span className="font-bold text-emerald-400">{filteredComponents.length}</span>/{JETBOT_COMPONENTS.length}
                </>
              ) : (
                <>
                  Hiển thị <span className="font-bold text-emerald-400">{filteredComponents.length}</span> /{' '}
                  {JETBOT_COMPONENTS.length} linh kiện
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EMPTY STATE FOR TABLE & CARDS */}
      {(activeTab === 'table' || activeTab === 'cards') && filteredComponents.length === 0 && (
        <div
          data-testid="component-empty-state"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3"
        >
          <Search className="w-9 h-9 text-slate-500 mx-auto" />
          <div className="text-lg font-bold text-slate-100">
            Không tìm thấy linh kiện phù hợp
          </div>
          <p className="text-sm text-slate-300 max-w-md mx-auto">
            Không có linh kiện nào khớp với từ khóa{' '}
            {searchQuery ? <span className="text-emerald-300 font-mono">"{searchQuery}"</span> : 'đã chọn'} trong danh mục hiện tại.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            data-testid="reset-filters-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Đặt lại tìm kiếm &amp; bộ lọc</span>
          </button>
        </div>
      )}

      {/* TAB 1: TABLE VIEW WITH REAL PHOTOS & EXPANDABLE OPERATION */}
      {activeTab === 'table' && filteredComponents.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm sm:text-[15px]">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-300 text-xs sm:text-sm font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-3 w-32 text-center">Ảnh ngoài đời</th>
                  <th className="py-3.5 px-4 w-56">Bộ phận / Linh kiện</th>
                  <th className="py-3.5 px-4 w-48">Vị trí lắp đặt</th>
                  <th className="py-3.5 px-4">Chức năng cơ bản</th>
                  <th className="py-3.5 px-4 w-64">Cách thức hoạt động</th>
                  <th className="py-3.5 px-3 w-36 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-sans">
                {filteredComponents.map((comp) => {
                  const isSelected = selectedComponentId === comp.id;
                  const isExpanded = expandedRowIds.has(comp.id);
                  const photoCount = getComponentPhotos(comp).length;

                  return (
                    <React.Fragment key={comp.id}>
                      <tr
                        data-testid={`component-row-${comp.id}`}
                        className={`transition-colors hover:bg-slate-800/50 ${
                          isSelected ? 'bg-emerald-950/35 ring-1 ring-inset ring-emerald-500/40' : ''
                        }`}
                      >
                        {/* Real-world Photo Thumbnail */}
                        <td className="py-4 px-3 align-top text-center">
                          <div
                            onClick={() => setDetailComponent(comp)}
                            className={`relative group cursor-pointer inline-block rounded-xl overflow-hidden border border-slate-700/80 shadow hover:border-emerald-500 transition-all ${isMobile ? 'w-20' : ''}`}
                            title="Bấm để xem chi tiết linh kiện và tất cả ảnh thực tế"
                          >
                            <img
                              src={comp.realPhotoUrl}
                              alt={comp.name}
                              className={`${isMobile ? 'w-20 h-20' : 'w-24 h-20'} object-contain bg-white p-1.5 pb-5 group-hover:scale-105 transition-transform duration-200`}
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Maximize2 className="w-5 h-5 text-emerald-400" />
                            </div>
                            <span className={`absolute bottom-0 inset-x-0 bg-slate-950/90 ${isMobile ? 'text-[10px]' : 'text-[11px]'} font-mono font-semibold text-emerald-300 text-center py-0.5 border-t border-slate-800 whitespace-nowrap`}>
                              {photoCount} ảnh thật 🔍
                            </span>
                          </div>
                        </td>

                        {/* Name & English Name */}
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-start gap-2.5">
                            <span
                              className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                              style={{ backgroundColor: comp.colorHex }}
                            />
                            <div>
                              <div className="font-bold text-base sm:text-lg text-white leading-snug">
                                {comp.name}
                              </div>
                              <div className="text-xs sm:text-sm text-slate-400 font-mono mt-0.5">
                                {comp.englishName}
                              </div>
                              <span className="inline-block mt-1.5 text-xs sm:text-sm font-semibold px-2.5 py-0.5 rounded-md bg-slate-800 text-emerald-300 border border-slate-700">
                                {comp.categoryLabel}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-4 px-4 text-slate-200 align-top text-sm sm:text-[15px] leading-relaxed">
                          <span className="font-medium text-slate-100">{comp.location}</span>
                          <div className="mt-1.5 text-xs sm:text-sm text-cyan-300 font-mono">
                            {comp.interfaceType.split(',')[0]}
                          </div>
                        </td>

                        {/* Core Function */}
                        <td className="py-4 px-4 align-top text-sm sm:text-[15px]">
                          <p className="text-slate-100 font-medium leading-relaxed">
                            {comp.functionSummary}
                          </p>
                          <div className="mt-2 text-xs sm:text-sm text-emerald-400 font-mono leading-relaxed">
                            ⚡ CMU 10A: {comp.cmuRole}
                          </div>
                        </td>

                        {/* How it works preview & accordion toggle */}
                        <td className="py-4 px-4 align-top">
                          <div className="text-slate-200 text-sm leading-relaxed line-clamp-3 mb-2">
                            {comp.workingPrinciple}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleRowExpand(comp.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-500/50 border border-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-4 h-4 text-emerald-400" />
                                <span>Đóng cách hoạt động</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4 text-emerald-400" />
                                <span>Xem 4 bước hoạt động</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Action buttons */}
                        <td className="py-4 px-3 align-top text-center">
                          <div className="flex flex-col items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onInspect3D(comp.id)}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-all shadow hover:shadow-emerald-500/20 cursor-pointer text-sm"
                              title="Tập trung và soi linh kiện này trên mô hình 3D"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Soi 3D</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDetailComponent(comp)}
                              data-testid={`view-detail-${comp.id}`}
                              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 transition-colors cursor-pointer text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0"
                              title="Xem chi tiết thông số, ảnh thực tế và cách hoạt động"
                            >
                              <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Chi tiết</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenAiGuide(`Hãy giải thích chi tiết nguyên lý hoạt động và cách lập trình ${comp.name} trong JetBot.`)}
                              className="text-xs sm:text-sm text-slate-300 hover:text-emerald-400 flex items-center gap-1 py-0.5 cursor-pointer font-medium"
                            >
                              <Info className="w-3.5 h-3.5" />
                              <span>Hỏi AI</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable "How It Works" Details Row */}
                      {isExpanded && (() => {
                        const rowPhotos = getComponentPhotos(comp);
                        return (
                        <tr
                          data-testid={`component-expanded-${comp.id}`}
                          className="bg-slate-950/90 border-b border-slate-800"
                        >
                          <td colSpan={6} className="p-5">
                            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-5 shadow-inner space-y-4">
                              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                                  <h4 className="font-bold text-base sm:text-lg text-emerald-300">
                                    Chi Tiết Cách Thức Hoạt Động Của {comp.name} ({comp.englishName})
                                  </h4>
                                </div>
                                <span className="text-xs sm:text-sm font-mono text-cyan-400 bg-cyan-950/60 px-3 py-1 rounded-lg border border-cyan-800/40">
                                  Giao thức: {comp.interfaceType}
                                </span>
                              </div>

                              {/* Attached Real Photos Strip */}
                              {rowPhotos.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  {rowPhotos.map((photo, pIdx) => (
                                    <button
                                      key={photo.url}
                                      type="button"
                                      onClick={() => {
                                        setDetailComponent(comp);
                                        setActiveModalPhotoIdx(pIdx);
                                      }}
                                      className="group text-left bg-slate-950 border border-slate-800 hover:border-emerald-500/60 rounded-xl overflow-hidden transition-all cursor-pointer"
                                    >
                                      <div className="h-32 bg-white p-1.5 overflow-hidden">
                                        <img
                                          src={photo.url}
                                          alt={`${comp.name} - ${photo.label}`}
                                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                                        />
                                      </div>
                                      <div className="px-3 py-2 text-xs sm:text-sm font-semibold text-emerald-300 border-t border-slate-800 flex items-center justify-between">
                                        <span className="truncate">{photo.label}</span>
                                        <Maximize2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* 4-Step How It Works Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                {comp.howItWorksSteps.map((step) => (
                                  <div
                                    key={step.step}
                                    className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 relative flex flex-col justify-between"
                                  >
                                    <div>
                                      <div className="flex items-center gap-2 mb-1.5 text-emerald-400 text-sm font-bold">
                                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-mono shrink-0">
                                          {step.step}
                                        </span>
                                        <span>{step.title}</span>
                                      </div>
                                      <p className="text-slate-200 text-sm leading-relaxed">
                                        {step.desc}
                                      </p>
                                    </div>
                                    <div className="mt-2.5 pt-1.5 border-t border-slate-900 text-xs text-slate-500 font-mono">
                                      Giai đoạn {step.step}/4
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Specs & Highlights footer */}
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm pt-2 border-t border-slate-800/80">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-slate-400 font-semibold">Thông số cốt lõi:</span>
                                  {comp.keySpecs.map((s, idx) => (
                                    <span
                                      key={idx}
                                      className="bg-slate-950 px-2.5 py-1 rounded-lg text-xs sm:text-sm text-slate-300 border border-slate-800"
                                    >
                                      <span className="text-slate-400">{s.label}: </span>
                                      <span className="text-emerald-400 font-mono font-medium">{s.value}</span>
                                    </span>
                                  ))}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => onInspect3D(comp.id)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all cursor-pointer text-sm shrink-0"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span>Soi góc quay linh kiện này trên 3D</span>
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RICH VISUAL CARDS VIEW */}
      {activeTab === 'cards' && filteredComponents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredComponents.map((comp) => {
            const isSelected = selectedComponentId === comp.id;

            return (
              <div
                key={comp.id}
                className={`bg-slate-900 border rounded-2xl overflow-hidden shadow-xl transition-all ${
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Card Top: Real Photo & Quick Meta */}
                <div className="relative h-48 bg-white overflow-hidden group p-2 pb-10">
                  <img
                    src={comp.realPhotoUrl}
                    alt={comp.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/55 via-35% to-transparent pointer-events-none" />

                  {/* Badges on top */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-md flex items-center gap-1.5"
                      style={{ backgroundColor: `${comp.colorHex}cc` }}
                    >
                      <span className="w-2 h-2 rounded-full bg-white" />
                      <span>{comp.categoryLabel}</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-950/80 text-emerald-300 border border-emerald-500/40 backdrop-blur-sm">
                      {getComponentPhotos(comp).length} ảnh thực tế
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDetailComponent(comp)}
                    className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-slate-950/85 hover:bg-emerald-500 hover:text-slate-950 text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors backdrop-blur-sm cursor-pointer"
                    title="Mở chi tiết linh kiện & tất cả ảnh thực tế"
                  >
                    <Maximize2 className="w-4 h-4" />
                    <span>Xem ảnh &amp; chi tiết</span>
                  </button>

                  {/* Title overlay at bottom of photo */}
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-xl font-bold text-white drop-shadow-md">
                      {comp.name}
                    </h3>
                    <div className="text-sm text-slate-200 font-mono drop-shadow">
                      {comp.englishName} · {comp.location}
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-4">
                  {/* Photo Caption */}
                  <div className="text-sm text-slate-200 bg-slate-950/75 p-3 rounded-xl border border-slate-800 leading-relaxed">
                    <span className="text-emerald-400 font-bold">🔍 Nhận diện ảnh thực tế: </span>
                    {comp.realPhotoCaption}
                  </div>

                  {/* Function summary */}
                  <div>
                    <h5 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Chức năng cơ bản</span>
                    </h5>
                    <p className="text-sm sm:text-[15px] text-slate-100 leading-relaxed font-medium">
                      {comp.functionSummary}
                    </p>
                  </div>

                  {/* How it works 4 steps */}
                  <div>
                    <h5 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      <span>Cách thức hoạt động từng bước</span>
                    </h5>
                    <div className="space-y-2">
                      {comp.howItWorksSteps.map((step) => (
                        <div
                          key={step.step}
                          className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-sm"
                        >
                          <div className="font-bold text-emerald-300 flex items-center gap-1.5 mb-1">
                            <span className="text-emerald-400 font-mono">#{step.step}</span>
                            <span>{step.title}</span>
                          </div>
                          <div className="text-slate-200 leading-relaxed text-sm">
                            {step.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Key Specs */}
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {comp.keySpecs.slice(0, 4).map((spec, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950 px-3 py-2 rounded-xl text-sm border border-slate-800 flex items-center justify-between gap-2"
                        >
                          <span className="text-slate-400">{spec.label}:</span>
                          <span className="text-emerald-300 font-mono font-semibold text-right">{spec.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => onOpenAiGuide(`Hãy giải thích chi tiết cách thức hoạt động và vai trò của ${comp.name} trong JetBot.`)}
                      className="text-sm text-slate-300 hover:text-emerald-400 flex items-center gap-1.5 cursor-pointer font-medium"
                    >
                      <Info className="w-4 h-4" />
                      <span>Hỏi thêm trợ lý</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onInspect3D(comp.id)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow hover:shadow-emerald-500/20 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Soi trên 3D</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: SYSTEM ARCHITECTURE & SIGNAL FLOW */}
      {activeTab === 'architecture' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Workflow className="w-6 h-6 text-emerald-400" />
              <span>Sơ Đồ Luồng Tín Hiệu &amp; Năng Lượng JetBot (Signal &amp; Power Flow)</span>
            </h3>
            <p className="text-sm sm:text-base text-slate-200 mt-1.5">
              Mô tả cách thức trung tâm xử lý NVIDIA Jetson Nano thu thập dữ liệu cảm biến, tính toán và xuất lệnh điều khiển động cơ.
            </p>
          </div>

          {/* Diagram Flow Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Input Column */}
            <div className="space-y-3">
              <div className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>1. CẢM BIẾN ĐẦU VÀO (INPUTS)</span>
              </div>

              <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-4">
                <div className="font-bold text-base text-cyan-300">RPLIDAR A1/A2</div>
                <div className="text-sm text-slate-300 mt-1">Quét laser 360° khoảng cách vật cản</div>
                <div className="text-xs sm:text-sm font-mono text-cyan-300 mt-2 bg-cyan-950/60 px-2.5 py-1 rounded inline-block">
                  UART / USB Serial → 115200 baud
                </div>
              </div>

              <div className="bg-slate-950 border border-blue-500/30 rounded-xl p-4">
                <div className="font-bold text-base text-blue-300">Camera CSI Sony IMX219</div>
                <div className="text-sm text-slate-300 mt-1">Thu video HD góc rộng 160° phục vụ thị giác máy</div>
                <div className="text-xs sm:text-sm font-mono text-blue-300 mt-2 bg-blue-950/60 px-2.5 py-1 rounded inline-block">
                  MIPI-CSI 2-lane → Zero-Copy GPU Buffer
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-700 rounded-xl p-4">
                <div className="font-bold text-base text-slate-200">Anten Wi-Fi Băng tần kép</div>
                <div className="text-sm text-slate-300 mt-1">Nhận lệnh điều khiển từ xa &amp; truyền Telemetry</div>
                <div className="text-xs sm:text-sm font-mono text-pink-300 mt-2 bg-pink-950/60 px-2.5 py-1 rounded inline-block">
                  M.2 PCIe / 802.11ac → TCP/IP ROS Web
                </div>
              </div>
            </div>

            {/* Core Processing Column */}
            <div className="space-y-3">
              <div className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>2. XỬ LÝ TRUNG TÂM (CORE BRAIN)</span>
              </div>

              <div className="bg-gradient-to-b from-emerald-950/50 to-slate-950 border-2 border-emerald-500 rounded-xl p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-lg text-emerald-300">NVIDIA JETSON NANO</div>
                  <Cpu className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="text-sm text-slate-200 mt-1.5">
                  128-Core Maxwell GPU · Quad ARM A57 · 4GB RAM
                </div>

                <div className="mt-3.5 space-y-2 text-sm text-slate-200 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-mono">▸</span>
                    <span>Hệ điều hành: Ubuntu Linux + ROS Core</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-mono">▸</span>
                    <span>Thị giác máy tính: OpenCV + TensorRT</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-mono">▸</span>
                    <span>Định vị &amp; Bản đồ: 2D SLAM Gmapping</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-mono">▸</span>
                    <span>Điều khiển động học: Differential Kinematics</span>
                  </div>
                </div>

                <div className="mt-3.5 text-center">
                  <div className="text-xs sm:text-sm font-mono text-emerald-300 bg-emerald-950/80 px-3 py-1.5 rounded-lg inline-block border border-emerald-500/30">
                    I2C Bus (SDA / SCL) + GPIO PWM Lệnh vận tốc
                  </div>
                </div>
              </div>
            </div>

            {/* Output Column */}
            <div className="space-y-3">
              <div className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>3. CHẤP HÀNH &amp; CHUYỂN ĐỘNG (OUTPUTS)</span>
              </div>

              <div className="bg-slate-950 border border-purple-500/30 rounded-xl p-4">
                <div className="font-bold text-base text-purple-300">Mạch Điều Khiển Động Cơ</div>
                <div className="text-sm text-slate-300 mt-1">Cầu H kép (TB6612FNG / PCA9685) cấp xung PWM</div>
                <div className="text-xs sm:text-sm font-mono text-purple-300 mt-2 bg-purple-950/60 px-2.5 py-1 rounded inline-block">
                  Cấp dòng công suất 1.2A - 3A
                </div>
              </div>

              <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-4">
                <div className="font-bold text-base text-amber-300">2 Động Cơ DC Giảm Tốc</div>
                <div className="text-sm text-slate-300 mt-1">Tạo mô-men xoắn kéo và đo vận tốc bằng Encoder</div>
                <div className="text-xs sm:text-sm font-mono text-amber-300 mt-2 bg-amber-950/60 px-2.5 py-1 rounded inline-block">
                  Tỷ số truyền 1:48 giảm tốc
                </div>
              </div>

              <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-4">
                <div className="font-bold text-base text-cyan-300">2 Bánh Chủ Động + Caster Wheel</div>
                <div className="text-sm text-slate-300 mt-1">Dẫn động vi sai: Tiến, lùi, rẽ và quay 360° tại chỗ</div>
                <div className="text-xs sm:text-sm font-mono text-cyan-300 mt-2 bg-cyan-950/60 px-2.5 py-1 rounded inline-block">
                  Zero-Radius Turn (Bán kính rẽ = 0)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE COMPONENT DETAIL & HOW-IT-WORKS MODAL */}
      {detailComponent && createPortal((() => {
        const modalPhotos = getComponentPhotos(detailComponent);
        const safePhotoIdx =
          modalPhotos.length > 0 ? Math.min(activeModalPhotoIdx, modalPhotos.length - 1) : 0;
        const activePhoto = modalPhotos[safePhotoIdx] ?? {
          url: detailComponent.realPhotoUrl,
          label: 'Ảnh thực tế',
          caption: detailComponent.realPhotoCaption,
        };

        return (
        <div
          data-testid="component-detail-modal"
          className={`fixed inset-0 z-50 flex items-center justify-center ${isMobile ? 'p-2' : 'p-3 sm:p-6'} bg-slate-950/90 backdrop-blur-md animate-fade-in`}
          onClick={() => setDetailComponent(null)}
        >
          <div
            className={`w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
              isMobile ? 'max-h-[94dvh]' : 'max-h-[92vh]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with Prev / Next Navigation */}
            <div
              className={`flex items-center justify-between gap-2 bg-slate-950 border-b border-slate-800 ${
                isMobile ? 'px-3 py-2.5' : 'px-5 py-4 gap-3'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: detailComponent.colorHex }}
                />
                <div className="min-w-0">
                  <h3 className="font-bold text-lg sm:text-xl text-white truncate">
                    {detailComponent.name} ({detailComponent.englishName})
                  </h3>
                  <div className="text-xs sm:text-sm text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="text-emerald-400 font-semibold">{detailComponent.categoryLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      Linh kiện {(activeDetailIndex >= 0 ? activeDetailIndex : 0) + 1} / {modalList.length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleStepDetail(-1)}
                  data-testid="detail-prev-btn"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Linh kiện trước (Phím mũi tên trái)"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Trước</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStepDetail(1)}
                  data-testid="detail-next-btn"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Linh kiện tiếp theo (Phím mũi tên phải)"
                >
                  <span>Tiếp</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDetailComponent(null)}
                  aria-label="Đóng cửa sổ chi tiết"
                  className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer hover:bg-slate-800 ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Component Jump Strip */}
            <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/95 border-b border-slate-800 overflow-x-auto scrollbar-none">
              {modalList.map((item, idx) => {
                const isCurrent = item.id === detailComponent.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDetailComponent(item)}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer tabular-nums ${
                      isCurrent
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {idx + 1}. {item.name}
                  </button>
                );
              })}
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
              {/* Top 2-col: Real Photo Gallery + Core Summary & Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-white p-3 flex items-center justify-center min-h-[250px]">
                    <img
                      src={activePhoto.url}
                      alt={`${detailComponent.name} - ${activePhoto.label}`}
                      data-testid="modal-active-photo"
                      className="w-full h-auto max-h-[290px] object-contain"
                    />

                    <div className="absolute top-2.5 left-2.5 px-3 py-1 rounded-full bg-slate-950/85 border border-slate-700 text-xs font-bold text-emerald-300 shadow pointer-events-none">
                      📸 {activePhoto.label}
                    </div>

                    {modalPhotos.length > 1 && (
                      <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-slate-950/85 border border-slate-700 text-xs font-mono font-bold text-cyan-300 shadow pointer-events-none tabular-nums">
                        {safePhotoIdx + 1}/{modalPhotos.length}
                      </div>
                    )}

                    {modalPhotos.length > 1 && (
                      <>
                        <button
                          type="button"
                          aria-label="Ảnh thực tế trước"
                          data-testid="modal-photo-prev"
                          onClick={() =>
                            setActiveModalPhotoIdx((safePhotoIdx - 1 + modalPhotos.length) % modalPhotos.length)
                          }
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/85 hover:bg-slate-900 text-white border border-slate-700 shadow-lg cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Ảnh thực tế tiếp theo"
                          data-testid="modal-photo-next"
                          onClick={() =>
                            setActiveModalPhotoIdx((safePhotoIdx + 1) % modalPhotos.length)
                          }
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/85 hover:bg-slate-900 text-white border border-slate-700 shadow-lg cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Thumbnail gallery switcher - all attached photos visible at once */}
                  {modalPhotos.length > 1 && (
                    <div
                      className={`grid gap-2 ${
                        modalPhotos.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
                      }`}
                    >
                      {modalPhotos.map((photo, idx) => {
                        const isActive = idx === safePhotoIdx;
                        return (
                          <button
                            key={photo.url}
                            type="button"
                            data-testid={`modal-photo-thumb-${idx}`}
                            onClick={() => setActiveModalPhotoIdx(idx)}
                            className={`rounded-xl overflow-hidden border-2 flex flex-col bg-slate-950 transition-all cursor-pointer ${
                              isActive
                                ? 'border-emerald-400 ring-2 ring-emerald-500/30 shadow-md'
                                : 'border-slate-700 opacity-85 hover:opacity-100 hover:border-slate-500'
                            }`}
                          >
                            <div className="w-full h-14 bg-white overflow-hidden">
                              <img
                                src={photo.url}
                                alt={photo.label}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span
                              className={`w-full px-1.5 py-1 text-xs font-medium truncate text-center ${
                                isActive ? 'text-emerald-300 font-bold bg-emerald-950/50' : 'text-slate-300'
                              }`}
                            >
                              {photo.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {activePhoto.caption && (
                    <div className="bg-slate-950/90 px-3.5 py-2.5 rounded-xl border border-slate-800 text-sm text-slate-200 leading-relaxed">
                      <span className="font-bold text-cyan-400">Góc chụp này: </span>
                      {activePhoto.caption}
                    </div>
                  )}
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 text-sm sm:text-[15px]">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Chức năng cơ bản
                    </div>
                    <p className="text-slate-100 leading-relaxed font-medium text-base">
                      {detailComponent.functionSummary}
                    </p>
                  </div>

                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Vị trí &amp; Giao thức kết nối
                    </div>
                    <p className="text-slate-200 leading-relaxed">{detailComponent.location}</p>
                    <p className="text-cyan-300 font-mono text-sm mt-1.5 font-medium">
                      {detailComponent.interfaceType}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80">
                    <div className="text-xs sm:text-sm font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                      Vai trò trong bài học CMU 10A
                    </div>
                    <p className="text-slate-200 leading-relaxed">{detailComponent.cmuRole}</p>
                  </div>
                </div>
              </div>

              {/* General Working Principle */}
              <div className="bg-slate-950 p-5 rounded-xl border border-emerald-500/30 space-y-2">
                <div className="text-sm sm:text-base font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-2">
                  <Cpu className="w-5 h-5" />
                  <span>Nguyên lý hoạt động tổng quát</span>
                </div>
                <p className="text-sm sm:text-base text-slate-100 leading-relaxed">
                  {detailComponent.workingPrinciple}
                </p>
              </div>

              {/* How it works 4-step workflow */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="text-sm sm:text-base font-bold text-cyan-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Workflow className="w-5 h-5" />
                  <span>Quy trình hoạt động chi tiết 4 bước (How It Works)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detailComponent.howItWorksSteps.map((step) => (
                    <div
                      key={step.step}
                      className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-sm"
                    >
                      <div className="font-bold text-emerald-300 text-sm sm:text-[15px] mb-1.5 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs font-mono tabular-nums shrink-0">
                          {step.step}
                        </span>
                        <span>{step.title}</span>
                      </div>
                      <p className="text-slate-200 text-sm leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Specs & Real-world Visual Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wide">
                    Thông số kỹ thuật chi tiết
                  </div>
                  <div className="divide-y divide-slate-800/80 text-sm">
                    {detailComponent.keySpecs.map((spec, idx) => (
                      <div key={idx} className="py-2 flex items-start justify-between gap-3">
                        <span className="text-slate-400 shrink-0 font-medium">{spec.label}</span>
                        <span className="text-emerald-300 font-mono text-right font-semibold">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wide">
                    Nhận diện trên ảnh thực tế
                  </div>
                  <p className="text-sm sm:text-[15px] text-slate-200 leading-relaxed">
                    {detailComponent.realPhotoCaption}
                  </p>
                  {detailComponent.realPhotoHighlights && (
                    <div className="space-y-2 pt-1">
                      {detailComponent.realPhotoHighlights.map((hl, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-sm text-slate-200 leading-relaxed"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                          <span>{hl}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  onInspect3D(detailComponent.id);
                  setDetailComponent(null);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg hover:shadow-emerald-500/20 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Eye className="w-4 h-4" />
                <span>Xem đối chiếu trên mô hình 3D</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenAiGuide(`Hãy giải thích chi tiết hơn về cách ${detailComponent.name} hoạt động trong JetBot.`);
                  setDetailComponent(null);
                }}
                className="text-sm font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Hỏi trợ lý AI →
              </button>
            </div>
          </div>
        </div>
        );
      })(), document.body)}
    </div>
  );
};
