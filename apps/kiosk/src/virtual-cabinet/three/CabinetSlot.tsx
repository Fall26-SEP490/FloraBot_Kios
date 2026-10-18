import React, { useMemo, useRef } from 'react';
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

    // Smoothly brighten the warm chamber spotlight when selected or open
    if (downlightRef.current) {
      const targetIntensity =
        slot.status === 'EMPTY'
          ? 0.25
          : slot.status === 'OPEN' || slot.status === 'OPENING'
            ? 1.45
            : isSelected
              ? 1.15
              : 0.82;
      downlightRef.current.intensity = THREE.MathUtils.damp(
        downlightRef.current.intensity,
        targetIntensity,
        5,
        delta,
      );
    }

    // 2. Smooth idle bouquet presentation motion (turntable sway + gentle lift when selected/open)
    if (bouquetGroupRef.current) {
      const phaseOffset = slot.code === 'A01' ? 0 : slot.code === 'A02' ? 2.1 : 4.2;
      const targetSwayY =
        slot.status === 'OPEN'
          ? Math.sin(time * 1.5 + phaseOffset) * 0.18
          : isSelected
            ? Math.sin(time * 1.2 + phaseOffset) * 0.14
            : Math.sin(time * 0.7 + phaseOffset) * 0.05;

      const baseLiftY = -height / 2 + 0.34;
      const targetLiftY =
        baseLiftY +
        (slot.status === 'OPEN' ? 0.025 : isSelected ? 0.012 : 0) +
        Math.sin(time * 1.6 + phaseOffset) * 0.006;

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
      const targetGlow = slot.status === 'OPEN' ? 0.9 : isSelected ? 0.55 : 0.15;
      mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, targetGlow, 5, delta);
    }
  });

  return (
    <group position={dimension.position}>
      {/* === 1. CHAMBER INTERIOR CASING: Warm Champagne Boutique Finish (Prevents White Blowout) === */}
      {/* Back Wall with warm architectural tone */}
      <mesh position={[0, 0, -depth / 2 + 0.005]}>
        <planeGeometry args={[width - 0.01, height - 0.01]} />
        <meshStandardMaterial color="#e6dfd3" roughness={0.65} metalness={0.04} />
      </mesh>
      {/* Decorative vertical slatted wood/fluted back accent panel */}
      {[-0.28, -0.14, 0, 0.14, 0.28].map((xPos, i) => (
        <mesh key={`slat-${i}`} position={[xPos, 0, -depth / 2 + 0.01]}>
          <boxGeometry args={[0.06, height - 0.08, 0.008]} />
          <meshStandardMaterial color="#ddd4c5" roughness={0.55} metalness={0.06} />
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
        {/* Lower dark emerald/slate podium base */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.24, 0.26, 0.05, 32]} />
          <meshStandardMaterial color="#0f291e" roughness={0.3} metalness={0.25} />
        </mesh>
        {/* Illuminated gold/warm LED ring under podium top */}
        <mesh ref={turntableRef} position={[0, 0.028, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.225, 0.007, 12, 36]} />
          <meshStandardMaterial
            color="#fef08a"
            emissive="#fbbf24"
            emissiveIntensity={0.3}
            roughness={0.2}
          />
        </mesh>
        {/* Upper white marble/ceramic riser stage */}
        <mesh position={[0, 0.042, 0]}>
          <cylinderGeometry args={[0.21, 0.22, 0.028, 32]} />
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

      {/* Controlled Warm Commercial Downlight (Balanced so it never clips to white) */}
      <pointLight
        ref={downlightRef}
        position={[0, height / 2 - 0.09, 0.08]}
        intensity={slot.status === 'EMPTY' ? 0.25 : 0.85}
        color="#fff7ed"
        distance={1.65}
        decay={1.9}
      />

      {/* === 3. LARGE, LUSH 3D BOUQUETS WITH VASE & LAYERED KOREAN WRAPPING === */}
      {slot.status !== 'EMPTY' && slot.bouquetId && (
        <group ref={bouquetGroupRef} position={[0, -height / 2 + 0.34, 0.02]}>
          {/* Frosted Glass Hydration Vase on the Pedestal */}
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.078, 0.058, 0.18, 24]} />
            <meshStandardMaterial
              color="#e2e8f0"
              roughness={0.22}
              metalness={0.15}
              transparent
              opacity={0.85}
            />
          </mesh>
          {/* Gold neck ring on vase */}
          <mesh position={[0, -0.055, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.076, 0.005, 10, 24]} />
            <meshStandardMaterial color="#eab308" metalness={0.85} roughness={0.2} />
          </mesh>

          {/* ---------------- A01: Silk Rose Luxury Bouquet (Large & Lush) ---------------- */}
          {slot.code === 'A01' && (
            <group scale={1.62}>
              {/* High Back Collar Wrap (Korean-style layered paper fan behind flowers) */}
              <mesh position={[0, 0.14, -0.045]} rotation={[-0.12, 0, 0]}>
                <cylinderGeometry
                  args={[0.19, 0.055, 0.34, 24, 1, true, -Math.PI * 0.65, Math.PI * 1.3]}
                />
                <meshStandardMaterial color="#fbcfe8" roughness={0.45} side={THREE.DoubleSide} />
              </mesh>
              {/* Outer Blush Pink Fluted Paper Cone */}
              <mesh position={[0, -0.02, 0]}>
                <cylinderGeometry args={[0.155, 0.048, 0.28, 28, 1, true]} />
                <meshStandardMaterial
                  color="#fce7f3"
                  roughness={0.48}
                  metalness={0.04}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Inner Ivory Silk Tissue Layer */}
              <mesh position={[0, 0.03, 0.005]}>
                <cylinderGeometry args={[0.142, 0.052, 0.22, 24, 1, true]} />
                <meshStandardMaterial color="#fff1f2" roughness={0.38} side={THREE.DoubleSide} />
              </mesh>

              {/* Crimson Satin Ribbon Waist Band & Bow with Trailing Tails */}
              <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.072, 0.009, 10, 24]} />
                <meshStandardMaterial color="#be123c" roughness={0.25} metalness={0.25} />
              </mesh>
              <group position={[0, -0.05, 0.076]}>
                <mesh>
                  <sphereGeometry args={[0.022, 14, 14]} />
                  <meshStandardMaterial color="#be123c" roughness={0.25} metalness={0.3} />
                </mesh>
                <mesh position={[-0.034, 0.006, 0]} rotation={[0, 0, 0.42]}>
                  <cylinderGeometry args={[0.014, 0.022, 0.055, 12]} />
                  <meshStandardMaterial color="#9f1239" roughness={0.3} />
                </mesh>
                <mesh position={[0.034, 0.006, 0]} rotation={[0, 0, -0.42]}>
                  <cylinderGeometry args={[0.014, 0.022, 0.055, 12]} />
                  <meshStandardMaterial color="#9f1239" roughness={0.3} />
                </mesh>
                {/* Ribbon tails */}
                <mesh position={[-0.018, -0.045, 0.005]} rotation={[0.1, 0, 0.22]}>
                  <boxGeometry args={[0.014, 0.075, 0.004]} />
                  <meshStandardMaterial color="#be123c" roughness={0.25} />
                </mesh>
                <mesh position={[0.018, -0.045, 0.005]} rotation={[0.1, 0, -0.22]}>
                  <boxGeometry args={[0.014, 0.075, 0.004]} />
                  <meshStandardMaterial color="#be123c" roughness={0.25} />
                </mesh>
              </group>

              {/* Soft Green Foliage Dome Cushion */}
              <mesh position={[0, 0.08, 0]}>
                <sphereGeometry args={[0.115, 18, 14]} />
                <meshStandardMaterial color="#14532d" roughness={0.75} />
              </mesh>

              {/* Multi-layered Silk Rose Blooms (9 Full Roses) */}
              {[
                { pos: [0, 0.16, 0.02], core: '#9f1239', petal: '#e11d48', scale: 1.15 },
                { pos: [-0.068, 0.135, 0.035], core: '#be123c', petal: '#fb7185', scale: 1.0 },
                { pos: [0.068, 0.135, 0.035], core: '#be123c', petal: '#f43f5e', scale: 1.0 },
                { pos: [-0.042, 0.175, -0.035], core: '#db2777', petal: '#f9a8d4', scale: 0.95 },
                { pos: [0.042, 0.175, -0.035], core: '#e11d48', petal: '#fda4af', scale: 0.95 },
                { pos: [0, 0.11, 0.078], core: '#be123c', petal: '#fb7185', scale: 0.92 },
                { pos: [-0.088, 0.105, -0.01], core: '#9f1239', petal: '#fda4af', scale: 0.88 },
                { pos: [0.088, 0.105, -0.01], core: '#9f1239', petal: '#f43f5e', scale: 0.88 },
                { pos: [0, 0.205, -0.015], core: '#fbcfe8', petal: '#fff1f2', scale: 0.95 },
              ].map((rose, rIdx) => (
                <group
                  key={`rose-head-${rIdx}`}
                  position={rose.pos as [number, number, number]}
                  scale={rose.scale}
                >
                  {/* Rose bud spiral center */}
                  <mesh>
                    <sphereGeometry args={[0.026, 14, 14]} />
                    <meshStandardMaterial color={rose.core} roughness={0.32} />
                  </mesh>
                  {/* 5 overlapping outer silk petals */}
                  {[0, 1.25, 2.51, 3.77, 5.02].map((ang, pIdx) => (
                    <mesh
                      key={`petal-${rIdx}-${pIdx}`}
                      position={[Math.cos(ang) * 0.022, -0.002, Math.sin(ang) * 0.022]}
                    >
                      <sphereGeometry args={[0.022, 12, 12]} />
                      <meshStandardMaterial color={rose.petal} roughness={0.36} />
                    </mesh>
                  ))}
                </group>
              ))}

              {/* White Baby's Breath (Gypsophila) Pearl Clusters */}
              {[
                [-0.038, 0.15, 0.062],
                [0.038, 0.15, 0.062],
                [-0.075, 0.16, 0.01],
                [0.075, 0.16, 0.01],
                [0, 0.19, 0.045],
              ].map((pos, idx) => (
                <mesh key={`gyp-a01-${idx}`} position={pos as [number, number, number]}>
                  <sphereGeometry args={[0.012, 10, 10]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.2} />
                </mesh>
              ))}

              {/* Eucalyptus Accent Leaves */}
              {[
                { pos: [0.105, 0.09, 0.02], rot: [0, 0, -0.75] },
                { pos: [-0.105, 0.09, 0.02], rot: [0, 0, 0.75] },
                { pos: [0.06, 0.21, -0.04], rot: [-0.4, 0, -0.35] },
                { pos: [-0.06, 0.21, -0.04], rot: [-0.4, 0, 0.35] },
              ].map((leaf, idx) => (
                <mesh
                  key={`leaf-a01-${idx}`}
                  position={leaf.pos as [number, number, number]}
                  rotation={leaf.rot as [number, number, number]}
                >
                  <coneGeometry args={[0.024, 0.085, 10]} />
                  <meshStandardMaterial color="#15803d" roughness={0.45} />
                </mesh>
              ))}
            </group>
          )}

          {/* ---------------- A02: Pastel Fabric Tulips (Large & Lush) ---------------- */}
          {slot.code === 'A02' && (
            <group scale={1.62}>
              {/* High Back Collar Wrap (Soft Lavender-Cream Paper) */}
              <mesh position={[0, 0.14, -0.045]} rotation={[-0.12, 0, 0]}>
                <cylinderGeometry
                  args={[0.185, 0.052, 0.34, 24, 1, true, -Math.PI * 0.65, Math.PI * 1.3]}
                />
                <meshStandardMaterial color="#ede9fe" roughness={0.5} side={THREE.DoubleSide} />
              </mesh>
              {/* Buttercream Kraft Outer Wrap */}
              <mesh position={[0, -0.02, 0]}>
                <cylinderGeometry args={[0.148, 0.046, 0.28, 28, 1, true]} />
                <meshStandardMaterial color="#fef3c7" roughness={0.55} side={THREE.DoubleSide} />
              </mesh>

              {/* Lavender Satin Ribbon & Bow */}
              <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.068, 0.008, 10, 24]} />
                <meshStandardMaterial color="#7e22ce" roughness={0.25} metalness={0.2} />
              </mesh>
              <group position={[0, -0.05, 0.072]}>
                <mesh>
                  <sphereGeometry args={[0.021, 12, 12]} />
                  <meshStandardMaterial color="#9333ea" roughness={0.25} metalness={0.25} />
                </mesh>
                <mesh position={[-0.032, 0.005, 0]} rotation={[0, 0, 0.38]}>
                  <cylinderGeometry args={[0.013, 0.02, 0.05, 12]} />
                  <meshStandardMaterial color="#a855f7" roughness={0.3} />
                </mesh>
                <mesh position={[0.032, 0.005, 0]} rotation={[0, 0, -0.38]}>
                  <cylinderGeometry args={[0.013, 0.02, 0.05, 12]} />
                  <meshStandardMaterial color="#a855f7" roughness={0.3} />
                </mesh>
              </group>

              {/* 9 Pastel Tulip Cups with Rounded Bases */}
              {[
                { pos: [-0.048, 0.14, 0.028], col: '#facc15', rot: [0.12, 0, -0.16] },
                { pos: [0.048, 0.145, 0.025], col: '#fb7185', rot: [0.12, 0, 0.16] },
                { pos: [0, 0.175, -0.02], col: '#c084fc', rot: [-0.1, 0, 0] },
                { pos: [-0.038, 0.1, 0.058], col: '#fdba74', rot: [0.22, 0, -0.1] },
                { pos: [0.038, 0.105, 0.058], col: '#f472b6', rot: [0.22, 0, 0.1] },
                { pos: [0, 0.195, 0.018], col: '#fef08a', rot: [0.04, 0, 0] },
                { pos: [-0.078, 0.125, -0.01], col: '#f9a8d4', rot: [0.05, 0, -0.28] },
                { pos: [0.078, 0.125, -0.01], col: '#d8b4fe', rot: [0.05, 0, 0.28] },
                { pos: [0, 0.13, 0.068], col: '#fda4af', rot: [0.26, 0, 0] },
              ].map((tulip, idx) => (
                <group
                  key={`tulip-${idx}`}
                  position={tulip.pos as [number, number, number]}
                  rotation={tulip.rot as [number, number, number]}
                >
                  {/* Rounded tulip cup bottom */}
                  <mesh position={[0, 0.024, 0]}>
                    <sphereGeometry args={[0.027, 14, 14]} />
                    <meshStandardMaterial color={tulip.col} roughness={0.28} />
                  </mesh>
                  {/* Tulip upper petals */}
                  <mesh position={[0, 0.048, 0]}>
                    <cylinderGeometry args={[0.022, 0.027, 0.045, 14]} />
                    <meshStandardMaterial color={tulip.col} roughness={0.28} />
                  </mesh>
                  {/* Green stem */}
                  <mesh position={[0, -0.02, 0]}>
                    <cylinderGeometry args={[0.0055, 0.0055, 0.07, 8]} />
                    <meshStandardMaterial color="#15803d" roughness={0.4} />
                  </mesh>
                </group>
              ))}

              {/* Crisp Emerald Sword Leaves */}
              {[
                { pos: [0.085, 0.09, 0.015], rot: [0, 0, -0.42] },
                { pos: [-0.085, 0.09, 0.015], rot: [0, 0, 0.42] },
                { pos: [0.045, 0.11, -0.05], rot: [-0.35, 0, -0.2] },
                { pos: [-0.045, 0.11, -0.05], rot: [-0.35, 0, 0.2] },
              ].map((leaf, idx) => (
                <mesh
                  key={`tleaf-${idx}`}
                  position={leaf.pos as [number, number, number]}
                  rotation={leaf.rot as [number, number, number]}
                >
                  <boxGeometry args={[0.02, 0.19, 0.006]} />
                  <meshStandardMaterial color="#16a34a" roughness={0.38} />
                </mesh>
              ))}
            </group>
          )}

          {/* ---------------- A03: Pre-order Golden Sunflowers (Large & Lush) ---------------- */}
          {slot.code === 'A03' && (
            <group scale={1.62}>
              {/* High Back Collar Wrap (Warm Amber/Kraft Paper) */}
              <mesh position={[0, 0.14, -0.045]} rotation={[-0.12, 0, 0]}>
                <cylinderGeometry
                  args={[0.19, 0.052, 0.34, 24, 1, true, -Math.PI * 0.65, Math.PI * 1.3]}
                />
                <meshStandardMaterial color="#fde68a" roughness={0.55} side={THREE.DoubleSide} />
              </mesh>
              {/* Rustic Terracotta-Brown Kraft Wrap */}
              <mesh position={[0, -0.02, 0]}>
                <cylinderGeometry args={[0.15, 0.048, 0.28, 28, 1, true]} />
                <meshStandardMaterial color="#b45309" roughness={0.62} side={THREE.DoubleSide} />
              </mesh>
              {/* Jute Twine Bow & Gift Card Tag */}
              <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.07, 0.008, 10, 24]} />
                <meshStandardMaterial color="#fef08a" roughness={0.75} />
              </mesh>
              <mesh position={[0.02, -0.035, 0.078]} rotation={[0, 0, -0.12]}>
                <planeGeometry args={[0.072, 0.048]} />
                <meshStandardMaterial color="#fef9c3" roughness={0.4} />
              </mesh>

              {/* Foliage Cushion */}
              <mesh position={[0, 0.085, 0]}>
                <sphereGeometry args={[0.11, 16, 14]} />
                <meshStandardMaterial color="#14532d" roughness={0.7} />
              </mesh>

              {/* Main Hero Golden Sunflower (Front Center) */}
              <group position={[0, 0.145, 0.045]} rotation={[0.15, 0, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.046, 0.046, 0.02, 24]} />
                  <meshStandardMaterial color="#451a03" roughness={0.85} />
                </mesh>
                <mesh position={[0, 0, 0.011]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.035, 0.007, 10, 24]} />
                  <meshStandardMaterial color="#92400e" roughness={0.8} />
                </mesh>
                {[...Array(16)].map((_, i) => {
                  const angle = (i / 16) * Math.PI * 2;
                  return (
                    <mesh
                      key={`sf-petal-${i}`}
                      position={[Math.cos(angle) * 0.064, Math.sin(angle) * 0.064, -0.004]}
                      rotation={[0, 0, angle - Math.PI / 2]}
                    >
                      <coneGeometry args={[0.017, 0.052, 8]} />
                      <meshStandardMaterial color="#facc15" roughness={0.32} />
                    </mesh>
                  );
                })}
              </group>

              {/* Secondary Sunflower (Upper Left) */}
              <group position={[-0.062, 0.165, -0.015]} rotation={[-0.1, -0.28, 0.18]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.036, 0.036, 0.016, 20]} />
                  <meshStandardMaterial color="#451a03" roughness={0.85} />
                </mesh>
                {[...Array(12)].map((_, i) => {
                  const angle = (i / 12) * Math.PI * 2;
                  return (
                    <mesh
                      key={`sf2-petal-${i}`}
                      position={[Math.cos(angle) * 0.048, Math.sin(angle) * 0.048, -0.004]}
                      rotation={[0, 0, angle - Math.PI / 2]}
                    >
                      <coneGeometry args={[0.014, 0.042, 8]} />
                      <meshStandardMaterial color="#eab308" roughness={0.32} />
                    </mesh>
                  );
                })}
              </group>

              {/* Third Sunflower (Upper Right) */}
              <group position={[0.062, 0.165, -0.015]} rotation={[-0.1, 0.28, -0.18]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.036, 0.036, 0.016, 20]} />
                  <meshStandardMaterial color="#451a03" roughness={0.85} />
                </mesh>
                {[...Array(12)].map((_, i) => {
                  const angle = (i / 12) * Math.PI * 2;
                  return (
                    <mesh
                      key={`sf3-petal-${i}`}
                      position={[Math.cos(angle) * 0.048, Math.sin(angle) * 0.048, -0.004]}
                      rotation={[0, 0, angle - Math.PI / 2]}
                    >
                      <coneGeometry args={[0.014, 0.042, 8]} />
                      <meshStandardMaterial color="#f59e0b" roughness={0.32} />
                    </mesh>
                  );
                })}
              </group>

              {/* Chamomile / White Daisy Accent Blossoms */}
              {[
                [-0.065, 0.11, 0.045],
                [0.065, 0.11, 0.045],
                [0, 0.21, 0.01],
              ].map((pos, idx) => (
                <group key={`daisy-${idx}`} position={pos as [number, number, number]}>
                  <mesh>
                    <sphereGeometry args={[0.014, 10, 10]} />
                    <meshStandardMaterial color="#facc15" roughness={0.4} />
                  </mesh>
                  <mesh position={[0, 0, -0.004]}>
                    <cylinderGeometry args={[0.024, 0.024, 0.006, 12]} />
                    <meshStandardMaterial color="#ffffff" roughness={0.3} />
                  </mesh>
                </group>
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
