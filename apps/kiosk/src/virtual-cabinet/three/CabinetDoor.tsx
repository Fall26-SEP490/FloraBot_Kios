import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VirtualSlotStatus } from '../virtualCabinet.types';

type CabinetDoorProps = {
  width: number;
  height: number;
  status: VirtualSlotStatus;
  isSelected: boolean;
  onSelect: () => void;
};

export function CabinetDoor({ width, height, status, isSelected, onSelect }: CabinetDoorProps) {
  const hingeGroupRef = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Sleek slim showcase door border (4.2 cm) so maximum glass area reveals the flowers
  const borderT = 0.042;
  const frameD = 0.026;
  const innerW = Math.max(0.1, width - borderT * 2);
  const innerH = Math.max(0.1, height - borderT * 2);

  useFrame((_, delta) => {
    if (!hingeGroupRef.current) return;

    let targetAngle = 0;
    if (status === 'OPEN') {
      targetAngle = Math.PI * 0.46; // ~83 degrees wide open
    } else if (status === 'OPENING') {
      targetAngle = Math.PI * 0.2; // ~36 degrees unlatching pop
    } else if (isHovered) {
      targetAngle = 0.025; // Subtle interactive micro-peek on hover
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      hingeGroupRef.current.rotation.y = -targetAngle;
    } else {
      const smoothLambda = status === 'OPEN' ? 6.5 : 8.0;
      hingeGroupRef.current.rotation.y = THREE.MathUtils.damp(
        hingeGroupRef.current.rotation.y,
        -targetAngle,
        smoothLambda,
        delta,
      );
    }
  });

  const frameColor = isSelected ? '#fef9c3' : isHovered ? '#ffffff' : '#f1f5f9';
  const emissiveColor = isSelected ? '#eab308' : isHovered ? '#38bdf8' : '#000000';
  const emissiveIntensity = isSelected ? 0.28 : isHovered ? 0.14 : 0;

  const frameMaterial = (
    <meshStandardMaterial
      color={frameColor}
      emissive={emissiveColor}
      emissiveIntensity={emissiveIntensity}
      roughness={0.22}
      metalness={0.12}
    />
  );

  const trimMaterial = (
    <meshStandardMaterial
      color={isSelected ? '#fde047' : '#cbd5e1'}
      metalness={0.88}
      roughness={0.18}
    />
  );

  return (
    // Hinge pivot group positioned at the left edge of the slot opening
    <group ref={hingeGroupRef} position={[-width / 2, 0, 0]}>
      {/* Top hinge pin */}
      <mesh position={[0, height / 2 - 0.06, 0]}>
        <cylinderGeometry args={[0.011, 0.011, 0.045, 14]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.15} />
      </mesh>

      {/* Bottom hinge pin */}
      <mesh position={[0, -height / 2 + 0.06, 0]}>
        <cylinderGeometry args={[0.011, 0.011, 0.045, 14]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.15} />
      </mesh>

      {/* Door panel assembly, offset so its left edge aligns with hinge pivot */}
      <group
        position={[width / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setIsHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setIsHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        {/* === HOLLOW DOOR FRAME: 4 Borders (Top, Bottom, Left, Right) === */}
        {/* 1. Top Rail */}
        <mesh position={[0, (height - borderT) / 2, 0]}>
          <boxGeometry args={[width, borderT, frameD]} />
          {frameMaterial}
        </mesh>
        {/* 2. Bottom Rail */}
        <mesh position={[0, -(height - borderT) / 2, 0]}>
          <boxGeometry args={[width, borderT, frameD]} />
          {frameMaterial}
        </mesh>
        {/* 3. Left Stile */}
        <mesh position={[-(width - borderT) / 2, 0, 0]}>
          <boxGeometry args={[borderT, innerH, frameD]} />
          {frameMaterial}
        </mesh>
        {/* 4. Right Stile */}
        <mesh position={[(width - borderT) / 2, 0, 0]}>
          <boxGeometry args={[borderT, innerH, frameD]} />
          {frameMaterial}
        </mesh>

        {/* Outer Metallic Accent Trim around frame perimeter */}
        <mesh position={[0, (height - 0.008) / 2, frameD / 2 + 0.001]}>
          <boxGeometry args={[width + 0.006, 0.008, 0.008]} />
          {trimMaterial}
        </mesh>
        <mesh position={[0, -(height - 0.008) / 2, frameD / 2 + 0.001]}>
          <boxGeometry args={[width + 0.006, 0.008, 0.008]} />
          {trimMaterial}
        </mesh>
        <mesh position={[-(width - 0.008) / 2, 0, frameD / 2 + 0.001]}>
          <boxGeometry args={[0.008, height + 0.006, 0.008]} />
          {trimMaterial}
        </mesh>
        <mesh position={[(width - 0.008) / 2, 0, frameD / 2 + 0.001]}>
          <boxGeometry args={[0.008, height + 0.006, 0.008]} />
          {trimMaterial}
        </mesh>

        {/* === ULTRA-CLEAR ANTI-GLARE SHOWCASE GLASS PANE === */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[innerW + 0.006, innerH + 0.006]} />
          <meshStandardMaterial
            color="#e0f2fe"
            transparent
            opacity={0.07}
            roughness={0.05}
            metalness={0.1}
            depthWrite={false}
          />
        </mesh>

        {/* Crisp diagonal glass reflection gleam */}
        <mesh position={[-innerW * 0.18, innerH * 0.24, 0.004]} rotation={[0, 0, 0.32]}>
          <planeGeometry args={[innerW * 0.55, 0.014]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} />
        </mesh>
        <mesh position={[-innerW * 0.14, innerH * 0.19, 0.004]} rotation={[0, 0, 0.32]}>
          <planeGeometry args={[innerW * 0.38, 0.006]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.1} depthWrite={false} />
        </mesh>

        {/* === POLISHED CHROME DOOR HANDLE (mounted on right stile) === */}
        <group position={[(width - borderT) / 2, 0, frameD / 2 + 0.018]}>
          {/* Vertical cylindrical bar */}
          <mesh>
            <cylinderGeometry args={[0.0085, 0.0085, 0.26, 16]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.95} roughness={0.08} />
          </mesh>
          {/* Top mounting standoff */}
          <mesh position={[-0.008, 0.09, -0.01]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0065, 0.0065, 0.022, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.12} />
          </mesh>
          {/* Bottom mounting standoff */}
          <mesh position={[-0.008, -0.09, -0.01]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0065, 0.0065, 0.022, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.12} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export default React.memo(CabinetDoor);
