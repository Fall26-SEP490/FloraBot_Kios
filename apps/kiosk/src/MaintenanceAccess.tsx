import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@florabot/ui';
import { ApiError, request, type Device } from './api';
import { useKioskLanguage } from './kiosk-language';
import type { components } from '../../../packages/contracts/src/generated/api';

type PendingChallenge = components['schemas']['MaintenanceAccessPending'];

export function MaintenanceAccess({ device }: { device: Device }) {
  const { tr } = useKioskLanguage();
  const [manualId, setManualId] = useState<string>();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const pending = useQuery({
    queryKey: ['maintenance-access', device.id],
    queryFn: () => request<PendingChallenge[]>(device, '/maintenance-access/pending'),
    refetchInterval: (query) => (query.state.status === 'error' ? 30_000 : 5_000),
    refetchIntervalInBackground: false,
  });
  const challenges = pending.data ?? [];
  const selected =
    challenges.find((item) => item.id === manualId) ??
    challenges.find((item) => !dismissed.includes(item.id));

  function finish(text?: string) {
    if (selected) setDismissed((ids) => [...ids, selected.id]);
    setManualId(undefined);
    if (text) {
      setMessage(text);
      void pending.refetch();
    }
  }

  return (
    <>
      {challenges.length > 0 && (
        <Button
          variant="outline"
          onClick={() => {
            setMessage('');
            setManualId(challenges[0].id);
          }}
        >
          {tr('Nhập mã thao tác tủ', 'Enter service code')}
        </Button>
      )}
      {!selected && message && <p role="status">{message}</p>}
      {selected && (
        <MaintenanceDialog
          key={selected.id}
          challenge={selected}
          device={device}
          onFinish={finish}
        />
      )}
    </>
  );
}

function MaintenanceDialog({
  challenge,
  device,
  onFinish,
}: {
  challenge: PendingChallenge;
  device: Device;
  onFinish: (message?: string) => void;
}) {
  const { tr } = useKioskLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !/^[0-9]{6}$/.test(code)) return;
    setSubmitting(true);
    setError('');
    try {
      await request<components['schemas']['AcceptedMaintenanceAccess']>(
        device,
        '/maintenance-access/' + challenge.id + '/confirm',
        { code },
      );
      onFinish(tr('Đã tiếp nhận lệnh mở ô.', 'The unlock command was accepted.'));
    } catch (cause) {
      setCode('');
      if (cause instanceof ApiError && [404, 409, 410].includes(cause.status)) {
        onFinish(
          tr(
            'Phiên không còn hiệu lực. Kiểm tra trên điện thoại.',
            'This request is no longer available. Check your phone.',
          ),
        );
      } else {
        setError(
          tr(
            'Không xác nhận được mã. Kiểm tra trên điện thoại và thử lại.',
            'Code could not be verified. Check your phone and try again.',
          ),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="maintenance-access-title" onCancel={() => onFinish()}>
      <form onSubmit={confirm}>
        <h2 id="maintenance-access-title">{tr('Xác nhận mở ô', 'Confirm locker access')}</h2>
        <p>
          {tr('Ô tủ', 'Locker')} {challenge.slotCode}
        </p>
        <label htmlFor="maintenance-access-code">
          {challenge.operation === 'PREORDER_LOAD'
            ? tr('Mã 6 số trong email', 'Six-digit code from your email')
            : tr('Mã 6 số trên điện thoại', 'Six-digit code from your phone')}
        </label>
        <input
          id="maintenance-access-code"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ''))}
        />
        {error && <p role="alert">{error}</p>}
        <Button type="submit" disabled={submitting || code.length !== 6}>
          {tr('Xác nhận', 'Confirm')}
        </Button>
        <Button type="button" variant="outline" onClick={() => onFinish()} disabled={submitting}>
          {tr('Đóng', 'Close')}
        </Button>
      </form>
    </dialog>
  );
}
