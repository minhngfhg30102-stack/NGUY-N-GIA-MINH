import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Gamepad2,
  TableProperties,
  Sparkles,
  Volume2,
  VolumeX,
  Bot,
  Image as ImageIcon,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Backpack,
  Shovel,
  Maximize2,
  MapPin,
  Info,
  Cpu,
  Smartphone,
  Monitor,
  Code2,
  Camera,
  EyeOff,
} from 'lucide-react';
import { JetBotScene } from './components/JetBot3D/JetBotScene';
import { BottomDock } from './components/Controls/BottomDock';
import { DriveController } from './components/Controls/DriveController';
import {
  computeDriveVelocityFromKeys,
  isMovementDriveKey,
  normalizeDriveKeyCode,
  shouldIgnoreKeyboardTarget,
} from './components/Controls/keyboardDrive';
import { CameraFPV } from './components/Controls/CameraFPV';
import { ComponentTable } from './components/AnalysisTable/ComponentTable';
import { getComponentPhotos } from './components/AnalysisTable/componentFilter';
import { JetBotAIModal } from './components/AIAdvisor/JetBotAIModal';
import { ZoomControls } from './components/Controls/ZoomControls';
import { ShovelButton } from './components/Controls/ShovelButton';
import { DigDiscoveryModal } from './components/Controls/DigDiscoveryModal';
import { BackpackModal } from './components/Controls/BackpackModal';
import {
  AutonomousCodePanel,
  CustomCodeFile,
  IdeWorkspaceMode,
} from './components/Controls/AutonomousCodePanel';
import { robotAudio } from './components/JetBot3D/audioSynth';
import {
  ALL_PRESETS,
  CodeLanguage,
  LogEntry,
  PRESETS_BY_LANGUAGE,
  computeDangerProbability,
  runMultiLanguageProgram,
} from './components/JetBot3D/autonomousRunner';
import { DriveState, RenderMode, ViewPreset, EnvironmentMap, DigMode, RealPhotoItem } from './types/robot';
import { JETBOT_COMPONENTS, CMU_LESSON_INFO } from './data/componentsData';
import { EXCAVATION_COMPONENTS } from './data/excavationData';
import { ExcavationComponent, InventoryItem } from './types/excavation';
import { rollWeightedExcavationComponent } from './components/Controls/excavationHelpers';
import {
  computeMobileViewport,
  MobileViewportState,
  resolveMobileLayoutFlags,
} from './utils/mobileViewport';

export type MobileModePreference = 'auto' | 'mobile' | 'desktop';

function readBrowserViewport(): { viewport: MobileViewportState; height: number } {
  if (typeof window === 'undefined') {
    return {
      viewport: computeMobileViewport({ width: 1280, height: 720, hasCoarsePointer: false }),
      height: 720,
    };
  }
  const hasCoarsePointer =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  return {
    viewport: computeMobileViewport({
      width: window.innerWidth,
      height: window.innerHeight,
      hasCoarsePointer,
    }),
    height: window.innerHeight,
  };
}

export default function App() {
  // Navigation View: '3d-inspect' | 'drive-sim' | 'table-analysis'
  const [activeView, setActiveView] = useState<'3d-inspect' | 'drive-sim' | 'table-analysis'>('3d-inspect');

  // Dedicated Mobile / Phone Mode ('auto' activates automatically on portrait & landscape phones)
  const [mobileModePref, setMobileModePref] = useState<MobileModePreference>(() => {
    try {
      const saved = localStorage.getItem('jetbot_mobile_mode_v1');
      if (saved === 'mobile' || saved === 'desktop' || saved === 'auto') {
        return saved;
      }
    } catch {}
    return 'auto';
  });
  const [viewportInfo, setViewportInfo] = useState<{
    viewport: MobileViewportState;
    height: number;
  }>(() => readBrowserViewport());

  useEffect(() => {
    const handleResize = () => {
      setViewportInfo(readBrowserViewport());
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('jetbot_mobile_mode_v1', mobileModePref);
    } catch {}
  }, [mobileModePref]);

  const { isMobileMode, isMobileLandscape } = resolveMobileLayoutFlags(
    mobileModePref,
    viewportInfo.viewport,
    viewportInfo.height
  );

  const handleToggleMobileMode = () => {
    setMobileModePref((prev) => {
      if (prev === 'auto') {
        return viewportInfo.viewport.isMobileViewport ? 'desktop' : 'mobile';
      }
      return prev === 'mobile' ? 'desktop' : 'mobile';
    });
    robotAudio.playClick(740);
  };

  // Exclusive mobile bottom-sheet controllers so tabs/panels never cover each other on phones
  const [mobileInspectSheet, setMobileInspectSheet] = useState<'none' | 'dock' | 'asdw'>('none');
  const [mobileDriveTool, setMobileDriveTool] = useState<'none' | 'drive' | 'camera' | 'code'>('none');

  // Environment Map Selection: 'mars-planet' (Sao Hỏa & Aliens) or 'cmu-arena' (Sa bàn CMU 10A)
  const [environmentMap, setEnvironmentMap] = useState<EnvironmentMap>('mars-planet');

  // 3D Scene Controls
  const [explodedValue, setExplodedValue] = useState<number>(0);
  const [renderMode, setRenderMode] = useState<RenderMode>('realistic');
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [viewPreset, setViewPreset] = useState<ViewPreset>('iso');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [modelScale, setModelScale] = useState<number>(1.4); // Enlarged 1.4x by default for clear inspection
  const [obstaclesCount, setObstaclesCount] = useState<{ toppled: number; total: number }>({ toppled: 0, total: 6 });
  const [resetObstaclesTrigger, setResetObstaclesTrigger] = useState<number>(0);
  const [inspectResetTrigger, setInspectResetTrigger] = useState<number>(0);
  const [driveResetTrigger, setDriveResetTrigger] = useState<number>(0);
  const [driveCamResetTrigger, setDriveCamResetTrigger] = useState<number>(0);

  // Zoom In / Zoom Out Controls State (Mouse Wheel + Key I & O)
  const [zoomState, setZoomState] = useState<'in' | 'out' | null>(null);
  const [isIActive, setIsIActive] = useState<boolean>(false);
  const [isOActive, setIsOActive] = useState<boolean>(false);

  const handleResetInspectView = () => {
    setSelectedComponentId(null);
    setViewPreset('iso');
    setInspectResetTrigger((prev) => prev + 1);
    robotAudio.playClick(850);
  };

  const handleResetObstacles = () => {
    setResetObstaclesTrigger((prev) => prev + 1);
    setObstaclesCount((prev) => ({ ...prev, toppled: 0 }));
  };

  // Drive Mode Simulation State
  const [driveState, setDriveState] = useState<DriveState>({
    isDriving: false,
    linearVelocity: 0,
    angularVelocity: 0,
    steerAngle: 0,
    leftWheelSpeed: 0,
    rightWheelSpeed: 0,
    heading: 0,
    position: { x: 0, z: 0 },
    nearestObstacleDistance: 2.5,
    obstacleDetected: false,
  });

  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiInitialQuery, setAiInitialQuery] = useState<string>('');
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState<boolean>(false);

  // Excavation & Backpack State
  const [inventory, setInventory] = useState<Record<string, InventoryItem>>(() => {
    try {
      const saved = localStorage.getItem('jetbot_mars_inventory');
      if (saved) return JSON.parse(saved);
    } catch {}
    const starter1 = EXCAVATION_COMPONENTS.find((c) => c.id === 'chassis-frame')!;
    const starter2 = EXCAVATION_COMPONENTS.find((c) => c.id === 'caster-wheels')!;
    return {
      'chassis-frame': {
        ...starter1,
        count: 1,
        firstFoundAt: Date.now() - 3600000,
        foundLocationName: 'Trạm Đáp Tàu Vũ Trụ',
      },
      'caster-wheels': {
        ...starter2,
        count: 1,
        firstFoundAt: Date.now() - 1800000,
        foundLocationName: 'Chân Núi Bazan Tây',
      },
    };
  });

  const [isBackpackOpen, setIsBackpackOpen] = useState<boolean>(false);
  const [isDigging, setIsDigging] = useState<boolean>(false);
  const [digProgress, setDigProgress] = useState<number>(0);
  const [digMode, setDigMode] = useState<DigMode>('jetbot');
  const [pendingAstronautItem, setPendingAstronautItem] = useState<ExcavationComponent | null>(null);
  const [discoveredByAstronaut, setDiscoveredByAstronaut] = useState<boolean>(false);
  const [astronautDigTrigger, setAstronautDigTrigger] = useState<{ seq: number; colorHex: string } | null>(null);
  const [astronautReceiveTrigger, setAstronautReceiveTrigger] = useState<number>(0);
  const [astronautCancelTrigger, setAstronautCancelTrigger] = useState<number>(0);
  const [discoveredItemModal, setDiscoveredItemModal] = useState<ExcavationComponent | null>(null);
  const [hasNewItemInBackpack, setHasNewItemInBackpack] = useState<boolean>(false);

  // Selected Component info for detail overlay
  const selectedComponent = JETBOT_COMPONENTS.find((c) => c.id === selectedComponentId);
  const selectedComponentPhotos = selectedComponent ? getComponentPhotos(selectedComponent) : [];
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number>(0);
  const [enlargedPhoto, setEnlargedPhoto] = useState<{
    photos: RealPhotoItem[];
    index: number;
    title: string;
  } | null>(null);

  useEffect(() => {
    setSelectedGalleryIndex(0);
  }, [selectedComponentId]);

  // Toggle Sound
  const handleToggleMute = () => {
    const nextMuted = robotAudio.toggleMute();
    setIsMuted(nextMuted);
  };

  // Speed Boost & Gear control
  // speedLevel: 1 = Eco (0.30 m/s), 2 = Standard (0.55 m/s), 3 = Turbo Boost (1.10 m/s)
  const [speedLevel, setSpeedLevel] = useState<number>(2);
  const [isShiftBoost, setIsShiftBoost] = useState<boolean>(false);
  const isTurboActive = speedLevel === 3 || isShiftBoost;

  // Keyboard Navigation for Drive Mode
  const activeKeys = React.useRef<Set<string>>(new Set());
  const [pressedKeysState, setPressedKeysState] = useState<Set<string>>(new Set());
  const [showAsdwInInspect, setShowAsdwInInspect] = useState<boolean>(false);
  const effectiveShowAsdwInInspect = isMobileMode ? mobileInspectSheet === 'asdw' : showAsdwInInspect;
  const isDriveActive =
    activeView === 'drive-sim' || (activeView === '3d-inspect' && effectiveShowAsdwInInspect);

  // Multi-Language Code IDE Runner State & Live Sensor Refs
  const latestDriveStateRef = React.useRef<DriveState>(driveState);
  latestDriveStateRef.current = driveState;
  const environmentMapRef = React.useRef<EnvironmentMap>(environmentMap);
  environmentMapRef.current = environmentMap;
  const autoRunAbortRef = React.useRef<AbortController | null>(null);
  const autoLogIdRef = React.useRef<number>(1);

  const [workspaceMode, setWorkspaceMode] = useState<IdeWorkspaceMode>('custom');
  const [customFiles, setCustomFiles] = useState<CustomCodeFile[]>(() => {
    try {
      const saved = localStorage.getItem('jetbot_custom_code_files_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [{ id: 'custom-1', name: 'Code 1', language: 'python', code: '' }];
  });
  const [activeCustomFileId, setActiveCustomFileId] = useState<string>(
    () => customFiles[0]?.id || 'custom-1'
  );

  useEffect(() => {
    try {
      localStorage.setItem('jetbot_custom_code_files_v1', JSON.stringify(customFiles));
    } catch {}
  }, [customFiles]);

  const [presetLanguage, setPresetLanguage] = useState<CodeLanguage>('python');
  const [presetByLang, setPresetByLang] = useState<Record<CodeLanguage, string>>({
    python: PRESETS_BY_LANGUAGE.python[0].id,
    javascript: PRESETS_BY_LANGUAGE.javascript[0].id,
    cpp: PRESETS_BY_LANGUAGE.cpp[0].id,
  });
  const [codeByLang, setCodeByLang] = useState<Record<CodeLanguage, string>>(() => {
    const defaults: Record<CodeLanguage, string> = {
      python: PRESETS_BY_LANGUAGE.python[0].code,
      javascript: PRESETS_BY_LANGUAGE.javascript[0].code,
      cpp: PRESETS_BY_LANGUAGE.cpp[0].code,
    };
    try {
      const saved = localStorage.getItem('jetbot_preset_code_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            python: typeof parsed.python === 'string' ? parsed.python : defaults.python,
            javascript: typeof parsed.javascript === 'string' ? parsed.javascript : defaults.javascript,
            cpp: typeof parsed.cpp === 'string' ? parsed.cpp : defaults.cpp,
          };
        }
      }
    } catch {}
    return defaults;
  });
  const [isAutoCodeRunning, setIsAutoCodeRunning] = useState<boolean>(false);
  const [isCodePanelCollapsed, setIsCodePanelCollapsed] = useState<boolean>(true);
  const [isCodePanelExpanded, setIsCodePanelExpanded] = useState<boolean>(false);
  const [autoCodeLogs, setAutoCodeLogs] = useState<LogEntry[]>([]);
  const [autoCodeError, setAutoCodeError] = useState<string | null>(null);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);
  const [autoDangerProb, setAutoDangerProb] = useState<number>(0.08);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSavedLabel, setLastSavedLabel] = useState<string | null>(null);
  const [saveTick, setSaveTick] = useState<number>(0);

  const activeCustomFile =
    customFiles.find((f) => f.id === activeCustomFileId) || customFiles[0];
  const codeLanguage: CodeLanguage =
    workspaceMode === 'custom' && activeCustomFile
      ? activeCustomFile.language
      : presetLanguage;
  const autoCode: string =
    workspaceMode === 'custom' && activeCustomFile
      ? activeCustomFile.code
      : codeByLang[presetLanguage];
  const selectedPresetId = presetByLang[presetLanguage];

  const getSensorSnapshot = useCallback(() => {
    const d = latestDriveStateRef.current;
    const envMap = environmentMapRef.current;
    const maxBound = envMap === 'mars-planet' ? 12.5 : 2.8;
    const nearBoundary =
      Math.abs(d.position.x) > maxBound - 0.65 ||
      Math.abs(d.position.z) > maxBound - 0.65;
    return {
      obstacleDist: d.nearestObstacleDistance,
      alienDist: d.nearestAlienDistance ?? 99,
      nearBoundary,
      headingDeg: d.heading,
      posX: d.position.x,
      posZ: d.position.z,
    };
  }, []);

  const stopAutonomousCode = useCallback((silent = false) => {
    if (autoRunAbortRef.current) {
      autoRunAbortRef.current.abort();
      autoRunAbortRef.current = null;
    }
    setIsAutoCodeRunning(false);
    setDriveState((prev) =>
      prev.linearVelocity === 0 && prev.angularVelocity === 0
        ? prev
        : { ...prev, linearVelocity: 0, angularVelocity: 0 }
    );
    if (!silent) {
      setAutoCodeLogs((prev) => [
        ...prev.slice(-49),
        { id: autoLogIdRef.current++, level: 'warn', text: 'Đã dừng thực thi chương trình.' },
      ]);
    }
  }, []);

  const handleStartAutonomousCode = useCallback(async () => {
    if (!autoCode.trim()) {
      setAutoCodeError('Khung code đang trống. Hãy nhập code trước khi bấm Bắt đầu chạy.');
      setAutoCodeLogs((prev) => [
        ...prev.slice(-49),
        { id: autoLogIdRef.current++, level: 'warn', text: 'Chưa có code để chạy. Hãy nhập code vào khung soạn thảo.' },
      ]);
      return;
    }
    if (autoRunAbortRef.current) {
      autoRunAbortRef.current.abort();
    }
    const controller = new AbortController();
    autoRunAbortRef.current = controller;
    setAutoCodeError(null);
    setLastRunMs(null);
    setIsAutoCodeRunning(true);
    void robotAudio.unlock();
    robotAudio.playClick(920);
    const startAt = performance.now();
    const langTag =
      codeLanguage === 'python'
        ? 'Python'
        : codeLanguage === 'javascript'
        ? 'JavaScript'
        : 'C++ / Arduino';
    setAutoCodeLogs([
      { id: autoLogIdRef.current++, level: 'info', text: `Khởi chạy [${langTag}]...` },
    ]);

    let hadError = false;
    try {
      await runMultiLanguageProgram(
        codeLanguage,
        autoCode,
        {
          setMotors: (linearVelocity, angularVelocity) => {
            setDriveState((prev) => ({
              ...prev,
              linearVelocity,
              angularVelocity,
            }));
          },
          stop: () => {
            setDriveState((prev) => ({
              ...prev,
              linearVelocity: 0,
              angularVelocity: 0,
            }));
          },
          getSensors: getSensorSnapshot,
          onLog: (level, text) => {
            setAutoCodeLogs((prev) => [
              ...prev.slice(-49),
              { id: autoLogIdRef.current++, level, text },
            ]);
          },
          onDangerProb: (prob) => {
            setAutoDangerProb(prob);
          },
        },
        controller.signal
      );
    } catch (err) {
      hadError = true;
      if (!controller.signal.aborted) {
        const message = err instanceof Error ? err.message : 'Lỗi cú pháp hoặc thực thi code.';
        setAutoCodeError(message);
        setAutoCodeLogs((prev) => [
          ...prev.slice(-49),
          { id: autoLogIdRef.current++, level: 'danger', text: `Lỗi: ${message}` },
        ]);
      }
    } finally {
      const elapsedMs = Math.max(1, Math.round(performance.now() - startAt));
      if (!hadError && !controller.signal.aborted) {
        setLastRunMs(elapsedMs);
        setAutoCodeLogs((prev) => [
          ...prev.slice(-49),
          { id: autoLogIdRef.current++, level: 'success', text: `Hoàn thành thực thi (${elapsedMs}ms · exit 0)` },
        ]);
      }
      if (autoRunAbortRef.current === controller) {
        autoRunAbortRef.current = null;
        setIsAutoCodeRunning(false);
      }
    }
  }, [autoCode, codeLanguage, getSensorSnapshot]);

  const handleLanguageChange = useCallback(
    (nextLang: CodeLanguage) => {
      if (workspaceMode === 'custom' && activeCustomFile) {
        setCustomFiles((prev) =>
          prev.map((f) => (f.id === activeCustomFile.id ? { ...f, language: nextLang } : f))
        );
        setHasUnsavedChanges(true);
      } else {
        setPresetLanguage(nextLang);
      }
      setAutoCodeError(null);
      robotAudio.playClick(820);
    },
    [workspaceMode, activeCustomFile]
  );

  const handleCodeChange = useCallback(
    (nextCode: string) => {
      if (workspaceMode === 'custom' && activeCustomFile) {
        setCustomFiles((prev) =>
          prev.map((f) => (f.id === activeCustomFile.id ? { ...f, code: nextCode } : f))
        );
      } else {
        setCodeByLang((prev) => ({ ...prev, [presetLanguage]: nextCode }));
      }
      setHasUnsavedChanges(true);
      if (autoCodeError) setAutoCodeError(null);
    },
    [autoCodeError, workspaceMode, activeCustomFile, presetLanguage]
  );

  const handleSaveActiveCode = useCallback(() => {
    try {
      localStorage.setItem('jetbot_custom_code_files_v1', JSON.stringify(customFiles));
      localStorage.setItem('jetbot_preset_code_v1', JSON.stringify(codeByLang));
    } catch {}
    const nowLabel = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setHasUnsavedChanges(false);
    setLastSavedLabel(nowLabel);
    setSaveTick((prev) => prev + 1);
    robotAudio.playClick(1040);
  }, [customFiles, codeByLang]);

  const handleCreateCustomFile = useCallback(() => {
    setCustomFiles((prev) => {
      const usedNums = prev
        .map((f) => /^Code\s+(\d+)$/i.exec(f.name.trim()))
        .filter((m): m is RegExpExecArray => !!m)
        .map((m) => Number(m[1]));
      const nextNum = usedNums.length > 0 ? Math.max(...usedNums) + 1 : prev.length + 1;
      const newFile: CustomCodeFile = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `Code ${nextNum}`,
        language: activeCustomFile?.language || 'python',
        code: '',
      };
      setActiveCustomFileId(newFile.id);
      return [...prev, newFile];
    });
    setWorkspaceMode('custom');
    setAutoCodeError(null);
    robotAudio.playClick(860);
  }, [activeCustomFile]);

  const handleCreateCustomFileWithCode = useCallback(
    (pastedCode: string, detectedLang?: CodeLanguage) => {
      setCustomFiles((prev) => {
        const usedNums = prev
          .map((f) => /^Code\s+(\d+)$/i.exec(f.name.trim()))
          .filter((m): m is RegExpExecArray => !!m)
          .map((m) => Number(m[1]));
        const nextNum = usedNums.length > 0 ? Math.max(...usedNums) + 1 : prev.length + 1;
        const newFile: CustomCodeFile = {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `Code ${nextNum}`,
          language: detectedLang || activeCustomFile?.language || 'python',
          code: pastedCode,
        };
        setActiveCustomFileId(newFile.id);
        return [...prev, newFile];
      });
      setWorkspaceMode('custom');
      setAutoCodeError(null);
      robotAudio.playClick(880);
    },
    [activeCustomFile]
  );

  const handleDeleteCustomFile = useCallback(
    (id: string) => {
      setCustomFiles((prev) => {
        if (prev.length <= 1) {
          return prev.map((f) => (f.id === id ? { ...f, code: '' } : f));
        }
        const idx = prev.findIndex((f) => f.id === id);
        const filtered = prev.filter((f) => f.id !== id);
        if (id === activeCustomFileId) {
          const fallback = filtered[Math.max(0, idx - 1)] || filtered[0];
          if (fallback) setActiveCustomFileId(fallback.id);
        }
        return filtered;
      });
      setAutoCodeError(null);
      robotAudio.playClick(700);
    },
    [activeCustomFileId]
  );

  const handleRenameCustomFile = useCallback((id: string, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed) return;
    setCustomFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: trimmed } : f))
    );
  }, []);

  const handleSelectAutonomousPreset = useCallback(
    (presetId: string) => {
      const found = ALL_PRESETS.find((p) => p.id === presetId);
      if (!found) return;
      setPresetLanguage(found.language);
      setPresetByLang((prev) => ({ ...prev, [found.language]: found.id }));
      setCodeByLang((prev) => ({ ...prev, [found.language]: found.code }));
      setAutoCodeError(null);
      robotAudio.playClick(780);
    },
    []
  );

  const handleResetAutonomousPreset = useCallback(() => {
    const found =
      PRESETS_BY_LANGUAGE[presetLanguage].find((p) => p.id === selectedPresetId) ||
      PRESETS_BY_LANGUAGE[presetLanguage][0];
    setCodeByLang((prev) => ({ ...prev, [presetLanguage]: found.code }));
    setAutoCodeError(null);
    robotAudio.playClick(780);
  }, [presetLanguage, selectedPresetId]);

  const addExcavationItemToInventory = useCallback(
    (chosenItem: ExcavationComponent) => {
      const locName = driveState.nearestDigSiteName || 'Đồi Cát Sao Hỏa';
      setInventory((prev) => {
        const nextInv = { ...prev };
        if (nextInv[chosenItem.id]) {
          nextInv[chosenItem.id] = {
            ...nextInv[chosenItem.id],
            count: nextInv[chosenItem.id].count + 1,
          };
        } else {
          nextInv[chosenItem.id] = {
            ...chosenItem,
            count: 1,
            firstFoundAt: Date.now(),
            foundLocationName: locName,
          };
        }
        try {
          localStorage.setItem('jetbot_mars_inventory', JSON.stringify(nextInv));
        } catch {}
        return nextInv;
      });
    },
    [driveState.nearestDigSiteName]
  );

  const handleStartDig = useCallback(() => {
    if (isDigging) return;

    // Astronaut Dig & Deliver Mode (Phi hành gia đi đào rồi mang lại gần JetBot -> nhấn Z nhận)
    if (digMode === 'astronaut') {
      if (environmentMap !== 'mars-planet') return;
      if (pendingAstronautItem || (driveState.astronautTaskStatus && driveState.astronautTaskStatus !== 'idle')) {
        return;
      }
      const chosenItem = rollWeightedExcavationComponent(EXCAVATION_COMPONENTS);
      setPendingAstronautItem(chosenItem);
      setAstronautDigTrigger((prev) => ({
        seq: (prev?.seq ?? 0) + 1,
        colorHex: chosenItem.tierColorHex,
      }));
      robotAudio.playDiggingSound();
      return;
    }

    // Standard JetBot Direct Dig Mode
    setIsDigging(true);
    setDigProgress(0);
    robotAudio.playDiggingSound();

    const startTime = performance.now();
    const duration = 1400; // 1.4s suspense

    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setDigProgress(progress);

      if (progress > 45 && progress < 55) {
        robotAudio.playDiggingSound();
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        setIsDigging(false);

        const chosenItem = rollWeightedExcavationComponent(EXCAVATION_COMPONENTS);
        addExcavationItemToInventory(chosenItem);

        robotAudio.playDiscoveryFanfare(chosenItem.tier);
        setDiscoveredByAstronaut(false);
        setDiscoveredItemModal(chosenItem);
        setHasNewItemInBackpack(true);
      }
    }, 40);
  }, [
    isDigging,
    digMode,
    environmentMap,
    pendingAstronautItem,
    driveState.astronautTaskStatus,
    addExcavationItemToInventory,
  ]);

  const handleReceiveAstronautItem = useCallback(() => {
    if (!pendingAstronautItem || !driveState.astronautCanReceiveZ) return;
    const deliveredItem = pendingAstronautItem;
    addExcavationItemToInventory(deliveredItem);

    robotAudio.playAstronautReceiveChime();
    robotAudio.playDiscoveryFanfare(deliveredItem.tier);
    setDiscoveredByAstronaut(true);
    setDiscoveredItemModal(deliveredItem);
    setHasNewItemInBackpack(true);
    setPendingAstronautItem(null);
    setAstronautReceiveTrigger((prev) => prev + 1);
    setDriveState((prev) => ({
      ...prev,
      astronautTaskStatus: 'idle',
      astronautCanReceiveZ: false,
    }));
  }, [pendingAstronautItem, driveState.astronautCanReceiveZ, addExcavationItemToInventory]);

  const speedLevelRef = React.useRef<number>(speedLevel);
  speedLevelRef.current = speedLevel;

  const updateDriveFromKeys = useCallback(() => {
    const { linearVelocity, angularVelocity } = computeDriveVelocityFromKeys(
      activeKeys.current,
      speedLevelRef.current
    );

    setDriveState((prev) => ({
      ...prev,
      linearVelocity,
      angularVelocity,
    }));
  }, []);

  useEffect(() => {
    if (activeKeys.current.size > 0 && isDriveActive) {
      updateDriveFromKeys();
    }
  }, [speedLevel, isDriveActive, updateDriveFromKeys]);

  const keyboardContextRef = React.useRef({
    isDriveActive,
    activeView,
    isDigging,
    digMode,
    canDig: Boolean(driveState.canDig),
    environmentMap,
    astronautTaskStatus: driveState.astronautTaskStatus || 'idle',
    astronautCanReceiveZ: Boolean(driveState.astronautCanReceiveZ),
    hasPendingAstronautItem: Boolean(pendingAstronautItem),
    handleStartDig,
    handleReceiveAstronautItem,
    stopAutonomousCode,
    isCodePanelCollapsed,
    isMobileMode,
    mobileDriveTool,
    handleSaveActiveCode,
    isAnyModalOpen: isAiModalOpen || isPhotoModalOpen || isBackpackOpen || Boolean(enlargedPhoto) || Boolean(discoveredItemModal),
  });
  keyboardContextRef.current = {
    isDriveActive,
    activeView,
    isDigging,
    digMode,
    canDig: Boolean(driveState.canDig),
    environmentMap,
    astronautTaskStatus: driveState.astronautTaskStatus || 'idle',
    astronautCanReceiveZ: Boolean(driveState.astronautCanReceiveZ),
    hasPendingAstronautItem: Boolean(pendingAstronautItem),
    handleStartDig,
    handleReceiveAstronautItem,
    stopAutonomousCode,
    isCodePanelCollapsed,
    isMobileMode,
    mobileDriveTool,
    handleSaveActiveCode,
    isAnyModalOpen: isAiModalOpen || isPhotoModalOpen || isBackpackOpen || Boolean(enlargedPhoto) || Boolean(discoveredItemModal),
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctx = keyboardContextRef.current;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        const isCodeVisible = ctx.isMobileMode ? ctx.mobileDriveTool === 'code' : !ctx.isCodePanelCollapsed;
        if (ctx.activeView === 'drive-sim' && isCodeVisible) {
          e.preventDefault();
          ctx.handleSaveActiveCode();
          return;
        }
      }

      if (shouldIgnoreKeyboardTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (ctx.isAnyModalOpen) return;

      const normalizedCode = normalizeDriveKeyCode(e);

      // If user is in '3d-inspect' (Mô hình 3D) and presses W/A/S/D or Arrow keys,
      // auto-activate ASDW drive controls so WASD moves JetBot immediately from any 3D view.
      let driveEnabledNow = ctx.isDriveActive;
      if (!driveEnabledNow && ctx.activeView === '3d-inspect' && isMovementDriveKey(normalizedCode)) {
        driveEnabledNow = true;
        setExplodedValue(0);
        if (ctx.isMobileMode) {
          setMobileInspectSheet('asdw');
        } else {
          setShowAsdwInInspect(true);
        }
      }

      // Dig hotkey [KeyE], Astronaut Receive hotkey [KeyZ], & ASDW drive controls
      if (driveEnabledNow) {
        if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z' || e.keyCode === 90) {
          if (ctx.hasPendingAstronautItem && ctx.astronautCanReceiveZ) {
            e.preventDefault();
            ctx.handleReceiveAstronautItem();
            return;
          }
        }

        if (e.code === 'KeyE' || e.key.toLowerCase() === 'e') {
          const astronautIdle = ctx.astronautTaskStatus === 'idle';
          const digReady = !ctx.isDigging && (ctx.canDig || ctx.environmentMap === 'mars-planet') && (ctx.digMode === 'jetbot' || astronautIdle);
          if (digReady) {
            e.preventDefault();
            ctx.handleStartDig();
            return;
          }
        }

        if (normalizedCode) {
          e.preventDefault();
          if (autoRunAbortRef.current && normalizedCode !== 'ShiftLeft' && normalizedCode !== 'ShiftRight') {
            ctx.stopAutonomousCode(true);
          }
          activeKeys.current.add(normalizedCode);
          if (normalizedCode === 'ShiftLeft' || normalizedCode === 'ShiftRight') {
            setIsShiftBoost(true);
          }
          setPressedKeysState(new Set(activeKeys.current));
          updateDriveFromKeys();
          return;
        }
      }

      // Backpack hotkey [KeyB]
      if (e.code === 'KeyB') {
        e.preventDefault();
        setIsBackpackOpen((prev) => !prev);
        setHasNewItemInBackpack(false);
        robotAudio.playBackpackOpen();
        return;
      }

      // Zoom In (Key I) / Zoom Out (Key O) when a 3D viewport is visible
      if (ctx.activeView !== 'table-analysis') {
        if (e.code === 'KeyI') {
          setIsIActive(true);
          setZoomState('in');
        } else if (e.code === 'KeyO') {
          setIsOActive(true);
          setZoomState('out');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (shouldIgnoreKeyboardTarget(e.target)) return;

      const normalizedCode = normalizeDriveKeyCode(e);
      if (normalizedCode === 'Space' && keyboardContextRef.current.isDriveActive) {
        e.preventDefault();
      }

      if (normalizedCode && activeKeys.current.has(normalizedCode)) {
        activeKeys.current.delete(normalizedCode);
        if (normalizedCode === 'ShiftLeft' || normalizedCode === 'ShiftRight') {
          setIsShiftBoost(false);
        }
        setPressedKeysState(new Set(activeKeys.current));
        updateDriveFromKeys();
      } else if (e.code && activeKeys.current.has(e.code)) {
        activeKeys.current.delete(e.code);
        setPressedKeysState(new Set(activeKeys.current));
        updateDriveFromKeys();
      }

      if (e.code === 'KeyI') {
        setIsIActive(false);
        setZoomState((prev) => (prev === 'in' ? null : prev));
      } else if (e.code === 'KeyO') {
        setIsOActive(false);
        setZoomState((prev) => (prev === 'out' ? null : prev));
      }
    };

    const handleBlur = () => {
      activeKeys.current.clear();
      setIsShiftBoost(false);
      setPressedKeysState(new Set());
      setIsIActive(false);
      setIsOActive(false);
      setZoomState(null);
      updateDriveFromKeys();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [updateDriveFromKeys]);

  // Clear active driving velocity, keys, astronaut tasks, and autonomous script when leaving Drive Mode or Mars
  useEffect(() => {
    if (activeView !== 'drive-sim' && autoRunAbortRef.current) {
      stopAutonomousCode(true);
    }
    if (!isDriveActive || environmentMap !== 'mars-planet') {
      if (pendingAstronautItem) {
        setPendingAstronautItem(null);
        setAstronautCancelTrigger((prev) => prev + 1);
      }
      setDriveState((prev) => ({
        ...prev,
        astronautTaskStatus: 'idle',
        astronautCanReceiveZ: false,
      }));
    }
    if (!isDriveActive) {
      activeKeys.current.clear();
      setIsShiftBoost(false);
      setPressedKeysState(new Set());
      setDriveState((prev) =>
        prev.linearVelocity === 0 && prev.angularVelocity === 0
          ? prev
          : { ...prev, linearVelocity: 0, angularVelocity: 0 }
      );
    }
  }, [isDriveActive, activeView, environmentMap, pendingAstronautItem, stopAutonomousCode]);

  useEffect(() => {
    return () => {
      if (autoRunAbortRef.current) {
        autoRunAbortRef.current.abort();
        autoRunAbortRef.current = null;
      }
    };
  }, []);

  const handleResetZoomForCurrentMode = () => {
    if (isDriveActive) {
      setDriveCamResetTrigger((prev) => prev + 1);
      robotAudio.playClick(850);
    } else {
      handleResetInspectView();
    }
  };

  const handleSendDriveCommand = (linear: number, angular: number) => {
    if (autoRunAbortRef.current) {
      stopAutonomousCode(true);
    }
    setDriveState((prev) => ({
      ...prev,
      linearVelocity: linear,
      angularVelocity: angular,
    }));
  };

  const handleResetPosition = () => {
    stopAutonomousCode(true);
    setDriveResetTrigger((prev) => prev + 1);
    setDriveState((prev) => ({
      ...prev,
      position: { x: 0, z: 0 },
      heading: 0,
      linearVelocity: 0,
      angularVelocity: 0,
    }));
  };

  const handleOpenAi = (query?: string) => {
    setAiInitialQuery(query || '');
    setIsAiModalOpen(true);
  };

  const handleInspectComponent = (compId: string) => {
    setSelectedComponentId(compId);
    setMobileInspectSheet('none');
    setActiveView('3d-inspect');
  };

  const handleSelect3DComponent = (compId: string | null) => {
    setSelectedComponentId(compId);
    if (compId && isMobileMode) {
      setMobileInspectSheet('none');
    }
  };

  return (
    <div
      className={`relative overflow-hidden bg-slate-950 font-sans text-slate-100 select-none ${
        isMobileMode ? 'w-full h-[100dvh]' : 'w-screen h-screen'
      }`}
    >
      {/* 1. TOP NAVBAR */}
      <header
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between bg-slate-950/88 border-b border-slate-800/90 backdrop-blur-md ${
          isMobileMode
            ? isMobileLandscape
              ? 'h-9 px-2 gap-1'
              : 'h-10 px-2 gap-1'
            : 'px-3 sm:px-6 py-2.5 gap-2'
        }`}
      >
        {/* Left: CMU 10A Title, School Badge & Backpack */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div
            className={`${
              isMobileMode
                ? isMobileLandscape
                  ? 'w-6 h-6 text-[10px]'
                  : 'w-6.5 h-6.5 text-[11px]'
                : 'w-8 h-8 text-sm'
            } rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold font-mono shadow shrink-0`}
          >
            CMU
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-bold tracking-tight text-white truncate ${
                  isMobileMode ? 'text-[11px]' : 'text-sm'
                }`}
              >
                {isMobileMode ? 'JETBOT 3D' : 'MÔ PHỎNG JETBOT 3D'}
              </span>
              {!isMobileMode && (
                <span className="hidden md:inline-block text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap shrink-0">
                  LỚP 10A
                </span>
              )}
            </div>
            {!isMobileMode && (
              <p className="hidden sm:block text-[10px] text-slate-400 font-mono truncate">
                NVIDIA Jetson Nano · RPLIDAR · Camera CSI · Động cơ DC vi sai
              </p>
            )}
          </div>

          {/* Backpack button at top-left corner */}
          <button
            onClick={() => {
              setIsBackpackOpen(true);
              setHasNewItemInBackpack(false);
              robotAudio.playBackpackOpen();
            }}
            className={`relative flex items-center gap-1 ${
              isMobileMode ? 'px-1.5 py-1 rounded-lg text-[11px]' : 'px-2 sm:px-3 py-1.5 rounded-xl text-xs'
            } border font-bold transition-all cursor-pointer shadow-lg active:scale-95 whitespace-nowrap shrink-0 ${
              hasNewItemInBackpack
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-slate-950 border-amber-300 ring-2 ring-amber-400 animate-pulse'
                : 'bg-slate-900/90 hover:bg-slate-800 text-amber-300 border-amber-500/40 hover:border-amber-400'
            }`}
            title="Mở Balo linh kiện đã đào bới được trên Sao Hỏa (Phím B)"
          >
            <Backpack className={`${isMobileMode ? 'w-3 h-3' : 'w-3.5 h-3.5 sm:w-4 sm:h-4'} text-amber-400 shrink-0`} />
            <span className={`font-mono ${isMobileMode ? 'text-[10px]' : 'text-[11px] sm:text-xs'}`}>
              {isMobileMode
                ? `${Object.keys(inventory).length}/15`
                : `Balo (${Object.keys(inventory).length}/15)`}
            </span>
          </button>
        </div>

        {/* Center: 3 Primary Mode Switchers (Desktop Only — Mobile uses Fixed Bottom Nav) */}
        {!isMobileMode && (
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-inner shrink-0">
            <button
              onClick={() => {
                setActiveView('3d-inspect');
                robotAudio.playClick(700);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeView === '3d-inspect'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Mô hình 3D</span>
            </button>

            <button
              onClick={() => {
                setShowAsdwInInspect(false);
                setActiveView('drive-sim');
                void robotAudio.unlock();
                robotAudio.playClick(750);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeView === 'drive-sim'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Lái xe &amp; Cảm biến</span>
            </button>

            <button
              onClick={() => {
                setShowAsdwInInspect(false);
                setActiveView('table-analysis');
                robotAudio.playClick(800);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeView === 'table-analysis'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Bảng linh kiện</span>
            </button>
          </div>
        )}

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Real Photo Comparison Modal Button */}
          <button
            onClick={() => setIsPhotoModalOpen(true)}
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Xem ảnh chụp robot JetBot thực tế từ đề bài CMU"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
            {!isMobileMode && <span className="hidden md:inline">Ảnh thực tế</span>}
          </button>

          {/* AI Advisor Button */}
          <button
            onClick={() => handleOpenAi()}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-950 cursor-pointer whitespace-nowrap shrink-0"
            title="Hỏi trợ lý kỹ thuật AI"
          >
            <Bot className="w-3.5 h-3.5" />
            {!isMobileMode && <span className="hidden sm:inline">Hỏi AI</span>}
          </button>

          {/* Environment Map Selector Toggle (Exclusively for Drive Simulation Mode) */}
          {isDriveActive && (
            <button
              onClick={() => {
                const nextMap = environmentMap === 'mars-planet' ? 'cmu-arena' : 'mars-planet';
                setEnvironmentMap(nextMap);
                robotAudio.playClick(650);
              }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-md whitespace-nowrap shrink-0 ${
                environmentMap === 'mars-planet'
                  ? 'bg-gradient-to-r from-red-600/90 to-amber-600/90 text-white border-red-500 shadow-red-950/40'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50 hover:bg-emerald-900/60'
              }`}
              title="Đổi bản đồ lái xe: Sao Hỏa có Alien ⟷ Sa bàn thi đấu CMU"
            >
              {isMobileMode ? (
                <span>{environmentMap === 'mars-planet' ? '🪐' : '🏟️'}</span>
              ) : (
                <span>{environmentMap === 'mars-planet' ? '🪐 Bề mặt Sao Hỏa' : '🏟️ Sân CMU 10A'}</span>
              )}
            </button>
          )}

          {/* Dedicated Mobile / Desktop Mode Toggle */}
          <button
            type="button"
            data-testid="mobile-mode-toggle"
            onClick={handleToggleMobileMode}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isMobileMode
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/30'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title={
              isMobileMode
                ? 'Đang bật Giao diện Điện thoại (không che tab) · Nhấn để chuyển sang Giao diện Máy tính'
                : 'Chuyển sang Giao diện Điện thoại tối ưu không che tab'
            }
          >
            {isMobileMode ? (
              <Smartphone className="w-3.5 h-3.5 text-cyan-300" />
            ) : (
              <Monitor className="w-3.5 h-3.5 text-slate-300" />
            )}
            {!isMobileMode && <span className="hidden lg:inline">ĐT</span>}
          </button>

          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer shrink-0"
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </header>

      {/* 2. 3D VIEWPORT CONTAINER */}
      <main className="w-full h-full relative">
        <JetBotScene
          explodedValue={explodedValue}
          renderMode={renderMode}
          isAutoRotate={isAutoRotate}
          selectedComponentId={selectedComponentId}
          onSelectComponent={handleSelect3DComponent}
          isDriveMode={isDriveActive}
          driveState={driveState}
          setDriveState={setDriveState}
          viewPreset={viewPreset}
          modelScale={modelScale}
          onObstaclesToppledChange={(toppled, total) => setObstaclesCount({ toppled, total })}
          resetObstaclesTrigger={resetObstaclesTrigger}
          inspectResetTrigger={inspectResetTrigger}
          driveResetTrigger={driveResetTrigger}
          driveCamResetTrigger={driveCamResetTrigger}
          zoomState={zoomState}
          environmentMap={environmentMap}
          isDigging={isDigging}
          astronautDigTrigger={astronautDigTrigger}
          astronautReceiveTrigger={astronautReceiveTrigger}
          astronautCancelTrigger={astronautCancelTrigger}
        />

        {/* Shovel Excavation Floating Action Button on Mars */}
        <ShovelButton
          isMobile={isMobileMode}
          isMobileLandscape={isMobileLandscape}
          alignLeft={isMobileMode && isMobileLandscape && activeView === 'drive-sim' && mobileDriveTool === 'code'}
          canDig={!!driveState.canDig || (environmentMap === 'mars-planet' && isDriveActive)}
          isDigging={isDigging}
          digProgress={digProgress}
          digSiteName={driveState.nearestDigSiteName}
          onDig={handleStartDig}
          digMode={digMode}
          onDigModeChange={setDigMode}
          astronautStatus={driveState.astronautTaskStatus || 'idle'}
          astronautName={driveState.astronautTaskName}
          astronautDistanceToBot={driveState.astronautDistanceToBot}
          astronautCanReceiveZ={!!driveState.astronautCanReceiveZ}
          pendingItemName={pendingAstronautItem?.name}
          onReceiveFromAstronaut={handleReceiveAstronautItem}
          positionClass={
            isMobileMode
              ? isMobileLandscape
                ? activeView === 'drive-sim' && mobileDriveTool === 'code'
                  ? 'bottom-11 left-2'
                  : 'bottom-11 right-2'
                : activeView === 'drive-sim' && mobileDriveTool === 'camera'
                ? 'bottom-[90px] right-2'
                : 'top-11 right-2'
              : activeView === 'drive-sim'
              ? isCodePanelCollapsed
                ? 'bottom-20 right-6'
                : isCodePanelExpanded
                ? 'bottom-5 right-[560px]'
                : 'bottom-5 right-[432px]'
              : 'bottom-24 right-6 sm:bottom-28 sm:right-10'
          }
        />

        {/* Floating Zoom Controls (Mouse Wheel & Keys I / O) */}
        {activeView !== 'table-analysis' && !(activeView === 'drive-sim' && !isMobileMode) && (
          <ZoomControls
            isMobile={isMobileMode}
            isMobileLandscape={isMobileLandscape}
            onZoomInStart={() => setZoomState('in')}
            onZoomInEnd={() => setZoomState(null)}
            onZoomOutStart={() => setZoomState('out')}
            onZoomOutEnd={() => setZoomState(null)}
            onResetZoom={handleResetZoomForCurrentMode}
            isIActive={isIActive || zoomState === 'in'}
            isOActive={isOActive || zoomState === 'out'}
            positionClass={
              isMobileMode
                ? isMobileLandscape
                  ? 'top-10 left-2'
                  : 'top-11 left-2'
                : 'top-16 left-6'
            }
          />
        )}

        {/* 3. INSPECTION MODE HUD OVERLAYS */}
        {activeView === '3d-inspect' && (
          <>
            {/* Desktop ASDW Drive Toggle Button */}
            {!isMobileMode && (
              <div className="fixed bottom-6 left-6 z-20 pointer-events-auto">
                {!showAsdwInInspect ? (
                  <button
                    onClick={() => {
                      setShowAsdwInInspect(true);
                      setExplodedValue(0);
                      void robotAudio.unlock();
                      robotAudio.playClick(800);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-emerald-500 text-slate-200 hover:text-slate-950 border border-slate-700/80 rounded-xl shadow-xl backdrop-blur-md text-xs font-bold transition-all cursor-pointer"
                    title="Mở cụm phím ASDW lái xe"
                  >
                    <Gamepad2 className="w-4 h-4 text-emerald-400" />
                    <span>Bật phím ASDW</span>
                  </button>
                ) : (
                  <DriveController
                    driveState={driveState}
                    onSendDriveCommand={handleSendDriveCommand}
                    onResetPosition={handleResetPosition}
                    activePressedKeys={pressedKeysState}
                    onClose={() => setShowAsdwInInspect(false)}
                    obstaclesToppled={obstaclesCount.toppled}
                    totalObstacles={obstaclesCount.total}
                    onResetObstacles={handleResetObstacles}
                    speedLevel={speedLevel}
                    onSpeedLevelChange={setSpeedLevel}
                    isTurboActive={isTurboActive}
                    onToggleTurbo={() => setSpeedLevel((prev) => (prev === 3 ? 2 : 3))}
                  />
                )}
              </div>
            )}

            {/* Mobile ASDW Controller Sheet in Inspect Mode */}
            {isMobileMode && mobileInspectSheet === 'asdw' && (
              <DriveController
                isMobile
                isMobileLandscape={isMobileLandscape}
                driveState={driveState}
                onSendDriveCommand={handleSendDriveCommand}
                onResetPosition={handleResetPosition}
                activePressedKeys={pressedKeysState}
                onClose={() => setMobileInspectSheet('none')}
                obstaclesToppled={obstaclesCount.toppled}
                totalObstacles={obstaclesCount.total}
                onResetObstacles={handleResetObstacles}
                speedLevel={speedLevel}
                onSpeedLevelChange={setSpeedLevel}
                isTurboActive={isTurboActive}
                onToggleTurbo={() => setSpeedLevel((prev) => (prev === 3 ? 2 : 3))}
              />
            )}

            {/* Selected Component Detail Inspector Box (Bottom Sheet on Mobile Portrait, Side Drawer on Mobile Landscape, Right Card on Desktop) */}
            {selectedComponent && (!isMobileMode || mobileInspectSheet === 'none') && (() => {
              const photos = selectedComponentPhotos;
              const safePhotoIdx =
                photos.length > 0 ? Math.min(selectedGalleryIndex, photos.length - 1) : 0;
              const activePhoto = photos[safePhotoIdx] ?? {
                url: selectedComponent.realPhotoUrl,
                label: 'Ảnh thực tế',
                caption: selectedComponent.realPhotoCaption,
              };
              const activeCaption = activePhoto.caption || selectedComponent.realPhotoCaption;

              return (
              <div
                data-testid="selected-component-panel"
                className={
                  isMobileMode
                    ? isMobileLandscape
                      ? 'fixed top-10 bottom-11 right-2 z-30 w-[300px] max-w-[46vw] overflow-y-auto bg-slate-900/95 border border-slate-700/85 rounded-xl p-3 shadow-2xl backdrop-blur-xl pointer-events-auto'
                      : 'fixed bottom-[86px] left-2 right-2 z-30 max-h-[44dvh] overflow-y-auto bg-slate-900/95 border border-slate-700/85 rounded-xl p-3 shadow-2xl backdrop-blur-xl pointer-events-auto'
                    : 'absolute top-16 right-4 z-30 w-96 sm:w-[440px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5.5rem)] overflow-y-auto bg-slate-900/95 border border-slate-700/80 rounded-2xl p-5 shadow-2xl backdrop-blur-xl pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-200'
                }
              >
                {/* Header */}
                <div
                  className={`flex items-start justify-between gap-2 border-b border-slate-800 ${
                    isMobileMode ? 'pb-2 mb-2.5' : 'pb-3.5 mb-4'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`${isMobileMode ? 'w-3 h-3 mt-1.5' : 'w-4 h-4 mt-1.5'} rounded-full shadow-md shrink-0`}
                      style={{ backgroundColor: selectedComponent.colorHex }}
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`font-bold ${isMobileMode ? 'text-base' : 'text-lg sm:text-xl'} text-white leading-snug`}>
                          {selectedComponent.name}
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-semibold">
                          {selectedComponent.categoryLabel}
                        </span>
                      </div>
                      <div className={`${isMobileMode ? 'text-xs' : 'text-sm'} text-slate-400 font-mono mt-0.5`}>
                        {selectedComponent.englishName}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedComponentId(null)}
                    aria-label="Đóng bảng chi tiết linh kiện"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="Đóng bảng chi tiết"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className={`${isMobileMode ? 'space-y-2.5 text-xs sm:text-sm' : 'space-y-4 text-sm'}`}>
                  {/* FEATURED LARGE REAL PHOTO GALLERY CARD (Ảnh Chụp Thực Tế Ngoài Đời) */}
                  {activePhoto.url && (
                    <div className="space-y-2">
                      <div className="relative group rounded-xl overflow-hidden border border-slate-700/80 shadow-lg bg-white">
                        <img
                          src={activePhoto.url}
                          alt={`${selectedComponent.name} - ${activePhoto.label}`}
                          data-testid="selected-component-active-photo"
                          className={`w-full ${
                            isMobileMode ? (isMobileLandscape ? 'h-28' : 'h-32') : 'h-48 sm:h-56'
                          } object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03] cursor-pointer`}
                          onClick={() =>
                            setEnlargedPhoto({
                              photos,
                              index: safePhotoIdx,
                              title: selectedComponent.name,
                            })
                          }
                          title="Bấm để phóng to ảnh chụp thật toàn màn hình"
                        />
                        {/* Real Photo Badge */}
                        <div className="absolute top-2.5 left-2.5 px-3 py-1 rounded-full bg-slate-950/85 border border-slate-700/80 backdrop-blur-md text-xs font-bold text-emerald-300 flex items-center gap-1.5 shadow-md pointer-events-none">
                          <span>📸 {activePhoto.label}</span>
                        </div>

                        {/* Photo Index Counter */}
                        {photos.length > 1 && (
                          <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-slate-950/85 border border-slate-700/80 text-xs font-mono font-bold text-cyan-300 shadow-md pointer-events-none tabular-nums">
                            {safePhotoIdx + 1}/{photos.length}
                          </div>
                        )}

                        {/* Prev/Next Quick Arrows */}
                        {photos.length > 1 && (
                          <>
                            <button
                              type="button"
                              aria-label="Ảnh thực tế trước"
                              data-testid="panel-photo-prev"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGalleryIndex((safePhotoIdx - 1 + photos.length) % photos.length);
                              }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white border border-slate-700 shadow-md cursor-pointer transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Ảnh thực tế tiếp theo"
                              data-testid="panel-photo-next"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGalleryIndex((safePhotoIdx + 1) % photos.length);
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-950/80 hover:bg-slate-900 text-white border border-slate-700 shadow-md cursor-pointer transition-colors"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {/* Hover Overlay Zoom Button */}
                        <button
                          type="button"
                          onClick={() =>
                            setEnlargedPhoto({
                              photos,
                              index: safePhotoIdx,
                              title: selectedComponent.name,
                            })
                          }
                          className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-md backdrop-blur-md transition-all cursor-pointer"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-cyan-300" />
                          <span>Phóng to</span>
                        </button>
                      </div>

                      {/* Thumbnail Switcher Grid - all attached real photos visible at once */}
                      {photos.length > 1 && (
                        <div
                          className={`grid gap-2 ${
                            photos.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
                          }`}
                        >
                          {photos.map((photo, idx) => {
                            const isActive = idx === safePhotoIdx;
                            return (
                              <button
                                key={photo.url}
                                type="button"
                                data-testid={`panel-photo-thumb-${idx}`}
                                onClick={() => setSelectedGalleryIndex(idx)}
                                className={`group/thumb relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer bg-slate-950 flex flex-col ${
                                  isActive
                                    ? 'border-emerald-400 ring-2 ring-emerald-500/30 shadow-md'
                                    : 'border-slate-700/80 opacity-85 hover:opacity-100 hover:border-slate-500'
                                }`}
                                title={photo.label}
                              >
                                <div className="w-full h-14 bg-white overflow-hidden">
                                  <img
                                    src={photo.url}
                                    alt={photo.label}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <span
                                  className={`w-full px-1.5 py-1 text-[11px] sm:text-xs font-medium truncate text-center ${
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

                      {/* Photo Caption */}
                      {activeCaption && (
                        <div className="text-sm text-slate-200 bg-slate-950/75 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                          <span className="font-bold text-cyan-400">Đặc điểm thực tế: </span>
                          {activeCaption}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Location on Robot */}
                  <div className="flex items-start gap-2 text-sm text-slate-200 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 leading-relaxed">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-1" />
                    <div>
                      <span className="text-slate-400 font-semibold">Vị trí: </span>
                      <span className="text-slate-100">{selectedComponent.location}</span>
                    </div>
                  </div>

                  {/* Core Function */}
                  <div className="bg-slate-950/85 p-3.5 rounded-xl border border-slate-800/80">
                    <div className="text-emerald-400 font-bold text-sm mb-1.5 flex items-center gap-1.5">
                      <Info className="w-4 h-4" />
                      <span>Chức năng cốt lõi:</span>
                    </div>
                    <div className="text-slate-100 leading-relaxed text-sm sm:text-[15px]">
                      {selectedComponent.functionSummary}
                    </div>
                  </div>

                  {/* Specifications Grid */}
                  <div className="space-y-2">
                    <div className="text-slate-300 font-bold text-sm flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-cyan-400" />
                      <span>Thông số kỹ thuật:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedComponent.keySpecs.map((spec, i) => (
                        <div key={i} className="bg-slate-800/75 p-2.5 rounded-xl border border-slate-700/50">
                          <div className="text-slate-400 text-xs font-medium">{spec.label}</div>
                          <div className="text-emerald-300 font-mono text-sm font-semibold mt-0.5 leading-snug break-words">
                            {spec.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hardware Interface */}
                  <div className="text-sm bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 leading-relaxed">
                    <span className="text-slate-400 font-semibold">Giao thức kết nối: </span>
                    <span className="font-mono text-cyan-300 font-medium">{selectedComponent.interfaceType}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenAi(`Hãy phân tích sâu nguyên lý hoạt động, cách đấu nối phần cứng và vai trò của ${selectedComponent.name} trong robot JetBot.`)}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm shadow-md shadow-emerald-950/40"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Hỏi AI về linh kiện này</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveView('table-analysis')}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold transition-colors flex items-center justify-center gap-1.5 text-sm border border-slate-700 cursor-pointer"
                    >
                      <span>Xem bảng phân tích chi tiết</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
              );
            })()}

            {/* Desktop Click Hint Tooltip Banner */}
            {!isMobileMode && activeView === '3d-inspect' && !selectedComponent && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-900/85 border border-slate-700/80 shadow-xl backdrop-blur-md text-[11px] text-slate-300 flex items-center gap-2 pointer-events-none select-none">
                <span>💡 <strong>Mẹo:</strong> Nhấp chuột vào bất kỳ bộ phận nào của mô hình 3D để xem ảnh thật ngoài đời & thông số</span>
              </div>
            )}

            {/* Bottom Dock for 3D Inspection (Always shown on Desktop; single-sheet on Mobile) */}
            {(!isMobileMode || mobileInspectSheet === 'dock') && (
              <BottomDock
                isMobile={isMobileMode}
                isMobileLandscape={isMobileLandscape}
                onCloseMobileSheet={() => setMobileInspectSheet('none')}
                explodedValue={explodedValue}
                onExplodedChange={setExplodedValue}
                renderMode={renderMode}
                onRenderModeChange={setRenderMode}
                isAutoRotate={isAutoRotate}
                onToggleAutoRotate={() => setIsAutoRotate(!isAutoRotate)}
                selectedComponentId={selectedComponentId}
                onSelectComponent={handleSelect3DComponent}
                onViewPreset={(preset) => {
                  setViewPreset(preset);
                  setInspectResetTrigger((prev) => prev + 1);
                  robotAudio.playClick(850);
                }}
                isMuted={isMuted}
                onToggleMute={handleToggleMute}
                onResetView={() => {
                  setExplodedValue(0);
                  handleResetInspectView();
                }}
                modelScale={modelScale}
                onModelScaleChange={setModelScale}
              />
            )}

            {/* Mobile Portrait Inspect Tool Bar above Bottom Nav (Landscape folds these into the unified bottom bar) */}
            {isMobileMode && !isMobileLandscape && (
              <div
                data-testid="mobile-inspect-tool-switcher"
                className="fixed bottom-[46px] left-2 right-2 z-30 flex items-center justify-center gap-1 pointer-events-auto"
              >
                <button
                  type="button"
                  data-testid="mobile-inspect-dock-btn"
                  onClick={() => {
                    setSelectedComponentId(null);
                    setMobileInspectSheet((prev) => (prev === 'dock' ? 'none' : 'dock'));
                    robotAudio.playClick(740);
                  }}
                  className={`flex-1 min-h-[34px] px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shadow-lg backdrop-blur-md ${
                    mobileInspectSheet === 'dock'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-slate-900/92 text-slate-200 border-slate-700'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Thanh 3D</span>
                </button>

                <button
                  type="button"
                  data-testid="mobile-inspect-asdw-btn"
                  onClick={() => {
                    setSelectedComponentId(null);
                    setExplodedValue(0);
                    void robotAudio.unlock();
                    setMobileInspectSheet((prev) => (prev === 'asdw' ? 'none' : 'asdw'));
                    robotAudio.playClick(780);
                  }}
                  className={`flex-1 min-h-[34px] px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shadow-lg backdrop-blur-md ${
                    mobileInspectSheet === 'asdw'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-slate-900/92 text-slate-200 border-slate-700'
                  }`}
                >
                  <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Lái ASDW</span>
                </button>

                {(mobileInspectSheet !== 'none' || selectedComponent) && (
                  <button
                    type="button"
                    data-testid="mobile-inspect-clear-btn"
                    onClick={() => {
                      setMobileInspectSheet('none');
                      setSelectedComponentId(null);
                    }}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-900/92 text-slate-300 border border-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shadow-lg backdrop-blur-md"
                  >
                    <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Thu gọn</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* 4. DRIVE MODE HUD OVERLAYS */}
        {activeView === 'drive-sim' && (
          <>
            {/* Drive Controller (Always visible on Desktop; Exclusively selected on Mobile) */}
            {(!isMobileMode || mobileDriveTool === 'drive') && (
              <DriveController
                isMobile={isMobileMode}
                isMobileLandscape={isMobileLandscape}
                driveState={driveState}
                onSendDriveCommand={handleSendDriveCommand}
                onResetPosition={handleResetPosition}
                activePressedKeys={pressedKeysState}
                onClose={isMobileMode ? () => setMobileDriveTool('none') : undefined}
                obstaclesToppled={obstaclesCount.toppled}
                totalObstacles={obstaclesCount.total}
                onResetObstacles={handleResetObstacles}
                speedLevel={speedLevel}
                onSpeedLevelChange={setSpeedLevel}
                isTurboActive={isTurboActive}
                onToggleTurbo={() => setSpeedLevel((prev) => (prev === 3 ? 2 : 3))}
              />
            )}

            {/* Quick Floating Turbo Speed Indicator & Zoom Controls Row (Desktop Only) */}
            {!isMobileMode && (
              <div className="fixed top-16 left-6 z-20 pointer-events-auto hidden sm:flex items-start gap-2.5">
                <button
                  onClick={() => setSpeedLevel((prev) => (prev === 3 ? 2 : 3))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-xl transition-all cursor-pointer text-xs font-bold ${
                    isTurboActive
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-300 ring-2 ring-amber-400/50 shadow-orange-500/30'
                      : 'bg-slate-900/90 text-amber-300 hover:text-white hover:bg-slate-800 border-amber-500/40'
                  }`}
                  title="Bật/Tắt tăng tốc Turbo (Phím tắt: Giữ SHIFT)"
                >
                  <span className="text-sm">🚀</span>
                  <span>{isTurboActive ? 'TĂNG TỐC TURBO: ĐANG BẬT (200%)' : 'NÚT TĂNG TỐC JETBOT'}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isTurboActive ? 'bg-slate-950/25 text-slate-950 font-black' : 'bg-slate-800 text-amber-300 border border-amber-500/30'
                  }`}>
                    SHIFT
                  </span>
                </button>
                <ZoomControls
                  inline
                  onZoomInStart={() => setZoomState('in')}
                  onZoomInEnd={() => setZoomState(null)}
                  onZoomOutStart={() => setZoomState('out')}
                  onZoomOutEnd={() => setZoomState(null)}
                  onResetZoom={handleResetZoomForCurrentMode}
                  isIActive={isIActive || zoomState === 'in'}
                  isOActive={isOActive || zoomState === 'out'}
                />
              </div>
            )}

            {/* Mars Greenhouse 2-Door Airlock & Crop-Watering Status HUD */}
            {environmentMap === 'mars-planet' && (driveState.greenhouseAirlock || driveState.astronautWatering) && (
              <div
                data-testid="greenhouse-airlock-hud"
                className={`fixed left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1.5 ${
                  isMobileMode ? 'top-11 max-w-[92vw]' : 'top-16 max-w-md'
                }`}
              >
                {driveState.greenhouseAirlock && (
                  <div className="w-full rounded-xl bg-slate-950/90 border border-slate-700/80 backdrop-blur-md shadow-2xl px-3.5 py-2 text-xs text-slate-100">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            driveState.greenhouseAirlock.statusColor === 'red'
                              ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                              : driveState.greenhouseAirlock.statusColor === 'amber'
                              ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-pulse'
                              : driveState.greenhouseAirlock.statusColor === 'green'
                              ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                              : 'bg-cyan-400'
                          }`}
                        />
                        <span className="font-bold truncate">
                          {driveState.greenhouseAirlock.phaseLabel}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {driveState.greenhouseAirlock.progressPercent > 0 &&
                        driveState.greenhouseAirlock.progressPercent < 100
                          ? `${driveState.greenhouseAirlock.progressPercent}%`
                          : driveState.greenhouseAirlock.dustPurged
                          ? 'SẠCH BỤI'
                          : 'AIRLOCK'}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold">
                      <span
                        className={`px-1.5 py-0.5 rounded border ${
                          driveState.greenhouseAirlock.outerDoorOpen
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}
                      >
                        Cửa ngoài: {driveState.greenhouseAirlock.outerDoorOpen ? 'MỞ' : 'KHÓA'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border ${
                          driveState.greenhouseAirlock.innerDoorOpen
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}
                      >
                        Cửa trong: {driveState.greenhouseAirlock.innerDoorOpen ? 'MỞ' : 'KHÓA'}
                      </span>
                      {driveState.greenhouseAirlock.dustPurged && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/35">
                          Air-Shower OK
                        </span>
                      )}
                    </div>

                    {(driveState.greenhouseAirlock.statusColor === 'amber' ||
                      driveState.greenhouseAirlock.statusColor === 'red') && (
                      <div className="mt-1.5 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-100"
                          style={{ width: `${driveState.greenhouseAirlock.progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {driveState.astronautWatering && (
                  <div className="px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold shadow-lg backdrop-blur-md">
                    Phi hành gia đang vào khoang đệm tưới rau nhà kính
                  </div>
                )}
              </div>
            )}

            {/* Camera CSI Live FPV View (Always shown on Desktop; Exclusively selected on Mobile) */}
            {(!isMobileMode || mobileDriveTool === 'camera') && (
              <CameraFPV
                isMobile={isMobileMode}
                isMobileLandscape={isMobileLandscape}
                driveState={driveState}
                onCloseMobile={() => setMobileDriveTool('none')}
              />
            )}

            {/* Multi-Language Code IDE Editor & Runner HUD */}
            {(!isMobileMode || mobileDriveTool === 'code') && (
              <AutonomousCodePanel
                isMobile={isMobileMode}
                isMobileLandscape={isMobileLandscape}
                workspaceMode={workspaceMode}
                onWorkspaceModeChange={(mode) => {
                  setWorkspaceMode(mode);
                  setAutoCodeError(null);
                  robotAudio.playClick(760);
                }}
                customFiles={customFiles}
                activeCustomFileId={activeCustomFile?.id || 'custom-1'}
                onSelectCustomFile={(id) => {
                  setActiveCustomFileId(id);
                  setAutoCodeError(null);
                  robotAudio.playClick(760);
                }}
                onCreateCustomFile={handleCreateCustomFile}
                onCreateCustomFileWithCode={handleCreateCustomFileWithCode}
                onDeleteCustomFile={handleDeleteCustomFile}
                onRenameCustomFile={handleRenameCustomFile}
                language={codeLanguage}
                onLanguageChange={handleLanguageChange}
                code={autoCode}
                onCodeChange={handleCodeChange}
                selectedPresetId={selectedPresetId}
                onSelectPreset={handleSelectAutonomousPreset}
                onResetPreset={handleResetAutonomousPreset}
                isRunning={isAutoCodeRunning}
                onStart={handleStartAutonomousCode}
                onStop={() => stopAutonomousCode(false)}
                isCollapsed={isMobileMode ? false : isCodePanelCollapsed}
                onToggleCollapse={() => {
                  if (isMobileMode) {
                    setMobileDriveTool('none');
                  } else {
                    setIsCodePanelCollapsed((prev) => !prev);
                  }
                }}
                isExpanded={isCodePanelExpanded}
                onToggleExpand={() => setIsCodePanelExpanded((prev) => !prev)}
                onSaveFile={handleSaveActiveCode}
                hasUnsavedChanges={hasUnsavedChanges}
                lastSavedLabel={lastSavedLabel}
                saveTick={saveTick}
                logs={autoCodeLogs}
                onClearLogs={() => {
                  setAutoCodeLogs([]);
                  setLastRunMs(null);
                }}
                errorMsg={autoCodeError}
                lastRunMs={lastRunMs}
                dangerProb={
                  isAutoCodeRunning
                    ? autoDangerProb
                    : computeDangerProbability({
                        obstacleDist: driveState.nearestObstacleDistance,
                        alienDist: driveState.nearestAlienDistance ?? 99,
                        nearBoundary:
                          Math.abs(driveState.position.x) >
                            (environmentMap === 'mars-planet' ? 12.5 : 2.8) - 0.65 ||
                          Math.abs(driveState.position.z) >
                            (environmentMap === 'mars-planet' ? 12.5 : 2.8) - 0.65,
                        headingDeg: driveState.heading,
                        posX: driveState.position.x,
                        posZ: driveState.position.z,
                      })
                }
              />
            )}

            {/* Mobile Portrait Single-Drawer Drive Tool Switcher above Bottom Nav (Landscape folds into unified bottom bar) */}
            {isMobileMode && !isMobileLandscape && (
              <div
                data-testid="mobile-drive-tool-switcher"
                className="fixed bottom-[46px] left-2 right-2 z-35 grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-slate-950/65 border border-white/15 backdrop-blur-md shadow-xl pointer-events-auto"
              >
                <button
                  type="button"
                  data-testid="mobile-tool-drive"
                  onClick={() => setMobileDriveTool((prev) => (prev === 'drive' ? 'none' : 'drive'))}
                  className={`min-h-[32px] px-1 rounded-md text-[10.5px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                    mobileDriveTool === 'drive'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Gamepad2 className="w-3 h-3 shrink-0" />
                  <span>Tay cầm</span>
                </button>

                <button
                  type="button"
                  data-testid="mobile-tool-camera"
                  onClick={() => setMobileDriveTool((prev) => (prev === 'camera' ? 'none' : 'camera'))}
                  className={`min-h-[32px] px-1 rounded-md text-[10.5px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                    mobileDriveTool === 'camera'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Camera className="w-3 h-3 shrink-0" />
                  <span>Camera</span>
                </button>

                <button
                  type="button"
                  data-testid="mobile-tool-code"
                  onClick={() => setMobileDriveTool((prev) => (prev === 'code' ? 'none' : 'code'))}
                  className={`min-h-[32px] px-1 rounded-md text-[10.5px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                    mobileDriveTool === 'code'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Code2 className="w-3 h-3 shrink-0" />
                  <span>Code IDE</span>
                </button>

                <button
                  type="button"
                  data-testid="mobile-tool-none"
                  onClick={() => setMobileDriveTool('none')}
                  className={`min-h-[32px] px-1 rounded-md text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                    mobileDriveTool === 'none'
                      ? 'bg-slate-800 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <EyeOff className="w-3 h-3 shrink-0" />
                  <span>Xem 3D</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* 5. TABLE ANALYSIS OVERLAY VIEW */}
        {activeView === 'table-analysis' && (
          <div
            className={`absolute inset-0 z-20 bg-slate-950/95 overflow-y-auto pointer-events-auto backdrop-blur-sm ${
              isMobileMode
                ? isMobileLandscape
                  ? 'top-9 pb-12'
                  : 'top-10 pb-14'
                : 'top-14'
            }`}
          >
            <ComponentTable
              isMobile={isMobileMode}
              isMobileLandscape={isMobileLandscape}
              onInspect3D={handleInspectComponent}
              selectedComponentId={selectedComponentId}
              onOpenAiGuide={handleOpenAi}
            />
          </div>
        )}
      </main>

      {/* MOBILE FIXED BOTTOM NAVIGATION BAR (Portrait: slim 44px bar; Landscape: single unified 40px strip with tool buttons) */}
      {isMobileMode && (
        <nav
          aria-label="Điều hướng chính trên điện thoại"
          data-testid="mobile-bottom-nav"
          className={`fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md ${
            isMobileLandscape
              ? 'h-10 flex items-center justify-between gap-2 px-2 py-1'
              : 'h-11 grid grid-cols-3 gap-1 px-1.5 py-1'
          }`}
        >
          <div className={isMobileLandscape ? 'flex items-center gap-1 shrink-0' : 'contents'}>
            <button
              type="button"
              data-testid="mobile-nav-3d-inspect"
              onClick={() => {
                setActiveView('3d-inspect');
                robotAudio.playClick(700);
              }}
              className={`${
                isMobileLandscape ? 'h-8 px-2.5 text-[11px] rounded-lg' : 'min-h-[36px] text-[11px] rounded-lg'
              } flex items-center justify-center gap-1 font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeView === '3d-inspect'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>{isMobileLandscape ? '3D' : 'Mô hình 3D'}</span>
            </button>

            <button
              type="button"
              data-testid="mobile-nav-drive-sim"
              onClick={() => {
                setShowAsdwInInspect(false);
                setActiveView('drive-sim');
                void robotAudio.unlock();
                robotAudio.playClick(750);
              }}
              className={`${
                isMobileLandscape ? 'h-8 px-2.5 text-[11px] rounded-lg' : 'min-h-[36px] text-[11px] rounded-lg'
              } flex items-center justify-center gap-1 font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeView === 'drive-sim'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
              <span>{isMobileLandscape ? 'Lái xe' : 'Lái & Cảm biến'}</span>
            </button>

            <button
              type="button"
              data-testid="mobile-nav-table-analysis"
              onClick={() => {
                setShowAsdwInInspect(false);
                setActiveView('table-analysis');
                robotAudio.playClick(800);
              }}
              className={`${
                isMobileLandscape ? 'h-8 px-2.5 text-[11px] rounded-lg' : 'min-h-[36px] text-[11px] rounded-lg'
              } flex items-center justify-center gap-1 font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeView === 'table-analysis'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5 shrink-0" />
              <span>Linh kiện</span>
            </button>
          </div>

          {/* Landscape Integrated Tool Switcher (Eliminates stacked second bar to maximize 3D height) */}
          {isMobileLandscape && activeView === '3d-inspect' && (
            <div
              data-testid="mobile-inspect-tool-switcher"
              className="flex items-center gap-1 border-l border-slate-800 pl-2 overflow-x-auto scrollbar-none"
            >
              <button
                type="button"
                data-testid="mobile-inspect-dock-btn"
                onClick={() => {
                  setSelectedComponentId(null);
                  setMobileInspectSheet((prev) => (prev === 'dock' ? 'none' : 'dock'));
                  robotAudio.playClick(740);
                }}
                className={`h-8 px-2 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mobileInspectSheet === 'dock'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-900 text-slate-200 border-slate-700'
                }`}
              >
                <Layers className="w-3 h-3 shrink-0" />
                <span>Thanh 3D</span>
              </button>

              <button
                type="button"
                data-testid="mobile-inspect-asdw-btn"
                onClick={() => {
                  setSelectedComponentId(null);
                  setExplodedValue(0);
                  void robotAudio.unlock();
                  setMobileInspectSheet((prev) => (prev === 'asdw' ? 'none' : 'asdw'));
                  robotAudio.playClick(780);
                }}
                className={`h-8 px-2 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mobileInspectSheet === 'asdw'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-900 text-slate-200 border-slate-700'
                }`}
              >
                <Gamepad2 className="w-3 h-3 shrink-0" />
                <span>Lái ASDW</span>
              </button>

              {(mobileInspectSheet !== 'none' || selectedComponent) && (
                <button
                  type="button"
                  data-testid="mobile-inspect-clear-btn"
                  onClick={() => {
                    setMobileInspectSheet('none');
                    setSelectedComponentId(null);
                  }}
                  className="h-8 px-2 rounded-lg bg-slate-900 text-slate-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <EyeOff className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Ẩn</span>
                </button>
              )}
            </div>
          )}

          {isMobileLandscape && activeView === 'drive-sim' && (
            <div
              data-testid="mobile-drive-tool-switcher"
              className="flex items-center gap-1 border-l border-slate-800 pl-2 overflow-x-auto scrollbar-none"
            >
              <button
                type="button"
                data-testid="mobile-tool-drive"
                onClick={() => setMobileDriveTool((prev) => (prev === 'drive' ? 'none' : 'drive'))}
                className={`h-8 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mobileDriveTool === 'drive'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-900 text-slate-200 border border-slate-700'
                }`}
              >
                <Gamepad2 className="w-3 h-3 shrink-0" />
                <span>Tay cầm</span>
              </button>

              <button
                type="button"
                data-testid="mobile-tool-camera"
                onClick={() => setMobileDriveTool((prev) => (prev === 'camera' ? 'none' : 'camera'))}
                className={`h-8 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mobileDriveTool === 'camera'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-900 text-slate-200 border border-slate-700'
                }`}
              >
                <Camera className="w-3 h-3 shrink-0" />
                <span>Camera</span>
              </button>

              <button
                type="button"
                data-testid="mobile-tool-code"
                onClick={() => setMobileDriveTool((prev) => (prev === 'code' ? 'none' : 'code'))}
                className={`h-8 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mobileDriveTool === 'code'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-200 border border-slate-700'
                }`}
              >
                <Code2 className="w-3 h-3 shrink-0" />
                <span>Code IDE</span>
              </button>

              <button
                type="button"
                data-testid="mobile-tool-none"
                onClick={() => setMobileDriveTool('none')}
                className={`h-8 px-2 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mobileDriveTool === 'none'
                    ? 'bg-slate-800 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <EyeOff className="w-3 h-3 shrink-0" />
                <span>Xem 3D</span>
              </button>
            </div>
          )}
        </nav>
      )}

      {/* 6. AI ADVISOR MODAL */}
      <JetBotAIModal
        isMobile={isMobileMode}
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        initialQuery={aiInitialQuery}
      />

      {/* 7. REAL JETBOT PHOTO COMPARISON MODAL */}
      {isPhotoModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${isMobileMode ? 'p-2' : 'p-3 sm:p-6'} bg-slate-950/85 backdrop-blur-md`}>
          <div
            className={`w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
              isMobileMode ? 'max-h-[94dvh]' : 'max-h-[90vh]'
            }`}
          >
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm text-white">
                  Ảnh Chụp Linh Kiện Robot JetBot Thực Tế (CMU Lớp 10A)
                </h3>
              </div>
              <button
                onClick={() => setIsPhotoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
                <span className="font-bold text-emerald-400">Ghi chú đối chiếu mô hình: </span>
                Mô hình 3D trong ứng dụng được thiết kế hoàn toàn bám sát theo các góc chụp thực tế này:
                Khung nhôm xanh lá tròn, cụm RPLIDAR đen trên cùng, Camera CSI có cáp dẹt dán dải xanh, bo mạch NVIDIA Jetson Nano có tản nhiệt nhôm đen, 2 bánh xe nan hoa xanh dương và 2 động cơ DC dưới đáy gầm.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="p-2 text-[11px] font-semibold text-slate-300 border-b border-slate-800">
                    1. Camera CSI & Cáp dẹt FFC
                  </div>
                  <img
                    src="/assets/aistudio/image_f841a927.png"
                    alt="Camera CSI"
                    className="w-full h-44 object-cover bg-black"
                  />
                </div>

                <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="p-2 text-[11px] font-semibold text-slate-300 border-b border-slate-800">
                    2. RPLIDAR & Động cơ đai kéo
                  </div>
                  <img
                    src="/assets/aistudio/image_8a45e6b8.png"
                    alt="RPLIDAR"
                    className="w-full h-44 object-cover bg-black"
                  />
                </div>

                <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="p-2 text-[11px] font-semibold text-slate-300 border-b border-slate-800">
                    3. Mặt trước & Bánh xe xanh nan hoa
                  </div>
                  <img
                    src="/assets/aistudio/image_46fc7930.png"
                    alt="Mặt trước JetBot"
                    className="w-full h-44 object-cover bg-black"
                  />
                </div>

                <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="p-2 text-[11px] font-semibold text-slate-300 border-b border-slate-800">
                    4. Tản nhiệt Jetson Nano & Cọc đồng
                  </div>
                  <img
                    src="/assets/aistudio/image_a3d4a2ce.png"
                    alt="Jetson Nano Heatsink"
                    className="w-full h-44 object-cover bg-black"
                  />
                </div>

                <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="p-2 text-[11px] font-semibold text-slate-300 border-b border-slate-800">
                    5. Mặt sau: Cổng USB & Anten Wi-Fi
                  </div>
                  <img
                    src="/assets/aistudio/image_c14dba1a.png"
                    alt="Mặt sau JetBot"
                    className="w-full h-44 object-cover bg-black"
                  />
                </div>

                <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="p-2 text-[11px] font-semibold text-slate-300 border-b border-slate-800">
                    6. Mặt đáy gầm: 2 Động cơ DC & Bánh xoay
                  </div>
                  <img
                    src="/assets/aistudio/image_bbcc8481.png"
                    alt="Mặt đáy gầm xe"
                    className="w-full h-44 object-cover bg-black"
                  />
                </div>

                <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="p-2 text-[11px] font-semibold text-slate-300 border-b border-slate-800">
                    7. Gai lốp rãnh mê cung & Ốc siết Anten
                  </div>
                  <img
                    src="/assets/aistudio/image_3a4f0581.png"
                    alt="Gai lốp và đai ốc anten"
                    className="w-full h-44 object-cover bg-black"
                  />
                </div>

                <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="p-2.5 text-xs font-semibold text-slate-200 border-b border-slate-800">
                    8. Cổng USB 3.0, HDMI &amp; Khay pin 3 cell
                  </div>
                  <img
                    src="/assets/aistudio/3_37e20bc8.jpg"
                    alt="Cổng USB 3.0 Jetson Nano và khay pin"
                    className="w-full h-44 object-cover bg-black"
                  />
                </div>

                <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="p-2.5 text-xs font-semibold text-slate-200 border-b border-slate-800">
                    9. Mặt sau: 2 Anten Wi-Fi, OLED &amp; Công tắc
                  </div>
                  <img
                    src="/assets/aistudio/2_45b1e6a7.jpg"
                    alt="2 Anten Wi-Fi và công tắc nguồn"
                    className="w-full h-44 object-cover bg-black"
                  />
                </div>

                <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="p-2.5 text-xs font-semibold text-slate-200 border-b border-slate-800">
                    10. Cận cảnh vân lốp cao su rãnh mê cung
                  </div>
                  <img
                    src="/assets/aistudio/1793006044923_3623432520915601015_g8908539602773141407_eec5e2d594f8a3d825da581ef69c2939_e0977dd6.jpg"
                    alt="Vân lốp cao su JetBot"
                    className="w-full h-44 object-cover bg-black"
                  />
                </div>

                <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="p-2.5 text-xs font-semibold text-slate-200 border-b border-slate-800">
                    11. Cận cảnh 2 động cơ DC &amp; giắc nối dưới gầm
                  </div>
                  <img
                    src="/assets/aistudio/1794209545008_43132710148482215_g8908539602773141407_d4b315b01618f58c49674b604cd4ff17_8a55e730.jpg"
                    alt="2 động cơ DC dưới gầm xe"
                    className="w-full h-44 object-cover bg-black"
                  />
                </div>

                <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="p-2.5 text-xs font-semibold text-slate-200 border-b border-slate-800">
                    12. Cặp bánh xoay tự do (Caster) trước &amp; sau
                  </div>
                  <img
                    src="/assets/aistudio/1794209545157_43132710148482215_g8908539602773141407_f36e3a266647df439cb9b2cff63e62e5_11deefde.jpg"
                    alt="Bánh xoay tự do dưới gầm"
                    className="w-full h-44 object-cover bg-black"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7b. SINGLE COMPONENT REAL PHOTO LIGHTBOX MODAL */}
      {enlargedPhoto && (() => {
        const photos = enlargedPhoto.photos;
        const safeIdx = Math.min(enlargedPhoto.index, Math.max(0, photos.length - 1));
        const currentPhoto = photos[safeIdx];
        if (!currentPhoto) return null;

        return (
          <div
            data-testid="component-photo-lightbox"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150"
            onClick={() => setEnlargedPhoto(null)}
          >
            <div
              className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-slate-950 border-b border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ImageIcon className="w-5 h-5 text-emerald-400 shrink-0" />
                  <h3 className="font-bold text-base sm:text-lg text-white truncate">
                    Ảnh thực tế: {enlargedPhoto.title} — {currentPhoto.label}
                  </h3>
                  {photos.length > 1 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-cyan-300 font-mono text-xs font-bold shrink-0 tabular-nums">
                      {safeIdx + 1}/{photos.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Đóng phóng to ảnh"
                  onClick={() => setEnlargedPhoto(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative p-4 bg-white flex items-center justify-center overflow-hidden">
                <img
                  src={currentPhoto.url}
                  alt={`${enlargedPhoto.title} - ${currentPhoto.label}`}
                  className="w-full max-h-[60vh] object-contain rounded-lg"
                />
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Ảnh trước"
                      onClick={() =>
                        setEnlargedPhoto({
                          ...enlargedPhoto,
                          index: (safeIdx - 1 + photos.length) % photos.length,
                        })
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/85 hover:bg-slate-900 text-white border border-slate-700 shadow-lg cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Ảnh tiếp theo"
                      onClick={() =>
                        setEnlargedPhoto({
                          ...enlargedPhoto,
                          index: (safeIdx + 1) % photos.length,
                        })
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/85 hover:bg-slate-900 text-white border border-slate-700 shadow-lg cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {photos.length > 1 && (
                <div
                  className={`grid gap-2 px-4 py-2.5 bg-slate-900 border-t border-slate-800 ${
                    photos.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
                  }`}
                >
                  {photos.map((photo, idx) => (
                    <button
                      key={photo.url}
                      type="button"
                      onClick={() => setEnlargedPhoto({ ...enlargedPhoto, index: idx })}
                      className={`rounded-xl overflow-hidden border-2 flex items-center gap-2 pr-2 bg-slate-950 cursor-pointer transition-all ${
                        idx === safeIdx
                          ? 'border-emerald-400 ring-2 ring-emerald-500/30'
                          : 'border-slate-700 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img src={photo.url} alt={photo.label} className="w-12 h-10 object-cover bg-white shrink-0" />
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {photo.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {currentPhoto.caption && (
                <div className="px-5 py-3.5 bg-slate-950/95 border-t border-slate-800 text-sm sm:text-[15px] text-slate-200 leading-relaxed">
                  <span className="font-bold text-emerald-400">Chi tiết đối chiếu: </span>
                  {currentPhoto.caption}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 8. Excavation Discovery Reward Modal */}
      <DigDiscoveryModal
        isMobile={isMobileMode}
        item={discoveredItemModal}
        collectedByAstronaut={discoveredByAstronaut}
        onClose={() => setDiscoveredItemModal(null)}
        onOpenBackpack={() => setIsBackpackOpen(true)}
        onInspect3D={handleInspectComponent}
      />

      {/* 9. Backpack Modal (Balo linh kiện) */}
      <BackpackModal
        isMobile={isMobileMode}
        isOpen={isBackpackOpen}
        onClose={() => setIsBackpackOpen(false)}
        inventory={inventory}
        onInspect3D={handleInspectComponent}
      />
    </div>
  );
}
