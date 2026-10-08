import { useEffect, useRef, useState } from 'react';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { ApiError, request, type Device } from './api';

type Balance = components['schemas']['CustomerPointsResponse'];
export default function PointRedemption({
  device,
  token,
  online,
  disabled,
  onChange,
  onExit,
}: {
  device: Device;
  token: string;
  online: boolean;
  disabled: boolean;
  onChange: (points: number | null) => void;
  onExit: () => void;
}) {
  const [balance, setBalance] = useState<Balance>();
  const [value, setValue] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const epoch = useRef(0);
  useEffect(() => {
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
  const available = Number(balance?.loyaltyPoints);
  const valid =
    /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= available;
  async function read() {
    const current = ++epoch.current;
    setLoading(true);
    setError('');
    setBalance(undefined);
    setValue('0');
    onChange(0);
    try {
      const result = await request<Balance>(device, '/customer/points', undefined, token);
      if (epoch.current !== current) return;
      if (
        !Number.isSafeInteger(Number(result.loyaltyPoints)) ||
        Number(result.loyaltyPoints) < 0 ||
        !Number.isFinite(Number(result.maxRedeemPercent)) ||
        Number(result.maxRedeemPercent) < 0
      )
        throw new Error(
          'Chưa hiển thị được số điểm chính xác. Bạn vẫn có thể mua hoa mà không đổi điểm.',
        );
      setBalance(result);
    } catch (cause) {
      if (epoch.current !== current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        onExit();
        return;
      }
      setError(cause instanceof Error ? cause.message : 'Chưa lấy được số điểm. Bạn thử lại nhé.');
    } finally {
      if (epoch.current === current) setLoading(false);
    }
  }
  return (
    <div className="point-redemption">
      <h2>Đổi điểm cho bó hoa hôm nay</h2>
      <Button
        variant="outline"
        disabled={!online || disabled || loading}
        onClick={() => void read()}
      >
        {loading ? 'Đang xem điểm…' : balance ? 'Cập nhật số điểm' : 'Xem điểm có thể dùng'}
      </Button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {balance && (
        <>
          <p role="status">
            Bạn có {available.toLocaleString('vi-VN')} điểm. Mỗi điểm giảm 1 đồng.
          </p>
          <label htmlFor="redeem-points">Số điểm muốn dùng</label>
          <input
            id="redeem-points"
            inputMode="numeric"
            autoComplete="off"
            value={value}
            disabled={!online || disabled}
            aria-invalid={!valid}
            aria-describedby={`points-help${valid ? '' : ' points-error'}`}
            onChange={(event) => {
              const next = event.target.value;
              setValue(next);
              onChange(
                /^\d+$/.test(next) &&
                  Number.isSafeInteger(Number(next)) &&
                  Number(next) <= available
                  ? Number(next)
                  : null,
              );
            }}
          />
          <p id="points-help">
            Để 0 nếu bạn muốn giữ điểm cho lần sau. Bạn có thể đổi tối đa{' '}
            {Number(balance.maxRedeemPercent).toLocaleString('vi-VN')}% giá trị đơn của shop có tổng
            tiền lớn nhất trong giỏ. Hệ thống kiểm tra hạn mức và số dư khi giữ hoa.
          </p>
          {!valid && (
            <p id="points-error" className="error" role="alert">
              Nhập số nguyên từ 0 đến {available.toLocaleString('vi-VN')} điểm.
            </p>
          )}
          <p className="quiet">
            Điểm được trừ khi giữ hoa và trả lại nếu giỏ chưa thanh toán bị hủy hoặc hết hạn.
          </p>
        </>
      )}
    </div>
  );
}
