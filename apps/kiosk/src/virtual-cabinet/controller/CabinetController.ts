import type {
  VirtualCabinetEvent,
  VirtualKioskStatus,
  VirtualSlot,
} from '../virtualCabinet.types';

export type CabinetSnapshot = {
  slots: VirtualSlot[];
  kioskStatus: VirtualKioskStatus;
  activeSlot: VirtualSlot | null;
  queue: string[];
  events: VirtualCabinetEvent[];
  dispensingComplete: boolean;
};

export interface CabinetController {
  getSnapshot(): CabinetSnapshot;
  subscribe(listener: (snapshot: CabinetSnapshot) => void): () => void;
  holdBouquet(bouquetId: string, held: boolean): void;
  openSlot(code: string): boolean;
  startDispensing(codes: string[]): boolean;
  closeActiveSlot(): void;
  toggleOffline(): void;
  toggleMaintenance(): void;
  simulateFault(targetSlotCode?: string): void;
  resetCabinet(): void;
  destroy(): void;
}
