import {
  INITIAL_VIRTUAL_SLOTS,
  type VirtualCabinetEvent,
  type VirtualKioskStatus,
  type VirtualSlot,
} from '../virtualCabinet.types';
import type { CabinetController, CabinetSnapshot } from './CabinetController';

export type VirtualCabinetControllerOptions = {
  initialSlots?: VirtualSlot[];
  ackDelayMs?: number;
  openDelayMs?: number;
  closeDelayMs?: number;
  nextSlotDelayMs?: number;
};

export class VirtualCabinetController implements CabinetController {
  private slots: VirtualSlot[];
  private kioskStatus: VirtualKioskStatus = 'ONLINE';
  private activeSlotCode: string | null = null;
  private queue: string[] = [];
  private events: VirtualCabinetEvent[] = [];
  private eventCounter = 0;
  private listeners = new Set<(snapshot: CabinetSnapshot) => void>();

  private ackDelayMs: number;
  private openDelayMs: number;
  private closeDelayMs: number;
  private nextSlotDelayMs: number;

  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private currentSnapshot!: CabinetSnapshot;

  constructor(options: VirtualCabinetControllerOptions = {}) {
    this.slots = (options.initialSlots || INITIAL_VIRTUAL_SLOTS).map((slot) => ({ ...slot }));
    this.ackDelayMs = options.ackDelayMs ?? 400;
    this.openDelayMs = options.openDelayMs ?? 800;
    this.closeDelayMs = options.closeDelayMs ?? 250;
    this.nextSlotDelayMs = options.nextSlotDelayMs ?? 300;
    this.updateSnapshot();
  }

  private updateSnapshot(): void {
    const activeSlot = this.slots.find((s) => s.code === this.activeSlotCode) ?? null;
    const dispensingComplete =
      !this.activeSlotCode &&
      this.queue.length === 0 &&
      this.slots.some((s) => s.status === 'EMPTY');

    this.currentSnapshot = {
      slots: [...this.slots],
      kioskStatus: this.kioskStatus,
      activeSlot,
      queue: [...this.queue],
      events: [...this.events],
      dispensingComplete,
    };
  }

  public getSnapshot(): CabinetSnapshot {
    return this.currentSnapshot;
  }

  public subscribe(listener: (snapshot: CabinetSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.updateSnapshot();
    const snapshot = this.currentSnapshot;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private addEvent(kind: VirtualCabinetEvent['kind'], message: string): void {
    this.eventCounter += 1;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const newEvent: VirtualCabinetEvent = {
      id: this.eventCounter,
      kind,
      message,
      createdAt: timeStr,
    };
    this.events = [newEvent, ...this.events].slice(0, 8);
  }

  private safeTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      fn();
    }, ms);
    this.pendingTimers.add(timer);
    return timer;
  }

  private clearAllTimers(): void {
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
  }

  public holdBouquet(bouquetId: string, held: boolean): void {
    const slotIndex = this.slots.findIndex((s) => s.bouquetId === bouquetId);
    if (slotIndex === -1) return;
    const slot = this.slots[slotIndex];

    if (held && slot.status === 'AVAILABLE') {
      this.slots[slotIndex] = { ...slot, status: 'HELD' };
      this.addEvent('SYSTEM', `Giữ ô ${slot.code} cho lượt mua hiện tại.`);
      this.notify();
    } else if (!held && slot.status === 'HELD') {
      this.slots[slotIndex] = { ...slot, status: 'AVAILABLE' };
      this.addEvent('SYSTEM', `Trả ô ${slot.code} về danh mục.`);
      this.notify();
    }
  }

  public openSlot(code: string): boolean {
    if (this.kioskStatus !== 'ONLINE') {
      this.addEvent('WARNING', 'Không thể mở cửa khi tủ đang offline hoặc bảo trì.');
      this.notify();
      return false;
    }

    const slotIndex = this.slots.findIndex((s) => s.code === code);
    if (slotIndex === -1) return false;
    const targetSlot = this.slots[slotIndex];

    if (targetSlot.status === 'FAULT') {
      this.addEvent('WARNING', `Ô ${code} đang gặp sự cố; không thể gửi lệnh mở.`);
      this.notify();
      return false;
    }

    this.activeSlotCode = code;
    this.slots[slotIndex] = { ...targetSlot, status: 'OPENING' };
    this.addEvent('UNLOCK', `Gửi lệnh UNLOCK tới ô ${code}.`);
    this.notify();

    // Trigger ACK
    this.safeTimeout(() => {
      if (this.activeSlotCode !== code) return;
      this.addEvent('ACK', `Thiết bị xác nhận lệnh mở ô ${code}.`);
      this.notify();
    }, this.ackDelayMs);

    // Trigger OPEN
    this.safeTimeout(() => {
      if (this.activeSlotCode !== code) return;
      const currentIdx = this.slots.findIndex((s) => s.code === code);
      if (currentIdx !== -1 && this.slots[currentIdx].status === 'OPENING') {
        this.slots[currentIdx] = { ...this.slots[currentIdx], status: 'OPEN' };
        this.addEvent('DOOR_OPENED', `Cửa ô ${code} đã mở; đèn chỉ dẫn đang nhấp nháy.`);
        this.notify();
      }
    }, this.openDelayMs);

    return true;
  }

  public startDispensing(codes: string[]): boolean {
    if (codes.length === 0 || this.kioskStatus !== 'ONLINE' || this.activeSlotCode) {
      if (this.kioskStatus !== 'ONLINE') {
        this.addEvent('WARNING', 'Tủ chưa sẵn sàng để bắt đầu mở cửa.');
        this.notify();
      }
      return false;
    }

    const [first, ...remaining] = codes;
    this.queue = remaining;
    return this.openSlot(first);
  }

  public closeActiveSlot(): void {
    if (!this.activeSlotCode) return;
    const code = this.activeSlotCode;
    const slotIndex = this.slots.findIndex((s) => s.code === code);
    if (slotIndex === -1) return;

    const performClose = () => {
      const idx = this.slots.findIndex((s) => s.code === code);
      if (idx !== -1) {
        this.slots[idx] = {
          ...this.slots[idx],
          bouquetId: null,
          bouquetName: null,
          image: null,
          status: 'EMPTY',
        };
      }
      this.addEvent('DOOR_CLOSED', `Cửa ô ${code} đã đóng an toàn.`);
      this.activeSlotCode = null;
      this.notify();

      if (this.queue.length > 0) {
        const [next, ...remaining] = this.queue;
        this.queue = remaining;
        this.safeTimeout(() => {
          this.openSlot(next);
        }, this.nextSlotDelayMs);
      }
    };

    if (this.closeDelayMs > 0) {
      this.safeTimeout(performClose, this.closeDelayMs);
    } else {
      performClose();
    }
  }

  public toggleOffline(): void {
    this.kioskStatus = this.kioskStatus === 'OFFLINE' ? 'ONLINE' : 'OFFLINE';
    this.addEvent(
      this.kioskStatus === 'ONLINE' ? 'SYSTEM' : 'WARNING',
      this.kioskStatus === 'ONLINE'
        ? 'Tủ đã kết nối lại.'
        : 'LI-01 · Tủ đang mất kết nối. Không thể gửi lệnh mở cửa.',
    );
    this.notify();
  }

  public toggleMaintenance(): void {
    this.kioskStatus = this.kioskStatus === 'MAINTENANCE' ? 'ONLINE' : 'MAINTENANCE';
    this.addEvent(
      this.kioskStatus === 'ONLINE' ? 'SYSTEM' : 'WARNING',
      this.kioskStatus === 'ONLINE'
        ? 'Kết thúc chế độ bảo trì.'
        : 'Tủ đang bảo trì. Danh mục và lệnh mở cửa tạm khóa.',
    );
    this.notify();
  }

  public simulateFault(targetSlotCode?: string): void {
    const target =
      targetSlotCode ||
      this.activeSlotCode ||
      this.slots.find((s) => s.status !== 'EMPTY')?.code;
    if (!target) return;

    const targetIdx = this.slots.findIndex((s) => s.code === target);
    if (targetIdx !== -1) {
      this.slots[targetIdx] = { ...this.slots[targetIdx], status: 'FAULT' };
    }
    if (this.activeSlotCode === target) {
      this.activeSlotCode = null;
    }
    this.queue = [];
    this.addEvent('WARNING', `Ô ${target} không phản hồi; đã chuyển sang trạng thái lỗi.`);
    this.notify();
  }

  public resetCabinet(): void {
    this.clearAllTimers();
    this.slots = INITIAL_VIRTUAL_SLOTS.map((s) => ({ ...s }));
    this.kioskStatus = 'ONLINE';
    this.activeSlotCode = null;
    this.queue = [];
    this.events = [];
    this.eventCounter = 0;
    this.notify();
  }

  public destroy(): void {
    this.clearAllTimers();
    this.listeners.clear();
  }
}
