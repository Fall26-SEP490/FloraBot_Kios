export type VirtualKioskStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';

export type VirtualSlotStatus =
  'AVAILABLE' | 'HELD' | 'RESERVED' | 'OPENING' | 'OPEN' | 'EMPTY' | 'FAULT';

export type VirtualSlot = {
  code: string;
  bouquetId: string | null;
  bouquetName: string | null;
  image: string | null;
  status: VirtualSlotStatus;
};

export type VirtualCabinetEvent = {
  id: number;
  kind: 'SYSTEM' | 'UNLOCK' | 'ACK' | 'DOOR_OPENED' | 'DOOR_CLOSED' | 'WARNING';
  message: string;
  createdAt: string;
};

export const INITIAL_VIRTUAL_SLOTS: VirtualSlot[] = [
  {
    code: 'A01',
    bouquetId: 'demo-b1',
    bouquetName: 'Bó hồng lụa dịu dàng',
    image: 'images/demo-silk-rose.png',
    status: 'AVAILABLE',
  },
  {
    code: 'A02',
    bouquetId: 'demo-b2',
    bouquetName: 'Tulip vải pastel cao cấp',
    image: 'images/demo-pastel-bouquet.png',
    status: 'AVAILABLE',
  },
  {
    code: 'A03',
    bouquetId: 'demo-b3',
    bouquetName: 'Hướng dương lụa đặt trước',
    image: 'images/demo-sunflower.png',
    status: 'RESERVED',
  },
];

export const SLOT_STATUS_LABELS: Record<VirtualSlotStatus, string> = {
  AVAILABLE: 'Sẵn sàng bán',
  HELD: 'Đang giữ chỗ',
  RESERVED: 'Đơn đặt trước',
  OPENING: 'Đang mở khóa',
  OPEN: 'Cửa đang mở',
  EMPTY: 'Đã lấy hoa',
  FAULT: 'Lỗi cửa',
};
