import { VirtualCabinetPanel } from './VirtualCabinetPanel';
import type {
  VirtualCabinetEvent,
  VirtualKioskStatus,
  VirtualSlot as VirtualSlotModel,
} from './virtualCabinet.types';

type Props = {
  slots: VirtualSlotModel[];
  kioskStatus: VirtualKioskStatus;
  activeSlot: VirtualSlotModel | null;
  events: VirtualCabinetEvent[];
  onCloseDoor: () => void;
  onToggleOffline: () => void;
  onToggleMaintenance: () => void;
  onSimulateFault: () => void;
  onReset: () => void;
};

export function VirtualCabinet(props: Props) {
  return <VirtualCabinetPanel {...props} />;
}

export default VirtualCabinet;
