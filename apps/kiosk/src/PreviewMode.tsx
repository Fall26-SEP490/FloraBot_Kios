import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Check, Flower2, MapPin } from '@florabot/ui';
import { flowerPhotos } from '@florabot/ui/flower-photos';
import BouquetImage from './BouquetImage';
import { VirtualCabinet } from './virtual-cabinet/VirtualCabinet';
import { useVirtualCabinet } from './virtual-cabinet/useVirtualCabinet';
import './preview.css';
import './virtual-cabinet/virtual-cabinet.css';
import './preview-mode.css';

export type PreviewBouquet = {
  id: string;
  name: string;
  price: number;
  slotCode: string;
  shopName: string;
  image: string;
  tag: string;
  description: string;
};

// Business Invariant: One Seller leases the WHOLE kiosk.
// All bouquets at this kiosk belong to the single shop: "Hoa Sài Gòn (Minh họa)".
const SHARED_SHOP_NAME = 'Hoa Sài Gòn (Minh họa)';

const DEMO_BOUQUETS: PreviewBouquet[] = [
  {
    id: 'demo-b1',
    name: 'Bó hồng lụa dịu dàng',
    price: 350000,
    slotCode: 'A01',
    shopName: SHARED_SHOP_NAME,
    image: 'images/demo-silk-rose.png',
    tag: 'Hoa lụa nghệ thuật',
    description: 'Hoa hồng lụa thủ công tông phấn ấm áp, cánh hoa tạo hình tỉ mỉ.',
  },
  {
    id: 'demo-b2',
    name: 'Tulip vải pastel cao cấp',
    price: 280000,
    slotCode: 'A02',
    shopName: SHARED_SHOP_NAME,
    image: 'images/demo-pastel-bouquet.png',
    tag: 'Vải lụa trang trí',
    description: 'Bó tulip vải phối lá xanh thanh lịch cho không gian trang nhã.',
  },
  {
    id: 'demo-b3',
    name: 'Hướng dương lụa đặt trước',
    price: 320000,
    slotCode: 'A03',
    shopName: SHARED_SHOP_NAME,
    image: 'images/demo-sunflower.png',
    tag: 'Hoa nhân tạo',
    description: 'Hoa hướng dương lụa vàng tươi sáng ngập tràn năng lượng tích cực.',
  },
];

const money = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function PreviewMode({ onExit }: { onExit: () => void }) {
  const cabinet = useVirtualCabinet();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);
  const [activeTab, setActiveTab] = useState<'walkin' | 'pickup'>('walkin');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [simulatedCheckoutOpen, setSimulatedCheckoutOpen] = useState(false);
  const [simulatedPaid, setSimulatedPaid] = useState(false);

  // Pre-order pickup simulation state
  const [pickupCode, setPickupCode] = useState('');
  const [pickupResult, setPickupResult] = useState<{
    orderCode: string;
    item: string;
    slot: string;
    accessories: string;
  } | null>(null);
  const [pickupTriggered, setPickupTriggered] = useState(false);
  const [pickupError, setPickupError] = useState('');
  const [pickupAttempts, setPickupAttempts] = useState(0);

  const selectedBouquets = DEMO_BOUQUETS.filter((b) => selectedIds.includes(b.id));
  const availableBouquets = DEMO_BOUQUETS.filter((bouquet) =>
    cabinet.slots.some(
      (slot) =>
        slot.bouquetId === bouquet.id && (slot.status === 'AVAILABLE' || slot.status === 'HELD'),
    ),
  );
  const totalAmount = selectedBouquets.reduce((sum, b) => sum + b.price, 0);
  const stage = activeTab === 'pickup' || simulatedPaid ? 3 : simulatedCheckoutOpen ? 2 : 0;

  const toggleSelect = (id: string) => {
    const isSelected = selectedIds.includes(id);
    cabinet.holdBouquet(id, !isSelected);
    setSelectedIds((prev) => (isSelected ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const resetPreview = () => {
    setSelectedIds([]);
    setSimulatedCheckoutOpen(false);
    setSimulatedPaid(false);
    setPickupCode('');
    setPickupResult(null);
    setPickupTriggered(false);
    setPickupError('');
    setPickupAttempts(0);
    cabinet.resetCabinet();
  };

  const handleSimulatePickup = () => {
    const clean = pickupCode.trim().toUpperCase();
    if (!clean) {
      setPickupError('Vui lòng nhập mã PIN hoặc mã đơn đặt trước.');
      return;
    }
    if (pickupAttempts >= 3) {
      setPickupError('Đã vượt quá 3 lần thử. Hãy chọn “Làm mới” để bắt đầu lại.');
      return;
    }
    setPickupError('');
    setPickupTriggered(false);
    if (clean === '123456' || clean === 'PRE26101' || clean === 'DEMO2026') {
      setPickupAttempts(0);
      setPickupResult({
        orderCode: 'FB-PREORDER-26101',
        item: 'Hướng dương lụa đặt trước',
        slot: 'A03',
        accessories: 'Thiệp chúc mừng viết tay + Nơ lụa kèm theo',
      });
    } else {
      const nextAttempts = pickupAttempts + 1;
      setPickupAttempts(nextAttempts);
      setPickupResult(null);
      setPickupError(
        nextAttempts >= 3
          ? 'Mã không đúng. Tạm khóa sau 3 lần thử; hãy chọn “Làm mới”.'
          : `Mã không đúng. Bạn còn ${3 - nextAttempts} lần thử.`,
      );
    }
  };

  return (
    <div className="kp-shell preview-simulator">
      <header className="kp-header">
        <div className="kp-brand" aria-label="FloraBot">
          <Flower2 size={30} aria-hidden="true" />
          FloraBot<span>.</span>
        </div>
        <ol className="kp-top-steps" aria-label="Tiến trình mô phỏng kiosk">
          {['Chọn hoa', 'Xem giỏ', 'Thanh toán', 'Nhận hoa'].map((label, index) => (
            <li key={label} aria-current={stage === index ? 'step' : undefined}>
              <span>{index < stage ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <div className="preview-simulator__header-actions">
          <span className="kp-preview-badge">DỮ LIỆU MINH HỌA · CHƯA CÓ IOT</span>
          <Button type="button" variant="outline" onClick={onExit}>
            Thoát xem mẫu
          </Button>
        </div>
      </header>

      <main id="main" className="kp-main preview-compact-main">
        <div className="kp-location">
          <span>
            <MapPin size={16} aria-hidden="true" />
            Không gian kiosk minh họa · {SHARED_SHOP_NAME}
          </span>
          <button type="button" onClick={resetPreview}>
            Làm mới
          </button>
        </div>

        {activeTab === 'walkin' && !simulatedCheckoutOpen && (
          <section className="kp-hero preview-simulator__hero">
            <div>
              <p className="kp-eyebrow">MỘT CHÚT HOA, MỘT CHÚT THƯƠNG</p>
              <h1>
                Một bó hoa,
                <br />
                một ngày vui.
              </h1>
              <p>
                Chạm để chọn hoa có sẵn trong tủ.
                <br />
                Theo dõi trực tiếp trạng thái từng ô ngay trên màn hình.
              </p>
              <span className="kp-hero-tag">Hoa nhân tạo · Sẵn sàng nhận tại kiosk</span>
            </div>
            <img src={flowerPhotos.pastelBouquet.src} alt={flowerPhotos.pastelBouquet.alt} />
          </section>
        )}

        <p className="preview-simulator__notice" role="status">
          Chế độ xem mẫu Kiosk Tablet — Không thanh toán thật, không mở khóa tủ thật.
        </p>

        {/* Compact Mode Switcher (Tabs) */}
        <div className="kiosk-compact-tabs" role="tablist" aria-label="Lựa chọn phương thức">
          <button
            type="button"
            className={`compact-tab-btn ${activeTab === 'walkin' ? 'active' : ''}`}
            onClick={() => setActiveTab('walkin')}
            aria-selected={activeTab === 'walkin'}
            role="tab"
          >
            🌸 Mua hoa tại chỗ (Walk-in)
          </button>
          <button
            type="button"
            className={`compact-tab-btn ${activeTab === 'pickup' ? 'active' : ''}`}
            onClick={() => setActiveTab('pickup')}
            aria-selected={activeTab === 'pickup'}
            role="tab"
          >
            📦 Nhận đơn đặt trước (PIN / QR)
          </button>
        </div>

        <div className="preview-workspace">
          <div className="preview-flow">
            {/* Tab 1: Walk-in shopping - Catalogue first */}
            {activeTab === 'walkin' && !simulatedCheckoutOpen && (
              <section className="preview-catalogue-section" aria-labelledby="catalog-heading">
                {/* Short compact heading & subtitle */}
                <div className="kp-section-heading preview-catalogue-header">
                  <div>
                    <p className="kp-eyebrow">CHỌN MỘT NIỀM VUI</p>
                    <h1 id="catalog-heading" className="preview-compact-title">
                      Hoa đang có sẵn tại tủ
                    </h1>
                  </div>
                  <span>{availableBouquets.length} mẫu sẵn sàng</span>
                </div>
                <p className="kp-data-note preview-compact-subtitle">
                  100% hoa nhân tạo cao cấp · Chỉ hiển thị các ô có thể mua tại chỗ.
                </p>

                {/* Compact Bouquet Cards Grid */}
                <div className="preview-bouquet-grid">
                  {availableBouquets.map((bouquet) => {
                    const isSelected = selectedIds.includes(bouquet.id);
                    return (
                      <article
                        key={bouquet.id}
                        className={`kp-product preview-bouquet-card ${isSelected ? 'selected' : ''}`}
                      >
                        <div className="kp-photo card-image-wrap">
                          <BouquetImage
                            src={`${import.meta.env.BASE_URL}${bouquet.image}`}
                            alt={`Ảnh minh họa ${bouquet.name}`}
                            className="bouquet-card-img"
                            width={320}
                            height={180}
                          />
                          <span className="card-slot-badge">Ô {bouquet.slotCode}</span>
                        </div>

                        <div className="kp-product-body card-content">
                          <p className="card-shop">{bouquet.shopName}</p>
                          <h2 className="card-title">{bouquet.name}</h2>
                          <span className="card-illustration-notice">
                            {bouquet.tag} · Hoa thực tế tại ô {bouquet.slotCode}
                          </span>

                          <div className="card-action-row card-purchase-row">
                            <strong className="card-price">{money(bouquet.price)}</strong>
                            <label
                              htmlFor={`preview-chk-${bouquet.id}`}
                              className="card-checkbox-label"
                            >
                              <input
                                id={`preview-chk-${bouquet.id}`}
                                type="checkbox"
                                checked={isSelected}
                                aria-label={`Chọn ${bouquet.name} tại ô ${bouquet.slotCode}`}
                                onChange={() => toggleSelect(bouquet.id)}
                              />
                              <span aria-hidden="true">{isSelected ? '✓' : '+'}</span>
                            </label>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Accessories preorder-only note */}
                <p className="compact-preorder-note">
                  <strong>Lưu ý:</strong> Phụ kiện chỉ áp dụng cho đơn đặt trước. Bó hoa mua tại chỗ
                  đã chuẩn bị sẵn tại ô tủ.
                </p>

                {/* Sticky Basket Summary */}
                <aside className="preview-sticky-basket" aria-label="Giỏ hoa mẫu">
                  <div className="basket-info">
                    <span className="basket-count">{selectedIds.length} bó đã chọn</span>
                    <span className="basket-total">
                      Tổng: <strong>{money(totalAmount)}</strong>
                    </span>
                  </div>
                  <Button
                    type="button"
                    className="basket-checkout-button"
                    disabled={selectedIds.length === 0}
                    onClick={() => setSimulatedCheckoutOpen(true)}
                  >
                    {selectedIds.length === 0
                      ? 'Chưa chọn hoa'
                      : `Thử nghiệm đặt hoa (${selectedIds.length}) · ${money(totalAmount)}`}
                  </Button>
                </aside>
              </section>
            )}

            {/* Simulated Checkout View */}
            {activeTab === 'walkin' && simulatedCheckoutOpen && (
              <section
                className="simulated-checkout-section"
                aria-labelledby="simulated-checkout-title"
              >
                <h1 id="simulated-checkout-title">Mô phỏng quy trình thanh toán</h1>

                <div className="preview-warning-box" role="alert">
                  <strong>MÔ PHỎNG: DỮ LIỆU MINH HỌA</strong>
                  <p>
                    Đây là quy trình mô phỏng giao diện Kiosk Tablet. Không kết nối payOS, không trừ
                    tiền và không gửi lệnh mở chốt tủ thực tế.
                  </p>
                </div>

                <div className="simulated-checkout-card">
                  <h2>Chi tiết đơn hoa mô phỏng</h2>
                  <ul className="simulated-items-list">
                    {selectedBouquets.map((b) => (
                      <li key={b.id} className="simulated-item-row">
                        <span>
                          <strong>{b.name}</strong> · Ô {b.slotCode} ({b.shopName})
                        </span>
                        <strong>{money(b.price)}</strong>
                      </li>
                    ))}
                  </ul>

                  <div className="simulated-total-row">
                    <span>Tổng số tiền:</span>
                    <strong className="simulated-total-amount">{money(totalAmount)}</strong>
                  </div>

                  {!simulatedPaid ? (
                    <div className="simulated-payment-box">
                      <div className="simulated-qr-wrap">
                        <span className="simulated-watermark">
                          MÃ MINH HỌA - KHÔNG QUÉT THANH TOÁN
                        </span>
                        <QRCodeSVG
                          value="https://florabot.test/demo-nonpayment-preview"
                          size={180}
                          title="Mã QR minh họa giao diện thanh toán"
                        />
                        <p className="simulated-qr-caption">
                          Mã QR giả lập giao diện phục vụ kiểm thử · Không thực hiện giao dịch tài
                          chính
                        </p>
                      </div>

                      <div className="simulated-instructions">
                        <p>
                          Mã đơn mô phỏng: <strong>FB-PREVIEW-261014-01</strong>
                        </p>
                        <p>
                          Mã biên nhận tạm tính: <strong>MINHHOA1</strong>
                        </p>
                        <p className="quiet">
                          Giao diện minh họa: Trên thiết bị thật đã cấu hình, khách quét mã payOS để
                          thanh toán và hệ thống tự động mở chốt ô tủ.
                        </p>

                        <div className="simulated-actions">
                          <Button
                            type="button"
                            onClick={() => {
                              setSimulatedPaid(true);
                              cabinet.startDispensing(
                                selectedBouquets.map((bouquet) => bouquet.slotCode),
                              );
                            }}
                            className="simulate-success-btn"
                          >
                            Mô phỏng thanh toán thành công (Thử nghiệm giao diện)
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setSimulatedCheckoutOpen(false)}
                          >
                            Quay lại chọn hoa
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="simulated-success-box" role="status">
                      <div className="simulated-success-badge">
                        ✓ MÔ PHỎNG: THANH TOÁN THÀNH CÔNG
                      </div>
                      <p>
                        Trạng thái mô phỏng: <strong>Đã nhận tiền (Mô phỏng giao diện)</strong>
                      </p>
                      <p className="simulated-hardware-note">
                        (Lưu ý trung thực: Chế độ xem mẫu chỉ minh họa giao diện màn hình; TỦ THẬT
                        KHÔNG MỞ CHỐT KHÓA và không gửi tín hiệu phần cứng nào).
                      </p>
                      <div className="simulated-receipt-card">
                        <h3>Biên nhận mua hoa điện tử (Minh họa)</h3>
                        <p>
                          Mã đơn hàng: <strong>FB-PREVIEW-261014-01</strong>
                        </p>
                        <p>
                          Mã tra cứu biên nhận: <strong>MINHHOA1</strong>
                        </p>
                        <p>
                          Vị trí nhận hoa mô phỏng:{' '}
                          <strong>
                            {selectedBouquets.map((b) => `Ô ${b.slotCode}`).join(', ')}
                          </strong>
                        </p>
                        <p>
                          Cửa hàng: <strong>{SHARED_SHOP_NAME}</strong>
                        </p>
                      </div>

                      <div className="simulated-actions">
                        <Button
                          type="button"
                          disabled={!cabinet.dispensingComplete}
                          onClick={() => {
                            setSimulatedCheckoutOpen(false);
                            setSimulatedPaid(false);
                            setSelectedIds([]);
                            cabinet.resetCabinet();
                          }}
                        >
                          {cabinet.dispensingComplete
                            ? 'Hoàn tất lượt xem mẫu'
                            : 'Đóng tất cả cửa để hoàn tất'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Tab 2: Pre-order Pickup */}
            {activeTab === 'pickup' && (
              <section className="preview-pickup-section" aria-labelledby="pickup-heading">
                <h1 id="pickup-heading">Nhận đơn đặt trước tại tủ (Mô phỏng)</h1>
                <p className="pickup-lead">
                  Dành cho khách hàng đã đặt hoa online trước qua website hoặc ứng dụng FloraBot.
                </p>

                <div className="camera-privacy-notice" role="note">
                  <strong>Bảo vệ quyền riêng tư & tiện lợi:</strong> Camera trên kiosk không tự động
                  kích hoạt. Quý khách có thể nhập trực tiếp mã PIN hoặc mã biên nhận trên màn hình
                  cảm ứng bên dưới.
                </div>

                <div className="preview-pickup-card">
                  <label htmlFor="preview-pin-input">Mã PIN hoặc Mã biên nhận nhận hoa</label>
                  <div className="preview-input-group">
                    <input
                      id="preview-pin-input"
                      type="text"
                      placeholder="Ví dụ: PRE26101 hoặc 123456"
                      value={pickupCode}
                      onChange={(e) => setPickupCode(e.target.value)}
                      maxLength={20}
                    />
                    <Button type="button" onClick={handleSimulatePickup}>
                      Kiểm tra mã đơn
                    </Button>
                  </div>

                  {pickupError && (
                    <p role="alert" className="error">
                      {pickupError}
                    </p>
                  )}

                  <div className="quick-demo-pins">
                    <span>Mã thử nghiệm nhanh:</span>
                    <button
                      type="button"
                      className="pin-chip"
                      onClick={() => {
                        setPickupCode('PRE26101');
                        setPickupError('');
                      }}
                    >
                      PRE26101 (Hướng dương + thiệp)
                    </button>
                    <button
                      type="button"
                      className="pin-chip"
                      onClick={() => {
                        setPickupCode('123456');
                        setPickupError('');
                      }}
                    >
                      123456 (Đơn đặt trước mẫu)
                    </button>
                  </div>

                  {pickupResult && (
                    <div className="pickup-result-card" role="status">
                      <h3>Thông tin đơn đặt trước</h3>
                      <div className="result-row">
                        <span>Mã đơn:</span>
                        <strong>{pickupResult.orderCode}</strong>
                      </div>
                      <div className="result-row">
                        <span>Sản phẩm:</span>
                        <strong>{pickupResult.item}</strong>
                      </div>
                      <div className="result-row">
                        <span>Vị trí ô tủ:</span>
                        <strong className="slot-highlight">Ô {pickupResult.slot}</strong>
                      </div>
                      <div className="result-row">
                        <span>Phụ kiện đi kèm:</span>
                        <span>{pickupResult.accessories}</span>
                      </div>

                      <div className="pickup-simulation-status">
                        <span className="status-badge-ok">
                          ✓ Mã hợp lệ · Sẵn sàng mở ô (Mô phỏng)
                        </span>
                        <p className="quiet simulated-cabinet-warning">
                          (Chế độ xem mẫu: Toàn bộ quy trình là mô phỏng giao diện; TỦ THẬT KHÔNG MỞ
                          CHỐT KHÓA và không kết nối phần cứng).
                        </p>
                      </div>

                      {!pickupTriggered ? (
                        <Button
                          type="button"
                          onClick={() => {
                            if (cabinet.startDispensing([pickupResult.slot])) {
                              setPickupTriggered(true);
                            }
                          }}
                        >
                          Mô phỏng mở ô nhận hoa
                        </Button>
                      ) : (
                        <div className="pickup-triggered-feedback" role="status">
                          <p>
                            <strong>
                              MÔ PHỎNG: Đã gửi lệnh mở ô {pickupResult.slot} tới tủ ảo.
                            </strong>
                          </p>
                          <p className="quiet">
                            (Nhắc nhở: Phần cứng tủ thực tế hoàn toàn không mở trong chế độ xem
                            mẫu).
                          </p>
                        </div>
                      )}

                      <div className="pickup-actions-row">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setPickupResult(null);
                            setPickupCode('');
                            setPickupTriggered(false);
                          }}
                        >
                          Thử mã khác
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          <VirtualCabinet
            slots={cabinet.slots}
            kioskStatus={cabinet.kioskStatus}
            activeSlot={cabinet.activeSlot}
            events={cabinet.events}
            onCloseDoor={cabinet.closeActiveSlot}
            onToggleOffline={cabinet.toggleOffline}
            onToggleMaintenance={cabinet.toggleMaintenance}
            onSimulateFault={cabinet.simulateFault}
            onReset={resetPreview}
          />
        </div>
      </main>

      <footer className="kp-footer preview-compact-footer">
        <p>
          <Flower2 size={17} aria-hidden="true" />
          FloraBot Kiosk Tablet · Hoa nhân tạo cao cấp.
        </p>
        <button type="button" onClick={onExit}>
          Về màn thiết lập thiết bị
        </button>
        <span>Bản xem trước giao diện độc lập · Không điều khiển IoT thật</span>
      </footer>
    </div>
  );
}
