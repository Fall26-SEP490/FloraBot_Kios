import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { ApiError, request, type Device } from './api';

type History = components['schemas']['CustomerHistoryPage'];
const number = (value: number | string) =>
  typeof value === 'string' && /^\d+$/.test(value)
    ? BigInt(value).toLocaleString('vi-VN')
    : typeof value === 'number' && Number.isSafeInteger(value)
      ? value.toLocaleString('vi-VN')
      : 'Chưa thể hiển thị chính xác';
const statuses: Record<string, string> = {
  AWAITING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  DISPENSING: 'Đang mở tủ',
  COMPLETED: 'Đã nhận hoa',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết thời gian giữ hoa',
  DISPENSE_FAILED: 'Tủ gặp sự cố',
  REFUNDED: 'Đã hoàn tiền',
  DISPUTED: 'Đang xử lý phản ánh',
};

export default function CustomerAccount({
  device,
  token,
  online,
  onBack,
  onExit,
  onFinish,
  canForgetAccount = true,
}: {
  device: Device;
  token: string;
  online: boolean;
  onBack: () => void;
  onExit: () => void;
  onFinish: (message: string) => void;
  canForgetAccount?: boolean;
}) {
  const [history, setHistory] = useState<History | null>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const check = useRef<HTMLInputElement>(null);
  const epoch = useRef(0);
  const sending = useRef(false);
  useLayoutEffect(() => {
    heading.current?.focus();
  }, [review]);
  useEffect(() => {
    function invalidate() {
      epoch.current++;
    }
    function hide() {
      if (document.hidden) onExit();
    }
    document.addEventListener('visibilitychange', hide);
    return () => {
      invalidate();
      document.removeEventListener('visibilitychange', hide);
    };
  }, [onExit]);
  async function load(page: number) {
    if (sending.current || !online) return;
    sending.current = true;
    setBusy(true);
    setError('');
    const version = ++epoch.current;
    try {
      const result = await request<History>(
        device,
        `/customer/history?page=${page}`,
        undefined,
        token,
      );
      if (version === epoch.current) setHistory(result);
    } catch (cause) {
      if (version !== epoch.current) return;
      if (cause instanceof ApiError && cause.status === 401)
        onFinish('Phiên đã hết hiệu lực. Bạn có thể xác thực số điện thoại để tiếp tục.');
      else setError('Chưa tải được lịch sử. Kiểm tra kết nối rồi chọn tải lại.');
    } finally {
      if (version === epoch.current) {
        sending.current = false;
        setBusy(false);
      }
    }
  }
  async function forget() {
    if (sending.current || !online) return;
    if (!confirmed) {
      setError('Vui lòng xác nhận bạn đã hiểu thông tin sẽ xóa và dữ liệu được giữ lại.');
      check.current?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);
    setError('');
    const version = ++epoch.current;
    try {
      await request(device, '/flows/forget_customer', {}, token);
      if (version === epoch.current)
        onFinish(
          'Đã xóa thông tin định danh và điểm tích lũy. Phiên đã kết thúc; các chứng từ giao dịch vẫn được giữ lại.',
        );
    } catch (cause) {
      if (version !== epoch.current) return;
      if (
        cause instanceof ApiError &&
        cause.status >= 400 &&
        cause.status < 500 &&
        cause.status !== 401
      ) {
        setError(cause.message);
        sending.current = false;
        setBusy(false);
      } else
        onFinish(
          'Chưa xác nhận được kết quả xóa. Phiên đã kết thúc để bảo vệ thông tin; hãy xác thực lại trước khi kiểm tra.',
        );
    }
  }
  return (
    <section className="customer-account" aria-labelledby="account-title">
      <h1 id="account-title" tabIndex={-1} ref={!review ? heading : undefined}>
        Những lần bạn ghé FloraBot
      </h1>
      <p>
        Lịch sử mua và điểm tích lũy chỉ hiển thị trong phiên này. Kết thúc phiên trước khi rời tủ;
        rời tab cũng sẽ đóng phiên đang xem lịch sử.
      </p>
      {!online && (
        <p role="status">Đang ngoại tuyến. Kết nối lại để xem lịch sử hoặc gửi yêu cầu xóa.</p>
      )}
      <div className="otp-actions">
        <Button variant="outline" disabled={busy} onClick={onBack}>
          Trở lại chọn hoa
        </Button>
        <Button variant="outline" onClick={onExit}>
          Kết thúc phiên riêng tư
        </Button>
      </div>
      <p role="alert" id="account-error" className="error">
        {error}
      </p>
      <p role="status">
        {busy
          ? 'Đang xử lý…'
          : history && !error
            ? `Đã tải trang ${history.page} của lịch sử mua.`
            : ''}
      </p>
      {!review ? (
        <>
          <Button disabled={busy || !online} onClick={() => void load(Number(history?.page ?? 1))}>
            {history ? 'Tải lại lịch sử' : 'Xem lịch sử mua'}
          </Button>
          {history && (
            <>
              <p className="customer-session">
                Điểm hiện có: <strong>{number(history.loyaltyPoints)} điểm</strong>
              </p>
              {history.items.length === 0 ? (
                <p>Chưa có đơn hàng trong trang lịch sử này.</p>
              ) : (
                <ul className="customer-history">
                  {history.items.map((order) => (
                    <li key={order.id}>
                      <h2>{order.shopName}</h2>
                      <p>Đơn {order.orderCode}</p>
                      <p>
                        {new Date(order.createdAt).toLocaleString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}{' '}
                        · {statuses[order.status] ?? 'Đang cập nhật'}
                      </p>
                      <p>{order.items.join(', ') || 'Chưa có thông tin sản phẩm.'}</p>
                      <dl>
                        <div>
                          <dt>Giá trị đơn</dt>
                          <dd>{number(order.totalAmount)} đ</dd>
                        </div>
                        <div>
                          <dt>Điểm đã nhận</dt>
                          <dd>{number(order.pointsEarned)}</dd>
                        </div>
                        <div>
                          <dt>Điểm đã dùng</dt>
                          <dd>{number(order.pointsRedeemed)}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
              <div className="otp-actions">
                <Button
                  variant="outline"
                  disabled={busy || !online || Number(history.page) <= 1}
                  onClick={() => void load(Number(history.page) - 1)}
                >
                  Trang trước
                </Button>
                <span>Trang {history.page}</span>
                <Button
                  variant="outline"
                  disabled={busy || !online || !history.hasMore}
                  onClick={() => void load(Number(history.page) + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </>
          )}
          <div className="customer-erasure">
            <h2>Quản lý thông tin cá nhân</h2>
            {!canForgetAccount || history?.canForgetAccount === false ? (
              <p>
                Tài khoản này đang quản lý shop. Vui lòng liên hệ hỗ trợ trên website để xử lý tài
                khoản và các nghĩa vụ còn lại của shop.
              </p>
            ) : (
              <>
                <p>
                  Bạn có thể yêu cầu xóa thông tin định danh gắn với tài khoản này. Hãy đọc rõ những
                  dữ liệu được giữ lại trước khi quyết định.
                </p>
                <Button
                  variant="outline"
                  disabled={busy || !online}
                  onClick={() => {
                    setHistory(null);
                    setError('');
                    setConfirmed(false);
                    setReview(true);
                  }}
                >
                  Tìm hiểu và yêu cầu xóa
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="customer-erasure">
          <h2 tabIndex={-1} ref={heading}>
            Xác nhận xóa thông tin định danh
          </h2>
          <p>
            Số điện thoại và email hiện tại sẽ được gỡ khỏi tài khoản, tên được ẩn danh, điểm tích
            lũy về 0 và tài khoản ngừng hoạt động. Bạn sẽ được đăng xuất.
          </p>
          <p>
            Đơn hàng, thanh toán và nhật ký vẫn được giữ lại để đối chiếu. Tài khoản ngân hàng cho
            khoản hoàn đang chờ không bị xóa ở bước này; thông tin đó được xóa sau khi chi hoàn
            xong.
          </p>
          <p>
            Nếu xác thực lại cùng số điện thoại sau này, bạn sẽ có tài khoản mới, không khôi phục
            điểm hoặc lịch sử của tài khoản đã xóa.
          </p>
          <label className="erasure-confirm">
            <input
              ref={check}
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              aria-describedby="account-error"
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Tôi đã hiểu và muốn xóa thông tin định danh cùng điểm tích lũy.
          </label>
          <div className="otp-actions">
            <Button disabled={busy || !online} onClick={() => void forget()}>
              Xác nhận xóa và kết thúc phiên
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setReview(false);
                setError('');
              }}
            >
              Giữ tài khoản của tôi
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
