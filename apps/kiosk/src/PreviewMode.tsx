import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Button,
  Check,
  CreditCard,
  Delete,
  Flower2,
  KeyRound,
  MapPin,
  PackageCheck,
} from '@florabot/ui';
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
  const [paymentSeconds, setPaymentSeconds] = useState(300);

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
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const checkoutHeadingRef = useRef<HTMLHeadingElement>(null);
  const pickupHeadingRef = useRef<HTMLHeadingElement>(null);

  const selectedBouquets = DEMO_BOUQUETS.filter((b) => selectedIds.includes(b.id));
  const availableBouquets = DEMO_BOUQUETS.filter((bouquet) =>
    cabinet.slots.some(
      (slot) =>
        slot.bouquetId === bouquet.id && (slot.status === 'AVAILABLE' || slot.status === 'HELD'),
    ),
  );
  const totalAmount = selectedBouquets.reduce((sum, b) => sum + b.price, 0);
  const stage = activeTab === 'pickup' || simulatedPaid ? 2 : simulatedCheckoutOpen ? 1 : 0;
  const showCabinet =
    (activeTab === 'walkin' && !simulatedCheckoutOpen) ||
    simulatedPaid ||
    (activeTab === 'pickup' && pickupResult !== null);
  const paymentTime = `${String(Math.floor(paymentSeconds / 60)).padStart(2, '0')}:${String(paymentSeconds % 60).padStart(2, '0')}`;

  useEffect(() => {
    if (!simulatedCheckoutOpen || simulatedPaid || paymentSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setPaymentSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paymentSeconds, simulatedCheckoutOpen, simulatedPaid]);

  useEffect(() => {
    const heading = simulatedCheckoutOpen ? checkoutHeadingRef.current : pickupHeadingRef.current;
    if (!heading || (!simulatedCheckoutOpen && activeTab !== 'pickup')) return;
    const frame = window.requestAnimationFrame(() => {
      heading.scrollIntoView({ block: 'start', behavior: 'auto' });
      heading.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, simulatedCheckoutOpen]);

  const toggleSelect = (id: string) => {
    const isSelected = selectedIds.includes(id);
    cabinet.holdBouquet(id, !isSelected);
    setSelectedIds((prev) => (isSelected ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const resetPreview = () => {
    setSelectedIds([]);
    setSimulatedCheckoutOpen(false);
    setSimulatedPaid(false);
    setPaymentSeconds(300);
    setPickupCode('');
    setPickupResult(null);
    setPickupTriggered(false);
    setPickupError('');
    setPickupAttempts(0);
    cabinet.resetCabinet();
  };

  const enterPickupDigit = (digit: string) => {
    setPickupCode((current) => {
      const numeric = /^\d*$/.test(current) ? current : '';
      return numeric.length >= 6 ? numeric : `${numeric}${digit}`;
    });
    setPickupError('');
    pickupInputRef.current?.focus();
  };

  const handleSimulatePickup = () => {
    const clean = pickupCode.trim().toUpperCase();
    if (!clean) {
      setPickupError('Vui lòng nhập mã PIN hoặc mã đơn đặt trước.');
      pickupInputRef.current?.focus();
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
          {['Chọn hoa', 'Thanh toán', 'Nhận hoa'].map((label, index) => (
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
        <div className="preview-context-bar">
          <span>
            <MapPin size={16} aria-hidden="true" />
            {SHARED_SHOP_NAME}
          </span>
          <span className="preview-context-status" role="status">
            Chế độ xem mẫu · Không thanh toán thật, không mở khóa tủ thật
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

        {/* Compact Mode Switcher (Tabs) */}
        <div className="kiosk-compact-tabs" role="tablist" aria-label="Lựa chọn phương thức">
          <button
            type="button"
            className={`compact-tab-btn ${activeTab === 'walkin' ? 'active' : ''}`}
            onClick={() => setActiveTab('walkin')}
            aria-selected={activeTab === 'walkin'}
            role="tab"
          >
            <Flower2 size={19} aria-hidden="true" />
            Mua hoa tại chỗ
          </button>
          <button
            type="button"
            className={`compact-tab-btn ${activeTab === 'pickup' ? 'active' : ''}`}
            onClick={() => setActiveTab('pickup')}
            aria-selected={activeTab === 'pickup'}
            role="tab"
          >
            <PackageCheck size={19} aria-hidden="true" />
            Nhận đơn đặt trước
          </button>
        </div>

        <div
          className={`preview-workspace ${simulatedCheckoutOpen || activeTab === 'pickup' ? 'preview-workspace--task' : ''} ${!showCabinet ? 'preview-workspace--solo' : ''}`}
        >
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
                    onClick={() => {
                      setPaymentSeconds(300);
                      setSimulatedCheckoutOpen(true);
                    }}
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
                <header className="task-screen-header">
                  <div>
                    <span className="task-screen-eyebrow">BƯỚC 3 · THANH TOÁN</span>
                    <h1
                      ref={checkoutHeadingRef}
                      id="simulated-checkout-title"
                      tabIndex={-1}
                      aria-label="Mô phỏng quy trình thanh toán"
                    >
                      Thanh toán đơn hoa
                    </h1>
                    <p>Kiểm tra đơn hoa và trải nghiệm bước quét mã thanh toán.</p>
                  </div>
                  <div className="preview-warning-box" role="note">
                    <strong>MÔ PHỎNG: DỮ LIỆU MINH HỌA</strong>
                    <span>Không kết nối payOS · Không trừ tiền · Không mở tủ thật</span>
                  </div>
                </header>

                <div className="simulated-checkout-card">
                  <div className="simulated-order-summary">
                    <div className="simulated-card-heading">
                      <span>ĐƠN HÀNG</span>
                      <strong>{selectedBouquets.length} bó hoa</strong>
                    </div>
                    <ul className="simulated-items-list">
                      {selectedBouquets.map((b) => (
                        <li key={b.id} className="simulated-item-row">
                          <BouquetImage
                            src={b.image}
                            alt=""
                            className="simulated-item-thumb"
                            width={64}
                            height={64}
                          />
                          <span className="simulated-item-copy">
                            <strong>{b.name}</strong>
                            <small>Ô {b.slotCode} · {b.shopName}</small>
                          </span>
                          <strong>{money(b.price)}</strong>
                        </li>
                      ))}
                    </ul>

                    <div className="simulated-total-row">
                      <span>Tổng thanh toán</span>
                      <strong className="simulated-total-amount">{money(totalAmount)}</strong>
                    </div>
                  </div>

                  {!simulatedPaid ? (
                    <div className="simulated-payment-box">
                      <div className="simulated-qr-wrap">
                        <div className="simulated-payment-status">
                          <span><CreditCard size={17} aria-hidden="true" /> Đang chờ thanh toán</span>
                          <strong aria-live="polite">{paymentTime}</strong>
                        </div>
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
                        <span className="simulated-instructions__label">THÔNG TIN GIAO DỊCH</span>
                        <dl className="simulated-code-list">
                          <div><dt>Mã đơn</dt><dd>FB-PREVIEW-261014-01</dd></div>
                          <div><dt>Biên nhận</dt><dd>MINHHOA1</dd></div>
                        </dl>
                        <p className="quiet">
                          Giao diện minh họa: Trên thiết bị thật đã cấu hình, khách quét mã payOS để
                          thanh toán và hệ thống tự động mở chốt ô tủ.
                        </p>

                        <div className="simulated-actions">
                          <Button
                            type="button"
                            aria-label="Mô phỏng thanh toán thành công (Thử nghiệm giao diện)"
                            disabled={paymentSeconds <= 0}
                            onClick={() => {
                              setSimulatedPaid(true);
                              cabinet.startDispensing(
                                selectedBouquets.map((bouquet) => bouquet.slotCode),
                              );
                            }}
                            className="simulate-success-btn"
                          >
                            {paymentSeconds > 0 ? 'Xác nhận thanh toán mẫu' : 'Mã thanh toán đã hết hạn'}
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
                <header className="task-screen-header">
                  <div>
                    <span className="task-screen-eyebrow">NHẬN HOA ĐẶT TRƯỚC</span>
                    <h1
                      ref={pickupHeadingRef}
                      id="pickup-heading"
                      aria-label="Nhận đơn đặt trước tại tủ (Mô phỏng)"
                      tabIndex={-1}
                    >
                      Nhập mã để mở ô nhận hoa
                    </h1>
                    <p>Dùng PIN 6 số hoặc mã biên nhận từ website FloraBot.</p>
                  </div>
                  <div className="camera-privacy-notice" role="note">
                    <strong>Camera đang tắt</strong>
                    <span>Camera trên kiosk không tự động kích hoạt.</span>
                  </div>
                </header>

                <div className="preview-pickup-card">
                  <div className="pickup-entry-panel">
                    <div className="pickup-entry-form">
                      <div className="pickup-method-badge">
                        <KeyRound size={18} aria-hidden="true" />
                        Nhập mã bảo mật
                      </div>
                      <label htmlFor="preview-pin-input">Mã PIN hoặc mã biên nhận</label>
                      <div className="preview-input-group">
                        <input
                          ref={pickupInputRef}
                          id="preview-pin-input"
                          type="text"
                          aria-label="Mã PIN hoặc Mã biên nhận nhận hoa"
                          inputMode="text"
                          autoComplete="off"
                          placeholder="PRE26101 hoặc 123456"
                          value={pickupCode}
                          onChange={(e) => {
                            setPickupCode(e.target.value);
                            if (pickupError) setPickupError('');
                          }}
                          onBlur={() => {
                            if (!pickupCode.trim()) {
                              setPickupError('Vui lòng nhập mã PIN hoặc mã đơn đặt trước.');
                            }
                          }}
                          maxLength={20}
                          aria-invalid={!!pickupError}
                          aria-describedby={pickupError ? 'preview-pin-error' : undefined}
                        />
                        <Button type="button" onClick={handleSimulatePickup}>
                          Kiểm tra mã đơn
                        </Button>
                      </div>

                      {pickupError && (
                        <p id="preview-pin-error" role="alert" className="error">
                          {pickupError}
                        </p>
                      )}

                      <p className="pickup-security-hint">
                        Mã chỉ được dùng để xác nhận đúng đơn và đúng ô tủ. Tối đa 3 lần thử.
                      </p>
                    </div>

                    <div className="pickup-keypad" aria-label="Bàn phím nhập PIN">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          aria-label={`Nhập số ${digit}`}
                          onClick={() => enterPickupDigit(String(digit))}
                        >
                          {digit}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="pickup-keypad__utility"
                        aria-label="Xóa toàn bộ mã"
                        onClick={() => {
                          setPickupCode('');
                          setPickupError('');
                          pickupInputRef.current?.focus();
                        }}
                      >
                        Xóa
                      </button>
                      <button type="button" aria-label="Nhập số 0" onClick={() => enterPickupDigit('0')}>
                        0
                      </button>
                      <button
                        type="button"
                        className="pickup-keypad__utility"
                        aria-label="Xóa ký tự cuối"
                        onClick={() => {
                          setPickupCode((current) => current.slice(0, -1));
                          setPickupError('');
                          pickupInputRef.current?.focus();
                        }}
                      >
                        <Delete size={22} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <details className="quick-demo-pins">
                    <summary>Dùng dữ liệu thử</summary>
                    <div>
                      <button
                        type="button"
                        className="pin-chip"
                        aria-label="PRE26101 (Hướng dương + thiệp)"
                        onClick={() => {
                          setPickupCode('PRE26101');
                          setPickupError('');
                        }}
                      >
                        <strong>PRE26101</strong>
                        <small>Hướng dương + thiệp</small>
                      </button>
                      <button
                        type="button"
                        className="pin-chip"
                        aria-label="123456 (Đơn đặt trước mẫu)"
                        onClick={() => {
                          setPickupCode('123456');
                          setPickupError('');
                        }}
                      >
                        <strong>123456</strong>
                        <small>Đơn đặt trước mẫu</small>
                      </button>
                    </div>
                  </details>

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

          {showCabinet && (
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
          )}
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
