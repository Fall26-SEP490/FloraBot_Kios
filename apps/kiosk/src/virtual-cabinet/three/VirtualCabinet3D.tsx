import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Cabinet3DProps } from './cabinet3d.types';
import CabinetLights from './CabinetLights';
import CabinetModel from './CabinetModel';

type OrbitControlsInstance = React.ComponentRef<typeof OrbitControls>;

// Closer, hero-scale framing so the 3D cabinet fills the showcase container
const DEFAULT_CAMERA_POS: [number, number, number] = [0.16, 0.04, 3.12];
const DEFAULT_TARGET_POS: [number, number, number] = [0, -0.02, 0];

const SLOT_CAMERA_PRESETS: Record<
  string,
  {
    target: [number, number, number];
    selectCamPos: [number, number, number];
    openCamPos: [number, number, number];
  }
> = {
  A01: {
    target: [-0.46, 0.46, 0.05],
    selectCamPos: [-0.22, 0.34, 2.72],
    openCamPos: [-0.28, 0.42, 2.32],
  },
  A02: {
    target: [-0.46, -0.58, 0.05],
    selectCamPos: [-0.22, -0.36, 2.72],
    openCamPos: [-0.28, -0.52, 2.32],
  },
  A03: {
    target: [0.46, -0.58, 0.05],
    selectCamPos: [0.26, -0.36, 2.72],
    openCamPos: [0.32, -0.52, 2.32],
  },
};

function CameraRig({
  activeSlotCode,
  selectedSlotCode,
  isUserInteracting,
  resetSignal,
  controlsRef,
}: {
  activeSlotCode: string | null;
  selectedSlotCode: string | null;
  isUserInteracting: boolean;
  resetSignal: number;
  controlsRef: React.RefObject<OrbitControlsInstance | null>;
}) {
  const desiredCamPos = useRef(new THREE.Vector3(...DEFAULT_CAMERA_POS));
  const desiredTarget = useRef(new THREE.Vector3(...DEFAULT_TARGET_POS));
  const isAnimatingRef = useRef(false);
  const lastResetRef = useRef(resetSignal);

  // Trigger smooth camera transition when reset button is pressed
  useEffect(() => {
    if (resetSignal !== lastResetRef.current) {
      lastResetRef.current = resetSignal;
      desiredCamPos.current.set(...DEFAULT_CAMERA_POS);
      desiredTarget.current.set(...DEFAULT_TARGET_POS);
      isAnimatingRef.current = true;
    }
  }, [resetSignal]);

  // Trigger smooth camera focus when an active (opening/open) or selected slot changes
  useEffect(() => {
    if (activeSlotCode && SLOT_CAMERA_PRESETS[activeSlotCode]) {
      const preset = SLOT_CAMERA_PRESETS[activeSlotCode];
      desiredTarget.current.set(...preset.target);
      desiredCamPos.current.set(...preset.openCamPos);
      isAnimatingRef.current = true;
    } else if (selectedSlotCode && SLOT_CAMERA_PRESETS[selectedSlotCode]) {
      const preset = SLOT_CAMERA_PRESETS[selectedSlotCode];
      desiredTarget.current.set(...preset.target);
      desiredCamPos.current.set(...preset.selectCamPos);
      isAnimatingRef.current = true;
    } else {
      desiredTarget.current.set(...DEFAULT_TARGET_POS);
      desiredCamPos.current.set(...DEFAULT_CAMERA_POS);
      isAnimatingRef.current = true;
    }
  }, [activeSlotCode, selectedSlotCode]);

  // Stop automated camera glide immediately when the user grabs the canvas to rotate/zoom
  useEffect(() => {
    if (isUserInteracting) {
      isAnimatingRef.current = false;
    }
  }, [isUserInteracting]);

  useFrame(({ camera }, delta) => {
    if (!isAnimatingRef.current || isUserInteracting || !controlsRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      camera.position.copy(desiredCamPos.current);
      controlsRef.current.target.copy(desiredTarget.current);
      controlsRef.current.update();
      isAnimatingRef.current = false;
      return;
    }

    // Frame-rate independent exponential damping for silky smooth camera motion
    const smoothSpeed = activeSlotCode ? 5.2 : 4.2;
    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      desiredCamPos.current.x,
      smoothSpeed,
      delta,
    );
    camera.position.y = THREE.MathUtils.damp(
      camera.position.y,
      desiredCamPos.current.y,
      smoothSpeed,
      delta,
    );
    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      desiredCamPos.current.z,
      smoothSpeed,
      delta,
    );

    controlsRef.current.target.x = THREE.MathUtils.damp(
      controlsRef.current.target.x,
      desiredTarget.current.x,
      smoothSpeed,
      delta,
    );
    controlsRef.current.target.y = THREE.MathUtils.damp(
      controlsRef.current.target.y,
      desiredTarget.current.y,
      smoothSpeed,
      delta,
    );
    controlsRef.current.target.z = THREE.MathUtils.damp(
      controlsRef.current.target.z,
      desiredTarget.current.z,
      smoothSpeed,
      delta,
    );

    controlsRef.current.update();

    const posDist = camera.position.distanceToSquared(desiredCamPos.current);
    const targetDist = controlsRef.current.target.distanceToSquared(desiredTarget.current);
    if (posDist < 0.0002 && targetDist < 0.0002) {
      isAnimatingRef.current = false;
    }
  });

  return null;
}

export function VirtualCabinet3D({
  slots,
  kioskStatus,
  activeSlot,
  selectedSlotCode,
  onSelectSlot,
  onResetCameraRef,
}: Cabinet3DProps) {
  const controlsRef = useRef<OrbitControlsInstance>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  const resetCamera = useCallback(() => {
    setResetSignal((c) => c + 1);
  }, []);

  useEffect(() => {
    if (onResetCameraRef) {
      onResetCameraRef.current = resetCamera;
    }
  }, [onResetCameraRef, resetCamera]);

  return (
    <div
      className="virtual-cabinet-3d-container"
      role="region"
      aria-label="Mô hình tủ hoa thông minh 3D tương tác. Kéo để xoay, cuộn chuột hoặc chụm để thu phóng."
    >
      <div className="canvas-wrapper">
        <Canvas
          shadows
          camera={{
            position: DEFAULT_CAMERA_POS,
            fov: 35,
            near: 0.1,
            far: 30,
          }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <CameraRig
            activeSlotCode={activeSlot?.code ?? null}
            selectedSlotCode={selectedSlotCode}
            isUserInteracting={isUserInteracting}
            resetSignal={resetSignal}
            controlsRef={controlsRef}
          />

          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            enableDamping
            dampingFactor={0.06}
            rotateSpeed={0.75}
            zoomSpeed={0.85}
            minDistance={1.95}
            maxDistance={5.2}
            minPolarAngle={Math.PI / 3.4}
            maxPolarAngle={Math.PI / 1.88}
            minAzimuthAngle={-Math.PI / 2.4}
            maxAzimuthAngle={Math.PI / 2.4}
            onStart={() => setIsUserInteracting(true)}
            onEnd={() => setIsUserInteracting(false)}
          />

          <CabinetLights />

          <CabinetModel
            slots={slots}
            kioskStatus={kioskStatus}
            selectedSlotCode={selectedSlotCode}
            onSelectSlot={onSelectSlot}
          />
        </Canvas>

        {/* Compact Top-Right Camera Reset Button */}
        <div className="canvas-top-bar">
          <button
            type="button"
            className="canvas-reset-cam-btn"
            onClick={resetCamera}
            aria-label="Đưa góc nhìn về toàn cảnh"
          >
            🔄 Toàn cảnh
          </button>
        </div>

        {/* Bottom Subtle Interaction Pill */}
        <div className="canvas-bottom-bar">
          <span className="canvas-interaction-tip" aria-hidden="true">
            🖱️ Kéo để xoay · Cuộn để zoom · Chạm vào cửa tủ để xem cận cảnh
          </span>
        </div>
      </div>
    </div>
  );
}

export default VirtualCabinet3D;
