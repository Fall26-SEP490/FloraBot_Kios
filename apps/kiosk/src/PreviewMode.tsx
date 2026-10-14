import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@florabot/ui';
import BouquetImage from './BouquetImage';

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
    name: 'Hướng dương lụa rực rỡ',
    price: 320000,
    slotCode: 'B01',
    shopName: SHARED_SHOP_NAME,
    image: 'images/demo-sunflower.png',
    tag: 'Hoa nhân tạo',
    description: 'Hoa hướng dương lụa vàng tươi sáng ngập tràn năng lượng tích cực.',
  },
  {
    id: 'demo-b4',
    name: 'Bó hồng lụa mini để bàn',
    price: 180000,
    slotCode: 'B02',
    shopName: SHARED_SHOP_NAME,
    image: 'images/demo-mini-bouquet.png',
    tag: 'Kích thước nhỏ gọn',
    description: 'Bó hoa mini xinh xắn kèm dây ruy băng nơ mộc, thích hợp để bàn.',
  },
];

const money = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export default function PreviewMode({ onExit }: { onExit: () => void }) {
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

  const selectedBouquets = DEMO_BOUQUETS.filter((b) => selectedIds.includes(b.id));
  const totalAmount = selectedBouquets.reduce((sum, b) => sum + b.price, 0);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSimulatePickup = () => {
    const clean = pickupCode.trim().toUpperCase();
    if (!clean) {
      setPickupError('Vui lòng nhập mã PIN hoặc mã đơn đặt trước.');
      return;
    }
    setPickupError('');
    setPickupTriggered(false);
    if (clean === '123456' || clean.includes('ROSE') || clean === 'PRE26101') {
      setPickupResult({
        orderCode: 'FB-PREORDER-26101',
        item: 'Bó hồng lụa dịu dàng đặt trước',
        slot: 'PRE-01',
        accessories: 'Thiệp chúc mừng viết tay + Nơ lụa kèm theo',
      });
    } else {
      setPickupResult({
        orderCode: `FB-PREORDER-${clean}`,
        item: 'Tulip vải pastel cao cấp đặt trước',
        slot: 'PRE-02',
        accessories: 'Túi đựng hoa bảo vệ',
      });
    }
  };

  return (
    <div className="kiosk-preview-wrapper">
      {/* 1. Persistent clear demo ribbon ~56-64px */}
      <aside className="preview-ribbon" role="status" aria-label="Thông báo chế độ xem mẫu">
        <div className="preview-ribbon-badge">DỮ LIỆU MINH HỌA</div>
        <span className="preview-ribbon-text">
          Chế độ xem mẫu Kiosk Tablet — Không thanh toán thật, không mở khóa tủ thật.
        </span>
        <Button type="button" variant="outline" className="preview-exit-btn" onClick={onExit}>
          Thoát xem mẫu
        </Button>
      </aside>

      {/* 2. Compact header */}
      <header className="kiosk-compact-header">
        <div className="compact-header-brand">
          <strong className="brand">FloraBot</strong>
          <span className="kiosk-mode-tag">Bản xem mẫu Tablet</span>
          <span className="kiosk-shop-tag">Cửa hàng: {SHARED_SHOP_NAME}</span>
        </div>
        <div className="compact-header-actions">
          <Button
            type="button"
            variant="outline"
            className="compact-action-btn"
            onClick={() => {
              setSelectedIds([]);
              setSimulatedCheckoutOpen(false);
              setSimulatedPaid(false);
              setPickupCode('');
              setPickupResult(null);
              setPickupTriggered(false);
            }}
          >
            Làm mới
          </Button>
          <Button type="button" variant="outline" className="compact-action-btn" onClick={onExit}>
            Cài đặt
          </Button>
        </div>
      </header>

      {/* 3. Main container: Catalogue-first */}
      <main id="main" className="preview-compact-main">
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

        {/* Tab 1: Walk-in shopping - Catalogue first */}
        {activeTab === 'walkin' && !simulatedCheckoutOpen && (
          <section className="preview-catalogue-section" aria-labelledby="catalog-heading">
            {/* Short compact heading & subtitle */}
            <div className="preview-catalogue-header">
              <h1 id="catalog-heading" className="preview-compact-title">
                Một bó hoa, một ngày vui.
              </h1>
              <p className="preview-compact-subtitle">
                100% Hoa nhân tạo cao cấp · Chọn hoa có sẵn tại tủ hoặc tra cứu đơn đặt trước
              </p>
            </div>

            {/* Compact Bouquet Cards Grid */}
            <div className="preview-bouquet-grid">
              {DEMO_BOUQUETS.map((bouquet) => {
                const isSelected = selectedIds.includes(bouquet.id);
                return (
                  <article
                    key={bouquet.id}
                    className={`preview-bouquet-card ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="card-image-wrap">
                      <BouquetImage
                        src={`${import.meta.env.BASE_URL}${bouquet.image}`}
                        alt={`Ảnh minh họa ${bouquet.name}`}
                        className="bouquet-card-img"
                        width={320}
                        height={180}
                      />
                      <span className="card-slot-badge">Ô {bouquet.slotCode}</span>
                      <span className="card-art-badge">Hoa nhân tạo</span>
                    </div>

                    <div className="card-content">
                      <div className="card-header-row">
                        <h2 className="card-title">{bouquet.name}</h2>
                        <strong className="card-price">{money(bouquet.price)}</strong>
                      </div>
                      <p className="card-shop">{bouquet.shopName}</p>
                      <span className="card-illustration-notice">
                        Hình ảnh minh họa kiểu dáng · Hoa nhân tạo thực tế tại ô {bouquet.slotCode}
                      </span>

                      <div className="card-action-row">
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
                          <span>{isSelected ? 'Đã chọn bó này' : 'Chạm để chọn bó này'}</span>
                        </label>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Accessories preorder-only note */}
            <p className="compact-preorder-note">
              <strong>Lưu ý:</strong> Phụ kiện chỉ áp dụng cho đơn đặt trước. Bó hoa mua tại chỗ đã
              chuẩn bị sẵn tại ô tủ.
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
                    <span className="simulated-watermark">MÃ MINH HỌA - KHÔNG QUÉT THANH TOÁN</span>
                    <QRCodeSVG
                      value="https://florabot.test/demo-nonpayment-preview"
                      size={180}
                      title="Mã QR minh họa giao diện thanh toán"
                    />
                    <p className="simulated-qr-caption">
                      Mã QR giả lập giao diện phục vụ kiểm thử · Không thực hiện giao dịch tài chính
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
                        onClick={() => setSimulatedPaid(true)}
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
                  <div className="simulated-success-badge">✓ MÔ PHỎNG: THANH TOÁN THÀNH CÔNG</div>
                  <p>
                    Trạng thái mô phỏng: <strong>Đã nhận tiền (Mô phỏng giao diện)</strong>
                  </p>
                  <p className="simulated-hardware-note">
                    (Lưu ý trung thực: Chế độ xem mẫu chỉ minh họa giao diện màn hình; TỦ THẬT KHÔNG
                    MỞ CHỐT KHÓA và không gửi tín hiệu phần cứng nào).
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
                      <strong>{selectedBouquets.map((b) => `Ô ${b.slotCode}`).join(', ')}</strong>
                    </p>
                    <p>
                      Cửa hàng: <strong>{SHARED_SHOP_NAME}</strong>
                    </p>
                  </div>

                  <div className="simulated-actions">
                    <Button
                      type="button"
                      onClick={() => {
                        setSimulatedCheckoutOpen(false);
                        setSimulatedPaid(false);
                        setSelectedIds([]);
                      }}
                    >
                      Hoàn tất lượt xem mẫu
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
              kích hoạt. Quý khách có thể nhập trực tiếp mã PIN hoặc mã biên nhận trên màn hình cảm
              ứng bên dưới.
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
                  PRE26101 (Hồng lụa + thiệp)
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
                    <span className="status-badge-ok">✓ Mã hợp lệ · Sẵn sàng mở ô (Mô phỏng)</span>
                    <p className="quiet simulated-cabinet-warning">
                      (Chế độ xem mẫu: Toàn bộ quy trình là mô phỏng giao diện; TỦ THẬT KHÔNG MỞ
                      CHỐT KHÓA và không kết nối phần cứng).
                    </p>
                  </div>

                  {!pickupTriggered ? (
                    <Button type="button" onClick={() => setPickupTriggered(true)}>
                      Mô phỏng mở ô nhận hoa
                    </Button>
                  ) : (
                    <div className="pickup-triggered-feedback" role="status">
                      <p>
                        <strong>
                          MÔ PHỎNG: Lệnh mở ô tủ {pickupResult.slot} đã hoàn tất trên giao diện.
                        </strong>
                      </p>
                      <p className="quiet">
                        (Nhắc nhở: Phần cứng tủ thực tế hoàn toàn không mở trong chế độ xem mẫu).
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
      </main>

      <footer className="preview-compact-footer">
        FloraBot Kiosk Tablet · Toàn bộ hoa trưng bày là hoa nhân tạo cao cấp · Bản xem trước giao
        diện độc lập.
      </footer>
    </div>
  );
}
