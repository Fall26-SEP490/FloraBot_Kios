import { useEffect, useRef, useState } from 'react';
import { Button, Delete, ArrowRight, PackageCheck, ShieldCheck } from '@florabot/ui';
import { ApiError, request, type Device } from './api';
import type { components } from '../../../packages/contracts/src/generated/pickup-otp-api';
import './preorder-pickup.css';
import { KioskHeader } from './KioskHome';
import { useKioskLanguage } from './kiosk-language';

type Opened = components['schemas']['PreorderPickupOtpOpened'];
type Status = components['schemas']['PreorderPickupOtpStatus'];
type Stage = 'entry' | 'review' | 'sending' | 'watch' | 'uncertain';

export default function PreorderPickup({ device, onHome }: { device: Device; onHome: () => void }) {
  const { tr } = useKioskLanguage();
  const [stage, setStage] = useState<Stage>('entry');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [opened, setOpened] = useState<Opened>();
  const [status, setStatus] = useState<Status>();
  const [online, setOnline] = useState(navigator.onLine);
  const attempt = useRef<string | undefined>(undefined);
  const epoch = useRef(0);
  const sending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [stage]);
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine);
    const hide = () => {
      if (document.hidden) onHome();
    };
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    const timer = setInterval(() => {
      if (Date.now() - last >= 180000) onHome();
    }, 1000);
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    document.addEventListener('visibilitychange', hide);
    const invalidate = () => {
      epoch.current++;
    };
    return () => {
      invalidate();
      clearInterval(timer);
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [onHome]);

  useEffect(() => {
    if (!opened || stage !== 'watch' || !online) return;
    let active = true;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      if (Date.now() >= Date.parse(opened.watchExpiresAt!)) {
        setError(
          tr(
            'Lượt theo dõi đã hết hạn. Liên hệ shop nếu chưa nhận được hoa.',
            'Tracking has expired. Contact the shop if you have not collected your flowers.',
          ),
        );
        setStage('uncertain');
        return;
      }
      inFlight = true;
      try {
        const result = await request<Status>(
          device,
          `/preorders/pickup-otp/attempts/${opened.attemptId}`,
          undefined,
          undefined,
          { 'X-Pickup-Token': opened.watchToken! },
        );
        if (active) {
          setStatus(result);
          setError('');
        }
      } catch {
        if (active)
          setError(
            tr(
              'Chưa đọc được trạng thái cửa. Không tự mở lại; kiểm tra ô và liên hệ shop nếu cần.',
              'Unable to read the door status. Do not reopen; check the locker and contact the shop if needed.',
            ),
          );
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const timer = setInterval(() => {
      if (
        status?.orderStatus !== 'COMPLETED' &&
        !['FAILED', 'EXPIRED', 'REVOKED'].includes(status?.commandStatus ?? '')
      )
        void poll();
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [opened, stage, online, device, tr, status?.orderStatus, status?.commandStatus]);

  async function openLocker() {
    if (sending.current || !online) return;
    sending.current = true;
    attempt.current ??= crypto.randomUUID();
    const visit = epoch.current;
    setError('');
    setStage('sending');
    try {
      const result = await request<Opened>(device, '/preorders/pickup-otp/open', {
        code,
        attemptId: attempt.current,
      });
      if (visit !== epoch.current) return;
      setOpened(result);
      setCode('');
      setStage('watch');
    } catch (cause) {
      if (visit !== epoch.current) return;
      if (cause instanceof ApiError && [400, 401, 403, 409, 429].includes(cause.status)) {
        setError(cause.message);
        setStage('entry');
        attempt.current = undefined;
      } else {
        setError(
          tr(
            'Chưa xác nhận được lệnh mở ô. Kiểm tra cửa trước; nút bên dưới chỉ kiểm tra lại cùng lượt, không tạo lệnh mới.',
            'The opening request could not be confirmed. Check the door first; the button below checks the same attempt without creating another command.',
          ),
        );
        setStage('uncertain');
      }
    } finally {
      if (visit === epoch.current) sending.current = false;
    }
  }

  const failed =
    status?.orderStatus === 'DISPENSE_FAILED' ||
    ['FAILED', 'EXPIRED', 'REVOKED'].includes(status?.commandStatus ?? '');
  return (
    <div className="kh-shell">
      <KioskHeader
        onHome={onHome}
        homeDisabled={stage === 'sending'}
        title={tr('NHẬN HOA ĐẶT TRƯỚC', 'COLLECT PREORDER')}
      />
      <main id="main" className={stage === 'entry' ? 'pickup-entry-layout' : 'ko-main'}>
        <div className={stage === 'entry' ? 'pickup-ticket' : 'ko-heading'}>
          <p className="fb-eyebrow">
            {tr('FLORABOT   /   ĐIỂM NHẬN HOA', 'FLORABOT   /   FLOWER PICKUP')}
          </p>
          <h1 ref={heading} tabIndex={-1}>
            {tr('Nhận đơn đặt trước', 'Collect your preorder')}
          </h1>
          <p>
            {tr(
              'Đến đúng kiosk trong khung giờ hẹn. Mở email của shop để lấy mã nhận hoa.',
              'At your chosen kiosk during your pickup window, open the email from your shop to find your code.',
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
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        {stage === 'entry' && (
          <section className="pickup-console">
            <p className="pickup-step">
              {tr('01 / 02   ·   XÁC THỰC', '01 / 02   ·   VERIFICATION')}
            </p>
            <h2>{tr('Nhập mã nhận hoa', 'Enter your pickup code')}</h2>
            <p id="pickup-code-help">
              {tr('Dùng 8 chữ số trong email nhận hoa.', 'Use the 8 digits in your pickup email.')}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!/^\d{8}$/.test(code)) {
                  setError(
                    tr('Nhập đủ 8 chữ số trong email.', 'Enter the 8-digit code from your email.'),
                  );
                  return;
                }
                setError('');
                setStage('review');
              }}
            >
              <label className="pickup-code-field">
                <input
                  aria-label={tr('OTP nhận hoa', 'Pickup code')}
                  aria-describedby="pickup-code-help"
                  type="password"
                  inputMode="none"
                  autoComplete="off"
                  maxLength={8}
                  value={code}
                  disabled={!online}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                />
                <span className="pickup-digits" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, index) => (
                    <span key={index} data-next={index === code.length}>
                      {index < code.length ? '●' : '–'}
                    </span>
                  ))}
                </span>
              </label>
              <div
                className="ko-keypad"
                role="group"
                aria-label={tr('Bàn phím số', 'Number keypad')}
              >
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'delete'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={!online}
                    aria-label={
                      d === 'delete'
                        ? tr('Xóa một số', 'Delete last digit')
                        : d === 'clear'
                          ? tr('Xóa hết', 'Clear all')
                          : d
                    }
                    onClick={() =>
                      setCode((v) =>
                        d === 'clear' ? '' : d === 'delete' ? v.slice(0, -1) : (v + d).slice(0, 8),
                      )
                    }
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
              <Button type="submit" disabled={!online || code.length !== 8}>
                {tr('Tiếp tục', 'Continue')} <ArrowRight size={19} aria-hidden="true" />
              </Button>
            </form>
            <p className="pickup-email-help">
              {tr(
                'Chưa thấy mã? Kiểm tra thư rác hoặc liên hệ shop.',
                'Missing your code? Check spam or contact the shop.',
              )}
            </p>
          </section>
        )}
        {(stage === 'review' || stage === 'sending') && (
          <section className="ko-confirm">
            <ShieldCheck size={45} aria-hidden="true" />
            <p className="pickup-step">{tr('02 / 02 · MỞ Ô NHẬN HOA', '02 / 02 · OPEN LOCKER')}</p>
            <h2>{tr('Sẵn sàng nhận hoa?', 'Ready to collect?')}</h2>
            <p>
              {tr(
                'Đứng trước đúng kiosk đã chọn, kiểm tra cửa đã đóng. Xác nhận sẽ kiểm tra mã và yêu cầu mở ô của đơn tương ứng.',
                'Stand at your selected kiosk and check that its doors are closed. Confirmation verifies the code and requests the matching locker to open.',
              )}
            </p>
            <Button disabled={!online || stage === 'sending'} onClick={() => void openLocker()}>
              {stage === 'sending'
                ? tr('Đang gửi lệnh…', 'Sending request…')
                : tr('Xác nhận mở ô nhận hoa', 'Confirm and open locker')}
            </Button>
            <Button
              variant="outline"
              disabled={stage === 'sending'}
              onClick={() => {
                setCode('');
                setStage('entry');
              }}
            >
              {tr('Nhập lại mã', 'Enter another code')}
            </Button>
          </section>
        )}
        {stage === 'watch' && opened && (
          <section className="ko-confirm" role="status">
            <PackageCheck size={52} aria-hidden="true" />
            <h2>
              {status?.orderStatus === 'COMPLETED'
                ? tr('Đã nhận hoa. Cảm ơn bạn!', 'Collected. Thank you!')
                : failed
                  ? tr('Chưa xác nhận nhận hoa', 'Pickup not confirmed')
                  : status?.commandStatus === 'OPENED'
                    ? tr('Cửa đã mở, mời bạn lấy hoa', 'The door is open. Collect your flowers')
                    : tr('Đang chờ tủ mở cửa', 'Waiting for the locker to open')}
            </h2>
            <p>
              <strong>{opened.productName}</strong> · {opened.orderCode} · {tr('Ô', 'Locker')}{' '}
              {opened.slotCode}
            </p>
            <p>
              {failed
                ? tr(
                    'Kiểm tra ô và liên hệ shop để được hỗ trợ. Không tự gửi thêm lệnh mở.',
                    'Check the locker and contact the shop. Do not send another opening command.',
                  )
                : tr(
                    'Lấy hoa ở ô được mở rồi đóng cửa lại. Hệ thống chỉ xác nhận hoàn tất khi nhận được trạng thái thực từ tủ.',
                    'Collect your flowers and close the door. Completion is confirmed only from the actual device status.',
                  )}
            </p>
          </section>
        )}
        {stage === 'uncertain' && (
          <section className="ko-confirm">
            <h2>{tr('Kiểm tra ô nhận hoa', 'Check your locker')}</h2>
            {!opened && (
              <Button disabled={!online} onClick={() => void openLocker()}>
                {tr('Kiểm tra lại cùng lượt nhận', 'Check the same pickup attempt')}
              </Button>
            )}
            <p>
              {tr(
                'Nếu cửa đã mở, lấy hoa và đóng cửa. Nếu chưa nhận được hoa, liên hệ shop; không tạo lượt mới để mở lại.',
                'If the door opened, collect your flowers and close it. If not, contact the shop; do not start another attempt to reopen it.',
              )}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
