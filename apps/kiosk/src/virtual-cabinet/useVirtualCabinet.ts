import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { VirtualCabinetController } from './controller/VirtualCabinetController';
import type {
  VirtualCabinetEvent,
  VirtualKioskStatus,
  VirtualSlot,
} from './virtualCabinet.types';

export function useVirtualCabinet(customController?: VirtualCabinetController) {
  const controller = useMemo(
    () => customController ?? new VirtualCabinetController(),
    [customController],
  );

  const snapshot = useSyncExternalStore(
    (listener) => controller.subscribe(listener),
    () => controller.getSnapshot(),
  );

  useEffect(() => {
    return () => {
      if (!customController) {
        controller.destroy();
      }
    };
  }, [controller, customController]);

  const holdBouquet = useCallback(
    (bouquetId: string, held: boolean) => {
      controller.holdBouquet(bouquetId, held);
    },
    [controller],
  );

  const startDispensing = useCallback(
    (codes: string[]) => {
      return controller.startDispensing(codes);
    },
    [controller],
  );

  const openSlot = useCallback(
    (code: string) => {
      return controller.openSlot(code);
    },
    [controller],
  );

  const closeActiveSlot = useCallback(() => {
    controller.closeActiveSlot();
  }, [controller]);

  const toggleOffline = useCallback(() => {
    controller.toggleOffline();
  }, [controller]);

  const toggleMaintenance = useCallback(() => {
    controller.toggleMaintenance();
  }, [controller]);

  const simulateFault = useCallback(
    (targetSlotCode?: string) => {
      controller.simulateFault(targetSlotCode);
    },
    [controller],
  );

  const resetCabinet = useCallback(() => {
    controller.resetCabinet();
  }, [controller]);

  return {
    slots: snapshot.slots as VirtualSlot[],
    kioskStatus: snapshot.kioskStatus as VirtualKioskStatus,
    activeSlot: snapshot.activeSlot as VirtualSlot | null,
    queue: snapshot.queue,
    events: snapshot.events as VirtualCabinetEvent[],
    dispensingComplete: snapshot.dispensingComplete,
    holdBouquet,
    startDispensing,
    openSlot,
    closeActiveSlot,
    toggleOffline,
    toggleMaintenance,
    simulateFault,
    resetCabinet,
    controller,
  };
}
