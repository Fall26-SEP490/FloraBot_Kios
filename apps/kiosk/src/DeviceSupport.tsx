import { useState } from 'react';
import { Button } from '@florabot/ui';
import { KioskHeader } from './KioskHome';
import { useKioskLanguage } from './kiosk-language';

export default function DeviceSupport({ kioskId }: { kioskId: string }) {
  const { tr } = useKioskLanguage();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  async function submit() {
    if (busy || done) return;
    if (reason.trim().length < 10 || reason.trim().length > 1000) {
      setError(
        tr('Mô tả vấn đề từ 10 đến 1.000 ký tự.', 'Describe the issue in 10–1,000 characters.'),
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/kiosk-support/${encodeURIComponent(kioskId)}/device`, {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(String(response.status));
      const result = (await response.json()) as { id: string };
      setDone(result.id);
      setReason('');
    } catch {
      setError(
        tr(
          'Chưa xác nhận được việc gửi. Không tự gửi lại; hãy kiểm tra kết nối trước khi thử lại.',
          'Submission could not be confirmed. There is no automatic retry; check the connection before trying again.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="kh-shell">
      <KioskHeader />
      <main id="main" className="ko-main">
        <section className="ko-confirm">
          <p className="fb-eyebrow">FLORABOT SUPPORT</p>
          <h1>{tr('Báo lỗi tủ cho admin', 'Report a kiosk issue')}</h1>
          <p>
            {tr(
              'Mô tả lỗi màn hình, kết nối hoặc cửa tủ. Không ghi mật khẩu hay thông tin thanh toán vào nội dung.',
              'Describe a screen, connection or locker issue. Do not include passwords or payment credentials.',
            )}
          </p>
          {done ? (
            <div role="status">
              <h2>{tr('Đã gửi đến admin', 'Sent to the admin team')}</h2>
              <p>
                {tr('Mã yêu cầu:', 'Reference:')} {done}
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label htmlFor="device-support-reason">
                {tr('Vấn đề bạn gặp phải', 'What happened?')}
              </label>
              <textarea
                id="device-support-reason"
                value={reason}
                maxLength={1000}
                onChange={(e) => setReason(e.target.value)}
                rows={6}
                disabled={busy}
              />
              <Button type="submit" disabled={busy}>
                {busy ? tr('Đang gửi…', 'Sending…') : tr('Gửi báo lỗi', 'Submit report')}
              </Button>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
