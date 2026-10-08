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
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import {
  ApiError,
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
import AccessoryPicker from './AccessoryPicker';
import GiftAdvisor from './GiftAdvisor';
import '@fontsource/nunito/vietnamese-800.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@florabot/ui/tokens.css';
import './style.css';

void i18n.use(initReactI18next).init({
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
  resources: {
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
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'Nhập mã kiosk hợp lệ.',
    ),
  key: z.string().min(8, 'Khóa thiết bị cần ít nhất 8 ký tự.').max(256),
});
const money = (amount: string | number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));
function receiptUrl(id: string, token: string) {
  const base =
    import.meta.env.VITE_RECEIPT_URL ||
    (import.meta.env.DEV
      ? `${window.location.protocol}//${window.location.hostname}:3010/receipt`
      : '/receipt');
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

function Setup({ onReady }: { onReady: (device: Device) => void }) {
  const form = useForm<Device>({ resolver: zodResolver(setupSchema) });
  const connect = useMutation({
    mutationFn: async (device: Device) => {
      await request(device, '/catalog/items');
      return device;
    },
    onSuccess: (device) => {
      sessionStorage.setItem('florabot-device', JSON.stringify(device));
      onReady(device);
    },
  });
  return (
    <main id="main" className="setup">
      <h1>Kết nối tủ FloraBot</h1>
      <p>Dành cho nhân viên thiết lập thiết bị trước khi đón khách.</p>
      <form noValidate onSubmit={form.handleSubmit((value) => connect.mutate(value))}>
        <label htmlFor="device-id">Mã kiosk</label>
        <input
          id="device-id"
          {...form.register('id')}
          aria-invalid={!!form.formState.errors.id}
          aria-describedby="device-id-error"
        />
        <p id="device-id-error" className="error">
          {form.formState.errors.id?.message}
        </p>
        <label htmlFor="device-key">Khóa thiết bị</label>
        <input
          id="device-key"
          type="password"
          autoComplete="off"
          {...form.register('key')}
          aria-invalid={!!form.formState.errors.key}
          aria-describedby="device-key-error"
        />
        <p id="device-key-error" className="error">
          {form.formState.errors.key?.message}
        </p>
        <p role="alert" className="error">
          {connect.error?.message}
        </p>
        <Button type="submit" disabled={connect.isPending}>
          {connect.isPending ? 'Đang kết nối…' : 'Kết nối tủ'}
        </Button>
      </form>
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
  const [online, setOnline] = useState(navigator.onLine);
  const [selected, setSelected] = useState<string[]>([]);
  const [accessoriesOpen, setAccessoriesOpen] = useState(false);
  const [accessoryQuantities, setAccessoryQuantities] = useState<Record<string, string>>({});
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
      <>
        <header>
          <strong className="brand">FloraBot</strong>
        </header>
        <main id="main">
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
      </>
    );
  if (accountOpen && customer)
    return (
      <>
        <header>
          <strong className="brand">FloraBot</strong>
        </header>
        <main id="main">
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
      </>
    );
  return (
    <>
      <header>
        <strong className="brand">FloraBot</strong>
        <Button variant="outline" onClick={onReset} disabled={buy.isPending}>
          {t('reset')}
        </Button>
      </header>
      <main id="main">
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
            <section className="welcome">
              <div>
                <h1>{t('title')}</h1>
                <p>{t('intro')}</p>
              </div>
              <img
                src={`${import.meta.env.BASE_URL}flowers.avif`}
                width="480"
                height="320"
                alt=""
              />
            </section>
            {!customer && (
              <CustomerLogin
                device={device}
                online={online}
                onReady={(session) =>
                  setCustomer({
                    ...session,
                    expiresAt: Date.now() + Math.min(600, Number(session.expiresInSeconds)) * 1000,
                  })
                }
              />
            )}
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
              Đã thanh toán nhưng chưa nhận hoa?
            </Button>
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
                Lịch sử mua và thông tin cá nhân
              </Button>
            )}
            <GiftAdvisor
              onUseMessage={(message) => {
                setEcard(message);
                requestAnimationFrame(() => document.getElementById('ecard-message')?.focus());
              }}
              key={customer ? 'customer' : 'guest'}
              request={shoppingRequest}
              online={online}
              disabled={buy.isPending || uncertain || catalog.isError}
              available={available}
              selected={selected}
              onSelect={(id) => setSelected((ids) => (ids.includes(id) ? ids : [...ids, id]))}
            />
            <section aria-labelledby="flowers-title">
              <h2 id="flowers-title">Hoa đang đợi bạn</h2>
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
              {catalog.data?.length === 0 && <p>Tủ chưa có hoa sẵn sàng. Bạn ghé lại sau nhé.</p>}
              <ul className="flowers">
                {catalog.data?.map((item) => (
                  <li key={item.bouquetId}>
                    <label>
                      <input
                        type="checkbox"
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
                      <span>
                        <strong>{item.name}</strong>
                        <span className="shop">
                          {item.shopName} · Ô {item.slotCode}
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
            <AccessoryPicker
              items={accessories.data}
              quantities={accessoryQuantities}
              opened={accessoriesOpen}
              loading={accessories.isPending}
              error={accessories.error?.message}
              disabled={!online || buy.isPending || uncertain}
              invalid={!accessoryValid}
              onOpen={() => {
                if (accessoriesOpen) void accessories.refetch();
                else setAccessoriesOpen(true);
              }}
              onChange={(id, value) =>
                setAccessoryQuantities((values) => ({ ...values, [id]: value }))
              }
              onClear={() => setAccessoryQuantities({})}
            />
            <section className="basket" aria-label="Giỏ hoa">
              <p>
                {selected.length} bó đã chọn
                {selectedAccessories.length > 0
                  ? ` · ${selectedAccessories.length} loại phụ kiện`
                  : ''}{' '}
                · <strong>{money(total)}</strong>
              </p>
              <p className="quiet">Giá và tình trạng hàng sẽ được xác nhận khi giữ giỏ.</p>
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
                {buy.isPending ? 'Đang giữ hoa…' : 'Giữ hoa và thanh toán'}
              </Button>
              {buy.isError && !uncertain && (
                <p role="alert" className="error">
                  {buy.error.message} Bạn có thể điều chỉnh giỏ hoặc số điểm rồi thử lại.
                </p>
              )}
              {uncertain && (
                <p role="alert" className="error">
                  Chưa xác nhận được giỏ. Để tránh tạo giỏ trùng, hãy kết thúc lượt này; hoa đã giữ
                  sẽ được hệ thống trả lại khi hết hạn.
                </p>
              )}
            </section>
          </>
        ) : (
          <section className="checkout" aria-labelledby="checkout-title">
            <h1 id="checkout-title">Một chút nữa là hoa đến tay bạn.</h1>
            {checkout.isPending && <p role="status">Đang lấy thông tin giỏ hoa…</p>}
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
                  Tổng thanh toán: <strong>{money(current.amount)}</strong>
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
                      Thời gian còn lại: {Math.floor(remaining / 60)} phút {remaining % 60} giây.
                    </p>
                    <Button
                      onClick={() => payment.mutate()}
                      disabled={!online || payment.isPending}
                    >
                      {payment.isPending ? 'Đang tạo liên kết…' : 'Tạo mã thanh toán'}
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
                    <h2>Quét bằng camera điện thoại</h2>
                    <QRCodeSVG
                      value={payment.data.checkoutUrl}
                      size={224}
                      title="Mã QR mở trang thanh toán payOS"
                    />
                    <p>Mở trang payOS và làm theo hướng dẫn thanh toán.</p>
                    <a href={payment.data.checkoutUrl} target="_blank" rel="noopener noreferrer">
                      Mở liên kết thanh toán (tab mới)
                    </a>
                  </div>
                )}
                <h2>Biên nhận của bạn</h2>
                <p className="quiet">
                  Giữ mã đơn và mã biên nhận để tra cứu hoặc báo sự cố. Màn hình sẽ xóa thông tin
                  sau 10 phút không thao tác.
                </p>
                <ul className="receipts">
                  {current.orders.map((order) => (
                    <li key={order.id}>
                      <h3>{order.orderCode}</h3>
                      <p role="status">{stateNames[order.status] || 'Đang cập nhật trạng thái'}</p>
                      <p>
                        Mã biên nhận: <strong>{order.trackingToken}</strong>
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
                      <p>Quét QR để giữ biên nhận trên điện thoại.</p>
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
                        Xem biên nhận (tab mới)
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </main>
      <footer>Chọn hoa cho người thương, hoặc dành một bó cho chính mình.</footer>
    </>
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
  const [visit, setVisit] = useState(0);
  const [notice, setNotice] = useState('');
  const reset = React.useCallback(() => {
    queryClient.clear();
    setNotice('');
    setVisit((value) => value + 1);
    window.scrollTo(0, 0);
  }, []);
  const privacyFinish = React.useCallback(
    (message: string) => {
      reset();
      setNotice(message);
    },
    [reset],
  );
  return device ? (
    <Shopping
      key={visit}
      device={device}
      onReset={reset}
      notice={notice}
      onPrivacyFinish={privacyFinish}
    />
  ) : (
    <Setup onReady={setDevice} />
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
