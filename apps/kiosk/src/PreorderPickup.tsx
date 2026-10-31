import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Delete, KeyRound, PackageCheck, ShieldCheck } from '@florabot/ui';
import { ApiError, request, type CustomerSession, type Device } from './api';
import type { components } from '../../../packages/contracts/src/generated/api';
import { KioskHeader } from './KioskHome';
import { useKioskLanguage } from './kiosk-language';
import PickupRecovery from './PickupRecovery';

type PickupOrder = components['schemas']['KioskPickupOrder'];
type Stage = 'phone' | 'otp' | 'orders' | 'review' | 'sending' | 'watch' | 'uncertain';

export default function PreorderPickup({ device, onHome }: { device: Device; onHome: () => void }) {
  const { tr } = useKioskLanguage();
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [session, setSession] = useState<CustomerSession>();
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [selected, setSelected] = useState<PickupOrder>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [receiptMode, setReceiptMode] = useState(false);
  const epoch = useRef(0);
  const sending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [activeField, setActiveField] = useState<'phone' | 'code'>('phone');
  useEffect(() => {
    heading.current?.focus();
  }, [stage]);
  useEffect(() => {
    const onlineChanged = () => setOnline(navigator.onLine);
    const hide = () => {
      if (document.hidden) onHome();
    };
    window.addEventListener('online', onlineChanged);
    window.addEventListener('offline', onlineChanged);
    document.addEventListener('visibilitychange', hide);
    const invalidate = () => {
      epoch.current += 1;
    };
    return () => {
      invalidate();
      window.removeEventListener('online', onlineChanged);
      window.removeEventListener('offline', onlineChanged);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [onHome]);
  useEffect(() => {
    const timer = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(onHome, Math.min(600, Number(session.expiresInSeconds)) * 1000);
    return () => clearTimeout(timer);
  }, [session, onHome]);
  useEffect(() => {
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    const timer = setInterval(() => {
      if (Date.now() - last >= 180000) onHome();
    }, 1000);
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
    };
  }, [onHome]);
  const loadOrders = useCallback(
    async (token: string) => request<PickupOrder[]>(device, '/pickup/orders', undefined, token),
    [device],
  );
  async function run(action: () => Promise<void>) {
    if (sending.current || !online) return;
    sending.current = true;
    setBusy(true);
    setError('');
    const attempt = epoch.current;
    try {
      await action();
    } catch (cause) {
      if (attempt === epoch.current)
        setError(
          cause instanceof ApiError && cause.status === 429
            ? tr(
                'Thử quá nhiều lần. Vui lòng chờ rồi thử lại.',
                'Too many attempts. Please wait before trying again.',
              )
            : cause instanceof ApiError && cause.status === 503
              ? tr(
                  'SMS hiện chưa sẵn sàng. Bạn có thể nhận hoa bằng ID và mã trên biên nhận.',
                  'SMS is unavailable. You can collect using your receipt ID and code.',
                )
              : cause instanceof ApiError && cause.status === 401
                ? tr('Mã không đúng hoặc đã hết hạn.', 'The code is incorrect or has expired.')
                : tr(
                    'Chưa xử lý được yêu cầu. Kiểm tra kết nối rồi thử lại.',
                    'Unable to complete the request. Check the connection and try again.',
                  ),
        );
    } finally {
      if (attempt === epoch.current) {
        sending.current = false;
        setBusy(false);
      }
    }
  }
  function sendOtp() {
    if (!/^(0[35789]\d{8}|\+84[35789]\d{8})$/.test(phone.trim())) {
      setError(tr('Nhập số điện thoại Việt Nam hợp lệ.', 'Enter a valid Vietnamese phone number.'));
      return;
    }
    const attempt = epoch.current;
    void run(async () => {
      await request(device, '/otp/request', { phone: phone.trim() });
      if (attempt !== epoch.current) return;
      setCooldown(60);
      setCode('');
      setActiveField('code');
      setStage('otp');
    });
  }
  function verifyOtp() {
    if (!/^\d{6}$/.test(code)) {
      setError(tr('Nhập đủ 6 chữ số trong SMS.', 'Enter the 6-digit SMS code.'));
      return;
    }
    const attempt = epoch.current;
    void run(async () => {
      const result = await request<CustomerSession>(device, '/otp/verify', {
        phone: phone.trim(),
        code,
      });
      if (attempt !== epoch.current) return;
      if (
        !result.accessToken ||
        !Number.isFinite(Number(result.expiresInSeconds)) ||
        Number(result.expiresInSeconds) <= 0
      )
        throw new Error('Invalid session');
      setSession(result);
      setCode('');
      setPhone('');
      setStage('orders');
      const rows = await loadOrders(result.accessToken);
      if (attempt === epoch.current) setOrders(rows);
    });
  }
  async function openOrder() {
    if (!selected || !session || sending.current || !online) return;
    sending.current = true;
    setStage('sending');
    setError('');
    const attempt = epoch.current;
    try {
      const result = await request<components['schemas']['FlowResult']>(
        device,
        `/pickup/orders/${selected.id}/open`,
        {},
        session.accessToken,
      );
      if (attempt !== epoch.current) return;
      setStage(
        typeof result.result === 'string' && /^[0-9a-f-]{36}$/i.test(result.result)
          ? 'watch'
          : 'uncertain',
      );
    } catch (cause) {
      if (attempt !== epoch.current) return;
      if (cause instanceof ApiError && [400, 401, 403, 404, 409, 429].includes(cause.status)) {
        setStage('orders');
        setError(
          tr(
            'Đơn chưa thể nhận tại tủ này. Kiểm tra giờ hẹn, tình trạng cửa và thử lại.',
            'This order cannot be collected here yet. Check the pickup time and locker doors.',
          ),
        );
      } else setStage('uncertain');
    } finally {
      if (attempt === epoch.current) sending.current = false;
    }
  }
  const selectedId = selected?.id;
  useEffect(() => {
    if (stage !== 'watch' || !selectedId || !session || !online) return;
    let active = true;
    const timer = setInterval(() => {
      void request<PickupOrder>(
        device,
        `/pickup/orders/${selectedId}`,
        undefined,
        session.accessToken,
      )
        .then((row) => {
          if (active) setSelected(row);
        })
        .catch(() => {});
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [device, online, selectedId, session, stage]);
  if (receiptMode)
    return (
      <div className="kh-shell">
        <KioskHeader title={tr('NHẬN BẰNG BIÊN NHẬN', 'COLLECT WITH RECEIPT')} />
        <main id="main" className="ko-main">
          <PickupRecovery
            device={device}
            online={online}
            onBack={() => setReceiptMode(false)}
            onExit={onHome}
          />
        </main>
      </div>
    );
  const title =
    stage === 'phone' || stage === 'otp'
      ? tr('Nhận đơn đặt trước', 'Collect your preorder')
      : stage === 'watch'
        ? tr('Món quà của bạn', 'Your flowers are waiting')
        : tr('Chọn đơn nhận hoa', 'Select your order');
  return (
    <div className="kh-shell">
      <KioskHeader
        onHome={onHome}
        homeDisabled={stage === 'sending'}
        title={tr('NHẬN HOA', 'COLLECT FLOWERS')}
      />
      <main id="main" className="ko-main">
        <div className="ko-heading">
          <p className="fb-eyebrow">
            {tr('XÁC THỰC · CHỌN ĐƠN · NHẬN HOA', 'VERIFY · SELECT · COLLECT')}
          </p>
          <h1 ref={heading} tabIndex={-1}>
            {title}
          </h1>
          <p>
            {tr(
              'Chỉ hiển thị đơn của bạn, đã thanh toán và sẵn sàng tại tủ này.',
              'Only your paid orders that are ready at this kiosk will appear.',
            )}
          </p>
        </div>
        {!online && (
          <p className="notice" role="alert">
            {tr(
              'Tủ đang mất mạng. Vui lòng chờ kết nối lại.',
              'The kiosk is offline. Please wait for the connection to return.',
            )}
          </p>
        )}
        {(stage === 'phone' || stage === 'otp') && (
          <div className="ko-entry">
            <section className="ko-form">
              <span className="ko-form-icon">
                <KeyRound size={30} aria-hidden="true" />
              </span>
              <h2>
                {stage === 'phone'
                  ? tr('Số điện thoại đặt hoa', 'Order phone number')
                  : tr('Nhập mã xác thực', 'Enter verification code')}
              </h2>
              <p>
                {stage === 'phone'
                  ? tr(
                      'OTP sẽ được gửi qua SMS tới số dùng đặt đơn.',
                      'An SMS code will be sent to the number used for your order.',
                    )
                  : tr(
                      'Mã có 6 chữ số, hiệu lực 3 phút. Không chia sẻ mã với người khác.',
                      'Your 6-digit code expires in 3 minutes. Do not share it.',
                    )}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (stage === 'phone') sendOtp();
                  else verifyOtp();
                }}
              >
                <label htmlFor="preorder-phone">{tr('Số điện thoại', 'Phone number')}</label>
                <input
                  id="preorder-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={phone}
                  disabled={stage === 'otp' || busy || !online}
                  onFocus={() => setActiveField('phone')}
                  onChange={(e) => setPhone(e.target.value)}
                />
                {stage === 'otp' && (
                  <>
                    <label htmlFor="preorder-otp">{tr('OTP từ SMS', 'SMS code')}</label>
                    <input
                      id="preorder-otp"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      value={code}
                      onFocus={() => setActiveField('code')}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      disabled={busy || !online}
                    />
                  </>
                )}
                <Button disabled={busy || !online} type="submit">
                  {busy
                    ? tr('Đang xử lý…', 'Please wait…')
                    : stage === 'phone'
                      ? tr('Gửi OTP qua SMS', 'Send SMS code')
                      : tr('Xác thực và tìm đơn', 'Verify and find my orders')}
                </Button>
              </form>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  epoch.current += 1;
                  setPhone('');
                  setCode('');
                  setError('');
                  setReceiptMode(true);
                }}
              >
                {tr('Nhận bằng biên nhận', 'Collect with receipt')}
              </Button>
              {stage === 'otp' && (
                <div className="ko-otp-actions">
                  <Button
                    variant="outline"
                    disabled={busy || !online || cooldown > 0}
                    onClick={sendOtp}
                  >
                    {cooldown > 0
                      ? tr(`Gửi lại sau ${cooldown}s`, `Resend in ${cooldown}s`)
                      : tr('Gửi lại OTP', 'Resend code')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setStage('phone');
                      setCode('');
                      setActiveField('phone');
                    }}
                  >
                    {tr('Đổi số điện thoại', 'Change phone number')}
                  </Button>
                </div>
              )}
            </section>
            <div className="ko-keypad" role="group" aria-label={tr('Bàn phím số', 'Number keypad')}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'delete'].map((d) => (
                <button
                  key={d}
                  disabled={busy || !online}
                  type="button"
                  aria-label={
                    d === 'delete'
                      ? tr('Xóa một số', 'Delete last digit')
                      : d === 'clear'
                        ? tr('Xóa hết', 'Clear all')
                        : d
                  }
                  onClick={() => {
                    const update = (value: string) =>
                      d === 'clear'
                        ? ''
                        : d === 'delete'
                          ? value.slice(0, -1)
                          : (value + d).slice(0, activeField === 'code' ? 6 : 12);
                    if (activeField === 'code') setCode(update);
                    else setPhone(update);
                  }}
                >
                  {d === 'delete' ? (
                    <Delete size={24} aria-hidden="true" />
                  ) : d === 'clear' ? (
                    tr('Xóa', 'Clear')
                  ) : (
                    d
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {stage === 'orders' && (
          <section className="ko-orders">
            {busy ? (
              <p role="status">{tr('Đang tìm đơn…', 'Finding your orders…')}</p>
            ) : orders.length === 0 ? (
              <div className="ko-empty">
                <PackageCheck size={50} aria-hidden="true" />
                <h2>{tr('Chưa có đơn sẵn sàng nhận', 'No orders ready to collect')}</h2>
                <p>
                  {tr(
                    'Kiểm tra đúng tủ, giờ hẹn và thông báo shop đã chuẩn bị hoa. Số điện thoại phải được lưu trong hồ sơ của tài khoản đặt đơn trên website.',
                    'Check the kiosk, pickup time and the shop’s ready notification. Your phone number must be saved in the website profile of the account that placed the order.',
                  )}
                </p>
              </div>
            ) : (
              orders.map((order) => (
                <article key={order.id}>
                  <PackageCheck size={27} aria-hidden="true" />
                  <div>
                    <strong>{order.name}</strong>
                    <p>{order.orderCode}</p>
                  </div>
                  <Button
                    onClick={() => {
                      setSelected(order);
                      setStage('review');
                    }}
                    disabled={!online}
                  >
                    {tr('Chọn đơn này', 'Select order')}
                  </Button>
                </article>
              ))
            )}
            <Button
              variant="outline"
              disabled={busy || !online}
              onClick={() => {
                const attempt = epoch.current;
                void run(async () => {
                  const rows = await loadOrders(session!.accessToken);
                  if (attempt === epoch.current) setOrders(rows);
                });
              }}
            >
              {tr('Tải lại danh sách', 'Refresh orders')}
            </Button>
          </section>
        )}
        {(stage === 'review' || stage === 'sending') && selected && (
          <section className="ko-confirm">
            <ShieldCheck size={45} aria-hidden="true" />
            <h2>{tr('Sẵn sàng nhận hoa?', 'Ready to collect?')}</h2>
            <p>
              <strong>{selected.name}</strong> · {selected.orderCode}
            </p>
            <p>
              {tr(
                'Đảm bảo các cửa tủ đã đóng. Sau khi xác nhận, nhận hoa ở ô được mở rồi đóng cửa lại.',
                'Make sure all locker doors are closed. After confirming, collect your flowers from the opening locker, then close the door.',
              )}
            </p>
            <Button disabled={stage === 'sending' || !online} onClick={() => void openOrder()}>
              {stage === 'sending'
                ? tr('Đang gửi lệnh…', 'Sending request…')
                : tr('Xác nhận mở ô nhận hoa', 'Confirm and open locker')}
            </Button>
            <Button
              variant="outline"
              disabled={stage === 'sending'}
              onClick={() => setStage('orders')}
            >
              {tr('Chọn lại đơn', 'Choose another order')}
            </Button>
          </section>
        )}
        {stage === 'watch' && selected && (
          <section className="ko-confirm" role="status">
            <PackageCheck size={52} aria-hidden="true" />
            <h2>
              {selected.status === 'COMPLETED'
                ? tr('Đã nhận hoa. Cảm ơn bạn!', 'Collected. Thank you!')
                : selected.status === 'DISPENSE_FAILED'
                  ? tr('Tủ gặp sự cố', 'Locker issue')
                  : tr('Đã gửi yêu cầu mở ô', 'Locker request accepted')}
            </h2>
            <p>
              {selected.status === 'COMPLETED'
                ? tr(
                    'Cửa đã được đóng. Chúc bạn một ngày thật vui.',
                    'The door is closed. Have a lovely day.',
                  )
                : selected.status === 'DISPENSE_FAILED'
                  ? tr(
                      'Về Trang chủ và quét QR hỗ trợ admin. Giữ mã đơn để tra cứu.',
                      'Return Home and scan the admin support QR. Keep your order reference.',
                    )
                  : tr(
                      'Quan sát tủ, nhận hoa khi cửa mở và đóng cửa sau khi lấy hoa. Đang chờ phản hồi từ thiết bị.',
                      'Watch the kiosk, collect the flowers when the door opens, and close it afterwards. Waiting for the device response.',
                    )}
            </p>
            <strong>{selected.orderCode}</strong>
            <Button onClick={onHome}>{tr('Hoàn tất · Về Trang chủ', 'Finish · Back Home')}</Button>
          </section>
        )}
        {stage === 'uncertain' && (
          <div className="notice" role="alert">
            {tr(
              'Chưa xác nhận được kết quả. Hãy quan sát cửa tủ trước; màn hình không tự gửi lại lệnh. Nếu cửa không mở, về Trang chủ để quét QR hỗ trợ.',
              'The result is uncertain. Check the locker first; this screen will not resend the command. If the door stays closed, return Home for support.',
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <p className="ko-privacy">
          {tr(
            'Thông tin xác thực chỉ giữ trong lượt này và được xóa khi về Trang chủ.',
            'Verification details are kept only for this visit and cleared when you return Home.',
          )}
        </p>
      </main>
    </div>
  );
}
