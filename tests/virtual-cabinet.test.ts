import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VirtualCabinetController } from '../apps/kiosk/src/virtual-cabinet/controller/VirtualCabinetController';

describe('VirtualCabinetController Unit Tests', () => {
  let controller: VirtualCabinetController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new VirtualCabinetController({
      ackDelayMs: 100,
      openDelayMs: 200,
      closeDelayMs: 50,
      nextSlotDelayMs: 50,
    });
  });

  afterEach(() => {
    controller.destroy();
    vi.useRealTimers();
  });

  it('handles hold and release of walk-in bouquets', () => {
    const initial = controller.getSnapshot();
    const slotA01 = initial.slots.find((s) => s.code === 'A01');
    expect(slotA01?.status).toBe('AVAILABLE');

    // Hold
    controller.holdBouquet('demo-b1', true);
    expect(controller.getSnapshot().slots.find((s) => s.code === 'A01')?.status).toBe('HELD');
    expect(controller.getSnapshot().events[0].kind).toBe('SYSTEM');
    expect(controller.getSnapshot().events[0].message).toContain('Giữ ô A01');

    // Release
    controller.holdBouquet('demo-b1', false);
    expect(controller.getSnapshot().slots.find((s) => s.code === 'A01')?.status).toBe('AVAILABLE');
    expect(controller.getSnapshot().events[0].kind).toBe('SYSTEM');
    expect(controller.getSnapshot().events[0].message).toContain('Trả ô A01');
  });

  it('executes state transition OPENING -> OPEN -> EMPTY with logs', () => {
    const success = controller.openSlot('A01');
    expect(success).toBe(true);

    // Immediately OPENING and UNLOCK event
    let snap = controller.getSnapshot();
    expect(snap.slots.find((s) => s.code === 'A01')?.status).toBe('OPENING');
    expect(snap.events[0].kind).toBe('UNLOCK');

    // After ackDelayMs (100ms)
    vi.advanceTimersByTime(100);
    snap = controller.getSnapshot();
    expect(snap.events[0].kind).toBe('ACK');

    // After openDelayMs (200ms total)
    vi.advanceTimersByTime(100);
    snap = controller.getSnapshot();
    expect(snap.slots.find((s) => s.code === 'A01')?.status).toBe('OPEN');
    expect(snap.events[0].kind).toBe('DOOR_OPENED');
    expect(snap.activeSlot?.code).toBe('A01');

    // Close door
    controller.closeActiveSlot();
    // After closeDelayMs (50ms)
    vi.advanceTimersByTime(50);
    snap = controller.getSnapshot();
    const closedSlot = snap.slots.find((s) => s.code === 'A01');
    expect(closedSlot?.status).toBe('EMPTY');
    expect(closedSlot?.bouquetId).toBeNull();
    expect(snap.activeSlot).toBeNull();
    expect(snap.events[0].kind).toBe('DOOR_CLOSED');
  });

  it('opens multiple doors sequentially (one at a time)', () => {
    const started = controller.startDispensing(['A01', 'A02']);
    expect(started).toBe(true);

    // A01 is opening, A02 in queue
    let snap = controller.getSnapshot();
    expect(snap.slots.find((s) => s.code === 'A01')?.status).toBe('OPENING');
    expect(snap.slots.find((s) => s.code === 'A02')?.status).toBe('AVAILABLE');
    expect(snap.queue).toEqual(['A02']);

    // Advance to A01 OPEN
    vi.advanceTimersByTime(200);
    snap = controller.getSnapshot();
    expect(snap.slots.find((s) => s.code === 'A01')?.status).toBe('OPEN');

    // Close A01
    controller.closeActiveSlot();
    vi.advanceTimersByTime(50); // closeDelay
    snap = controller.getSnapshot();
    expect(snap.slots.find((s) => s.code === 'A01')?.status).toBe('EMPTY');

    // Advance nextSlotDelayMs (50ms)
    vi.advanceTimersByTime(50);
    snap = controller.getSnapshot();
    expect(snap.slots.find((s) => s.code === 'A02')?.status).toBe('OPENING');
    expect(snap.queue).toEqual([]);

    // Advance to A02 OPEN
    vi.advanceTimersByTime(200);
    snap = controller.getSnapshot();
    expect(snap.slots.find((s) => s.code === 'A02')?.status).toBe('OPEN');

    // Close A02
    controller.closeActiveSlot();
    vi.advanceTimersByTime(50);
    snap = controller.getSnapshot();
    expect(snap.slots.find((s) => s.code === 'A02')?.status).toBe('EMPTY');
    expect(snap.dispensingComplete).toBe(true);
  });

  it('blocks opening doors when kiosk is OFFLINE', () => {
    controller.toggleOffline();
    expect(controller.getSnapshot().kioskStatus).toBe('OFFLINE');

    const result = controller.openSlot('A01');
    expect(result).toBe(false);
    expect(controller.getSnapshot().slots.find((s) => s.code === 'A01')?.status).toBe('AVAILABLE');
    expect(controller.getSnapshot().events[0].kind).toBe('WARNING');
    expect(controller.getSnapshot().events[0].message).toContain('offline hoặc bảo trì');

    const dispensingResult = controller.startDispensing(['A01']);
    expect(dispensingResult).toBe(false);
  });

  it('blocks opening doors when kiosk is in MAINTENANCE', () => {
    controller.toggleMaintenance();
    expect(controller.getSnapshot().kioskStatus).toBe('MAINTENANCE');

    const result = controller.openSlot('A01');
    expect(result).toBe(false);
    expect(controller.getSnapshot().slots.find((s) => s.code === 'A01')?.status).toBe('AVAILABLE');
    expect(controller.getSnapshot().events[0].kind).toBe('WARNING');
    expect(controller.getSnapshot().events[0].message).toContain('offline hoặc bảo trì');
  });

  it('blocks door opening when slot has FAULT', () => {
    controller.simulateFault('A01');
    expect(controller.getSnapshot().slots.find((s) => s.code === 'A01')?.status).toBe('FAULT');
    expect(controller.getSnapshot().events[0].kind).toBe('WARNING');

    const result = controller.openSlot('A01');
    expect(result).toBe(false);
    expect(controller.getSnapshot().events[0].kind).toBe('WARNING');
    expect(controller.getSnapshot().events[0].message).toContain('sự cố');
  });

  it('resets cabinet restoring initial inventory and status', () => {
    controller.holdBouquet('demo-b1', true);
    controller.simulateFault('A02');
    controller.toggleOffline();

    let snap = controller.getSnapshot();
    expect(snap.kioskStatus).toBe('OFFLINE');
    expect(snap.slots.find((s) => s.code === 'A01')?.status).toBe('HELD');
    expect(snap.slots.find((s) => s.code === 'A02')?.status).toBe('FAULT');

    controller.resetCabinet();
    snap = controller.getSnapshot();
    expect(snap.kioskStatus).toBe('ONLINE');
    expect(snap.activeSlot).toBeNull();
    expect(snap.queue).toEqual([]);
    expect(snap.events).toEqual([]);
    expect(snap.slots.find((s) => s.code === 'A01')?.status).toBe('AVAILABLE');
    expect(snap.slots.find((s) => s.code === 'A02')?.status).toBe('AVAILABLE');
    expect(snap.slots.find((s) => s.code === 'A03')?.status).toBe('RESERVED');
  });
});
