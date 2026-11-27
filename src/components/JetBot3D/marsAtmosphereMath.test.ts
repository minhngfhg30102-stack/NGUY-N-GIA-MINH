import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildEscarpmentQuadIndices,
  buildMarsCraterProfilePoints,
  computeChassisTerrainPose,
  computeCraterRimHeight,
  computeRockDustBlend,
  MARS_ATMOSPHERE_PALETTE,
  MARS_CRATER_SPECS,
  MARS_GREENHOUSE_SPEC,
  MARS_SUN_DIRECTION,
  resolveStaticDomePushout,
  sampleMarsTerrainPointElevation,
} from './marsAtmosphereMath';

describe('marsAtmosphereMath', () => {
  it('provides a unit-length solar direction elevated above the Martian horizon', () => {
    const len = Math.hypot(MARS_SUN_DIRECTION.x, MARS_SUN_DIRECTION.y, MARS_SUN_DIRECTION.z);
    assert.ok(Math.abs(len - 1) < 1e-6);
    assert.ok(MARS_SUN_DIRECTION.y > 0.3 && MARS_SUN_DIRECTION.y < 0.85);
  });

  it('keeps fog density light so near and mid-ground stay razor sharp without dust storms', () => {
    assert.ok(MARS_ATMOSPHERE_PALETTE.fogDensity > 0 && MARS_ATMOSPHERE_PALETTE.fogDensity <= 0.01);
  });

  it('produces continuous periodic crater rim height with zero seam at 0 and 2*PI', () => {
    const h0 = computeCraterRimHeight(0, 0.75);
    const h2Pi = computeCraterRimHeight(Math.PI * 2, 0.75);
    assert.ok(Math.abs(h0 - h2Pi) < 1e-9);
    assert.equal(computeCraterRimHeight(1.2, 0), 0);
    assert.ok(h0 > 3 && h0 < 16);
  });

  it('clamps rock dust blend smoothly between 0 and 1', () => {
    assert.equal(computeRockDustBlend(-0.5), 0);
    assert.equal(computeRockDustBlend(1.2), 1);
    const mid = computeRockDustBlend(0.55);
    assert.ok(mid > 0.3 && mid < 0.75);
  });

  it('winds Mars LatheGeometry craters with 100% upward-facing (+Y) faces and normals', () => {
    const profile = buildMarsCraterProfilePoints(1.45, 0.18).map(
      ([px, py]) => new THREE.Vector2(px, py)
    );
    const geom = new THREE.LatheGeometry(profile, 32);
    geom.computeVertexNormals();
    const pos = geom.attributes.position;
    const index = geom.getIndex()!;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    let upFaces = 0;
    let downFaces = 0;
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(pos, index.getX(i));
      b.fromBufferAttribute(pos, index.getX(i + 1));
      c.fromBufferAttribute(pos, index.getX(i + 2));
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      const cross = ab.cross(ac);
      if (cross.lengthSq() > 1e-12) {
        if (cross.y > 0) upFaces++;
        else downFaces++;
      }
    }
    assert.ok(upFaces > 0);
    assert.equal(downFaces, 0);

    const norm = geom.attributes.normal;
    let downNorms = 0;
    for (let i = 0; i < norm.count; i++) {
      const ny = norm.getY(i);
      const lenSq = norm.getX(i) ** 2 + ny ** 2 + norm.getZ(i) ** 2;
      if (lenSq > 0.5 && ny <= 0) downNorms++;
    }
    assert.equal(downNorms, 0);
    geom.dispose();
  });

  it('winds Mars escarpment ring quads with upward-facing (+Y) normals', () => {
    const rings = [
      { rad: 13.75, y: -0.01 },
      { rad: 15.6, y: -1.15 },
      { rad: 20.4, y: -3.65 },
    ];
    const segs = 16;
    const positions: number[] = [];
    for (const step of rings) {
      for (let s = 0; s < segs; s++) {
        const theta = (s / segs) * Math.PI * 2;
        positions.push(Math.cos(theta) * step.rad, step.y, Math.sin(theta) * step.rad);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(buildEscarpmentQuadIndices(rings.length, segs));
    geom.computeVertexNormals();
    const norm = geom.attributes.normal;
    let up = 0;
    let down = 0;
    for (let i = 0; i < norm.count; i++) {
      if (norm.getY(i) > 0) up++;
      else down++;
    }
    assert.equal(up, rings.length * segs);
    assert.equal(down, 0);
    geom.dispose();
  });

  it('elevates JetBot over Mars crater rim walls and dips back into the crater bowl', () => {
    const c = MARS_CRATER_SPECS[5]; // (-0.4, -6.2), r = 1.25, h = 0.15
    const outside = sampleMarsTerrainPointElevation(c.x, c.z + c.r * 1.2, []);
    const onRim = sampleMarsTerrainPointElevation(c.x, c.z + c.r * 0.74, []);
    const inBowl = sampleMarsTerrainPointElevation(c.x, c.z, []);

    assert.equal(outside, 0);
    assert.ok(onRim > 0.12 && onRim < 0.2);
    assert.ok(inBowl < 0.01);

    // Approaching crater rim heading -Z (Math.PI) lifts nose up (negative slopePitch)
    const poseClimbing = computeChassisTerrainPose(
      c.x,
      c.z + c.r * 0.86,
      Math.PI,
      (wx, wz) => sampleMarsTerrainPointElevation(wx, wz, [])
    );
    assert.ok(poseClimbing.elevation > 0.06);
    assert.ok(poseClimbing.slopePitch < -0.1);
  });

  it('places the Mars greenhouse on flat clear ground away from craters, mounds, and spawn', () => {
    const gh = MARS_GREENHOUSE_SPEC;
    const spawnDist = Math.hypot(gh.x, gh.z);
    assert.ok(spawnDist > 4.0);

    for (const c of MARS_CRATER_SPECS) {
      const dist = Math.hypot(gh.x - c.x, gh.z - c.z);
      assert.ok(dist > gh.collisionRadius + c.r * 1.08 + 0.15);
    }

    const mounds = [
      { x: 2.4, z: 1.8, radius: 1.6, height: 0.28 },
      { x: -2.6, z: 2.2, radius: 1.7, height: 0.32 },
      { x: 2.0, z: -2.5, radius: 1.5, height: 0.26 },
      { x: -3.0, z: -1.8, radius: 1.6, height: 0.29 },
      { x: 0.2, z: 4.2, radius: 1.8, height: 0.34 },
    ];
    for (const m of mounds) {
      const dist = Math.hypot(gh.x - m.x, gh.z - m.z);
      assert.ok(dist > gh.collisionRadius + m.radius + 0.2);
    }

    assert.equal(sampleMarsTerrainPointElevation(gh.x, gh.z, mounds), 0);
  });

  it('pushes actors outside static dome radii cleanly without modifying outside positions', () => {
    const inside = resolveStaticDomePushout(3.8, 6.8, 0.25, 3.5, 6.5, 1.55);
    assert.equal(inside.pushed, true);
    assert.ok(Math.hypot(inside.x - 3.5, inside.z - 6.5) >= 1.55 + 0.25 - 1e-6);

    const outside = resolveStaticDomePushout(0, 0, 0.25, 3.5, 6.5, 1.55);
    assert.equal(outside.pushed, false);
    assert.equal(outside.x, 0);
    assert.equal(outside.z, 0);
  });
});
