import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VirtualSlot } from '../virtualCabinet.types';
import { CABINET_THEME, type SlotDimension } from './cabinet3d.types';
import CabinetDoor from './CabinetDoor';

type CabinetSlotProps = {
  slot: VirtualSlot;
  dimension: SlotDimension;
  isSelected: boolean;
  onSelect: () => void;
};

// Cache processed cutout textures by image path so they are only computed once
const cutoutTextureCache = new Map<string, THREE.CanvasTexture>();

function resolveSlotImageUrl(imagePath: string): string {
  if (
    imagePath.startsWith('http://') ||
    imagePath.startsWith('https://') ||
    imagePath.startsWith('data:')
  ) {
    return imagePath;
  }
  const baseUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Loads the exact catalogue bouquet photo (e.g. images/demo-silk-rose.png) and
 * automatically removes the light studio background from the outer borders via
 * flood-fill with soft edge feathering, returning a crisp transparent CanvasTexture.
 */
function useBouquetCutoutTexture(imagePath: string | null): THREE.CanvasTexture | null {
  const [loadedTexture, setLoadedTexture] = useState<{
    imagePath: string;
    texture: THREE.CanvasTexture;
  } | null>(null);

  const cachedTexture = imagePath ? (cutoutTextureCache.get(imagePath) ?? null) : null;
  const texture =
    cachedTexture ?? (loadedTexture?.imagePath === imagePath ? loadedTexture.texture : null);

  useEffect(() => {
    if (!imagePath) return;

    const cached = cutoutTextureCache.get(imagePath);
    if (cached) return;

    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (isCancelled) return;

      try {
        const maxDim = 512;
        const scale = Math.min(1, maxDim / Math.max(img.width || 512, img.height || 512));
        const w = Math.max(64, Math.round((img.width || 512) * scale));
        const h = Math.max(64, Math.round((img.height || 512) * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Flood-fill background mask starting from outer edges (top, left, right, bottom-corners)
        const visited = new Uint8Array(w * h);
        const isBg = new Uint8Array(w * h);
        const queue = new Int32Array(w * h);
        let head = 0;
        let tail = 0;

        const pushSeed = (x: number, y: number) => {
          if (x < 0 || x >= w || y < 0 || y >= h) return;
          const idx = y * w + x;
          if (!visited[idx]) {
            visited[idx] = 1;
            queue[tail++] = idx;
          }
        };

        // Top edge
        for (let x = 0; x < w; x++) {
          pushSeed(x, 0);
          pushSeed(x, 1);
        }
        // Left and right edges
        for (let y = 0; y < h; y++) {
          pushSeed(0, y);
          pushSeed(1, y);
          pushSeed(w - 1, y);
          pushSeed(w - 2, y);
        }
        // Bottom left & bottom right corners (leaving center 30%..68% for bouquet stem/ribbon)
        for (let x = 0; x < Math.floor(w * 0.28); x++) {
          pushSeed(x, h - 1);
          pushSeed(x, h - 2);
        }
        for (let x = Math.floor(w * 0.68); x < w; x++) {
          pushSeed(x, h - 1);
          pushSeed(x, h - 2);
        }

        const isStudioBgPixel = (pIdx: number): boolean => {
          const r = data[pIdx];
          const g = data[pIdx + 1];
          const b = data[pIdx + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const sat = maxC - minC;
          const lum = (r + g + b) / 3;
          return lum > 196 && sat < 26;
        };

        while (head < tail) {
          const idx = queue[head++];
          const pIdx = idx * 4;
          if (!isStudioBgPixel(pIdx)) continue;

          isBg[idx] = 1;
          const r = data[pIdx];
          const g = data[pIdx + 1];
          const b = data[pIdx + 2];

          const x = idx % w;
          const y = (idx - x) / w;

          const neighbors = [
            x > 0 ? idx - 1 : -1,
            x < w - 1 ? idx + 1 : -1,
            y > 0 ? idx - w : -1,
            y < h - 1 ? idx + w : -1,
          ];

          for (let i = 0; i < 4; i++) {
            const nIdx = neighbors[i];
            if (nIdx !== -1 && !visited[nIdx]) {
              const np = nIdx * 4;
              const dr = Math.abs(data[np] - r);
              const dg = Math.abs(data[np + 1] - g);
              const db = Math.abs(data[np + 2] - b);
              if (Math.max(dr, dg, db) < 15 && isStudioBgPixel(np)) {
                visited[nIdx] = 1;
                queue[tail++] = nIdx;
              }
            }
          }
        }

        // Apply transparent alpha to studio background and soft-feather 1px boundary pixels
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const pIdx = idx * 4;
            if (isBg[idx]) {
              data[pIdx + 3] = 0;
            } else {
              // Check 4-neighbors to feather edge transition
              let bgNeighbors = 0;
              if (x > 0 && isBg[idx - 1]) bgNeighbors++;
              if (x < w - 1 && isBg[idx + 1]) bgNeighbors++;
              if (y > 0 && isBg[idx - w]) bgNeighbors++;
              if (y < h - 1 && isBg[idx + w]) bgNeighbors++;
              if (bgNeighbors > 0) {
                data[pIdx + 3] = Math.round(255 * (1 - bgNeighbors * 0.22));
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        const canvasTex = new THREE.CanvasTexture(canvas);
        canvasTex.colorSpace = THREE.SRGBColorSpace;
        canvasTex.needsUpdate = true;
        cutoutTextureCache.set(imagePath, canvasTex);
        if (!isCancelled) setLoadedTexture({ imagePath, texture: canvasTex });
      } catch {
        // A remote image without CORS permission cannot be read through canvas.
        // Keep the colour-matched procedural bouquet instead of breaking WebGL.
      }
    };
    img.onerror = () => undefined;

    img.src = resolveSlotImageUrl(imagePath);

    return () => {
      isCancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [imagePath]);

  return texture;
}

// High-resolution procedural texture for slot label badge "A01", "A02", "A03"
function createSlotLabelTexture(code: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 256, 112);
    grad.addColorStop(0, '#092e20');
    grad.addColorStop(1, '#14532d');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 104, 22);
    ctx.fill();

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(38, 56, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 62px "Nunito", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code, 144, 58);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function CabinetSlot({ slot, dimension, isSelected, onSelect }: CabinetSlotProps) {
  const ledRef = useRef<THREE.Mesh>(null);
  const ledLightRef = useRef<THREE.PointLight>(null);
  const downlightRef = useRef<THREE.PointLight>(null);
  const bouquetGroupRef = useRef<THREE.Group>(null);
  const turntableRef = useRef<THREE.Mesh>(null);

  const labelTexture = useMemo(() => createSlotLabelTexture(slot.code), [slot.code]);
  const bouquetCutoutTexture = useBouquetCutoutTexture(slot.image);
  const { width, height, depth } = dimension;

  const ledColor = useMemo(() => {
    switch (slot.status) {
      case 'AVAILABLE':
        return CABINET_THEME.ledAvailable;
      case 'HELD':
      case 'RESERVED':
        return CABINET_THEME.ledHeld;
      case 'OPENING':
      case 'OPEN':
        return CABINET_THEME.ledOpening;
      case 'FAULT':
        return CABINET_THEME.ledFault;
      case 'EMPTY':
      default:
        return CABINET_THEME.ledEmpty;
    }
  }, [slot.status]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // 1. Status LED & Chamber Downlight smooth animation
    if (ledRef.current) {
      const mat = ledRef.current.material as THREE.MeshStandardMaterial;
      if (slot.status === 'OPENING' || slot.status === 'OPEN') {
        const pulse = 0.5 + 0.5 * Math.sin(time * 5.5);
        mat.emissiveIntensity = 1.0 + pulse * 1.4;
        if (ledLightRef.current) ledLightRef.current.intensity = 0.5 + pulse * 0.5;
      } else if (slot.status === 'FAULT') {
        const pulse = 0.5 + 0.5 * Math.sin(time * 10);
        mat.emissiveIntensity = 0.7 + pulse * 1.6;
        if (ledLightRef.current) ledLightRef.current.intensity = 0.4 + pulse * 0.6;
      } else if (
        slot.status === 'AVAILABLE' ||
        slot.status === 'HELD' ||
        slot.status === 'RESERVED'
      ) {
        mat.emissiveIntensity = 1.1;
        if (ledLightRef.current) ledLightRef.current.intensity = 0.35;
      } else {
        mat.emissiveIntensity = 0.08;
        if (ledLightRef.current) ledLightRef.current.intensity = 0;
      }
    }

    if (downlightRef.current) {
      const targetIntensity =
        slot.status === 'EMPTY'
          ? 0.25
          : slot.status === 'OPEN' || slot.status === 'OPENING'
            ? 1.35
            : isSelected
              ? 1.05
              : 0.78;
      downlightRef.current.intensity = THREE.MathUtils.damp(
        downlightRef.current.intensity,
        targetIntensity,
        5,
        delta,
      );
    }

    // 2. Smooth idle bouquet presentation motion
    if (bouquetGroupRef.current) {
      const phaseOffset = slot.code === 'A01' ? 0 : slot.code === 'A02' ? 2.1 : 4.2;
      const targetSwayY =
        slot.status === 'OPEN'
          ? Math.sin(time * 1.5 + phaseOffset) * 0.14
          : isSelected
            ? Math.sin(time * 1.2 + phaseOffset) * 0.1
            : Math.sin(time * 0.7 + phaseOffset) * 0.04;

      const baseLiftY = -height / 2 + 0.08;
      const targetLiftY =
        baseLiftY +
        (slot.status === 'OPEN' ? 0.02 : isSelected ? 0.01 : 0) +
        Math.sin(time * 1.6 + phaseOffset) * 0.005;

      bouquetGroupRef.current.rotation.y = THREE.MathUtils.damp(
        bouquetGroupRef.current.rotation.y,
        targetSwayY,
        4,
        delta,
      );
      bouquetGroupRef.current.position.y = THREE.MathUtils.damp(
        bouquetGroupRef.current.position.y,
        targetLiftY,
        4,
        delta,
      );
    }

    if (turntableRef.current) {
      const mat = turntableRef.current.material as THREE.MeshStandardMaterial;
      const targetGlow = slot.status === 'OPEN' ? 0.9 : isSelected ? 0.55 : 0.2;
      mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, targetGlow, 5, delta);
    }
  });

  return (
    <group position={dimension.position}>
      {/* === 1. CHAMBER INTERIOR CASING: Warm Boutique Showcase === */}
      {/* Back Wall */}
      <mesh position={[0, 0, -depth / 2 + 0.005]}>
        <planeGeometry args={[width - 0.01, height - 0.01]} />
        <meshStandardMaterial color="#e6dfd3" roughness={0.65} metalness={0.04} />
      </mesh>
      {/* Decorative vertical fluted back slats */}
      {[-0.28, -0.14, 0, 0.14, 0.28].map((xPos, i) => (
        <mesh key={`slat-${i}`} position={[xPos, 0, -depth / 2 + 0.01]}>
          <boxGeometry args={[0.06, height - 0.08, 0.008]} />
          <meshStandardMaterial color="#dcd3c2" roughness={0.55} metalness={0.06} />
        </mesh>
      ))}

      {/* Floor / Shelf */}
      <mesh position={[0, -height / 2 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 0.01, depth - 0.01]} />
        <meshStandardMaterial color="#d6cfc2" roughness={0.5} metalness={0.12} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, height / 2 - 0.005, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 0.01, depth - 0.01]} />
        <meshStandardMaterial color="#ebe5da" roughness={0.6} />
      </mesh>
      {/* Left Wall */}
      <mesh position={[-width / 2 + 0.005, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[depth - 0.01, height - 0.01]} />
        <meshStandardMaterial color="#efeae1" roughness={0.6} />
      </mesh>
      {/* Right Wall */}
      <mesh position={[width / 2 - 0.005, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[depth - 0.01, height - 0.01]} />
        <meshStandardMaterial color="#efeae1" roughness={0.6} />
      </mesh>

      {/* === 2. LUXURY TURNTABLE DISPLAY PEDESTAL AT CHAMBER BASE === */}
      <group position={[0, -height / 2 + 0.035, 0.02]}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.27, 0.048, 32]} />
          <meshStandardMaterial color="#0f291e" roughness={0.3} metalness={0.25} />
        </mesh>
        <mesh ref={turntableRef} position={[0, 0.026, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.235, 0.007, 12, 36]} />
          <meshStandardMaterial
            color="#fef08a"
            emissive="#fbbf24"
            emissiveIntensity={0.3}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 0.038, 0]}>
          <cylinderGeometry args={[0.22, 0.23, 0.024, 32]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} metalness={0.1} />
        </mesh>
      </group>

      {/* Ceiling Diffuse LED Lightbar Fixture */}
      <group position={[0, height / 2 - 0.016, 0.02]}>
        <mesh>
          <boxGeometry args={[width * 0.68, 0.014, 0.07]} />
          <meshStandardMaterial
            color="#fffbeb"
            emissive="#fde68a"
            emissiveIntensity={slot.status === 'EMPTY' ? 0.2 : 0.95}
            roughness={0.15}
          />
        </mesh>
      </group>

      <pointLight
        ref={downlightRef}
        position={[0, height / 2 - 0.09, 0.12]}
        intensity={slot.status === 'EMPTY' ? 0.25 : 0.82}
        color="#fff7ed"
        distance={1.65}
        decay={1.9}
      />

      {/* === 3. REAL CATALOGUE BOUQUET DISPLAY (2.5D Layered Cutout + 3D Fallback) === */}
      {slot.status !== 'EMPTY' && slot.bouquetId && (
        <group ref={bouquetGroupRef} position={[0, -height / 2 + 0.08, 0.04]}>
          {/* Frosted Glass Vase Holder on Pedestal */}
          <mesh position={[0, 0.08, -0.02]}>
            <cylinderGeometry args={[0.085, 0.068, 0.16, 24]} />
            <meshStandardMaterial
              color="#e2e8f0"
              roughness={0.25}
              metalness={0.15}
              transparent
              opacity={0.78}
            />
          </mesh>
          <mesh position={[0, 0.155, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.084, 0.005, 10, 24]} />
            <meshStandardMaterial color="#eab308" metalness={0.85} roughness={0.2} />
          </mesh>

          {bouquetCutoutTexture ? (
            /* Exact Catalogue Bouquet Cutout in 2.5D Layered Depth Assembly */
            <group position={[0, 0.42, 0.03]}>
              {/* Soft contact drop-shadow silhouette behind the bouquet */}
              <mesh position={[0, -0.01, -0.045]}>
                <planeGeometry args={[0.74, 0.68]} />
                <meshBasicMaterial
                  map={bouquetCutoutTexture}
                  color="#1e293b"
                  transparent
                  opacity={0.22}
                  alphaTest={0.05}
                  depthWrite={false}
                />
              </mesh>
              {/* Back volume layer for 3D parallax thickness when rotating camera */}
              <mesh position={[0, 0.005, -0.022]} scale={[0.97, 0.97, 1]}>
                <planeGeometry args={[0.74, 0.68]} />
                <meshBasicMaterial
                  map={bouquetCutoutTexture}
                  color="#cbd5e1"
                  transparent
                  alphaTest={0.06}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Hero Front High-Resolution Catalogue Bouquet Layer */}
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[0.74, 0.68]} />
                <meshBasicMaterial
                  map={bouquetCutoutTexture}
                  transparent
                  alphaTest={0.04}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          ) : (
            /* Colour-Matched Front-Tilted 3D Bouquet while image loads */
            <group position={[0, 0.26, 0]} rotation={[0.42, 0, 0]} scale={1.45}>
              {/* Back Paper Collar correctly positioned at -Z (behind flowers) */}
              <mesh position={[0, 0.1, -0.05]} rotation={[0, Math.PI, 0]}>
                <cylinderGeometry
                  args={[0.18, 0.05, 0.24, 24, 1, true, -Math.PI * 0.55, Math.PI * 1.1]}
                />
                <meshStandardMaterial
                  color={
                    slot.code === 'A01' ? '#c2cfc2' : slot.code === 'A02' ? '#ebd5d5' : '#e6ccb2'
                  }
                  roughness={0.5}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Low Flared Outer Wrap */}
              <mesh position={[0, -0.03, 0]}>
                <cylinderGeometry args={[0.15, 0.048, 0.2, 24, 1, true]} />
                <meshStandardMaterial
                  color={
                    slot.code === 'A01' ? '#ece6dd' : slot.code === 'A02' ? '#f5ebe6' : '#ddb892'
                  }
                  roughness={0.5}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Foliage Cushion */}
              <mesh position={[0, 0.06, 0]}>
                <sphereGeometry args={[0.115, 16, 14]} />
                <meshStandardMaterial color="#4a6b5b" roughness={0.7} />
              </mesh>
              {/* Colour-accurate Flower Heads facing forward */}
              {[
                [0, 0.14, 0.03],
                [-0.06, 0.12, 0.04],
                [0.06, 0.12, 0.04],
                [-0.04, 0.16, -0.02],
                [0.04, 0.16, -0.02],
              ].map((pos, idx) => (
                <mesh key={`fb-flower-${idx}`} position={pos as [number, number, number]}>
                  <sphereGeometry args={[0.038, 14, 14]} />
                  <meshStandardMaterial
                    color={
                      slot.code === 'A01'
                        ? idx % 2 === 0
                          ? '#c08497'
                          : '#f5ebe0'
                        : slot.code === 'A02'
                          ? idx % 2 === 0
                            ? '#e8b4b8'
                            : '#9d8ec4'
                          : '#eab308'
                    }
                    roughness={0.35}
                  />
                </mesh>
              ))}
            </group>
          )}
        </group>
      )}

      {/* === 4. STATUS LED FIXTURE (mounted neatly on upper-right frame) === */}
      <group position={[width / 2 - 0.052, height / 2 - 0.045, depth / 2 + 0.018]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.019, 0.019, 0.012, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.15} />
        </mesh>
        <mesh ref={ledRef} position={[0, 0, 0.006]}>
          <sphereGeometry args={[0.013, 16, 16]} />
          <meshStandardMaterial
            color={ledColor}
            emissive={ledColor}
            emissiveIntensity={1.0}
            roughness={0.15}
          />
        </mesh>
        <pointLight
          ref={ledLightRef}
          position={[0, 0, 0.03]}
          color={ledColor}
          intensity={0.35}
          distance={0.5}
        />
      </group>

      {/* === 5. SLOT IDENTIFICATION BADGE "A01", "A02", "A03" === */}
      <mesh position={[-width / 2 + 0.082, height / 2 - 0.045, depth / 2 + 0.018]}>
        <planeGeometry args={[0.115, 0.05]} />
        <meshBasicMaterial map={labelTexture} />
      </mesh>

      {/* === 6. HINGED SHOWCASE DOOR WITH CRYSTAL CLEAR GLASS === */}
      <group position={[0, 0, depth / 2]}>
        <CabinetDoor
          width={width}
          height={height}
          status={slot.status}
          isSelected={isSelected}
          onSelect={onSelect}
        />
      </group>
    </group>
  );
}

export default React.memo(CabinetSlot);
