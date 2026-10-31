import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import {
  Button,
  Flower2,
  PackageCheck,
  ShieldCheck,
  Zap,
  ArrowRight,
  MapPin,
  ShoppingCart,
  X,
} from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import {
  ApiError,
  mapSetupError,
  queryClient,
  request,
  type Checkout,
  type CustomerSession,
  type Device,
  type PaymentLink,
} from './api';
import CustomerLogin from './CustomerLogin';
import CustomerAccount from './CustomerAccount';
import PointRedemption from './PointRedemption';
import GiftMessage from './GiftMessage';
import PickupRecovery from './PickupRecovery';
import GiftAdvisor from './GiftAdvisor';
import BouquetImage, { getBouquetImageUrl } from './BouquetImage';
import PreviewMode from './PreviewMode';
import KioskHome, { KioskHeader, portalUrl } from './KioskHome';
import PreorderPickup from './PreorderPickup';
import DeviceSupport from './DeviceSupport';
import { useKioskLanguage } from './kiosk-language';
import { KioskBrand, KioskSteps, KioskFooter } from './KioskIdentity';
import '@fontsource/lora/vietnamese-400.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/vietnamese-400-italic.css';
import '@fontsource/lora/latin-400-italic.css';
import '@fontsource/nunito/vietnamese-800.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@florabot/ui/tokens.css';
import './style.css';
import './tablet.css';
import './boutique.css';
import './kiosk-home.css';

void i18n.use(initReactI18next).init({
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
  resources: {
    en: {
      translation: {
        title: 'A bouquet, a brighter day.',
        intro: 'Choose flowers, pay and collect at the locker.',
        offline: 'The kiosk is offline. Please wait for the connection before buying.',
        reset: 'End this visit',
        retry: 'Try again',
        loading: 'Checking available flowers…',
      },
    },
    vi: {
      translation: {
        title: 'Một bó hoa, một ngày vui.',
        intro: 'Chọn hoa trong tủ, thanh toán rồi nhận ngay tại ô.',
        offline:
          'Tủ đang mất kết nối. Bạn có thể xem màn hình, nhưng hãy đợi kết nối lại trước khi mua.',
        reset: 'Kết thúc lượt mua',
        retry: 'Thử lại',
        loading: 'Đang kiểm tra hoa trong tủ…',
      },
    },
  },
});
const setupSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'Nhập mã kiosk hợp lệ (định dạng UUID, ví dụ: 40000000-0000-0000-0000-000000000001).',
    ),
  key: z
    .string()
    .trim()
    .min(8, 'Khóa thiết bị (API key) cần ít nhất 8 ký tự.')
    .max(256, 'Khóa thiết bị (API key) không được vượt quá 256 ký tự.'),
});
const money = (amount: string | number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));
function receiptUrl(id: string, token: string) {
  const base = import.meta.env.VITE_RECEIPT_URL || portalUrl('/receipt');
  const url = new URL(base, window.location.origin);
  url.hash = new URLSearchParams({ order: id, token }).toString();
  return url.toString();
}
const stateNames: Record<string, string> = {
  AWAITING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã nhận tiền, chờ mở tủ',
  DISPENSING: 'Tủ đang mở, mời bạn nhận hoa',
  COMPLETED: 'Đã nhận hoa',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết thời gian giữ hoa',
  DISPENSE_FAILED: 'Tủ gặp sự cố, vui lòng giữ mã biên nhận',
  REFUNDED: 'Đã hoàn tiền',
  DISPUTED: 'Đang xử lý phản ánh',
};

function Setup({
  onReady,
  onPreview,
}: {
  onReady: (device: Device) => void;
  onPreview: () => void;
}) {
  const [showDeviceKey, setShowDeviceKey] = useState(false);
  const form = useForm<Device>({
    resolver: zodResolver(setupSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });
  const connect = useMutation({
    mutationFn: async (device: Device) => {
      const trimmedDevice: Device = {
        id: device.id.trim(),
        key: device.key.trim(),
      };
      try {
        await request(trimmedDevice, '/catalog/items');
        return trimmedDevice;
      } catch (error) {
        throw new Error(mapSetupError(error));
      }
    },
    onSuccess: (device) => {
      sessionStorage.setItem('florabot-device', JSON.stringify(device));
      onReady(device);
    },
  });
  return (
    <main id="main" className="setup setup-container fb-setup">
      <div className="setup-grid">
        {/* Left column: Branded Welcome & Preview trigger */}
        <section className="setup-welcome-col" aria-labelledby="welcome-hero-title">
          <div className="setup-brand-row">
            <KioskBrand />
            <span className="setup-version-pill">CHÀO MỪNG BẠN</span>
          </div>
          <div className="fb-setup-art">
            <img
              src={`${import.meta.env.BASE_URL}images/demo-pastel-bouquet.png`}
              width={440}
              height={440}
              alt="Bó hoa nhân tạo pastel, hình ảnh minh họa"
            />
            <span>Mỗi bó hoa, một lời thương.</span>
          </div>
          <h2
            id="welcome-hero-title"
            className="setup-hero-title"
            aria-label="Hệ thống Tủ Hoa Thông Minh FloraBot"
          >
            Hoa đẹp, <em>ngay bên bạn.</em>
          </h2>
          <p className="setup-hero-desc">
            Chạm để chọn. Trao gửi yêu thương. Khám phá trải nghiệm mua hoa tại tủ FloraBot.
          </p>

          <div className="setup-preview-card">
            <div>
              <span className="setup-preview-eyebrow">KHÔNG CẦN THIẾT BỊ THẬT</span>
              <h3>Trải nghiệm ngay giao diện kiosk</h3>
              <p>Xem danh mục, thanh toán và nhận hoa bằng dữ liệu minh họa an toàn.</p>
            </div>
            <Button
              id="preview-open"
              type="button"
              variant="outline"
              className="setup-preview-button"
              onClick={onPreview}
            >
              Xem giao diện mẫu <ArrowRight size={19} aria-hidden="true" />
            </Button>
          </div>

          <div className="setup-highlights-list">
            <div className="setup-highlight-item">
              <span className="setup-highlight-icon" aria-hidden="true">
                <Flower2 size={22} />
              </span>
              <div>
                <strong>100% Hoa nhân tạo cao cấp</strong>
                <p className="quiet">Bền đẹp, an toàn và luôn sẵn sàng tại tủ.</p>
              </div>
            </div>
            <div className="setup-highlight-item">
              <span className="setup-highlight-icon" aria-hidden="true">
                <Zap size={22} />
              </span>
              <div>
                <strong>Mua tại chỗ không cần đăng nhập</strong>
                <p className="quiet">Chọn hoa có sẵn và thanh toán trực tiếp tại kiosk.</p>
              </div>
            </div>
            <div className="setup-highlight-item">
              <span className="setup-highlight-icon" aria-hidden="true">
                <PackageCheck size={22} />
              </span>
              <div>
                <strong>Nhận đơn bằng PIN / QR</strong>
                <p className="quiet">Mở đúng ô nhận hoa bằng mã đã được cấp.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right column: Staff-only Device Setup Form */}
        <section className="setup-form-col" aria-labelledby="staff-setup-title">
          <div className="staff-indicator-pill" role="note">
            <ShieldCheck size={18} aria-hidden="true" />
            Dành riêng cho nhân viên kỹ thuật
          </div>
          <h1 id="staff-setup-title">Kết nối tủ FloraBot</h1>
          <p className="setup-staff-subtitle">
            Nhập thông tin được cấp để đồng bộ kiosk với hệ thống FloraBot.
          </p>

          <details className="setup-guidance-callout">
            <summary>Xem hướng dẫn lấy mã kết nối</summary>
            <p>
              Mã kiosk là chuỗi định danh duy nhất (UUID/id). Mã hiển thị như{' '}
              <code>K-DEMO-SIM</code> chỉ là nhãn nhận diện dán trên tủ (display code/label), tuyệt
              đối <strong>không phải</strong> khóa bí mật (API key/apiKey). Việc kết nối chỉ xác
              thực giao tiếp API và đồng bộ danh mục, không tự động kích hoạt phần cứng chốt khóa
              tủ.
            </p>
          </details>

          <form
            noValidate
            onSubmit={form.handleSubmit((value) => {
              connect.mutate({
                id: value.id.trim(),
                key: value.key.trim(),
              });
            })}
          >
            <label htmlFor="device-id">Mã kiosk (UUID / ID)</label>
            <p id="device-id-hint" className="setup-field-hint">
              Chuỗi UUID 36 ký tự định danh kiosk (ví dụ: 40000000-0000-0000-0000-000000000001).
            </p>
            <input
              id="device-id"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              {...form.register('id')}
              aria-invalid={!!form.formState.errors.id}
              aria-describedby={
                form.formState.errors.id ? 'device-id-hint device-id-error' : 'device-id-hint'
              }
            />
            {form.formState.errors.id && (
              <p id="device-id-error" className="error">
                {form.formState.errors.id.message}
              </p>
            )}

            <label htmlFor="device-key">Khóa thiết bị (API key / apiKey)</label>
            <p id="device-key-hint" className="setup-field-hint">
              Khóa API key bí mật được cấp cho thiết bị (không dùng mã nhãn dán như K-DEMO-SIM).
            </p>
            <div className="setup-secret-field">
              <input
                id="device-key"
                type={showDeviceKey ? 'text' : 'password'}
                autoComplete="off"
                placeholder="Khóa bí mật API key"
                {...form.register('key')}
                aria-invalid={!!form.formState.errors.key}
                aria-describedby={
                  form.formState.errors.key ? 'device-key-hint device-key-error' : 'device-key-hint'
                }
              />
              <button
                type="button"
                className="setup-secret-toggle"
                aria-label={showDeviceKey ? 'Ẩn API key' : 'Hiện API key'}
                aria-pressed={showDeviceKey}
                onClick={() => setShowDeviceKey((visible) => !visible)}
              >
                {showDeviceKey ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {form.formState.errors.key && (
              <p id="device-key-error" className="error">
                {form.formState.errors.key.message}
              </p>
            )}

            <p role="alert" className="error">
              {connect.error?.message}
            </p>
            <Button type="submit" disabled={connect.isPending}>
              {connect.isPending ? 'Đang kết nối…' : 'Kết nối tủ'}
            </Button>
          </form>

          <p className="quiet setup-privacy-note">
            Khóa thiết bị chỉ được lưu trong phiên trình duyệt này. Kết nối thành công sẽ sử dụng dữ
            liệu thật.
          </p>
        </section>
      </div>
    </main>
  );
}

function Shopping({
  device,
  onReset,
  notice,
  onPrivacyFinish,
}: {
  device: Device;
  onReset: () => void;
  notice: string;
  onPrivacyFinish: (message: string) => void;
}) {
  const { t } = useTranslation();
  const { tr, language } = useKioskLanguage();
  const [online, setOnline] = useState(navigator.onLine);
  const basketDialog = React.useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [accessoriesOpen] = useState(false);
  const [accessoryQuantities] = useState<Record<string, string>>({});
  const [checkoutId, setCheckoutId] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const [idleSoon, setIdleSoon] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [customer, setCustomer] = useState<CustomerSession & { expiresAt: number }>();
  const [accountOpen, setAccountOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [points, setPoints] = useState<number | null>(0);
  const [ecard, setEcard] = useState('');
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setEcard('');
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  const privacyNotice = React.useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice) privacyNotice.current?.focus();
  }, [notice]);
  useEffect(() => {
    if (!customer) return;
    const timeout = window.setTimeout(onReset, Math.max(0, customer.expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [customer, onReset]);
  async function shoppingRequest<T>(path: string, body?: unknown): Promise<T> {
    try {
      return await request<T>(device, path, body, customer?.accessToken);
    } catch (error) {
      if (customer && error instanceof ApiError && error.status === 401) onReset();
      throw error;
    }
  }
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    let lastAction = Date.now();
    const touch = () => {
      lastAction = Date.now();
    };
    const timer = window.setInterval(() => {
      setNow(Date.now());
      setIdleSoon(Date.now() - lastAction >= 540000);
      if (Date.now() - lastAction >= 600000) onReset();
    }, 1000);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
    };
  }, [onReset]);
  const catalog = useQuery({
    queryKey: ['catalog', device.id],
    queryFn: () =>
      request<components['schemas']['KioskCatalogResponse'][]>(device, '/catalog/items'),
    enabled: !checkoutId && online,
    refetchInterval: 15000,
  });
  const accessories = useQuery({
    queryKey: ['accessories', device.id],
    queryFn: () =>
      request<components['schemas']['KioskAccessoryResponse'][]>(device, '/catalog/accessories'),
    enabled: accessoriesOpen && !checkoutId && online,
    refetchInterval: 15000,
  });
  const checkout = useQuery({
    queryKey: ['checkout', checkoutId],
    queryFn: () => shoppingRequest<Checkout>(`/checkouts/${checkoutId}`),
    enabled: !!checkoutId && online,
    refetchInterval: 3000,
  });
  const buy = useMutation({
    mutationFn: () =>
      shoppingRequest<components['schemas']['FlowResult']>('/flows/kiosk_checkout', {
        p_bouquets: selected,
        ...(selectedAccessories.length ? { p_accessories: selectedAccessories } : {}),
        ...(customer ? { p_points: points ?? 0 } : {}),
        ...(ecard.trim() ? { p_ecard: ecard } : {}),
      }),
    onSuccess: (result) => {
      if (typeof result.result !== 'string') {
        setUncertain(true);
        return;
      }
      setCheckoutId(result.result);
      setEcard('');
    },
    onError: (error) => {
      setUncertain(!(error instanceof ApiError && [400, 409].includes(error.status)));
      void catalog.refetch();
      if (accessoriesOpen) void accessories.refetch();
    },
  });
  const payment = useMutation({
    mutationFn: async () => {
      const link = await shoppingRequest<PaymentLink>(`/checkouts/${checkoutId}/payment-link`, {});
      const url = new URL(link.checkoutUrl);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'pay.payos.vn' ||
        url.username ||
        url.password ||
        url.port
      )
        throw new Error('Liên kết thanh toán chưa hợp lệ. Vui lòng thử lại.');
      return link;
    },
  });
  const current = checkout.data;
  const remaining = current
    ? Math.max(0, Math.ceil((new Date(current.payBefore).getTime() - now) / 1000))
    : 0;
  const payable = current?.paymentStatus === 'PENDING' && remaining > 0;
  const available = new Set(catalog.data?.map((item) => item.bouquetId));
  const selectedAccessories = Object.entries(accessoryQuantities)
    .map(([id, value]) => ({ id, qty: Number(value || 0) }))
    .filter((item) => item.qty !== 0);
  const accessoryValid =
    selectedAccessories.length === 0 ||
    (!accessories.isError &&
      selectedAccessories.every((item) => {
        const stock = accessories.data?.find((row) => row.id === item.id);
        return (
          stock &&
          Number.isSafeInteger(item.qty) &&
          item.qty > 0 &&
          item.qty <= Number(stock.stockQuantity) &&
          Number.isSafeInteger(Number(stock.price)) &&
          Number(stock.price) > 0 &&
          Number.isSafeInteger(item.qty * Number(stock.price))
        );
      }));
  const selectionValid =
    (selected.length > 0 || selectedAccessories.length > 0) &&
    selected.every((id) => available.has(id)) &&
    accessoryValid;
  const accessoryTotal = accessoryValid
    ? selectedAccessories.reduce(
        (sum, item) =>
          sum + item.qty * Number(accessories.data?.find((row) => row.id === item.id)?.price),
        0,
      )
    : 0;
  const total =
    (catalog.data
      ?.filter((item) => selected.includes(item.bouquetId))
      .reduce((sum, item) => sum + Number(item.price), 0) || 0) + accessoryTotal;
  if (pickupOpen)
    return (
      <div className="fb-app">
        <header className="fb-header">
          <KioskBrand />
          <KioskSteps stage={2} />
        </header>
        <main id="main" className="fb-main fb-task-main">
          <PickupRecovery
            device={device}
            online={online}
            onExit={onReset}
            onBack={() => {
              setPickupOpen(false);
              requestAnimationFrame(() => document.getElementById('pickup-open')?.focus());
            }}
          />
        </main>
      </div>
    );
  if (accountOpen && customer)
    return (
      <div className="fb-app">
        <KioskHeader onHome={onReset} title={tr('TÀI KHOẢN', 'ACCOUNT')} />
        <main id="main" className="fb-main fb-task-main">
          <CustomerAccount
            device={device}
            token={customer.accessToken}
            canForgetAccount={customer.canForgetAccount}
            online={online}
            onBack={() => {
              setAccountOpen(false);
              requestAnimationFrame(() =>
                document.getElementById('customer-account-open')?.focus(),
              );
            }}
            onExit={onReset}
            onFinish={onPrivacyFinish}
          />
        </main>
      </div>
    );
  return (
    <div className="fb-app">
      <KioskHeader
        onHome={onReset}
        homeDisabled={buy.isPending}
        title={tr('MUA HOA TẠI CHỖ', 'BUY FLOWERS HERE')}
      />
      <div className="ks-progress">
        <KioskSteps
          stage={!checkoutId ? 0 : checkout.data?.paymentStatus === 'SUCCEEDED' ? 2 : 1}
        />
        <Button variant="outline" onClick={onReset} disabled={buy.isPending}>
          {t('reset')}
        </Button>
      </div>
      <main id="main" className="fb-main">
        {notice && !customer && (
          <p ref={privacyNotice} tabIndex={-1} role="status" className="notice">
            {notice}
          </p>
        )}
        {!online && (
          <p role="alert" className="notice">
            {t('offline')}
          </p>
        )}
        {idleSoon && (
          <p role="alert" className="notice">
            Lượt mua sẽ kết thúc trong một phút nếu bạn không thao tác. Chạm hoặc nhấn phím bất kỳ
            để tiếp tục.
          </p>
        )}
        {customer && (
          <p className="customer-session" role="status">
            Đã xác thực số điện thoại.{' '}
            {customer.expiresAt - now <= 60000
              ? 'Phiên sắp hết hạn; hãy giữ lại mã biên nhận nếu bạn đã thanh toán.'
              : 'Chọn “Kết thúc lượt mua” trước khi rời tủ.'}
          </p>
        )}
        {!checkoutId ? (
          <>
            <div className="fb-context">
              <span>
                <MapPin size={16} aria-hidden="true" />{' '}
                {catalog.data?.[0]?.shopName || 'Tủ hoa FloraBot'}
              </span>
              <span>
                {tr('Không cần đăng nhập để mua hoa', 'No account needed to buy flowers')}
              </span>
            </div>
            <div className="ks-catalog-intro">
              <h1>{tr('Chọn một bó hoa bạn thích', 'Find your little joy')}</h1>
              <p>
                {tr(
                  'Mỗi bó hoa tương ứng một ô tủ. Chọn hoa, thêm vào giỏ rồi thanh toán.',
                  'Each bouquet belongs to a locker. Choose your flowers, add to your basket and pay.',
                )}
              </p>
            </div>
            <Button
              id="pickup-open"
              variant="outline"
              disabled={buy.isPending || uncertain}
              onClick={() => {
                setEcard('');
                setPoints(0);
                setPickupOpen(true);
              }}
            >
              {tr('Đã thanh toán nhưng chưa nhận hoa?', 'Paid but have not received your flowers?')}
            </Button>
            <div className="fb-member-tools">
              {!customer && (
                <CustomerLogin
                  device={device}
                  online={online}
                  onReady={(session) =>
                    setCustomer({
                      ...session,
                      expiresAt:
                        Date.now() + Math.min(600, Number(session.expiresInSeconds)) * 1000,
                    })
                  }
                />
              )}
              {customer && (
                <Button
                  id="customer-account-open"
                  variant="outline"
                  disabled={buy.isPending || uncertain}
                  onClick={() => {
                    setPoints(0);
                    setEcard('');
                    setAccountOpen(true);
                  }}
                >
                  {tr(
                    'Lịch sử mua và thông tin cá nhân',
                    'Purchase history and personal information',
                  )}
                </Button>
              )}
            </div>
            <button
              type="button"
              className="fb-cart-trigger"
              aria-haspopup="dialog"
              aria-controls="walkin-basket"
              aria-label={tr(
                `Mở giỏ hoa, ${selected.length} bó`,
                `Open basket, ${selected.length} bouquets`,
              )}
              onClick={() => basketDialog.current?.showModal()}
            >
              <ShoppingCart size={23} aria-hidden="true" />
              <span aria-hidden="true">{selected.length}</span>
            </button>
            <div className="fb-shop-grid">
              <div className="fb-catalog-column">
                <GiftAdvisor
                  onUseMessage={setEcard}
                  key={customer ? 'customer' : 'guest'}
                  request={shoppingRequest}
                  online={online}
                  disabled={buy.isPending || uncertain || catalog.isError}
                  available={available}
                  selected={selected}
                  onSelect={(id) => setSelected((ids) => (ids.includes(id) ? ids : [...ids, id]))}
                />
                <section aria-labelledby="flowers-title">
                  <div className="fb-section-heading">
                    <div>
                      <p className="fb-eyebrow">{tr('CHỌN MỘT NIỀM VUI', 'PICK A LITTLE JOY')}</p>
                      <h2 id="flowers-title">
                        {tr('Hoa đang đợi bạn', 'Flowers waiting for you')}
                      </h2>
                    </div>
                    <span>
                      {catalog.data?.length || 0} {tr('bó có sẵn', 'available')}
                    </span>
                  </div>
                  {catalog.isPending && <p role="status">{t('loading')}</p>}
                  {catalog.isError && (
                    <div>
                      <p role="alert" className="error">
                        {catalog.error.message}
                      </p>
                      <Button onClick={() => void catalog.refetch()} disabled={!online}>
                        {t('retry')}
                      </Button>
                    </div>
                  )}
                  {catalog.data?.length === 0 && (
                    <p role="status">
                      {tr(
                        'Tủ chưa có hoa sẵn sàng. Bạn ghé lại sau nhé.',
                        'No flowers are ready right now. Please come back soon.',
                      )}
                    </p>
                  )}
                  <div className="artificial-flower-pill-notice" role="note">
                    <Flower2 size={17} aria-hidden="true" />{' '}
                    {tr(
                      'Hoa lụa & hoa sáp nghệ thuật · Bền đẹp theo thời gian',
                      'Silk & wax flowers · Made to last',
                    )}
                  </div>
                  <ul className="flowers">
                    {catalog.data?.map((item, idx) => (
                      <li
                        key={item.bouquetId}
                        className={selected.includes(item.bouquetId) ? 'is-selected' : undefined}
                      >
                        <label>
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${item.name} tại ô ${item.slotCode}`}
                            checked={selected.includes(item.bouquetId)}
                            disabled={buy.isPending || uncertain || !online}
                            onChange={(event) =>
                              setSelected((ids) =>
                                event.target.checked
                                  ? [...ids, item.bouquetId]
                                  : ids.filter((id) => id !== item.bouquetId),
                              )
                            }
                          />
                          <span className="fb-product-photo">
                            <BouquetImage
                              src={item.imageUrl || getBouquetImageUrl(item.name, idx)}
                              alt={
                                item.imageUrl
                                  ? item.name
                                  : tr(`Ảnh minh họa ${item.name}`, `Illustration of ${item.name}`)
                              }
                              className="flower-thumb-image"
                              width={400}
                              height={400}
                            />
                            <span className="fb-slot-label">Ô {item.slotCode}</span>
                            <span className="fb-product-selected" aria-hidden="true">
                              {selected.includes(item.bouquetId) ? '✓' : '+'}
                            </span>
                          </span>
                          <span className="flower-item-details">
                            <strong>{item.name}</strong>
                            <span className="shop">
                              {item.shopName} · Ô {item.slotCode}
                            </span>
                            <span className="illustration-caption">
                              {item.imageUrl
                                ? tr('Ảnh từ cửa hàng · Ô', 'Shop photo · Locker')
                                : tr(
                                    'Hình ảnh minh họa · Hoa thực tế tại ô',
                                    'Illustrative image · Actual flowers in locker',
                                  )}{' '}
                              {item.slotCode}
                            </span>
                          </span>
                          <strong className="price">{money(item.price)}</strong>
                        </label>
                      </li>
                    ))}
                  </ul>
                  {selected.some((id) => !available.has(id)) && (
                    <p role="status">
                      Có bó hoa vừa hết lượt mua. Vui lòng chọn lại từ danh sách hiện tại.
                    </p>
                  )}
                </section>
                <p className="fb-accessory-note">
                  {tr(
                    'Bó hoa mua tại chỗ đã được chuẩn bị sẵn. Phụ kiện đi kèm chỉ áp dụng cho đơn đặt trước.',
                    'Walk-in bouquets are ready to collect. Accessories are prepared for preorders only.',
                  )}
                </p>
              </div>
              <dialog
                ref={basketDialog}
                id="walkin-basket"
                className="basket fb-basket"
                aria-labelledby="walkin-basket-title"
                onCancel={(event) => {
                  if (buy.isPending) event.preventDefault();
                }}
              >
                <header className="fb-cart-heading">
                  <div>
                    <p className="fb-eyebrow">{tr('MÓN QUÀ CỦA BẠN', 'YOUR LITTLE GIFT')}</p>
                    <h2 id="walkin-basket-title">{tr('Giỏ hoa', 'Your basket')}</h2>
                  </div>
                  <button
                    type="button"
                    className="fb-cart-close"
                    disabled={buy.isPending}
                    aria-label={tr('Đóng giỏ hoa', 'Close basket')}
                    onClick={() => basketDialog.current?.close()}
                  >
                    <X size={22} aria-hidden="true" />
                  </button>
                </header>
                {selected.length === 0 ? (
                  <div className="fb-basket-empty">
                    <Flower2 size={38} strokeWidth={1} aria-hidden="true" />
                    <strong>{tr('Một niềm vui đang đợi', 'A little joy awaits')}</strong>
                    <p>
                      {tr(
                        'Chạm vào bó hoa bạn yêu thích để thêm vào giỏ nhé.',
                        'Touch a bouquet you love to add it to your basket.',
                      )}
                    </p>
                  </div>
                ) : (
                  <ul className="fb-basket-items">
                    {catalog.data
                      ?.filter((item) => selected.includes(item.bouquetId))
                      .map((item) => (
                        <li key={item.bouquetId}>
                          <span>
                            {item.name}
                            <small>Ô {item.slotCode}</small>
                          </span>
                          <strong>{money(item.price)}</strong>
                        </li>
                      ))}
                  </ul>
                )}
                <p className="fb-basket-total">
                  {selected.length} {tr('bó đã chọn', 'selected')}
                  {selectedAccessories.length > 0
                    ? ` · ${selectedAccessories.length} loại phụ kiện`
                    : ''}{' '}
                  · <strong>{money(total)}</strong>
                </p>
                <p className="quiet">
                  {tr(
                    'Giá và tình trạng hàng sẽ được xác nhận khi giữ giỏ.',
                    'Price and availability are confirmed when reserving your basket.',
                  )}
                </p>
                {customer && (
                  <PointRedemption
                    device={device}
                    token={customer.accessToken}
                    online={online}
                    disabled={buy.isPending || uncertain}
                    onChange={setPoints}
                    onExit={onReset}
                  />
                )}
                <GiftMessage
                  value={ecard}
                  onChange={setEcard}
                  disabled={!online || buy.isPending || uncertain}
                />
                <Button
                  disabled={
                    !online ||
                    !selectionValid ||
                    !Number.isSafeInteger(total) ||
                    points === null ||
                    Array.from(ecard).length > 150 ||
                    buy.isPending ||
                    uncertain ||
                    (selected.length > 0 && catalog.isError)
                  }
                  onClick={() => buy.mutate()}
                >
                  {buy.isPending
                    ? tr('Đang giữ hoa…', 'Reserving flowers…')
                    : tr('Giữ hoa và thanh toán', 'Reserve and pay')}
                </Button>
                {buy.isError && !uncertain && (
                  <p role="alert" className="error">
                    {buy.error.message} Bạn có thể điều chỉnh giỏ hoặc số điểm rồi thử lại.
                  </p>
                )}
                {uncertain && (
                  <p role="alert" className="error">
                    Chưa xác nhận được giỏ. Để tránh tạo giỏ trùng, hãy kết thúc lượt này; hoa đã
                    giữ sẽ được hệ thống trả lại khi hết hạn.
                  </p>
                )}
                <p className="fb-checkout-note">
                  <ShieldCheck size={15} aria-hidden="true" />{' '}
                  {tr('Thanh toán an toàn qua payOS', 'Secure payment via payOS')}
                </p>
              </dialog>
            </div>
          </>
        ) : (
          <section className="checkout fb-checkout" aria-labelledby="checkout-title">
            <h1 id="checkout-title">
              {tr('Một chút nữa là hoa đến tay bạn.', 'Your flowers are almost yours.')}
            </h1>
            {checkout.isPending && (
              <p role="status">{tr('Đang lấy thông tin giỏ hoa…', 'Loading your basket…')}</p>
            )}
            {checkout.isError && (
              <div>
                <p role="alert" className="error">
                  {checkout.error.message}
                </p>
                <Button onClick={() => void checkout.refetch()} disabled={!online}>
                  {t('retry')}
                </Button>
              </div>
            )}
            {current && (
              <>
                <p className="total">
                  {tr('Tổng thanh toán:', 'Total to pay:')} <strong>{money(current.amount)}</strong>
                </p>
                {current.orders.some((order) => Number(order.pointsRedeemed) > 0) && (
                  <p>
                    Giỏ hoa đã áp dụng điểm tích lũy. Chi tiết tiền giảm nằm trong từng biên nhận
                    bên dưới.
                  </p>
                )}
                {payable && (
                  <>
                    <p>
                      {tr('Thời gian còn lại:', 'Time remaining:')} {Math.floor(remaining / 60)}:
                      {String(remaining % 60).padStart(2, '0')}
                    </p>
                    <Button
                      onClick={() => payment.mutate()}
                      disabled={!online || payment.isPending}
                    >
                      {payment.isPending
                        ? tr('Đang tạo liên kết…', 'Creating payment…')
                        : tr('Tạo mã thanh toán', 'Show payment QR')}
                    </Button>
                  </>
                )}
                {current.paymentStatus === 'PENDING' && !payable && (
                  <p role="status">
                    Đã hết thời gian giữ giỏ. Chọn “Kết thúc lượt mua” để bắt đầu lại.
                  </p>
                )}
                {payment.isError && (
                  <p role="alert" className="error">
                    {payment.error.message}
                  </p>
                )}
                {payment.data && payable && online && (
                  <div className="payment-code">
                    <h2>
                      {payment.data.qrCode
                        ? tr('Quét bằng ứng dụng ngân hàng', 'Scan with your banking app')
                        : tr('Quét bằng camera điện thoại', 'Scan with your phone camera')}
                    </h2>
                    <QRCodeSVG
                      value={payment.data.qrCode || payment.data.checkoutUrl}
                      size={224}
                      title={
                        payment.data.qrCode
                          ? tr('Mã QR thanh toán payOS', 'payOS payment QR')
                          : tr('Mã QR mở trang thanh toán payOS', 'QR to open payOS checkout')
                      }
                    />
                    <p>
                      {payment.data.qrCode
                        ? tr(
                            'Quét mã QR để thanh toán qua payOS. Sau khi hệ thống xác nhận tiền, ô tủ sẽ được mở.',
                            'Scan to pay through payOS. The locker will open after the server confirms payment.',
                          )
                        : tr(
                            'Mở trang payOS và làm theo hướng dẫn thanh toán.',
                            'Open payOS and follow the payment instructions.',
                          )}
                    </p>
                    <a href={payment.data.checkoutUrl} target="_blank" rel="noopener noreferrer">
                      {tr('Mở liên kết thanh toán (tab mới)', 'Open payment link (new tab)')}
                    </a>
                  </div>
                )}
                <h2>{tr('Biên nhận của bạn', 'Your receipt')}</h2>
                <p className="quiet">
                  {tr(
                    'Giữ mã đơn và mã biên nhận để tra cứu hoặc báo sự cố. Màn hình sẽ xóa thông tin sau 10 phút không thao tác.',
                    'Keep your order and receipt codes for support. This screen clears after 10 minutes of inactivity.',
                  )}
                </p>
                <ul className="receipts">
                  {current.orders.map((order) => (
                    <li key={order.id}>
                      <h3>{order.orderCode}</h3>
                      <p role="status">
                        {language === 'vi'
                          ? stateNames[order.status] || 'Đang cập nhật trạng thái'
                          : (
                              {
                                AWAITING_PAYMENT: 'Awaiting payment',
                                PAID: 'Payment received · Waiting for locker',
                                DISPENSING: 'Locker opening · Please collect your flowers',
                                COMPLETED: 'Flowers collected',
                                DISPENSE_FAILED: 'Locker issue · Please keep your receipt',
                                REFUNDED: 'Refunded',
                                CANCELLED: 'Cancelled',
                                EXPIRED: 'Expired',
                                DISPUTED: 'Support in progress',
                              } as Record<string, string>
                            )[order.status] || 'Updating status'}
                      </p>
                      <p>
                        {tr('Mã biên nhận:', 'Receipt code:')}{' '}
                        <strong>{order.trackingToken}</strong>
                      </p>
                      <p>{money(order.amount)}</p>
                      {Number(order.pointsRedeemed) > 0 && (
                        <p>
                          Đã dùng {Number(order.pointsRedeemed).toLocaleString('vi-VN')} điểm · Giảm{' '}
                          {money(order.discountAmount)}
                        </p>
                      )}
                      <QRCodeSVG
                        value={receiptUrl(order.id, order.trackingToken)}
                        size={180}
                        marginSize={4}
                        title={`QR tra cứu đơn ${order.orderCode}`}
                      />
                      <p>
                        {tr(
                          'Quét QR để giữ biên nhận trên điện thoại.',
                          'Scan to save your receipt on your phone.',
                        )}
                      </p>
                      {!customer && order.status === 'COMPLETED' && (
                        <p>
                          Đã lưu giao dịch mua thành công. Quét QR bằng điện thoại riêng, mở biên
                          nhận và chọn lưu vào lịch sử để xem lại mà không cần tài khoản.
                        </p>
                      )}
                      <p className="receipt-id">ID biên nhận: {order.id}</p>
                      <a
                        href={receiptUrl(order.id, order.trackingToken)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {tr('Xem biên nhận (tab mới)', 'View receipt (new tab)')}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </main>
      <KioskFooter />
    </div>
  );
}

function App() {
  const [device, setDevice] = useState<Device | null>(() => {
    try {
      const saved = setupSchema.safeParse(
        JSON.parse(sessionStorage.getItem('florabot-device') || 'null'),
      );
      return saved.success ? saved.data : null;
    } catch {
      return null;
    }
  });
  const [previewOpen, setPreviewOpen] = useState(
    () => new URLSearchParams(window.location.search).get('preview') === '1',
  );
  const [screen, setScreen] = useState<'home' | 'shop' | 'pickup'>('home');
  const [visit, setVisit] = useState(0);
  const [notice, setNotice] = useState('');
  const reset = React.useCallback(() => {
    queryClient.clear();
    setNotice('');
    setVisit((value) => value + 1);
    setScreen('home');
    window.scrollTo(0, 0);
  }, []);
  const privacyFinish = React.useCallback(
    (message: string) => {
      reset();
      setNotice(message);
    },
    [reset],
  );

  const support = new URLSearchParams(window.location.search);
  if (support.get('support') === 'device' && /^[0-9a-f-]{36}$/i.test(support.get('kiosk') || ''))
    return <DeviceSupport kioskId={support.get('kiosk')!} />;
  const activeDevice =
    device ||
    (previewOpen ? { id: '00000000-0000-0000-0000-000000000001', key: 'preview-only' } : null);
  if (!activeDevice)
    return (
      <Setup
        onReady={(value) => {
          setDevice(value);
          setScreen('home');
        }}
        onPreview={() => {
          setPreviewOpen(true);
          setScreen('home');
        }}
      />
    );
  if (screen === 'home')
    return (
      <KioskHome
        device={activeDevice}
        preview={previewOpen}
        notice={notice}
        onBuy={() => {
          setScreen('shop');
          window.scrollTo(0, 0);
        }}
        onPickup={() => {
          setScreen('pickup');
          window.scrollTo(0, 0);
        }}
      />
    );
  if (previewOpen)
    return (
      <PreviewMode
        initialTab={screen === 'pickup' ? 'pickup' : 'walkin'}
        onExit={() => {
          setPreviewOpen(false);
          setScreen('home');
        }}
      />
    );
  if (screen === 'pickup')
    return <PreorderPickup key={visit} device={activeDevice} onHome={reset} />;
  return (
    <Shopping
      key={visit}
      device={activeDevice}
      onReset={reset}
      notice={notice}
      onPrivacyFinish={privacyFinish}
    />
  );
}
const root = createRootRoute({
  component: () => (
    <>
      <a className="skip-link" href="#main">
        Bỏ qua tới nội dung
      </a>
      <Outlet />
    </>
  ),
});
const index = createRoute({ getParentRoute: () => root, path: '/', component: App });
const router = createRouter({
  routeTree: root.addChildren([index]),
  basepath: import.meta.env.BASE_URL,
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
