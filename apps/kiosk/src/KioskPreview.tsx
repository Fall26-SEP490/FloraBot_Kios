import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Flower2, MapPin, Minus, Plus } from '@florabot/ui';
import { flowerPhotos } from '@florabot/ui/flower-photos';
import './preview.css';

type PreviewItem = {
  id: string;
  name: string;
  shop: string;
  price: number;
  photo: string;
  alt: string;
  label: string;
};
type CatalogItem = {
  productId: string;
  kioskId: string;
  name: string;
  shopName: string;
  price: number;
  photo: string | null;
};
type PublicKiosk = { id: string; name: string; address: string; status: string };
type Step = 'browse' | 'review' | 'payment' | 'pickup' | 'finish';
const website =
  import.meta.env.VITE_WEB_URL ||
  (import.meta.env.DEV ? 'http://localhost:8088' : window.location.origin);
const samples: PreviewItem[] = [
  {
    id: 'sample-pastel',
    name: 'Một chút dịu dàng',
    shop: 'Bộ sưu tập minh họa',
    price: 350000,
    photo: flowerPhotos.pastelBouquet.src,
    alt: flowerPhotos.pastelBouquet.alt,
    label: 'Sắc hồng',
  },
  {
    id: 'sample-tulip',
    name: 'Lời thương màu hồng',
    shop: 'Bộ sưu tập minh họa',
    price: 420000,
    photo: flowerPhotos.pinkTulip.src,
    alt: flowerPhotos.pinkTulip.alt,
    label: 'Tulip',
  },
  {
    id: 'sample-sun',
    name: 'Gửi một ngày nắng',
    shop: 'Bộ sưu tập minh họa',
    price: 290000,
    photo: flowerPhotos.sunflowers.src,
    alt: flowerPhotos.sunflowers.alt,
    label: 'Rực rỡ',
  },
  {
    id: 'sample-red',
    name: 'Điều muốn nói',
    shop: 'Bộ sưu tập minh họa',
    price: 490000,
    photo: flowerPhotos.redRoses.src,
    alt: flowerPhotos.redRoses.alt,
    label: 'Sắc đỏ',
  },
  {
    id: 'sample-white',
    name: 'Nhẹ nhàng bên nhau',
    shop: 'Bộ sưu tập minh họa',
    price: 380000,
    photo: flowerPhotos.whiteRose.src,
    alt: flowerPhotos.whiteRose.alt,
    label: 'Thanh lịch',
  },
  {
    id: 'sample-lily',
    name: 'Một lời cảm ơn',
    shop: 'Bộ sưu tập minh họa',
    price: 450000,
    photo: flowerPhotos.pinkLilies.src,
    alt: flowerPhotos.pinkLilies.alt,
    label: 'Sắc hồng',
  },
];
const currency = (value: number) => value.toLocaleString('vi-VN') + ' ₫';
async function readPublic<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'omit', cache: 'no-store', signal });
  if (!response.ok) throw new Error('Chưa đọc được dữ liệu backend.');
  return response.json() as Promise<T>;
}
function safeImage(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

export default function KioskPreview({ onSetup }: { onSetup: () => void }) {
  const [step, setStep] = useState<Step>('browse');
  const [source, setSource] = useState<'sample' | 'api'>('sample');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const [kioskId, setKioskId] = useState('');
  const [basket, setBasket] = useState<PreviewItem[]>([]);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const catalog = useQuery({
    queryKey: ['preview-public-catalog'],
    queryFn: ({ signal }) =>
      readPublic<{ items: CatalogItem[]; hasMore: boolean }>('/shop/catalog?page=1', signal),
    enabled: source === 'api',
    retry: false,
  });
  const kiosks = useQuery({
    queryKey: ['preview-public-kiosks'],
    queryFn: ({ signal }) => readPublic<PublicKiosk[]>('/kiosks', signal),
    enabled: source === 'api',
    retry: false,
  });
  const apiItems: PreviewItem[] = (catalog.data?.items ?? [])
    .filter(
      (item) =>
        (!kioskId || item.kioskId === kioskId) &&
        Number.isSafeInteger(item.price) &&
        item.price > 0,
    )
    .map((item) => ({
      id: `${item.productId}:${item.kioskId}`,
      name: item.name,
      shop: item.shopName,
      price: item.price,
      photo: safeImage(item.photo) ?? flowerPhotos.pastelBouquet.src,
      alt: item.photo ? item.name : 'Ảnh hoa tham khảo, không phải ảnh sản phẩm này',
      label: 'Danh mục website',
    }));
  const items = (source === 'sample' ? samples : apiItems).filter(
    (item) =>
      `${item.name} ${item.label} ${item.shop}`
        .toLocaleLowerCase('vi-VN')
        .includes(search.toLocaleLowerCase('vi-VN')) &&
      (category === 'Tất cả' || item.label === category),
  );
  const total = basket.reduce((sum, item) => sum + item.price, 0);
  const safeTotal = Number.isSafeInteger(total);
  const location = kiosks.data?.find((item) => item.id === kioskId);
  function go(next: Step) {
    setStep(next);
    setError('');
    requestAnimationFrame(() => heading.current?.focus());
  }
  function reset() {
    setBasket([]);
    setMessage('');
    setCode('');
    setSearch('');
    setCategory('Tất cả');
    go('browse');
  }
  function chooseSource(next: 'sample' | 'api') {
    setSource(next);
    setBasket([]);
    setCategory('Tất cả');
    setKioskId('');
  }
  const stage = step === 'browse' ? 0 : step === 'review' ? 1 : step === 'payment' ? 2 : 3;
  return (
    <div className="kp-shell">
      <header className="kp-header">
        <a href={`${website}/`} className="kp-brand">
          <Flower2 size={30} aria-hidden="true" />
          FloraBot<span>.</span>
        </a>
        <ol className="kp-top-steps" aria-label="Các màn hình xem thử">
          {['Chọn hoa', 'Xem giỏ', 'Thanh toán', 'Nhận hoa'].map((label, index) => (
            <li key={label} aria-current={stage === index ? 'step' : undefined}>
              <span>{index < stage ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <span className="kp-preview-badge">Bản xem thử · Chưa có IoT</span>
      </header>
      <main id="main" className="kp-main">
        <div className="kp-location">
          <span>
            <MapPin size={16} aria-hidden="true" />
            {location
              ? `${location.name} · ${location.status === 'ONLINE' ? 'Backend ghi nhận online' : 'Chưa sẵn sàng nhận hàng'}`
              : 'Không gian kiosk minh họa'}
          </span>
          <button onClick={reset}>Bắt đầu lại</button>
        </div>
        {step === 'browse' ? (
          <>
            <section className="kp-hero">
              <div>
                <p className="kp-eyebrow">MỘT CHÚT HOA, MỘT CHÚT THƯƠNG</p>
                <h1 ref={heading} tabIndex={-1}>
                  Hôm nay, bạn muốn
                  <br />
                  gửi tặng điều gì?
                </h1>
                <p>
                  Chạm để chọn một mẫu hoa bạn thích.
                  <br />
                  Khám phá trải nghiệm tại tủ ngay trên màn hình.
                </p>
                <span className="kp-hero-tag">Hoa giả · Thiết kế để giữ lại yêu thương</span>
              </div>
              <img src={flowerPhotos.pastelBouquet.src} alt={flowerPhotos.pastelBouquet.alt} />
            </section>
            <div className="kp-workspace">
              <section className="kp-products" aria-labelledby="kp-products-title">
                <div className="kp-section-heading">
                  <div>
                    <p className="kp-eyebrow">CHỌN MỘT NIỀM VUI</p>
                    <h2 id="kp-products-title">Một bó hoa dành cho bạn</h2>
                  </div>
                  <span>{items.length} mẫu đang xem</span>
                </div>
                <div className="kp-source-tabs" aria-label="Nguồn dữ liệu">
                  <button aria-pressed={source === 'sample'} onClick={() => chooseSource('sample')}>
                    Mẫu giao diện
                  </button>
                  <button aria-pressed={source === 'api'} onClick={() => chooseSource('api')}>
                    Danh mục API
                  </button>
                </div>
                <p className="kp-data-note" role="note">
                  {source === 'sample'
                    ? 'Ảnh và giá minh họa để xem UI, không phải tồn kho hoặc giao dịch thật.'
                    : 'Đọc danh mục website từ BE, không đại diện tồn kho WALK_IN. Chỉ GET công khai, không tạo đơn hoặc gửi lệnh tủ.'}
                </p>
                <div className="kp-search">
                  <label htmlFor="kp-search">Tìm mẫu hoa</label>
                  <input
                    id="kp-search"
                    type="search"
                    placeholder="Tên hoa, sắc màu, shop…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {source === 'api' && (
                    <>
                      <label htmlFor="kp-kiosk">Lọc theo kiosk</label>
                      <select
                        id="kp-kiosk"
                        value={kioskId}
                        onChange={(event) => {
                          setKioskId(event.target.value);
                          setBasket([]);
                        }}
                      >
                        <option value="">Tất cả kiosk trong trang danh mục</option>
                        {kiosks.data?.map((kiosk) => (
                          <option key={kiosk.id} value={kiosk.id}>
                            {kiosk.name}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
                {source === 'sample' && (
                  <div className="kp-categories" aria-label="Sắc hoa">
                    {['Tất cả', 'Sắc hồng', 'Rực rỡ', 'Thanh lịch', 'Sắc đỏ'].map((label) => (
                      <button
                        key={label}
                        aria-pressed={category === label}
                        onClick={() => setCategory(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {source === 'api' && (catalog.isPending || kiosks.isPending) ? (
                  <p role="status" className="kp-empty">
                    Đang đọc danh mục từ backend…
                  </p>
                ) : source === 'api' && (catalog.isError || kiosks.isError) ? (
                  <div className="kp-empty" role="alert">
                    <p>Chưa kết nối được danh mục API. Không dùng mẫu để thay thế kết quả thật.</p>
                    <button
                      className="kp-secondary"
                      onClick={() => {
                        void catalog.refetch();
                        void kiosks.refetch();
                      }}
                    >
                      Thử đọc lại
                    </button>
                  </div>
                ) : !items.length ? (
                  <div className="kp-empty" role="status">
                    <Flower2 size={30} aria-hidden="true" />
                    <p>Chưa có mẫu hoa phù hợp.</p>
                    <p>
                      {source === 'api'
                        ? 'Shop cần có mẫu hợp lệ và kiosk đủ điều kiện để xuất hiện trong danh mục.'
                        : 'Thử một từ khóa hoặc sắc hoa khác nhé.'}
                    </p>
                  </div>
                ) : (
                  <ul className="kp-grid">
                    {items.map((item) => {
                      const selected = basket.some((row) => row.id === item.id);
                      return (
                        <li key={item.id} className="kp-product">
                          <div className="kp-photo">
                            <img
                              src={item.photo}
                              alt={item.alt}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                            <span>{item.label}</span>
                          </div>
                          <div className="kp-product-body">
                            <p>{item.shop}</p>
                            <h3>{item.name}</h3>
                            <div>
                              <strong>{currency(item.price)}</strong>
                              <button
                                aria-label={`${selected ? 'Bỏ' : 'Chọn'} ${item.name}`}
                                aria-pressed={selected}
                                onClick={() =>
                                  setBasket((current) =>
                                    selected
                                      ? current.filter((row) => row.id !== item.id)
                                      : [...current, item],
                                  )
                                }
                              >
                                {selected ? (
                                  <Check size={21} aria-hidden="true" />
                                ) : (
                                  <Plus size={21} aria-hidden="true" />
                                )}
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {source === 'api' && catalog.data?.hasMore && (
                  <p className="kp-data-note">
                    Đang xem trang đầu danh mục API; còn sản phẩm ở các trang tiếp theo. Xem đầy đủ
                    tại <a href={`${website}/dat-hoa`}>website</a>.
                  </p>
                )}
              </section>
              <aside className="kp-basket" aria-labelledby="kp-basket-title">
                <div className="kp-basket-heading">
                  <h2 id="kp-basket-title">Bó hoa của bạn</h2>
                  <span>{basket.length}</span>
                </div>
                {basket.length ? (
                  <ul>
                    {basket.map((item) => (
                      <li key={item.id}>
                        <img src={item.photo} alt="" />
                        <div>
                          <strong>{item.name}</strong>
                          <span>{currency(item.price)}</span>
                        </div>
                        <button
                          aria-label={`Bỏ ${item.name} khỏi giỏ`}
                          onClick={() =>
                            setBasket((current) => current.filter((row) => row.id !== item.id))
                          }
                        >
                          <Minus size={17} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="kp-basket-empty">
                    <Flower2 size={38} aria-hidden="true" />
                    <p>Giỏ đang chờ một chút sắc màu.</p>
                    <span>Chọn dấu + trên mẫu hoa bạn thích.</span>
                  </div>
                )}
                <div className="kp-basket-total">
                  <span>Tổng tham khảo</span>
                  <strong>{safeTotal ? currency(total) : 'Vượt giới hạn'}</strong>
                </div>
                <button
                  className="kp-primary"
                  disabled={!basket.length || !safeTotal}
                  onClick={() => go('review')}
                >
                  Xem giỏ hoa <ArrowRight size={19} aria-hidden="true" />
                </button>
                <p>Chỉ xem thử. Chưa thu tiền, giữ hàng hoặc mở ô tủ.</p>
                <button className="kp-pickup-link" onClick={() => go('pickup')}>
                  Xem màn hình nhập mã nhận hoa
                </button>
              </aside>
            </div>
          </>
        ) : (
          <section className="kp-flow">
            <button className="kp-back" onClick={() => go('browse')}>
              ← Quay về chọn hoa
            </button>
            <p className="kp-eyebrow">TRẢI NGHIỆM MINH HỌA</p>
            <h1 ref={heading} tabIndex={-1}>
              {step === 'review'
                ? 'Gói ghém một chút yêu thương.'
                : step === 'payment'
                  ? 'Màn hình thanh toán'
                  : step === 'pickup'
                    ? 'Hoa của bạn ở ngay đây.'
                    : 'Cảm ơn bạn đã ghé xem.'}
            </h1>
            {step === 'review' && (
              <div className="kp-review-layout">
                <div>
                  <ul className="kp-review-items">
                    {basket.map((item) => (
                      <li key={item.id}>
                        <img src={item.photo} alt="" />
                        <div>
                          <strong>{item.name}</strong>
                          <p>{item.shop}</p>
                        </div>
                        <strong>{currency(item.price)}</strong>
                      </li>
                    ))}
                  </ul>
                  <label htmlFor="kp-message">Một lời nhắn nhỏ (tùy chọn)</label>
                  <textarea
                    id="kp-message"
                    value={message}
                    onChange={(event) =>
                      setMessage(Array.from(event.target.value).slice(0, 150).join(''))
                    }
                    placeholder="Gửi một lời thương…"
                  />
                  <span className="kp-data-note">
                    {Array.from(message).length}/150 ký tự · chỉ lưu tạm trên màn hình
                  </span>
                </div>
                <div className="kp-review-summary">
                  <h2>Đối chiếu giỏ xem thử</h2>
                  <p>{basket.length} mẫu hoa</p>
                  <strong>{currency(total)}</strong>
                  <p>
                    Giá hiển thị chưa được xác nhận bằng checkout thật. Không phát sinh đơn hoặc
                    khoản thanh toán.
                  </p>
                  <button className="kp-primary" onClick={() => go('payment')}>
                    Xem bước thanh toán <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
            {step === 'payment' && (
              <div className="kp-payment-layout">
                <div className="kp-payment-placeholder">
                  <Flower2 size={60} aria-hidden="true" />
                  <strong>Vị trí mã thanh toán</strong>
                  <span>Chưa tạo QR hoặc liên kết payOS</span>
                </div>
                <div>
                  <h2>Thanh toán khi hệ thống sẵn sàng</h2>
                  <p>
                    Tổng giỏ xem thử: <strong>{currency(total)}</strong>
                  </p>
                  <p>
                    Trong hệ thống thật, backend tạo checkout và xác minh thanh toán. Phiên này chưa
                    có thiết bị IoT và không gửi yêu cầu thanh toán.
                  </p>
                  <div className="kp-callout">
                    Không cần quét mã hay chuyển khoản cho bản xem thử.
                  </div>
                  <button className="kp-primary" onClick={() => go('pickup')}>
                    Xem màn hình nhận hoa <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
            {step === 'pickup' && (
              <div className="kp-pickup-layout">
                <div
                  className="kp-cabinet"
                  role="img"
                  aria-label="Mô hình sáu ô tủ, ô A02 được đánh dấu để minh họa"
                >
                  <div className="kp-cabinet-brand">
                    <Flower2 size={24} aria-hidden="true" />
                    FloraBot
                  </div>
                  <div>
                    {['A01', 'A02', 'A03', 'B01', 'B02', 'B03'].map((slot, index) => (
                      <span key={slot} className={slot === 'A02' ? 'kp-slot-highlight' : ''}>
                        <img src={samples[index].photo} alt="" />
                        <small>{slot}</small>
                      </span>
                    ))}
                  </div>
                  <p>Mô hình giao diện · không điều khiển khóa</p>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (code.toUpperCase() !== 'DEMO2026') {
                      setError(
                        'Nhập mã minh họa DEMO2026 để xem màn cuối. Mã biên nhận thật không dùng ở đây.',
                      );
                      return;
                    }
                    go('finish');
                  }}
                >
                  <h2>Nhập mã để xem bước cuối</h2>
                  <p>
                    Dùng mã <strong>DEMO2026</strong>. Đây không phải mã nhận hàng hoặc tra cứu đơn
                    thật.
                  </p>
                  <label htmlFor="kp-pickup-code">Mã minh họa</label>
                  <input
                    id="kp-pickup-code"
                    value={code}
                    maxLength={8}
                    autoComplete="off"
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    aria-describedby="kp-code-error"
                    aria-invalid={Boolean(error)}
                  />
                  <p id="kp-code-error" role="alert">
                    {error}
                  </p>
                  <button className="kp-primary" type="submit">
                    Xem màn hoàn tất <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </form>
              </div>
            )}
            {step === 'finish' && (
              <div className="kp-finish">
                <span>
                  <Flower2 size={48} aria-hidden="true" />
                </span>
                <h2>Bản xem trước đã hoàn tất</h2>
                <p>
                  Không có cửa tủ nào được mở, không có đơn hàng hay khoản thu nào được tạo. Khi có
                  IoT thật, trạng thái nhận hoa sẽ do backend và cảm biến xác nhận.
                </p>
                <button className="kp-primary" onClick={reset}>
                  Khám phá thêm mẫu hoa
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      <footer className="kp-footer">
        <p>
          <Flower2 size={17} aria-hidden="true" />
          Một chút hoa cho ngày thêm dịu dàng.
        </p>
        <button onClick={onSetup}>Về màn thiết lập thiết bị</button>
        <a href={`${website}/dat-hoa`}>
          Mở website đặt hoa <ArrowRight size={15} aria-hidden="true" />
        </a>
      </footer>
      {basket.length > 0 && step === 'browse' && (
        <button className="kp-mobile-basket" onClick={() => go('review')}>
          <span>
            {basket.length} mẫu · {safeTotal ? currency(total) : 'Vượt giới hạn'}
          </span>
          Xem giỏ <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
