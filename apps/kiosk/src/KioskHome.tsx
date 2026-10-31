import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowRight,
  Button,
  Flower2,
  KeyRound,
  MapPin,
  PackageCheck,
  ShieldCheck,
} from '@florabot/ui';
import { KioskBrand } from './KioskIdentity';
import { LanguagePicker, useKioskLanguage } from './kiosk-language';
import type { Device } from './api';
import type { components } from '../../../packages/contracts/src/generated/api';

export const portalUrl = (path: string) =>
  new URL(path, import.meta.env.VITE_PORTAL_URL || 'https://florabot-fe.vercel.app').toString();
export function supportUrl(id: string, audience: 'admin' | 'shop') {
  if (audience === 'shop') return portalUrl(`/ho-tro-cua-hang?kiosk=${encodeURIComponent(id)}`);
  const url = new URL(
    import.meta.env.VITE_PUBLIC_KIOSK_URL || 'https://florabot-kiosk.vercel.app/',
  );
  url.searchParams.set('support', 'device');
  url.searchParams.set('kiosk', id);
  return url.toString();
}

export function KioskHeader({
  onHome,
  title,
  homeDisabled = false,
}: {
  onHome?: () => void;
  title?: string;
  homeDisabled?: boolean;
}) {
  const { tr } = useKioskLanguage();
  return (
    <header className="kh-header">
      <KioskBrand />
      {title && <span className="kh-header-title">{title}</span>}
      <div className="kh-header-actions">
        {onHome && (
          <Button variant="outline" onClick={onHome} disabled={homeDisabled}>
            {tr('Trang chủ', 'Home')}
          </Button>
        )}
        <LanguagePicker />
      </div>
    </header>
  );
}

export default function KioskHome({
  device,
  onBuy,
  onPickup,
  preview = false,
  notice = '',
}: {
  device: Device;
  onBuy: () => void;
  onPickup: () => void;
  preview?: boolean;
  notice?: string;
}) {
  const { tr } = useKioskLanguage();
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);
  const [role, setRole] = useState<'customer' | 'staff'>('customer');
  const info = useQuery({
    queryKey: ['kiosk-home', device.id],
    enabled: !preview,
    queryFn: async () => {
      const response = await fetch(`/api/kiosk-support/${device.id}`, {
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Kiosk unavailable');
      return response.json() as Promise<components['schemas']['KioskHomeInfo']>;
    },
    refetchInterval: 30000,
  });
  return (
    <div className="kh-shell">
      <KioskHeader />
      <main id="main" className="kh-main">
        {notice && (
          <p className="notice" role="status" ref={noticeRef} tabIndex={-1}>
            {notice}
          </p>
        )}
        <div className="kh-context">
          <span>
            <MapPin size={17} aria-hidden="true" />
            {preview
              ? tr('Tủ hoa mẫu · Không điều khiển tủ thật', 'Demo kiosk · No real hardware')
              : info.data?.name || tr('Tủ hoa FloraBot', 'FloraBot flower kiosk')}
            {info.data?.code && ` · ${info.data.code}`}
          </span>
          <span>
            {info.data?.shopName || tr('Hoa nhân tạo cao cấp', 'Premium artificial flowers')}
          </span>
        </div>
        <section className="kh-welcome">
          <div>
            <p className="fb-eyebrow">
              {tr('CHẠM NHẸ, TRAO THƯƠNG', 'A LITTLE TOUCH. A LOT OF LOVE.')}
            </p>
            <h1>
              {tr('Hôm nay, bạn muốn', 'What brings you')}
              <br />
              <em>{tr('trao niềm vui nào?', 'a little joy today?')}</em>
            </h1>
            <p>
              {tr(
                'Chọn hoa tại tủ hoặc nhận món quà đã đặt. FloraBot luôn ở đây cùng bạn.',
                'Pick a bouquet at the kiosk or collect your order. Your next little joy starts here.',
              )}
            </p>
            <div className="kh-role" role="group" aria-label={tr('Bạn là ai?', 'Who are you?')}>
              <button aria-pressed={role === 'customer'} onClick={() => setRole('customer')}>
                {tr('Tôi là khách hàng', 'I am a customer')}
              </button>
              <button aria-pressed={role === 'staff'} onClick={() => setRole('staff')}>
                {tr('Tôi là nhân viên', 'I am staff')}
              </button>
            </div>
          </div>
          <div className="kh-welcome-image">
            <img
              src={`${import.meta.env.BASE_URL}images/demo-pastel-bouquet.png`}
              alt={tr(
                'Bó hoa nhân tạo pastel minh họa',
                'Illustration of a pastel artificial bouquet',
              )}
              width={500}
              height={500}
            />
            <span>{tr('Một món quà, ngàn lời thương.', 'A little gift, a thousand words.')}</span>
          </div>
        </section>
        {role === 'customer' ? (
          <section className="kh-actions" aria-label={tr('Chọn dịch vụ', 'Choose a service')}>
            <button
              className="kh-action kh-action-buy"
              aria-label={tr('Mua hoa tại chỗ', 'Buy flowers here')}
              onClick={onBuy}
            >
              <span className="kh-action-icon">
                <Flower2 size={35} strokeWidth={1.3} aria-hidden="true" />
              </span>
              <span className="kh-action-copy">
                <small>01 / {tr('CHỌN & NHẬN NGAY', 'PICK & TAKE HOME')}</small>
                <strong>{tr('Mua hoa tại chỗ', 'Buy flowers here')}</strong>
                <span>
                  {tr(
                    'Xem hoa trong từng ô · Thanh toán QR payOS',
                    'Browse bouquets by locker · Pay with payOS QR',
                  )}
                </span>
              </span>
              <ArrowRight size={27} aria-hidden="true" />
            </button>
            <button
              className="kh-action kh-action-pickup"
              aria-label={tr('Nhận đơn đặt trước', 'Collect a preorder')}
              onClick={onPickup}
            >
              <span className="kh-action-icon">
                <PackageCheck size={35} strokeWidth={1.3} aria-hidden="true" />
              </span>
              <span className="kh-action-copy">
                <small>02 / {tr('MÓN QUÀ ĐANG ĐỢI', 'YOUR GIFT IS WAITING')}</small>
                <strong>{tr('Nhận đơn đặt trước', 'Collect a preorder')}</strong>
                <span>
                  {tr(
                    'Nhập OTP email · Nhận hoa đặt trước',
                    'Enter email code · Collect your preorder',
                  )}
                </span>
              </span>
              <ArrowRight size={27} aria-hidden="true" />
            </button>
          </section>
        ) : (
          <section className="kh-staff">
            <ShieldCheck size={32} aria-hidden="true" />
            <div>
              <h2>{tr('Khu vực dành cho nhân viên', 'Staff workspace')}</h2>
              <p>
                {tr(
                  'Đăng nhập bằng tài khoản được cấp để xem công việc, nhập hoa và kiểm tra tủ. Chọn vai trò tại đây không cấp quyền mở khóa.',
                  'Sign in with your assigned account to manage tasks, stock flowers and inspect the kiosk. Selecting staff does not grant locker access.',
                )}
              </p>
              <a
                className="button button-primary"
                href={portalUrl('/workspace')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <KeyRound size={18} aria-hidden="true" />
                {tr('Đăng nhập nhân viên', 'Staff sign in')}
              </a>
            </div>
          </section>
        )}
        <section className="kh-help" aria-labelledby="kh-help-title">
          <div className="kh-help-intro">
            <span className="fb-eyebrow">{tr('LUÔN SẴN SÀNG HỖ TRỢ', 'WE ARE HERE TO HELP')}</span>
            <h2 id="kh-help-title">{tr('Bạn cần giúp đỡ?', 'Need a hand?')}</h2>
            <p>
              {tr(
                'Quét QR bằng điện thoại để gửi yêu cầu riêng tư.',
                'Scan a QR code on your phone for private support.',
              )}
            </p>
          </div>
          {(['admin', 'shop'] as const).map((audience) => (
            <article className="kh-help-card" key={audience}>
              <div>
                <strong>
                  {audience === 'admin'
                    ? tr('Báo lỗi tủ cho admin', 'Report a kiosk issue')
                    : tr('Liên hệ cửa hàng hoa', 'Contact the flower shop')}
                </strong>
                <p>
                  {audience === 'admin'
                    ? tr(
                        'Lỗi màn hình, kết nối, cửa không mở.',
                        'Screen, connection or locker problems.',
                      )
                    : tr(
                        'Hoa hư, giao nhầm hoặc cần hỗ trợ đơn.',
                        'Damaged or wrong flowers, order support.',
                      )}
                </p>
                <span>{tr('Dùng camera điện thoại để quét', 'Scan with your phone camera')}</span>
              </div>
              <QRCodeSVG
                role="img"
                aria-label={
                  audience === 'admin'
                    ? tr('QR báo lỗi thiết bị', 'Kiosk issue QR')
                    : tr('QR hỗ trợ cửa hàng', 'Flower shop support QR')
                }
                value={supportUrl(device.id, audience)}
                size={96}
                marginSize={2}
                title={
                  audience === 'admin'
                    ? tr('QR báo lỗi thiết bị', 'Kiosk issue QR')
                    : tr('QR hỗ trợ cửa hàng', 'Flower shop support QR')
                }
              />
            </article>
          ))}
        </section>
        <footer className="kh-footer">
          <span>
            FloraBot · {tr('Một chút hoa, một chút thương', 'A little flower, a little love')}
          </span>
          <span>
            {tr('Chọn dịch vụ trên màn hình để bắt đầu', 'Touch a service to get started')}
          </span>
        </footer>
      </main>
    </div>
  );
}
