import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@florabot/ui';
import { request, type Device } from './api';
import { useKioskLanguage } from './kiosk-language';
import type { components } from '../../../packages/contracts/src/generated/api';
import './quality-replacement.css';

type Schema = components['schemas'];
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const code = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const activeCommands = ['ISSUED', 'SENT', 'ACKED', 'OPENED', 'CLOSED'];

export default function QualityReplacementPickup({
  device,
  onHome,
}: {
  device: Device;
  onHome: () => void;
}) {
  const { tr } = useKioskLanguage();
  const [session, setSession] = useState<Schema['QualityPickupRequest'] | null>(null);
  const [detail, setDetail] = useState<Schema['QualityComplaintDetail'] | null>(null);
  const [write, setWrite] = useState<'idle' | 'sent' | 'uncertain' | 'checked'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const running = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(onHome, 5 * 60_000);
    };
    arm();
    window.addEventListener('pointerdown', arm);
    window.addEventListener('keydown', arm);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, [onHome]);
  const replacement = detail?.replacement;
  const collected = replacement?.state === 'COLLECTED' && detail?.status === 'RESOLVED_FIXED';
  const ready =
    detail?.handlingState === 'REPLACEMENT_READY' &&
    replacement?.state === 'READY' &&
    !!replacement.expiresAt &&
    Date.parse(replacement.expiresAt) > now;
  const command = replacement?.commandStatus;
  const canOpen = Boolean(ready && !command && (write === 'idle' || write === 'checked'));

  async function run(action: () => Promise<void>, failure: string) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch {
      if (alive.current) setError(failure);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const orderId = String(data.get('orderId') ?? '').trim();
    const trackingToken = String(data.get('trackingToken') ?? '')
      .trim()
      .toUpperCase();
    if (!uuid.test(orderId) || !code.test(trackingToken)) {
      setError(
        tr(
          'Kiểm tra lại ID và mã tra cứu trên biên nhận gốc.',
          'Check the order ID and lookup code on the original receipt.',
        ),
      );
      return;
    }
    await run(
      async () => {
        const response = await fetch('/api/receipts/complaints/lookup', {
          method: 'POST',
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, trackingToken } satisfies Schema['ReceiptLookupRequest']),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error();
        const found = (await response.json()) as Schema['QualityComplaintDetail'];
        if (!alive.current) return;
        if (found.orderId !== orderId.toLowerCase() || found.kioskId !== device.id.toLowerCase()) {
          setError(
            tr(
              'Hãy đến đúng kiosk của đơn gốc để nhận hoa thay.',
              'Go to the kiosk on the original order to collect the replacement.',
            ),
          );
          return;
        }
        setDetail(found);
        setSession({
          orderId,
          trackingToken,
          complaintId: found.id,
          attemptId: crypto.randomUUID(),
        });
        setWrite('idle');
      },
      tr(
        'Chưa tìm được hồ sơ. Kiểm tra mã trên biên nhận hoặc thử lại.',
        'Could not load the case. Check the receipt codes or try again.',
      ),
    );
  }

  async function open() {
    if (
      !session ||
      !canOpen ||
      running.current ||
      !replacement?.expiresAt ||
      Date.parse(replacement.expiresAt) <= Date.now()
    )
      return;
    await run(
      async () => {
        setWrite('uncertain');
        await request<Schema['QualityPickupResponse']>(
          device,
          '/quality-replacements/open',
          session,
        );
        if (alive.current) setWrite('sent');
      },
      tr(
        'Chưa xác nhận được lệnh mở ô. Hãy kiểm tra trạng thái trước khi thử lại.',
        'The unlock result is unknown. Check its status before retrying.',
      ),
    );
  }

  useEffect(() => {
    if (!session || collected || (write !== 'sent' && !activeCommands.includes(command ?? '')))
      return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (running.current) {
        timer = setTimeout(poll, 4000);
        return;
      }
      try {
        const result = await request<Schema['QualityComplaintDetail']>(
          device,
          '/quality-replacements/status',
          session,
        );
        if (stopped) return;
        setDetail(result);
        if (
          result.replacement?.state !== 'READY' ||
          !activeCommands.includes(result.replacement.commandStatus ?? '')
        ) {
          setWrite('checked');
          return;
        }
      } catch {
        /* The guest can also check explicitly. */
      }
      if (!stopped) timer = setTimeout(poll, 5000);
    }
    timer = setTimeout(poll, 3000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [session, device, write, command, collected]);

  return (
    <main id="main" className="quality-pickup">
      <Button type="button" variant="outline" onClick={onHome}>
        {tr('Về màn hình chính', 'Back to home')}
      </Button>
      <h1>{tr('Nhận hoa thay', 'Collect a replacement')}</h1>
      {!session ? (
        <form onSubmit={lookup}>
          <p>
            {tr(
              'Nhập thông tin trên biên nhận gốc. Không cần thanh toán thêm.',
              'Use the original receipt. No additional payment is required.',
            )}
          </p>
          <label>
            {tr('ID biên nhận', 'Receipt ID')}
            <input name="orderId" maxLength={36} required autoComplete="off" spellCheck={false} />
          </label>
          <label>
            {tr('Mã tra cứu', 'Lookup code')}
            <input
              name="trackingToken"
              maxLength={8}
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy
              ? tr('Đang tra cứu…', 'Looking up…')
              : tr('Tra cứu hoa thay', 'Look up replacement')}
          </Button>
        </form>
      ) : (
        <div className="quality-pickup-result">
          <p>
            {tr('Đơn', 'Order')} <strong>{detail?.orderCode}</strong>
          </p>
          <p role="status">
            {collected
              ? tr('Đã nhận hoa thay thành công.', 'Replacement collected successfully.')
              : command === 'OPENED'
                ? tr(
                    `Lấy hoa ở ô ${replacement?.slotCode} rồi đóng cửa.`,
                    `Take the flowers from locker ${replacement?.slotCode}, then close the door.`,
                  )
                : command === 'CLOSED' && ready
                  ? tr(
                      'Cửa đã đóng. Đang chờ cảm biến xác nhận đã lấy hoa.',
                      'Door closed. Waiting for pickup confirmation.',
                    )
                  : write === 'sent' || (ready && activeCommands.includes(command ?? ''))
                    ? tr('Đang chờ tủ phản hồi.', 'Waiting for the kiosk.')
                    : ready && command
                      ? tr(
                          'Chưa xác nhận nhận hoa thành công. Liên hệ hỗ trợ nếu ô không mở.',
                          'Pickup is not confirmed. Contact support if the locker did not open.',
                        )
                      : ready
                        ? tr(
                            `Hoa thay sẵn sàng ở ô ${replacement?.slotCode}.`,
                            `The replacement is ready in locker ${replacement?.slotCode}.`,
                          )
                        : tr(
                            'Hoa thay chưa sẵn sàng hoặc quyền nhận đã hết hiệu lực.',
                            'The replacement is not ready or the pickup window has ended.',
                          )}
          </p>
          {canOpen && (
            <Button type="button" disabled={busy} onClick={() => void open()}>
              {tr('Mở ô nhận hoa thay', 'Open replacement locker')}
            </Button>
          )}
          {!collected && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(
                  async () => {
                    const result = await request<Schema['QualityComplaintDetail']>(
                      device,
                      '/quality-replacements/status',
                      session,
                    );
                    if (alive.current) {
                      setDetail(result);
                      setWrite('checked');
                    }
                  },
                  tr(
                    'Chưa kiểm tra được trạng thái. Hãy thử lại.',
                    'Could not check the status. Try again.',
                  ),
                )
              }
            >
              {busy ? tr('Đang xử lý…', 'Working…') : tr('Kiểm tra trạng thái', 'Check status')}
            </Button>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
