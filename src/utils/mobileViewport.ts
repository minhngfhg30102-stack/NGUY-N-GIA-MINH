export type ViewportOrientation = 'portrait' | 'landscape';

export interface ViewportMetricsInput {
  width: number;
  height: number;
  hasCoarsePointer?: boolean;
}

export interface MobileViewportState {
  isMobileViewport: boolean;
  orientation: ViewportOrientation;
  isLandscapeViewport: boolean;
}

/**
 * Determines whether the current screen belongs to a mobile device in either
 * portrait (e.g. 390x844) or landscape (e.g. 844x390 / 915x412) orientation,
 * while strictly keeping laptops and desktop monitors (e.g. 1280x720, 1440x900)
 * in desktop mode.
 */
export function computeMobileViewport({
  width,
  height,
  hasCoarsePointer = false,
}: ViewportMetricsInput): MobileViewportState {
  const safeW = Number.isFinite(width) && width > 0 ? width : 1024;
  const safeH = Number.isFinite(height) && height > 0 ? height : 768;
  const orientation: ViewportOrientation = safeW > safeH ? 'landscape' : 'portrait';
  const shortSide = Math.min(safeW, safeH);
  const longSide = Math.max(safeW, safeH);

  // Portrait phones or small narrow windows (< 768px wide)
  const isNarrowPortrait = safeW < 768;

  // Landscape phones: short height (<= 540px) and width below desktop threshold (< 1024px)
  const isCompactLandscapePhone = safeW >= 768 && safeW < 1024 && safeH <= 540;

  // Touch phones with high-res CSS viewports (e.g. coarse pointer with phone-sized short side)
  const isCoarseTouchPhone =
    hasCoarsePointer && shortSide <= 600 && longSide <= 1024;

  const isMobileViewport =
    isNarrowPortrait || isCompactLandscapePhone || isCoarseTouchPhone;

  return {
    isMobileViewport,
    orientation,
    isLandscapeViewport: orientation === 'landscape',
  };
}

export function resolveMobileLayoutFlags(
  mobileModePref: 'auto' | 'mobile' | 'desktop',
  viewport: MobileViewportState,
  viewportHeight: number
): { isMobileMode: boolean; isMobileLandscape: boolean } {
  const isMobileMode =
    mobileModePref === 'mobile' ||
    (mobileModePref === 'auto' && viewport.isMobileViewport);

  // Only switch into ultra-short landscape drawer layout when height is genuinely compact
  // (phone rotated horizontally), or when mobile mode is active on a short landscape screen.
  const isMobileLandscape =
    isMobileMode &&
    viewport.isLandscapeViewport &&
    (viewport.isMobileViewport || viewportHeight <= 560);

  return {
    isMobileMode,
    isMobileLandscape,
  };
}
