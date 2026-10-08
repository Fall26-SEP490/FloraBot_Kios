import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import { ApiError, request, type CustomerSession, type Device } from './api';

const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$/, 'Nhập số điện thoại Việt Nam hợp lệ.'),
});
const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Nhập đủ 6 chữ số trong tin nhắn.'),
});

export default function CustomerLogin({
  device,
  online,
  onReady,
}: {
  device: Device;
  online: boolean;
  onReady: (session: CustomerSession) => void;
}) {
  const [phone, setPhone] = useState<string>();
  const [cooldown, setCooldown] = useState(0);
  const phoneForm = useForm<z.infer<typeof phoneSchema>>({ resolver: zodResolver(phoneSchema) });
  const codeForm = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema) });
  useEffect(() => {
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  const send = useMutation({
    mutationFn: async (value: string) => {
      await request(device, '/otp/request', { phone: value });
      return value;
    },
    onSuccess: (value) => {
      setPhone(value);
      setCooldown(60);
      codeForm.reset();
      requestAnimationFrame(() => codeForm.setFocus('code'));
    },
  });
  const verify = useMutation({
    mutationFn: async (code: string) => {
      const result = await request<CustomerSession>(device, '/otp/verify', { phone, code });
      if (
        !result.accessToken ||
        !Number.isFinite(Number(result.expiresInSeconds)) ||
        Number(result.expiresInSeconds) <= 0
      )
        throw new Error('Chưa nhận được phiên hợp lệ. Vui lòng thử lại.');
      return result;
    },
    onSuccess: onReady,
  });
  return (
    <details className="customer-login">
      <summary>Đăng nhập bằng số điện thoại (không bắt buộc)</summary>
      <p>
        Bạn vẫn có thể chọn hoa và thanh toán không cần đăng nhập. Phiên xác thực trên tủ kéo dài
        tối đa 10 phút.
      </p>
      {!phone ? (
        <form noValidate onSubmit={phoneForm.handleSubmit((value) => send.mutate(value.phone))}>
          <label htmlFor="customer-phone">Số điện thoại</label>
          <input
            id="customer-phone"
            type="tel"
            autoComplete="tel"
            {...phoneForm.register('phone')}
            aria-invalid={!!phoneForm.formState.errors.phone}
            aria-describedby="customer-phone-error"
            disabled={send.isPending}
          />
          <p id="customer-phone-error" className="error">
            {phoneForm.formState.errors.phone?.message}
          </p>
          <Button type="submit" disabled={!online || send.isPending}>
            {send.isPending ? 'Đang gửi mã…' : 'Gửi mã xác thực'}
          </Button>
        </form>
      ) : (
        <>
          <p role="status">
            Mã đã được gửi đến số kết thúc bằng {phone.slice(-3)}. Mã có hiệu lực trong 3 phút.
          </p>
          <form noValidate onSubmit={codeForm.handleSubmit((value) => verify.mutate(value.code))}>
            <label htmlFor="customer-code">Mã xác thực</label>
            <input
              id="customer-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              {...codeForm.register('code')}
              aria-invalid={!!codeForm.formState.errors.code}
              aria-describedby="customer-code-error"
              disabled={verify.isPending}
            />
            <p id="customer-code-error" className="error">
              {codeForm.formState.errors.code?.message}
            </p>
            <Button type="submit" disabled={!online || verify.isPending || send.isPending}>
              {verify.isPending ? 'Đang xác thực…' : 'Xác nhận đăng nhập'}
            </Button>
          </form>
          <div className="otp-actions">
            <Button
              variant="outline"
              disabled={!online || cooldown > 0 || send.isPending || verify.isPending}
              onClick={() => {
                verify.reset();
                send.mutate(phone);
              }}
            >
              {cooldown > 0 ? `Gửi lại sau ${cooldown} giây` : 'Gửi lại mã'}
            </Button>
            <Button
              variant="outline"
              disabled={send.isPending || verify.isPending}
              onClick={() => {
                setPhone(undefined);
                codeForm.reset();
                verify.reset();
                send.reset();
              }}
            >
              Đổi số điện thoại
            </Button>
          </div>
        </>
      )}
      {send.isError && (
        <p role="alert" className="error">
          {send.error.message}
        </p>
      )}
      {verify.isError && (
        <p role="alert" className="error">
          {verify.error instanceof ApiError && verify.error.status === 401
            ? 'Mã chưa đúng hoặc đã hết hạn. Kiểm tra tin nhắn hoặc yêu cầu mã mới.'
            : verify.error.message}
        </p>
      )}
    </details>
  );
}
