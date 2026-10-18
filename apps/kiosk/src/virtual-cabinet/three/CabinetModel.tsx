import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { VirtualKioskStatus, VirtualSlot } from '../virtualCabinet.types';
import type { SlotDimension } from './cabinet3d.types';
import CabinetSlot from './CabinetSlot';

type CabinetModelProps = {
  slots: VirtualSlot[];
  kioskStatus: VirtualKioskStatus;
  selectedSlotCode: string | null;
  onSelectSlot: (code: string) => void;
};

// Procedural 2X Retina CanvasTexture for FloraBot Illuminated Top Canopy Lightbox
function createFloraBotLogoTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1536;
  canvas.height = 280;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 280);
    bgGrad.addColorStop(0, '#ffffff');
    bgGrad.addColorStop(0.5, '#f8fafc');
    bgGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1536, 280);

    // Emerald & gold luxury border strips
    ctx.fillStyle = '#0f3828';
    ctx.fillRect(0, 0, 1536, 12);
    ctx.fillRect(0, 268, 1536, 12);

    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 12, 1536, 5);
    ctx.fillRect(0, 263, 1536, 5);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 20, 1508, 240);

    ctx.fillStyle = '#0f3828';
    ctx.font = 'bold 104px "Nunito", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌸 FloraBot', 768, 106);

    ctx.fillStyle = '#15803d';
    ctx.font = 'bold 38px "Be Vietnam Pro", "Segoe UI", sans-serif';
    ctx.letterSpacing = '4px';
    ctx.fillText('HỆ THỐNG TỦ HOA THÔNG MINH 24/7', 768, 204);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Procedural 2X Retina CanvasTexture for Simulated Kiosk Touchscreen
function createKioskScreenTexture(kioskStatus: VirtualKioskStatus): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1024, 1440);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 1024, 150);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 54px "Nunito", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌸 FloraBot Kiosk', 48, 75);

    const statusBg = kioskStatus === 'ONLINE' ? '#14532d' : '#78350f';
    const statusDot = kioskStatus === 'ONLINE' ? '#22c55e' : '#f59e0b';
    ctx.fillStyle = statusBg;
    ctx.beginPath();
    ctx.roundRect(750, 45, 226, 60, 30);
    ctx.fill();

    ctx.fillStyle = statusDot;
    ctx.beginPath();
    ctx.arc(785, 75, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(kioskStatus, 815, 75);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Một bó hoa, một ngày vui.', 512, 260);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '36px "Be Vietnam Pro", sans-serif';
    ctx.fillText('Chạm chọn hoa có sẵn tại tủ để mua ngay', 512, 335);

    // Product Card 1: Slot A01
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(60, 400, 904, 215, 24);
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#fda4af';
    ctx.font = 'bold 44px "Nunito", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🌸 Ô A01: Bó hồng lụa dịu dàng', 100, 475);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('350.000 đ', 100, 550);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '32px sans-serif';
    ctx.fillText('· Có sẵn tại tủ (Walk-in)', 360, 550);

    // Product Card 2: Slot A02
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(60, 655, 904, 215, 24);
    ctx.fill();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 44px "Nunito", sans-serif';
    ctx.fillText('🌷 Ô A02: Tulip vải pastel', 100, 730);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('280.000 đ', 100, 805);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '32px sans-serif';
    ctx.fillText('· Có sẵn tại tủ (Walk-in)', 360, 805);

    // Pre-order pickup banner (Slot A03)
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.roundRect(60, 910, 904, 210, 24);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📦 Nhận đơn đặt trước tại Ô A03', 512, 985);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Mã PIN mẫu: PRE26101', 512, 1055);

    ctx.fillStyle = '#64748b';
    ctx.font = '30px sans-serif';
    ctx.fillText('Màn hình cảm ứng Kiosk Tablet FloraBot', 512, 1370);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function CabinetModel({
  slots,
  kioskStatus,
  selectedSlotCode,
  onSelectSlot,
}: CabinetModelProps) {
  const logoTexture = useMemo(() => createFloraBotLogoTexture(), []);
  const screenTexture = useMemo(() => createKioskScreenTexture(kioskStatus), [kioskStatus]);

  // Overall cabinet dimensions
  const cabinetWidth = 2.08;
  const cabinetHeight = 2.62;
  const cabinetDepth = 0.6;

  const wallT = 0.05;
  const plinthH = 0.12;
  const canopyH = 0.26;

  // Interior Opening Calculation
  const openingH = cabinetHeight - plinthH - canopyH; // 2.24
  const openingCenterY = -0.07;
  const slotW = 0.95;
  const slotH = 1.08;
  const slotD = 0.54;

  const leftColX = -0.51;
  const rightColX = 0.51;
  const topRowY = 0.5;
  const bottomRowY = -0.64;

  const slotDimensions: Record<string, SlotDimension> = {
    A01: {
      width: slotW,
      height: slotH,
      depth: slotD,
      position: [leftColX, topRowY, 0.01],
    },
    A02: {
      width: slotW,
      height: slotH,
      depth: slotD,
      position: [leftColX, bottomRowY, 0.01],
    },
    A03: {
      width: slotW,
      height: slotH,
      depth: slotD,
      position: [rightColX, bottomRowY, 0.01],
    },
  };

  const slotA01 = slots.find((s) => s.code === 'A01') || {
    code: 'A01',
    status: 'AVAILABLE',
    bouquetId: null,
    bouquetName: null,
    image: null,
  };
  const slotA02 = slots.find((s) => s.code === 'A02') || {
    code: 'A02',
    status: 'AVAILABLE',
    bouquetId: null,
    bouquetName: null,
    image: null,
  };
  const slotA03 = slots.find((s) => s.code === 'A03') || {
    code: 'A03',
    status: 'RESERVED',
    bouquetId: null,
    bouquetName: null,
    image: null,
  };

  const chassisMaterial = (
    <meshStandardMaterial color="#0f3828" roughness={0.32} metalness={0.18} />
  );

  const chromeTrimMaterial = (
    <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.18} />
  );

  return (
    <group position={[0, 0, 0]}>
      {/* =========================================================================
          0. SHOWROOM FLOOR SHADOW PLATFORM (Grounds the 3D cabinet in space)
      ========================================================================= */}
      <mesh position={[0, -cabinetHeight / 2 - 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.65, 48]} />
        <meshStandardMaterial color="#061810" roughness={0.85} transparent opacity={0.55} />
      </mesh>

      {/* =========================================================================
          1. HOLLOW MODULAR CABINET CHASSIS
      ========================================================================= */}
      {/* Back Panel */}
      <mesh position={[0, 0, -cabinetDepth / 2 + 0.015]}>
        <boxGeometry args={[cabinetWidth, cabinetHeight, 0.03]} />
        {chassisMaterial}
      </mesh>

      {/* Left Outer Wall */}
      <mesh position={[-cabinetWidth / 2 + wallT / 2, 0, 0]}>
        <boxGeometry args={[wallT, cabinetHeight, cabinetDepth]} />
        {chassisMaterial}
      </mesh>

      {/* Right Outer Wall */}
      <mesh position={[cabinetWidth / 2 - wallT / 2, 0, 0]}>
        <boxGeometry args={[wallT, cabinetHeight, cabinetDepth]} />
        {chassisMaterial}
      </mesh>

      {/* Roof Panel */}
      <mesh position={[0, cabinetHeight / 2 - wallT / 2, 0]}>
        <boxGeometry args={[cabinetWidth, wallT, cabinetDepth]} />
        {chassisMaterial}
      </mesh>

      {/* Center Vertical Divider Pillar (between Left Column and Right Column) */}
      <mesh position={[0, openingCenterY, 0]}>
        <boxGeometry args={[0.06, openingH, cabinetDepth - 0.02]} />
        {chassisMaterial}
      </mesh>

      {/* Left Column Horizontal Shelf (between Slot A01 and Slot A02) */}
      <mesh position={[leftColX, openingCenterY, 0]}>
        <boxGeometry args={[slotW, 0.04, cabinetDepth - 0.02]} />
        {chassisMaterial}
      </mesh>

      {/* Right Column Horizontal Shelf (between Upper Tablet and Slot A03) */}
      <mesh position={[rightColX, openingCenterY, 0]}>
        <boxGeometry args={[slotW, 0.04, cabinetDepth - 0.02]} />
        {chassisMaterial}
      </mesh>

      {/* =========================================================================
          2. FRONT FASCIA & ARCHITECTURAL TRIM (BRUSHED CHROME)
      ========================================================================= */}
      {/* Center Front Divider Mullion */}
      <mesh position={[0, openingCenterY, cabinetDepth / 2 + 0.006]}>
        <boxGeometry args={[0.045, openingH, 0.015]} />
        {chromeTrimMaterial}
      </mesh>

      {/* Left Outer Front Mullion */}
      <mesh position={[-cabinetWidth / 2 + wallT / 2, openingCenterY, cabinetDepth / 2 + 0.006]}>
        <boxGeometry args={[wallT + 0.01, openingH, 0.015]} />
        {chromeTrimMaterial}
      </mesh>

      {/* Right Outer Front Mullion */}
      <mesh position={[cabinetWidth / 2 - wallT / 2, openingCenterY, cabinetDepth / 2 + 0.006]}>
        <boxGeometry args={[wallT + 0.01, openingH, 0.015]} />
        {chromeTrimMaterial}
      </mesh>

      {/* Horizontal Divider Bar */}
      <mesh position={[0, openingCenterY, cabinetDepth / 2 + 0.008]}>
        <boxGeometry args={[cabinetWidth, 0.035, 0.018]} />
        {chromeTrimMaterial}
      </mesh>

      {/* =========================================================================
          3. TOP CANOPY ILLUMINATED ACRYLIC LIGHTBOX BANNER
      ========================================================================= */}
      <group position={[0, cabinetHeight / 2 - canopyH / 2, cabinetDepth / 2 - 0.03]}>
        <mesh>
          <boxGeometry args={[cabinetWidth, canopyH, 0.08]} />
          {chassisMaterial}
        </mesh>
        <mesh position={[0, 0, 0.042]}>
          <planeGeometry args={[cabinetWidth - 0.06, canopyH - 0.04]} />
          <meshBasicMaterial map={logoTexture} />
        </mesh>
        <pointLight position={[0, 0, 0.14]} intensity={0.45} color="#ffffff" distance={1.5} />
      </group>

      {/* Overhead CCTV / Optical Surveillance Sensor */}
      <group position={[cabinetWidth / 2 - 0.22, cabinetHeight / 2 + 0.06, 0.05]}>
        <mesh>
          <cylinderGeometry args={[0.016, 0.016, 0.1, 12]} />
          {chromeTrimMaterial}
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.055, 0.038, 0.045, 16]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.4} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.05, 0.026]}>
          <sphereGeometry args={[0.015, 12, 12]} />
          <meshStandardMaterial color="#020617" roughness={0.05} />
        </mesh>
      </group>

      {/* =========================================================================
          4. BASE PLINTH & HEAVY-DUTY STAINLESS LEVELLING FEET
      ========================================================================= */}
      <group position={[0, -cabinetHeight / 2 + plinthH / 2, 0]}>
        <mesh>
          <boxGeometry args={[cabinetWidth, plinthH, cabinetDepth]} />
          <meshStandardMaterial color="#071f15" roughness={0.4} />
        </mesh>
        <mesh position={[0, plinthH / 2 - 0.01, cabinetDepth / 2 + 0.005]}>
          <boxGeometry args={[cabinetWidth + 0.02, 0.02, 0.01]} />
          {chromeTrimMaterial}
        </mesh>
        {[-0.88, 0.88].map((x) =>
          [-0.22, 0.22].map((z) => (
            <group key={`foot-${x}-${z}`} position={[x, -plinthH / 2 - 0.02, z]}>
              <mesh>
                <cylinderGeometry args={[0.038, 0.048, 0.04, 16]} />
                <meshStandardMaterial color="#f1f5f9" metalness={0.95} roughness={0.1} />
              </mesh>
            </group>
          )),
        )}
      </group>

      {/* =========================================================================
          5. LEFT COLUMN: SLOT A01 (TOP) & SLOT A02 (BOTTOM)
      ========================================================================= */}
      <CabinetSlot
        slot={slotA01}
        dimension={slotDimensions.A01}
        isSelected={selectedSlotCode === 'A01'}
        onSelect={() => onSelectSlot('A01')}
      />
      <CabinetSlot
        slot={slotA02}
        dimension={slotDimensions.A02}
        isSelected={selectedSlotCode === 'A02'}
        onSelect={() => onSelectSlot('A02')}
      />

      {/* =========================================================================
          6. RIGHT COLUMN: UPPER TOUCHSCREEN DISPLAY (TABLET)
      ========================================================================= */}
      <group position={[rightColX, topRowY, cabinetDepth / 2 - 0.01]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[slotW, slotH, 0.03]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.22} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.016]}>
          <boxGeometry args={[slotW - 0.06, slotH - 0.06, 0.01]} />
          <meshStandardMaterial color="#090d16" roughness={0.12} />
        </mesh>
        <mesh position={[0, 0, 0.022]}>
          <planeGeometry args={[slotW - 0.09, slotH - 0.09]} />
          <meshBasicMaterial map={screenTexture} />
        </mesh>
        <mesh position={[0, 0, 0.026]}>
          <planeGeometry args={[slotW - 0.09, slotH - 0.09]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={0.05}
            roughness={0.02}
            metalness={0.1}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, (slotH - 0.09) / 2 + 0.015, 0.023]}>
          <circleGeometry args={[0.007, 16]} />
          <meshBasicMaterial color="#020617" />
        </mesh>
      </group>

      {/* =========================================================================
          7. RIGHT COLUMN: SLOT A03 (BOTTOM PRE-ORDER CHAMBER)
      ========================================================================= */}
      <CabinetSlot
        slot={slotA03}
        dimension={slotDimensions.A03}
        isSelected={selectedSlotCode === 'A03'}
        onSelect={() => onSelectSlot('A03')}
      />
    </group>
  );
}

export default React.memo(CabinetModel);
