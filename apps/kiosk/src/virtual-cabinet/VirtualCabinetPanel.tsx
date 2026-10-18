import React, { Component, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@florabot/ui';
import { VirtualSlot as VirtualSlot2D } from './VirtualSlot';
import {
  SLOT_STATUS_LABELS,
  type VirtualCabinetEvent,
  type VirtualKioskStatus,
  type VirtualSlot as VirtualSlotModel,
} from './virtualCabinet.types';

// Lazy-load Three.js 3D cabinet component to keep initial Kiosk bundle lightweight
const VirtualCabinet3D = React.lazy(() => import('./three/VirtualCabinet3D'));

function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

type ErrorBoundaryProps = {
  fallback: React.ReactNode;
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class Cabinet3DErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('3D Cabinet render fallback triggered:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

type VirtualCabinetPanelProps = {
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

export function VirtualCabinetPanel({
  slots,
  kioskStatus,
  activeSlot,
  events,
  onCloseDoor,
  onToggleOffline,
  onToggleMaintenance,
  onSimulateFault,
  onReset,
}: VirtualCabinetPanelProps) {
  const [selectedSlotCode, setSelectedSlotCode] = useState<string | null>(null);
  const [use3DMode, setUse3DMode] = useState<boolean>(() => checkWebGLSupport());
  const resetCameraRef = useRef<(() => void) | null>(null);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.code === selectedSlotCode) ?? null,
    [selectedSlotCode, slots],
  );

  const handleSelectSlot = useCallback((code: string) => {
    setSelectedSlotCode(code);
  }, []);

  const handleResetAll = useCallback(() => {
    onReset();
    if (resetCameraRef.current) {
      resetCameraRef.current();
    }
  }, [onReset]);

  // Fallback 2D slots rendering (only displayed when 2D mode is active or WebGL fails)
  const fallback2DContent = (
    <section className="virtual-cabinet__slots-section" aria-label="Danh sách ô tủ 2D">
      <div className="virtual-cabinet-fallback-notice" role="status">
        <p className="fallback-text">
          Chế độ danh sách 2D. Bạn có thể bấm nút <strong>2D / 3D</strong> ở góc trên để quay lại mô
          hình 3D.
        </p>
      </div>
      <div className="virtual-cabinet__body">
        {slots.map((slot) => (
          <div
            key={slot.code}
            role="button"
            tabIndex={0}
            className={`virtual-slot-wrap ${selectedSlotCode === slot.code ? 'is-selected' : ''}`}
            onClick={() => handleSelectSlot(slot.code)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleSelectSlot(slot.code);
              }
            }}
          >
            <VirtualSlot2D slot={slot} />
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <aside
      className="virtual-cabinet virtual-cabinet-simulator"
      aria-labelledby="virtual-cabinet-title"
    >
      {/* 1. Header with simulation pill and connection status */}
      <div className="virtual-cabinet__heading">
        <div>
          <span className="virtual-cabinet__eyebrow">MÔ PHỎNG THIẾT BỊ 3D</span>
          <h2 id="virtual-cabinet-title">Tủ hoa thông minh FloraBot</h2>
        </div>
        <div className="virtual-cabinet__badges">
          <button
            type="button"
            className="virtual-cabinet__toggle-view-btn"
            onClick={() => setUse3DMode((v) => !v)}
            title="Chuyển đổi giữa chế độ 3D và 2D"
          >
            {use3DMode ? 'Chế độ 3D' : 'Chế độ 2D'}
          </button>
          <span
            className={`virtual-cabinet__connection virtual-cabinet__connection--${kioskStatus.toLowerCase()}`}
          >
            {kioskStatus}
          </span>
        </div>
      </div>

      {kioskStatus !== 'ONLINE' && (
        <p className="virtual-cabinet__alert" role="alert">
          {kioskStatus === 'OFFLINE'
            ? 'LI-01 · Tủ đang mất kết nối. Không thể gửi lệnh mở cửa.'
            : 'Tủ đang bảo trì. Danh mục và lệnh mở cửa tạm khóa.'}
        </p>
      )}

      {/* 2. Interactive 3D Canvas Viewport OR 2D Fallback */}
      {use3DMode ? (
        <Cabinet3DErrorBoundary fallback={fallback2DContent}>
          <Suspense
            fallback={
              <div className="virtual-cabinet-3d-loading" role="status">
                Đang khởi tạo mô hình 3D…
              </div>
            }
          >
            <VirtualCabinet3D
              slots={slots}
              kioskStatus={kioskStatus}
              activeSlot={activeSlot}
              selectedSlotCode={selectedSlotCode}
              onSelectSlot={handleSelectSlot}
              onResetCameraRef={resetCameraRef}
            />
          </Suspense>
        </Cabinet3DErrorBoundary>
      ) : (
        fallback2DContent
      )}

      {/* 3. Compact Quick-Select Slot Tabs + Active Slot Inspector */}
      <div className="virtual-cabinet__slot-tabs" role="tablist" aria-label="Chọn nhanh ô tủ">
        {slots.map((slot) => {
          const isSelected = selectedSlotCode === slot.code;
          return (
            <button
              key={slot.code}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`slot-tab-btn ${isSelected ? 'is-active' : ''} slot-tab-btn--${slot.status.toLowerCase()}`}
              onClick={() => handleSelectSlot(slot.code)}
            >
              <span className="slot-tab-dot" aria-hidden="true" />
              <span className="slot-tab-code">Ô {slot.code}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Active Door Prompt (when a door is opening or open) */}
      {activeSlot?.status === 'OPEN' && (
        <div className="virtual-cabinet__door-prompt" role="status">
          <div className="door-prompt-text">
            <strong>Ô {activeSlot.code} đang mở cửa</strong>
            <span>Vui lòng lấy hoa ra khỏi khoang và bấm đóng cửa.</span>
          </div>
          <Button type="button" onClick={onCloseDoor}>
            Đóng cửa ô {activeSlot.code}
          </Button>
        </div>
      )}

      {activeSlot?.status === 'OPENING' && (
        <p className="virtual-cabinet__opening" role="status">
          🔓 Đang nhả chốt từ và mở cửa ô {activeSlot.code}…
        </p>
      )}

      {/* 5. Compact Inspector Card for Selected Slot */}
      {selectedSlot && (
        <div
          className="virtual-cabinet__inspector-card"
          role="region"
          aria-label={`Chi tiết ô ${selectedSlot.code}`}
        >
          <div className="inspector-header">
            <div>
              <strong className="inspector-title">
                Ô {selectedSlot.code} · {selectedSlot.bouquetName || 'Ô trống (Đã lấy hoa)'}
              </strong>
              <p className="inspector-hint">
                {selectedSlot.status === 'AVAILABLE' &&
                  'Có sẵn tại tủ cho khách mua trực tiếp (Walk-in).'}
                {selectedSlot.status === 'HELD' && 'Đang được giữ tạm thời cho lượt mua hiện tại.'}
                {selectedSlot.status === 'RESERVED' &&
                  'Khoang dành riêng cho đơn đặt trước (nhận bằng mã PIN).'}
                {selectedSlot.status === 'OPENING' && 'Thiết bị đang gửi xung mở khóa chốt cửa…'}
                {selectedSlot.status === 'OPEN' && 'Cửa đang mở và đèn khoang đang sáng dẫn hướng.'}
                {selectedSlot.status === 'EMPTY' && 'Hoa đã được khách lấy ra và đóng cửa an toàn.'}
                {selectedSlot.status === 'FAULT' &&
                  'Cảnh báo: Ô đang gặp sự cố cảm biến hoặc kẹt chốt!'}
              </p>
            </div>
            <span className={`inspector-status-badge status--${selectedSlot.status.toLowerCase()}`}>
              {SLOT_STATUS_LABELS[selectedSlot.status]}
            </span>
          </div>
        </div>
      )}

      {/* 6. Testing & Simulation Controls + Event Log inside compact collapsible drawers */}
      <details className="virtual-cabinet__controls">
        <summary>🛠️ Bảng điều khiển giả lập & Nhật ký ({events.length})</summary>
        <div className="virtual-cabinet__control-grid">
          <Button type="button" variant="outline" onClick={onToggleOffline}>
            {kioskStatus === 'OFFLINE' ? 'Kết nối lại' : 'Mô phỏng offline'}
          </Button>
          <Button type="button" variant="outline" onClick={onToggleMaintenance}>
            {kioskStatus === 'MAINTENANCE' ? 'Kết thúc bảo trì' : 'Mô phỏng bảo trì'}
          </Button>
          <Button type="button" variant="outline" onClick={onSimulateFault}>
            Mô phỏng lỗi cửa
          </Button>
          <Button type="button" variant="outline" onClick={handleResetAll}>
            Khôi phục tủ
          </Button>
        </div>

        <div className="virtual-cabinet__events" aria-labelledby="virtual-events-title">
          <h3 id="virtual-events-title">Nhật ký thiết bị</h3>
          {events.length === 0 ? (
            <p>Chưa có sự kiện. Hãy chọn hoa hoặc thử mở một ô.</p>
          ) : (
            <ol aria-live="polite">
              {events.map((event) => (
                <li key={event.id}>
                  <time>{event.createdAt}</time>
                  <span className={`event-kind event-kind--${event.kind.toLowerCase()}`}>
                    {event.kind}
                  </span>
                  <span>{event.message}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </details>
    </aside>
  );
}

export default VirtualCabinetPanel;
