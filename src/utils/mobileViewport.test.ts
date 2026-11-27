import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMobileViewport, resolveMobileLayoutFlags } from './mobileViewport';

test('detects mobile portrait devices accurately', () => {
  const iphone14 = computeMobileViewport({ width: 390, height: 844, hasCoarsePointer: true });
  assert.equal(iphone14.isMobileViewport, true);
  assert.equal(iphone14.orientation, 'portrait');
  assert.equal(iphone14.isLandscapeViewport, false);

  const smallAndroid = computeMobileViewport({ width: 360, height: 740, hasCoarsePointer: true });
  assert.equal(smallAndroid.isMobileViewport, true);
  assert.equal(smallAndroid.orientation, 'portrait');
});

test('detects mobile landscape devices accurately (e.g. rotated phones)', () => {
  const iphoneLandscape = computeMobileViewport({ width: 844, height: 390, hasCoarsePointer: true });
  assert.equal(iphoneLandscape.isMobileViewport, true);
  assert.equal(iphoneLandscape.orientation, 'landscape');
  assert.equal(iphoneLandscape.isLandscapeViewport, true);

  const pixelLandscape = computeMobileViewport({ width: 915, height: 412, hasCoarsePointer: false });
  assert.equal(pixelLandscape.isMobileViewport, true);
  assert.equal(pixelLandscape.isLandscapeViewport, true);

  const seLandscape = computeMobileViewport({ width: 667, height: 375, hasCoarsePointer: false });
  assert.equal(seLandscape.isMobileViewport, true);
  assert.equal(seLandscape.isLandscapeViewport, true);
});

test('keeps laptops and desktops out of mobile mode (even touchscreen laptops)', () => {
  const macbook = computeMobileViewport({ width: 1440, height: 900, hasCoarsePointer: false });
  assert.equal(macbook.isMobileViewport, false);

  const hdLaptop = computeMobileViewport({ width: 1280, height: 720, hasCoarsePointer: true });
  assert.equal(hdLaptop.isMobileViewport, false);

  const winLaptop = computeMobileViewport({ width: 1366, height: 768, hasCoarsePointer: true });
  assert.equal(winLaptop.isMobileViewport, false);

  const tabletDesktop = computeMobileViewport({ width: 1024, height: 768, hasCoarsePointer: false });
  assert.equal(tabletDesktop.isMobileViewport, false);
});

test('resolves manual mobile/desktop preference overrides cleanly', () => {
  const phoneLandscape = computeMobileViewport({ width: 844, height: 390, hasCoarsePointer: true });
  assert.deepEqual(resolveMobileLayoutFlags('auto', phoneLandscape, 390), {
    isMobileMode: true,
    isMobileLandscape: true,
  });
  assert.deepEqual(resolveMobileLayoutFlags('desktop', phoneLandscape, 390), {
    isMobileMode: false,
    isMobileLandscape: false,
  });

  const laptop = computeMobileViewport({ width: 1440, height: 900, hasCoarsePointer: false });
  assert.deepEqual(resolveMobileLayoutFlags('auto', laptop, 900), {
    isMobileMode: false,
    isMobileLandscape: false,
  });
  // Manual mobile toggle on tall laptop previews compact mobile without short-screen clipping
  assert.deepEqual(resolveMobileLayoutFlags('mobile', laptop, 900), {
    isMobileMode: true,
    isMobileLandscape: false,
  });
});
