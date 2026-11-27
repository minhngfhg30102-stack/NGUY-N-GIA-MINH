import React, { useRef, useEffect, useState } from 'react';
import {
  Play,
  Square,
  EyeOff,
  Code2,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Terminal,
  ShieldAlert,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  FilePlus2,
  Plus,
  X,
  Pencil,
  BookOpen,
  FileCode2,
  ClipboardPaste,
  Save,
} from 'lucide-react';
import {
  CodeLanguage,
  LANGUAGE_INFO,
  LogEntry,
  PRESETS_BY_LANGUAGE,
} from '../JetBot3D/autonomousRunner';
import {
  AUTO_MEMBER_NAMESPACES,
  applyCompletion,
  CompletionContext,
  CompletionItem,
  CompletionKind,
  extractCompletionContext,
  getCompletionsForContext,
  toggleLineComments,
} from './codeAutocomplete';

export type IdeWorkspaceMode = 'custom' | 'presets';

export interface CustomCodeFile {
  id: string;
  name: string;
  language: CodeLanguage;
  code: string;
}

interface AutonomousCodePanelProps {
  workspaceMode: IdeWorkspaceMode;
  onWorkspaceModeChange: (mode: IdeWorkspaceMode) => void;
  customFiles: CustomCodeFile[];
  activeCustomFileId: string;
  onSelectCustomFile: (id: string) => void;
  onCreateCustomFile: () => void;
  onCreateCustomFileWithCode?: (pastedCode: string, detectedLang?: CodeLanguage) => void;
  onDeleteCustomFile: (id: string) => void;
  onRenameCustomFile: (id: string, nextName: string) => void;
  language: CodeLanguage;
  onLanguageChange: (lang: CodeLanguage) => void;
  code: string;
  onCodeChange: (nextCode: string) => void;
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  onResetPreset: () => void;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSaveFile?: () => void;
  hasUnsavedChanges?: boolean;
  lastSavedLabel?: string | null;
  saveTick?: number;
  logs: LogEntry[];
  onClearLogs: () => void;
  errorMsg: string | null;
  lastRunMs: number | null;
  dangerProb: number;
  isMobile?: boolean;
  isMobileLandscape?: boolean;
}

const LANGUAGES_ORDER: CodeLanguage[] = ['python', 'javascript', 'cpp'];

const LANG_EXT: Record<CodeLanguage, string> = {
  python: '.py',
  javascript: '.js',
  cpp: '.cpp',
};

function detectCodeLanguage(raw: string): CodeLanguage | null {
  const s = raw.trim();
  if (!s) return null;
  if (
    /#include\b|using\s+namespace\s+std|Serial\.(?:println|print)|void\s+(?:setup|loop)\s*\(|int\s+main\s*\(|\bcout\s*<<|\bprintf\s*\(/.test(
      s
    )
  ) {
    return 'cpp';
  }
  if (
    /\bconsole\.(?:log|warn|error)\b|\b(?:const|let|var)\s+[a-zA-Z_]\w*\s*=|\basync\s+function\b|\bfunction\s+[a-zA-Z_]\w*\s*\(|=>/.test(
      s
    )
  ) {
    return 'javascript';
  }
  if (
    /\bdef\s+[a-zA-Z_]\w*\s*\(|\bprint\s*\(|\belif\b|\bwhile\s+True\s*:|\bfor\s+[a-zA-Z_]\w*\s+in\s+/.test(
      s
    )
  ) {
    return 'python';
  }
  return null;
}

const KIND_BADGE: Record<CompletionKind, { tag: string; cls: string }> = {
  sdk: { tag: 'SDK', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' },
  sensor: { tag: 'CẢM BIẾN', cls: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30' },
  fn: { tag: 'HÀM', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/30' },
  snip: { tag: 'MẪU', cls: 'text-violet-300 bg-violet-500/15 border-violet-500/30' },
  kw: { tag: 'TỪ KHÓA', cls: 'text-slate-300 bg-slate-700/60 border-slate-600' },
};

export const AutonomousCodePanel: React.FC<AutonomousCodePanelProps> = ({
  workspaceMode,
  onWorkspaceModeChange,
  customFiles,
  activeCustomFileId,
  onSelectCustomFile,
  onCreateCustomFile,
  onCreateCustomFileWithCode,
  onDeleteCustomFile,
  onRenameCustomFile,
  language,
  onLanguageChange,
  code,
  onCodeChange,
  selectedPresetId,
  onSelectPreset,
  onResetPreset,
  isRunning,
  onStart,
  onStop,
  isCollapsed,
  onToggleCollapse,
  isExpanded,
  onToggleExpand,
  onSaveFile,
  hasUnsavedChanges = false,
  lastSavedLabel = null,
  saveTick = 0,
  logs,
  onClearLogs,
  errorMsg,
  lastRunMs,
  dangerProb,
  isMobile = false,
  isMobileLandscape = false,
}) => {
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pasteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const autocompleteListRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState<string>('');
  const [isPasteBoxOpen, setIsPasteBoxOpen] = useState(false);
  const [pasteBuffer, setPasteBuffer] = useState('');
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);

  const [completionItems, setCompletionItems] = useState<CompletionItem[]>([]);
  const [completionCtx, setCompletionCtx] = useState<CompletionContext | null>(null);
  const [activeCompletionIdx, setActiveCompletionIdx] = useState(0);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [logs.length]);

  useEffect(() => {
    if (saveTick <= 0) return;
    setJustSaved(true);
    const timer = window.setTimeout(() => setJustSaved(false), 2200);
    return () => window.clearTimeout(timer);
  }, [saveTick]);

  useEffect(() => {
    if (!isAutocompleteOpen || !autocompleteListRef.current) return;
    const activeEl = autocompleteListRef.current.children[activeCompletionIdx] as
      | HTMLElement
      | undefined;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeCompletionIdx, isAutocompleteOpen]);

  // Close autocomplete cleanly if language/file/run state changes
  useEffect(() => {
    setIsAutocompleteOpen(false);
  }, [language, activeCustomFileId, workspaceMode, isRunning]);

  const presetsForLang = PRESETS_BY_LANGUAGE[language];
  const currentPreset =
    presetsForLang.find((p) => p.id === selectedPresetId) || presetsForLang[0];
  const langMeta = LANGUAGE_INFO[language];
  const activeCustomFile =
    customFiles.find((f) => f.id === activeCustomFileId) || customFiles[0];

  const displayFileName =
    workspaceMode === 'custom' && activeCustomFile
      ? `${activeCustomFile.name}${LANG_EXT[language]}`
      : langMeta.fileName;

  const lineCount = Math.max(1, code.split('\n').length);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard fallback ignored silently in restricted iframes
    }
  };

  const handleOpenPasteBox = async () => {
    const nextOpen = !isPasteBoxOpen;
    setIsPasteBoxOpen(nextOpen);
    setClipboardNotice(null);
    if (nextOpen) {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText) {
          setPasteBuffer(clipText);
          setClipboardNotice('Đã tự đọc từ Clipboard.');
        }
      } catch {
        setClipboardNotice('Nhấn Ctrl+V để dán đoạn code vừa sao chép.');
      }
      requestAnimationFrame(() => pasteInputRef.current?.focus());
    }
  };

  const handleReadClipboardAgain = async () => {
    setClipboardNotice(null);
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setPasteBuffer(clipText);
        setClipboardNotice('Đã nạp nội dung từ Clipboard.');
      } else {
        setClipboardNotice('Clipboard hiện đang trống.');
      }
    } catch {
      setClipboardNotice('Trình duyệt chặn đọc tự động — hãy bấm vào ô bên dưới và nhấn Ctrl+V.');
      pasteInputRef.current?.focus();
    }
  };

  const detectedPasteLang = detectCodeLanguage(pasteBuffer);

  const handleApplyPasteReplace = () => {
    if (!pasteBuffer.trim()) return;
    if (detectedPasteLang && detectedPasteLang !== language) {
      onLanguageChange(detectedPasteLang);
    }
    onCodeChange(pasteBuffer);
    setIsPasteBoxOpen(false);
    setPasteBuffer('');
    setClipboardNotice(null);
  };

  const handleApplyPasteNewFile = () => {
    if (!pasteBuffer.trim()) return;
    if (onCreateCustomFileWithCode) {
      onCreateCustomFileWithCode(pasteBuffer, detectedPasteLang ?? undefined);
    } else {
      onCodeChange(pasteBuffer);
    }
    setIsPasteBoxOpen(false);
    setPasteBuffer('');
    setClipboardNotice(null);
  };

  const commitRename = () => {
    if (renamingId) {
      onRenameCustomFile(renamingId, renameDraft);
      setRenamingId(null);
    }
  };

  const openAutocompleteAt = (text: string, cursorPos: number) => {
    const ctx = extractCompletionContext(text, cursorPos);
    const items = getCompletionsForContext(language, ctx);
    if (items.length === 0) {
      setIsAutocompleteOpen(false);
      return;
    }
    setCompletionCtx(ctx);
    setCompletionItems(items);
    setActiveCompletionIdx(0);
    setIsAutocompleteOpen(true);
  };

  const handleSelectCompletion = (item: CompletionItem) => {
    const target = textareaRef.current;
    const cursorPos = target ? target.selectionStart : code.length;
    const ctx = completionCtx || extractCompletionContext(code, cursorPos);
    const { nextCode, nextCursorPos } = applyCompletion(code, ctx, item);
    onCodeChange(nextCode);
    setIsAutocompleteOpen(false);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = nextCursorPos;
        textareaRef.current.selectionEnd = nextCursorPos;
      }
    });
  };

  const handleToggleCommentShortcut = () => {
    const target = textareaRef.current;
    const start = target ? target.selectionStart : 0;
    const end = target ? target.selectionEnd : 0;
    const { nextCode, nextSelStart, nextSelEnd } = toggleLineComments(
      code,
      start,
      end,
      language
    );
    onCodeChange(nextCode);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = nextSelStart;
        textareaRef.current.selectionEnd = nextSelEnd;
      }
    });
  };

  const handleTriggerAutocompleteBtn = () => {
    if (isRunning) return;
    const target = textareaRef.current;
    const cursorPos = target ? target.selectionStart : code.length;
    target?.focus();
    openAutocompleteAt(code, cursorPos);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? nextValue.length;
    onCodeChange(nextValue);

    const ctx = extractCompletionContext(nextValue, cursorPos);
    const shouldAutoShow =
      (ctx.objectPrefix !== null && AUTO_MEMBER_NAMESPACES.has(ctx.objectPrefix)) ||
      (isAutocompleteOpen && (ctx.query.length > 0 || ctx.objectPrefix !== null));

    if (shouldAutoShow) {
      const items = getCompletionsForContext(language, ctx);
      if (items.length > 0) {
        setCompletionCtx(ctx);
        setCompletionItems(items);
        setActiveCompletionIdx(0);
        setIsAutocompleteOpen(true);
      } else {
        setIsAutocompleteOpen(false);
      }
    } else if (isAutocompleteOpen) {
      setIsAutocompleteOpen(false);
    }
  };

  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      e.stopPropagation();
      onSaveFile?.();
      return;
    }
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      setIsAutocompleteOpen(false);
      if (isRunning) {
        onStop();
      } else {
        onStart();
      }
      return;
    }
    if (e.key === 'Escape' && e.shiftKey && isRunning) {
      e.preventDefault();
      e.stopPropagation();
      onStop();
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const mod = e.ctrlKey || e.metaKey;

    // 1. Trigger Autocomplete: Ctrl+Space (or Alt+/)
    if ((mod && e.code === 'Space') || (e.altKey && e.key === '/')) {
      e.preventDefault();
      openAutocompleteAt(code, target.selectionStart);
      return;
    }

    // 2. Toggle line comment: Ctrl+/ or Cmd+/
    if (mod && e.key === '/') {
      e.preventDefault();
      handleToggleCommentShortcut();
      return;
    }

    // 3. Save File: Ctrl+S or Cmd+S
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onSaveFile?.();
      return;
    }

    // 4. Run / Stop: Ctrl+Enter or Cmd+Enter
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      setIsAutocompleteOpen(false);
      if (isRunning) {
        onStop();
      } else {
        onStart();
      }
      return;
    }

    // 5. Autocomplete Popup Navigation
    if (isAutocompleteOpen && completionItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveCompletionIdx((prev) => (prev + 1) % completionItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveCompletionIdx(
          (prev) => (prev - 1 + completionItems.length) % completionItems.length
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = completionItems[activeCompletionIdx] || completionItems[0];
        if (chosen) handleSelectCompletion(chosen);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsAutocompleteOpen(false);
        return;
      }
    }

    // 6. Standard Tab 4-space indent & Enter auto-indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = `${code.slice(0, start)}    ${code.slice(end)}`;
      onCodeChange(updated);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const lineStart = code.lastIndexOf('\n', start - 1) + 1;
      const currentLine = code.slice(lineStart, start);
      const baseIndentMatch = /^\s*/.exec(currentLine);
      const baseIndent = baseIndentMatch ? baseIndentMatch[0] : '';
      const trimmedRight = currentLine.trimEnd();
      const extraIndent =
        trimmedRight.endsWith(':') || trimmedRight.endsWith('{') ? '    ' : '';
      const insert = `\n${baseIndent}${extraIndent}`;
      const updated = `${code.slice(0, start)}${insert}${code.slice(end)}`;
      onCodeChange(updated);
      requestAnimationFrame(() => {
        const nextPos = start + insert.length;
        target.selectionStart = target.selectionEnd = nextPos;
      });
    }
  };

  const dangerPct = Math.round(dangerProb * 100);
  const dangerBarClass =
    dangerProb >= 0.65
      ? 'bg-red-500'
      : dangerProb >= 0.4
      ? 'bg-amber-400'
      : 'bg-emerald-400';

  if (isCollapsed) {
    return (
      <div
        className={`fixed ${
          isMobile ? 'bottom-[108px] right-2' : 'bottom-5 right-6'
        } z-30 flex items-center gap-2 pointer-events-auto`}
      >
        {isRunning && (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-xl border border-red-400/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Dừng chương trình đang chạy"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Dừng chạy</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          data-testid="open-code-panel-btn"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950/45 hover:bg-slate-900/65 text-emerald-200 hover:text-emerald-100 border border-emerald-400/40 shadow-2xl backdrop-blur-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0"
          title="Mở khung viết & chạy code"
        >
          <Code2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Mở khung Code</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-950/45 text-slate-100 font-mono text-[10px] border border-white/15">
            {langMeta.shortLabel}
          </span>
          {isRunning && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-mono text-[10px] border border-emerald-400/40">
              ĐANG CHẠY
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Trình soạn thảo và chạy code đa ngôn ngữ"
      data-testid="autonomous-code-panel"
      onKeyDown={handlePanelKeyDown}
      className={`fixed z-30 ${
        isMobile
          ? isMobileLandscape
            ? 'top-10 bottom-11 right-2 w-[360px] max-w-[50vw]'
            : 'bottom-[86px] left-2 right-2 w-auto max-h-[48dvh]'
          : `${
              isExpanded
                ? 'w-[520px] max-w-[calc(100vw-20rem)]'
                : 'w-[392px] max-w-[calc(100vw-3rem)]'
            } bottom-5 right-6 max-h-[calc(100vh-17.5rem)]`
      } flex flex-col bg-slate-950/35 border border-white/20 ${isMobile ? 'rounded-xl' : 'rounded-2xl'} shadow-2xl backdrop-blur-md pointer-events-auto overflow-hidden transition-[width] duration-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.75)]`}
    >
      {/* Header Bar */}
      <div className={`flex items-center justify-between gap-2 ${isMobile ? 'px-2.5 py-1.5' : 'px-3.5 py-2'} bg-slate-950/40 border-b border-white/15`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
            <Code2 className="w-3.5 h-3.5 text-emerald-300" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xs font-bold tracking-tight text-white truncate">
              Trình chạy Code IDE
            </h3>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold whitespace-nowrap shrink-0 ${
                isRunning
                  ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/45'
                  : 'bg-slate-950/40 text-slate-200 border border-white/15'
              }`}
            >
              {isRunning ? 'ĐANG CHẠY' : 'SẴN SÀNG'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isMobile && (
            <button
              type="button"
              onClick={onToggleExpand}
              data-testid="expand-code-panel-btn"
              className="p-1.5 rounded-lg bg-slate-950/40 hover:bg-slate-900/60 text-slate-100 hover:text-white border border-white/15 transition-colors cursor-pointer shrink-0"
              title={isExpanded ? 'Thu gọn chiều ngang khung code' : 'Mở rộng khung code để gõ thoải mái'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            data-testid="hide-code-panel-btn"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/40 hover:bg-slate-900/60 text-slate-100 hover:text-white border border-white/15 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Ẩn khung nhập code để quan sát toàn màn hình"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Ẩn khung</span>
          </button>
        </div>
      </div>

      {/* Workspace Mode Switcher: Blank Self-Write Files vs Sample Presets */}
      <div className={`${isMobile ? 'px-2.5 py-1' : 'px-3.5 py-1.5'} bg-slate-950/25 border-b border-white/15 flex items-center justify-between gap-2`}>
        <div
          role="tablist"
          aria-label="Chế độ viết code"
          className="flex items-center gap-1 bg-slate-950/35 p-0.5 rounded-lg border border-white/15 w-full"
        >
          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'custom'}
            data-testid="workspace-mode-custom"
            disabled={isRunning}
            onClick={() => onWorkspaceModeChange('custom')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
              workspaceMode === 'custom'
                ? 'bg-cyan-500/90 text-slate-950 shadow-sm'
                : 'text-slate-100 hover:text-white hover:bg-white/10'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5 shrink-0" />
            <span>Tự viết (Trống)</span>
            <span
              className={`px-1 rounded text-[10px] font-mono tabular-nums ${
                workspaceMode === 'custom'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-slate-950/40 text-slate-200'
              }`}
            >
              {customFiles.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={workspaceMode === 'presets'}
            data-testid="workspace-mode-presets"
            disabled={isRunning}
            onClick={() => onWorkspaceModeChange('presets')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
              workspaceMode === 'presets'
                ? 'bg-emerald-500/90 text-slate-950 shadow-sm'
                : 'text-slate-100 hover:text-white hover:bg-white/10'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Code mẫu</span>
          </button>
        </div>
      </div>

      {/* Multi-file Blank Tabs (in Custom Mode) OR Sample Presets (in Presets Mode) */}
      <div className={`${isMobile ? 'px-2.5 py-1.5 space-y-1.5' : 'px-3.5 py-2 space-y-2'} bg-slate-950/20 border-b border-white/15`}>
        {workspaceMode === 'custom' && (
          <div className="flex items-center gap-1.5">
            <div
              data-testid="custom-files-tabs"
              className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto pb-0.5"
            >
              {customFiles.map((file) => {
                const isActive = file.id === activeCustomFile?.id;
                const isEditingName = renamingId === file.id;
                return (
                  <div
                    key={file.id}
                    data-testid={`custom-file-tab-${file.id}`}
                    className={`group flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-slate-900/55 text-cyan-200 border-cyan-400/65 shadow-sm'
                        : 'bg-slate-950/30 text-slate-200 hover:text-white border-white/15 hover:border-white/30'
                    }`}
                  >
                    {isEditingName ? (
                      <input
                        type="text"
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        autoFocus
                        maxLength={20}
                        className="w-20 bg-slate-950 text-white text-[11px] px-1 rounded border border-cyan-500 focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        data-testid={`select-custom-file-${file.id}`}
                        disabled={isRunning}
                        onClick={() => onSelectCustomFile(file.id)}
                        onDoubleClick={() => {
                          if (!isRunning) {
                            setRenamingId(file.id);
                            setRenameDraft(file.name);
                          }
                        }}
                        className="flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Nhấp để chọn file, nhấp đúp để đổi tên"
                      >
                        <span>{file.name}</span>
                        <span className="text-[9px] font-mono text-slate-400">
                          {LANG_EXT[file.language]}
                        </span>
                      </button>
                    )}

                    {isActive && !isEditingName && !isRunning && (
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(file.id);
                          setRenameDraft(file.name);
                        }}
                        className="p-0.5 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                        title="Đổi tên file"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                    )}

                    {customFiles.length > 1 && !isRunning && (
                      <button
                        type="button"
                        data-testid={`delete-custom-file-${file.id}`}
                        onClick={() => onDeleteCustomFile(file.id)}
                        className="p-0.5 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Xóa file code này"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              disabled={isRunning}
              onClick={() => {
                onCreateCustomFile();
                requestAnimationFrame(() => textareaRef.current?.focus());
              }}
              data-testid="create-blank-code-btn"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] shadow-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              title="Tạo thêm một khung code trống mới"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo mới</span>
            </button>
          </div>
        )}

        {/* Language Tabs & Utility Tools */}
        <div className="flex items-center justify-between gap-1.5">
          <div
            role="tablist"
            aria-label="Chọn ngôn ngữ lập trình"
            className="flex items-center gap-1 bg-slate-950/35 p-0.5 rounded-lg border border-white/15"
          >
            {LANGUAGES_ORDER.map((langId) => {
              const info = LANGUAGE_INFO[langId];
              const active = language === langId;
              return (
                <button
                  key={langId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`lang-tab-${langId}`}
                  disabled={isRunning}
                  onClick={() => onLanguageChange(langId)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 ${
                    active
                      ? 'bg-emerald-500/90 text-slate-950 shadow-sm'
                      : 'text-slate-100 hover:text-white hover:bg-white/10'
                  }`}
                  title={info.label}
                >
                  {info.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleCopyCode}
              data-testid="copy-code-btn"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950/40 hover:bg-slate-900/60 text-slate-100 hover:text-white border border-white/15 transition-colors cursor-pointer text-[11px] font-medium whitespace-nowrap shrink-0"
              title="Sao chép toàn bộ code hiện tại"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã chép' : 'Chép'}</span>
            </button>
            <button
              type="button"
              onClick={handleOpenPasteBox}
              disabled={isRunning}
              data-testid="toggle-paste-box-btn"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 ${
                isPasteBoxOpen
                  ? 'bg-cyan-500/90 text-slate-950 border-cyan-400'
                  : 'bg-slate-950/40 hover:bg-slate-900/60 text-cyan-200 hover:text-cyan-100 border-cyan-400/40'
              }`}
              title="Mở khung dán code đã sao chép"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Khung dán</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onCodeChange('');
                requestAnimationFrame(() => textareaRef.current?.focus());
              }}
              disabled={isRunning}
              data-testid="clear-code-editor-btn"
              className="p-1.5 rounded-lg bg-slate-950/40 hover:bg-slate-900/60 text-slate-100 hover:text-white border border-white/15 disabled:opacity-40 transition-colors cursor-pointer"
              title="Xóa trắng để tự nhập code mới"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Sample Preset Dropdown (shown in Presets Mode) */}
        {workspaceMode === 'presets' && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="jetbot-code-preset"
                className="text-[11px] font-semibold text-slate-200 whitespace-nowrap shrink-0"
              >
                Code mẫu:
              </label>
              <select
                id="jetbot-code-preset"
                data-testid="preset-select"
                value={currentPreset?.id || ''}
                onChange={(e) => onSelectPreset(e.target.value)}
                disabled={isRunning}
                className="flex-1 min-w-0 bg-slate-950/50 border border-white/20 rounded-lg px-2 py-1 text-[11px] font-medium text-white focus:outline-none focus:border-emerald-400 disabled:opacity-60 cursor-pointer"
              >
                {presetsForLang.map((preset) => (
                  <option key={preset.id} value={preset.id} className="bg-slate-900 text-white">
                    {preset.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onResetPreset}
                disabled={isRunning}
                className="p-1.5 rounded-lg bg-slate-950/40 hover:bg-slate-900/60 text-slate-100 hover:text-white border border-white/15 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                title="Khôi phục nguyên bản code mẫu đang chọn"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            {currentPreset && (
              <p className="text-[10px] text-slate-200 leading-snug">
                {currentPreset.description}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Code Editor with Synchronized Line Numbers */}
      <div className={`${isMobile ? 'p-1.5 gap-1.5' : 'p-2.5 gap-2'} flex flex-col min-h-0 flex-1 overflow-y-auto`}>
        {/* Dedicated Clipboard Paste Box */}
        {isPasteBoxOpen && (
          <div
            data-testid="paste-code-box"
            className="rounded-xl border border-cyan-500/60 bg-slate-900/95 p-2.5 space-y-2 shadow-lg"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-[11px] font-bold text-cyan-200 truncate">
                  Khung dán code sao chép
                </span>
                {detectedPasteLang && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px] border border-emerald-500/35 shrink-0">
                    {LANGUAGE_INFO[detectedPasteLang].label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleReadClipboardAgain}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  title="Đọc lại nội dung vừa copy từ Clipboard"
                >
                  Đọc Clipboard
                </button>
                <button
                  type="button"
                  onClick={() => setIsPasteBoxOpen(false)}
                  className="p-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Đóng khung dán"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <textarea
              ref={pasteInputRef}
              data-testid="paste-box-textarea"
              value={pasteBuffer}
              onChange={(e) => setPasteBuffer(e.target.value)}
              spellCheck={false}
              rows={3}
              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700/80 focus:border-cyan-500 focus:outline-none font-mono text-[11px] leading-snug text-cyan-100 placeholder-slate-500 resize-y"
              placeholder="Nhấn Ctrl+V (hoặc chuột phải -> Dán) đoạn code bạn vừa sao chép vào khung này..."
            />

            {clipboardNotice && (
              <div className="text-[10px] text-slate-400 leading-snug">
                {clipboardNotice}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!pasteBuffer.trim()}
                onClick={handleApplyPasteReplace}
                data-testid="apply-paste-replace-btn"
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Dán vào khung hiện tại
              </button>
              {onCreateCustomFileWithCode && (
                <button
                  type="button"
                  disabled={!pasteBuffer.trim()}
                  onClick={handleApplyPasteNewFile}
                  data-testid="apply-paste-newfile-btn"
                  className="py-1.5 px-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  + Tạo file mới &amp; dán
                </button>
              )}
            </div>
          </div>
        )}

        <div className="relative rounded-xl border border-white/20 bg-slate-950/25 focus-within:border-emerald-400/75 transition-colors overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-slate-950/40 border-b border-white/15 text-[10px] font-mono text-slate-300">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="shrink-0 text-emerald-300 font-semibold">{displayFileName}</span>
              {hasUnsavedChanges && (
                <span className="text-amber-300 font-sans font-semibold shrink-0" title="Có thay đổi chưa nhấn lưu thủ công (Ctrl+S)">
                  *
                </span>
              )}
              {justSaved ? (
                <span
                  data-testid="save-status-badge"
                  className="flex items-center gap-1 text-emerald-300 font-sans font-semibold whitespace-nowrap shrink-0"
                >
                  <Check className="w-3 h-3" />
                  <span>Đã lưu</span>
                </span>
              ) : (
                lastSavedLabel && (
                  <span
                    data-testid="save-status-badge"
                    className="text-slate-300 font-sans truncate"
                  >
                    · Đã lưu {lastSavedLabel}
                  </span>
                )
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline truncate max-w-[130px] text-slate-300/80" title={langMeta.apiHint}>
                {langMeta.apiHint}
              </span>
              {onSaveFile && (
                <button
                  type="button"
                  onClick={onSaveFile}
                  data-testid="save-code-btn"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded border font-sans text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    justSaved
                      ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/45'
                      : 'bg-slate-950/45 hover:bg-slate-900/65 text-slate-100 border-white/15'
                  }`}
                  title="Lưu file code (Ctrl + S)"
                >
                  <Save className="w-3 h-3" />
                  <span>Lưu</span>
                </button>
              )}
            </div>
          </div>

          <div className={`relative flex ${isMobile ? (isMobileLandscape ? 'h-20' : 'h-24') : 'h-40 sm:h-44'} bg-transparent`}>
            <div
              ref={gutterRef}
              aria-hidden="true"
              className="w-8 py-2.5 pr-1.5 text-right font-mono text-[11px] leading-[1.6] text-slate-300/75 bg-slate-950/20 border-r border-white/15 select-none overflow-hidden tabular-nums shrink-0"
            >
              {Array.from({ length: lineCount }, (_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              data-testid="code-editor-textarea"
              value={code}
              onChange={handleTextareaChange}
              onKeyDown={handleTextareaKeyDown}
              onScroll={handleTextareaScroll}
              disabled={isRunning}
              spellCheck={false}
              wrap="off"
              className="flex-1 h-full py-2.5 px-2.5 bg-transparent text-[11px] leading-[1.6] font-mono text-emerald-100 placeholder-slate-300/65 focus:outline-none resize-none disabled:opacity-75 overflow-auto"
              placeholder={
                workspaceMode === 'custom'
                  ? `Nhập hoặc dán code ${langMeta.label} · Ctrl+Space để gợi ý cú pháp...`
                  : `Nhập code ${langMeta.label} · Ctrl+Enter chạy · Ctrl+Space gợi ý...`
              }
            />

            {/* VS Code-style Syntax Autocompletion Popup */}
            {isAutocompleteOpen && completionItems.length > 0 && (
              <div
                data-testid="code-autocomplete-popup"
                role="listbox"
                aria-label="Gợi ý cú pháp code"
                className="absolute bottom-1.5 left-9 right-1.5 z-20 rounded-lg border border-cyan-500/55 bg-slate-900/98 shadow-2xl backdrop-blur-md overflow-hidden"
              >
                <div className="flex items-center justify-between px-2.5 py-1 bg-slate-950/90 border-b border-slate-800 text-[9px] text-slate-400">
                  <span className="font-semibold text-cyan-300">
                    Gợi ý cú pháp {completionCtx?.objectPrefix ? `(${completionCtx.objectPrefix}.)` : `(${langMeta.shortLabel})`}
                  </span>
                  <span className="font-mono">↑↓ Chọn · Enter/Tab Chèn · Esc Đóng</span>
                </div>
                <div
                  ref={autocompleteListRef}
                  className="max-h-28 overflow-y-auto divide-y divide-slate-800/60"
                >
                  {completionItems.map((item, idx) => {
                    const active = idx === activeCompletionIdx;
                    const badge = KIND_BADGE[item.kind];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        data-testid={`autocomplete-item-${item.id}`}
                        onMouseEnter={() => setActiveCompletionIdx(idx)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectCompletion(item);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                          active ? 'bg-cyan-500/20 text-white' : 'text-slate-300 hover:bg-slate-800/70'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`px-1 py-0.5 rounded border text-[9px] font-mono font-bold whitespace-nowrap shrink-0 ${badge.cls}`}
                          >
                            {badge.tag}
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-emerald-200 truncate">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 truncate max-w-[52%]">
                          {item.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Clickable Keyboard Shortcuts Bar (Desktop only) */}
        {!isMobile && (
        <div
          data-testid="shortcut-hints-bar"
          className="flex items-center gap-1.5 overflow-x-auto text-[10px] text-slate-200"
        >
          <button
            type="button"
            onClick={() => (isRunning ? onStop() : onStart())}
            data-testid="shortcut-btn-run"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/40 hover:bg-slate-900/60 border border-white/15 text-slate-100 hover:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Chạy hoặc dừng chương trình (Ctrl + Enter)"
          >
            <kbd className="font-mono text-[9px] text-emerald-300">Ctrl+Enter</kbd>
            <span>{isRunning ? 'Dừng' : 'Chạy'}</span>
          </button>

          {onSaveFile && (
            <button
              type="button"
              onClick={onSaveFile}
              data-testid="shortcut-btn-save"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/40 hover:bg-slate-900/60 border border-white/15 text-slate-100 hover:text-cyan-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Lưu file code vào bộ nhớ trình duyệt (Ctrl + S)"
            >
              <kbd className="font-mono text-[9px] text-cyan-300">Ctrl+S</kbd>
              <span>Lưu</span>
            </button>
          )}

          <button
            type="button"
            disabled={isRunning}
            onClick={handleTriggerAutocompleteBtn}
            data-testid="shortcut-btn-autocomplete"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/40 hover:bg-slate-900/60 border border-white/15 text-slate-100 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40"
            title="Mở bảng gợi ý cú pháp tại vị trí con trỏ (Ctrl + Space)"
          >
            <kbd className="font-mono text-[9px] text-amber-300">Ctrl+Space</kbd>
            <span>Gợi ý</span>
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={handleToggleCommentShortcut}
            data-testid="shortcut-btn-comment"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/40 hover:bg-slate-900/60 border border-white/15 text-slate-100 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40"
            title="Bật/tắt ghi chú dòng đang chọn (Ctrl + /)"
          >
            <kbd className="font-mono text-[9px] text-slate-200">Ctrl+/</kbd>
            <span>Ghi chú</span>
          </button>
        </div>
        )}

        {/* Syntax / Runtime Error Alert */}
        {errorMsg && (
          <div
            data-testid="code-error-banner"
            className="flex items-start gap-2 px-2.5 py-2 rounded-xl bg-red-950/45 border border-red-400/50 text-[11px] text-red-100"
          >
            <AlertTriangle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
            <span className="leading-snug break-words">{errorMsg}</span>
          </div>
        )}

        {/* Primary Action Bar + Danger Telemetry */}
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              type="button"
              onClick={onStart}
              data-testid="start-auto-code-btn"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Chạy code (Phím tắt: Ctrl + Enter)"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Bắt đầu chạy</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStop}
              data-testid="stop-auto-code-btn"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-950/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Dừng chạy</span>
            </button>
          )}

          {/* Compact Live Danger Probability Meter */}
          <div
            className="w-32 px-2.5 py-1.5 rounded-xl bg-slate-950/35 border border-white/15 shrink-0"
            title="Xác suất vùng nguy hiểm camera AI đang đo"
          >
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="flex items-center gap-1 text-slate-200">
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                <span>Nguy hiểm</span>
              </span>
              <span className="font-mono font-bold tabular-nums text-white">
                {dangerPct}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-950/50 overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${dangerBarClass}`}
                style={{ width: `${Math.min(100, Math.max(4, dangerPct))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Terminal Console Output */}
        <div className="rounded-xl border border-white/15 bg-slate-950/30 overflow-hidden">
          <div className="flex items-center justify-between px-2.5 py-1 border-b border-white/15 text-[10px] text-slate-200">
            <span className="flex items-center gap-1.5 font-semibold">
              <Terminal className="w-3 h-3 text-cyan-300" />
              <span>Terminal Output</span>
              {lastRunMs !== null && !isRunning && (
                <span className="font-mono text-emerald-300 tabular-nums">
                  · {lastRunMs}ms
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={onClearLogs}
              className="flex items-center gap-1 text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="Xóa kết quả Terminal"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa</span>
            </button>
          </div>
          <div
            data-testid="auto-code-logs"
            className={`${isMobile ? 'max-h-16' : 'max-h-24'} overflow-y-auto px-2.5 py-1.5 font-mono text-[10px] space-y-1 tabular-nums`}
          >
            {logs.length === 0 ? (
              <div className="text-slate-300/75 italic">
                {workspaceMode === 'custom'
                  ? 'Khung trống sẵn sàng. Nhập code bất kỳ và bấm "Bắt đầu chạy"...'
                  : 'Hỗ trợ Python, JavaScript và C++ / Arduino. Nhấn "Bắt đầu chạy" hoặc Ctrl+Enter...'}
              </div>
            ) : (
              logs.map((entry) => (
                <div
                  key={entry.id}
                  className={
                    entry.level === 'danger'
                      ? 'text-red-300'
                      : entry.level === 'warn'
                      ? 'text-amber-300'
                      : entry.level === 'success'
                      ? 'text-emerald-300'
                      : 'text-slate-200'
                  }
                >
                  &gt; {entry.text}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </section>
  );
};
