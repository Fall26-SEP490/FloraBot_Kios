import { useEffect, useRef, useState } from 'react';
import { Button } from '@florabot/ui';
import { ApiError, request, type Device } from './api';
import { useKioskLanguage } from './kiosk-language';

export default function PickupUnlockRetry({
  device,
  orderId,
  commandId,
  trackingToken,
  accessToken,
  online,
}: {
  device: Device;
  orderId: string;
  commandId: string;
  trackingToken?: string;
  accessToken?: string;
  online: boolean;
}) {
  const { tr } = useKioskLanguage();
  const requestId = useRef<string | undefined>(undefined);
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function retry() {
    if (sending.current || !online || accepted || unavailable || cooldown) return;
    sending.current = true;
    setBusy(true);
    setError('');
    requestId.current ??= crypto.randomUUID();
    try {
      await request(
        device,
        `/pickup/orders/${orderId}/commands/${commandId}/retry-unlock`,
        {
          requestId: requestId.current,
          ...(accessToken ? {} : { trackingToken }),
        },
        accessToken,
      );
      setAccepted(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.retryAfterSeconds) {
        setCooldown(Math.ceil(cause.retryAfterSeconds));
      } else if (
        cause instanceof ApiError &&
        cause.status === 409 &&
        cause.code === 'Parent command must be ACKED to retry.'
      ) {
        setCooldown(5);
      } else if (cause instanceof ApiError && [400, 401, 403, 404, 409].includes(cause.status)) {
        setUnavailable(true);
        setError(
          tr(
            'Tủ chưa cho phép mở lại ô này. Giữ biên nhận và liên hệ shop để được hỗ trợ.',
            'This locker cannot be reopened. Keep your receipt and contact the shop for help.',
          ),
        );
      } else {
        setError(
          tr(
            'Chưa xác nhận được yêu cầu. Nếu cửa vẫn đóng, bạn có thể gửi lại cùng yêu cầu.',
            'The request could not be confirmed. If the door is still closed, you may resend the same request.',
          ),
        );
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="pickup-actions">
      {accepted ? (
        <p role="status">
          {tr(
            'Đã tiếp nhận yêu cầu thử mở lại. Quan sát cửa và lấy hoa khi cửa mở.',
            'The retry request was received. Watch the locker and collect your flowers when it opens.',
          )}
        </p>
      ) : (
        !unavailable && (
          <Button
            type="button"
            variant="outline"
            disabled={!online || busy || cooldown > 0}
            onClick={() => void retry()}
          >
            {busy
              ? tr('Đang gửi…', 'Sending…')
              : cooldown > 0
                ? tr(`Thử mở lại sau ${cooldown} giây`, `Retry in ${cooldown} seconds`)
                : tr('Cửa vẫn đóng? Thử mở lại', 'Door still closed? Retry opening')}
          </Button>
        )
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
