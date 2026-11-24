import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { ApiError, request, type Device } from './api';
import PickupUnlockRetry from './PickupUnlockRetry';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default function PickupRecovery({
  device,
  online,
  accessToken,
  receipt,
  onReceiptAttempt,
  onBack,
  onExit,
}: {
  device: Device;
  online: boolean;
  accessToken?: string;
  receipt?: { id: string; trackingToken: string };
  onReceiptAttempt?: () => void;
  onBack?: () => void;
  onExit: () => void;
}) {
  const [order, setOrder] = useState(receipt?.id ?? '');
  const [tracking, setTracking] = useState(receipt?.trackingToken ?? '');
  const [retryCommand, setRetryCommand] = useState<{
    orderId: string;
    commandId: string;
    trackingToken: string;
  }>();
  const [stage, setStage] = useState<'entry' | 'review' | 'sending' | 'accepted' | 'uncertain'>(
    receipt ? 'review' : 'entry',
  );
  const [error, setError] = useState('');
  const [canRequestAgain, setCanRequestAgain] = useState(false);
  const [invalid, setInvalid] = useState<'order' | 'tracking'>();
  const epoch = useRef(0);
  const sending = useRef(false);
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const review = useRef<HTMLHeadingElement>(null);
  const outcome = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    title.current?.focus();
    const invalidate = () => {
      epoch.current++;
    };
    const hide = () => {
      if (document.hidden) {
        invalidate();
        onExit();
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      invalidate();
      document.removeEventListener('visibilitychange', hide);
    };
  }, [onExit]);
  useEffect(() => {
    if (stage === 'review') review.current?.focus();
    if (stage === 'accepted' || stage === 'uncertain') outcome.current?.focus();
  }, [stage]);
  const receiptId = receipt?.id;
  useEffect(() => {
    if (!receiptId || (stage !== 'accepted' && stage !== 'uncertain')) return;
    const timer = window.setTimeout(() => setCanRequestAgain(true), 25000);
    return () => window.clearTimeout(timer);
  }, [receiptId, stage]);
  function check() {
    const id = order.trim();
    const token = tracking.trim().toUpperCase();
    if (!uuid.test(id) || id === '00000000-0000-0000-0000-000000000000') {
      setInvalid('order');
      setError('Nhập ID biên nhận đầy đủ, có dấu gạch ngang, từ biên nhận của bạn.');
      document.getElementById('pickup-order')?.focus();
      return;
    }
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(token)) {
      setInvalid('tracking');
      setError('Nhập mã biên nhận gồm 8 chữ hoặc số trên biên nhận.');
      document.getElementById('pickup-tracking')?.focus();
      return;
    }
    setOrder(id);
    setTracking(token);
    setError('');
    setInvalid(undefined);
    setStage('review');
  }
  async function send() {
    const orderId = receipt?.id ?? order;
    const trackingToken = receipt?.trackingToken ?? tracking;
    if (sending.current || !online) return;
    sending.current = true;
    const attempt = ++epoch.current;
    setStage('sending');
    setCanRequestAgain(false);
    setRetryCommand(undefined);
    setError('');
    try {
      const result = await request<components['schemas']['FlowResult']>(
        device,
        '/flows/request_pickup',
        { p_order: orderId, p_tracking: trackingToken },
      );
      if (attempt !== epoch.current) return;
      if (result.result === null) {
        setStage(receipt ? 'review' : 'entry');
        setInvalid('tracking');
        setError('Mã biên nhận chưa đúng. Kiểm tra mã rồi thử lại.');
        requestAnimationFrame(() => document.getElementById('pickup-tracking')?.focus());
        return;
      }
      if (typeof result.result === 'string' && uuid.test(result.result)) {
        setRetryCommand({ orderId, commandId: result.result, trackingToken });
      }
      setOrder('');
      setTracking('');
      setStage(
        typeof result.result === 'string' && uuid.test(result.result) ? 'accepted' : 'uncertain',
      );
    } catch (cause) {
      if (attempt !== epoch.current) return;
      if (cause instanceof ApiError && [400, 401, 403, 404, 409, 422, 429].includes(cause.status)) {
        setStage(receipt ? 'review' : 'entry');
        setError(
          cause.message.includes('(DISPENSE_FAILED)')
            ? 'Tủ chưa mở được ô. Hãy lưu biên nhận và liên hệ shop để được hỗ trợ.'
            : cause.message,
        );
        requestAnimationFrame(() => document.getElementById('pickup-order')?.focus());
      } else {
        setOrder('');
        setTracking('');
        setStage('uncertain');
      }
    } finally {
      sending.current = false;
      if (attempt === epoch.current) onReceiptAttempt?.();
    }
  }
  return (
    <section
      className="pickup-recovery"
      aria-label={receipt ? 'Thử mở lại cửa' : undefined}
      aria-labelledby={receipt ? undefined : titleId}
    >
      {!receipt && (
        <>
          <h1 id={titleId} ref={title} tabIndex={-1}>
            Nhận tiếp bó hoa của bạn
          </h1>
          <p>
            Dành cho đơn đã thanh toán nhưng bạn chưa nhận được hoa. Hãy thao tác tại đúng tủ trên
            biên nhận, khi các cửa đã đóng.
          </p>
        </>
      )}
      {!online && (
        <p role="alert" className="notice">
          Tủ đang mất kết nối. Chờ kết nối lại để gửi yêu cầu.
        </p>
      )}
      {stage === 'entry' && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            check();
          }}
        >
          <label htmlFor="pickup-order">ID biên nhận</label>
          <input
            id="pickup-order"
            value={order}
            onChange={(event) => setOrder(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={!online}
            aria-invalid={invalid === 'order'}
            aria-describedby={`pickup-help${invalid === 'order' ? ' pickup-error' : ''}`}
          />
          <p id="pickup-help" className="quiet">
            Dùng ID biên nhận đầy đủ, không phải mã đơn bắt đầu bằng FB.
          </p>
          <label htmlFor="pickup-tracking">Mã biên nhận (8 ký tự)</label>
          <input
            id="pickup-tracking"
            value={tracking}
            onChange={(event) => setTracking(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="characters"
            disabled={!online}
            aria-invalid={invalid === 'tracking'}
            aria-describedby={invalid === 'tracking' ? 'pickup-error' : undefined}
          />
          {error && (
            <p id="pickup-error" role="alert" className="error">
              {error}
            </p>
          )}
          <Button type="submit" disabled={!online}>
            Kiểm tra thông tin
          </Button>
        </form>
      )}
      {(stage === 'review' || stage === 'sending') && (
        <div>
          {!receipt && (
            <>
              <h2 ref={review} tabIndex={-1}>
                Yêu cầu mở lại ô nhận hoa?
              </h2>
              <p className="receipt-id">ID biên nhận: {order}</p>
              <p>
                Hệ thống sẽ kiểm tra đơn, thời gian giữ hoa và tình trạng tủ. Yêu cầu này không thu
                thêm tiền. Sau khi gửi, hãy quan sát cửa tủ.
              </p>
            </>
          )}
          {receipt && error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="pickup-actions">
            <Button disabled={!online || stage === 'sending'} onClick={() => void send()}>
              {stage === 'sending'
                ? 'Đang gửi yêu cầu…'
                : receipt
                  ? 'Cửa vẫn đóng? Thử mở lại'
                  : 'Yêu cầu mở ô nhận hoa'}
            </Button>
            {!receipt && (
              <Button
                variant="outline"
                disabled={stage === 'sending'}
                onClick={() => {
                  setStage('entry');
                  requestAnimationFrame(() => document.getElementById('pickup-order')?.focus());
                }}
              >
                Sửa thông tin
              </Button>
            )}
          </div>
        </div>
      )}
      {stage === 'accepted' && (
        <>
          <p ref={outcome} tabIndex={-1} role="status">
            Đã tiếp nhận yêu cầu mở ô. Hãy quan sát tủ và nhận hoa khi cửa mở.
          </p>
          {retryCommand && !receipt && (
            <PickupUnlockRetry
              device={device}
              online={online}
              accessToken={accessToken}
              {...retryCommand}
            />
          )}
        </>
      )}
      {stage === 'uncertain' && (
        <p ref={outcome} tabIndex={-1} role="alert" className="error">
          Chưa xác nhận được kết quả. Hãy quan sát tủ và giữ biên nhận để báo sự cố. Màn hình không
          tự gửi lại lệnh mở cửa.
        </p>
      )}
      {receipt && canRequestAgain && (stage === 'accepted' || stage === 'uncertain') && (
        <Button type="button" variant="outline" disabled={!online} onClick={() => void send()}>
          Cửa vẫn đóng? Thử mở lại
        </Button>
      )}
      {onBack && (
        <Button variant="outline" disabled={stage === 'sending'} onClick={onBack}>
          Trở lại chọn hoa
        </Button>
      )}
    </section>
  );
}
