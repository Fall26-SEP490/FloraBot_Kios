import type { VirtualKioskStatus, VirtualSlot } from '../virtualCabinet.types';

export type Cabinet3DProps = {
  slots: VirtualSlot[];
  kioskStatus: VirtualKioskStatus;
  activeSlot: VirtualSlot | null;
  selectedSlotCode: string | null;
  onSelectSlot: (code: string) => void;
  onResetCameraRef?: React.MutableRefObject<(() => void) | null>;
};

export type SlotDimension = {
  width: number;
  height: number;
  depth: number;
  position: [number, number, number];
};

export const CABINET_THEME = {
  bodyColor: '#123f2e',       // Dark forest green
  bodyAccent: '#1a4f3b',      // Slightly lighter forest green
  creamFrame: '#f3f6f1',      // Off-white / cream lacquer
  metalTrim: '#94a3b8',       // Metal trim / hinges
  glassColor: '#d1fae5',      // Subtle glass tint
  screenBezel: '#0f172a',     // Dark slate bezel
  screenGlow: '#38bdf8',      // Touchscreen glow
  ledAvailable: '#22c55e',    // Green
  ledHeld: '#f59e0b',         // Amber / Orange
  ledOpening: '#38bdf8',      // Pulsing Blue
  ledFault: '#ef4444',        // Pulsing Red
  ledEmpty: '#475569',        // Off / Gray
};
