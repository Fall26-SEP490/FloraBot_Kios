import { useEffect, useRef, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowRight, Button, Flower2, PackageCheck } from '@florabot/ui';
import { KioskBrand } from './KioskIdentity';
import { MaintenanceAccess } from './MaintenanceAccess';
import { LanguagePicker, useKioskLanguage } from './kiosk-language';
import type { Device } from './api';

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
  homeLabel,
  children,
}: {
  onHome?: () => void;
  title?: string;
  homeDisabled?: boolean;
  homeLabel?: string;
  children?: ReactNode;
}) {
  const { tr } = useKioskLanguage();
  return (
    <header className="kh-header">
      <KioskBrand />
      {title && <span className="kh-header-title">{title}</span>}
      <div className="kh-header-actions">
        {onHome && (
          <Button variant="outline" onClick={onHome} disabled={homeDisabled}>
            {homeLabel ?? tr('Trang chủ', 'Home')}
          </Button>
        )}
        {children}
        <LanguagePicker />
      </div>
    </header>
  );
}

export default function KioskHome({
  device,
  onBuy,
  onPickup,
  onReplacement,
  preview = false,
  notice = '',
}: {
  device: Device;
  onBuy: () => void;
  onPickup: () => void;
  onReplacement?: () => void;
  preview?: boolean;
  notice?: string;
}) {
  const { tr } = useKioskLanguage();
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);
  return (
    <div className="kh-shell">
      <KioskHeader>{!preview && <MaintenanceAccess key={device.id} device={device} />}</KioskHeader>
      <main id="main" className="kh-main">
        {notice && (
          <p className="notice" role="status" ref={noticeRef} tabIndex={-1}>
            {notice}
          </p>
        )}
        <section className="kh-watercolor-welcome" aria-labelledby="kh-watercolor-title">
          <div className="kh-watercolor-copy">
            <h1 id="kh-watercolor-title">
              {tr('Hôm nay,', 'Who would you')}
              <br />
              {tr('bạn muốn trao', 'like to bring')}
              <br />
              <em>{tr('niềm vui nào?', 'joy to today?')}</em>
            </h1>
            <p>{tr('Một món quà, ngàn lời thương.', 'A little gift, a thousand words.')}</p>
          </div>
        </section>
        {
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
                <strong>{tr('Mua hoa tại chỗ', 'Buy flowers here')}</strong>
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
                <strong>{tr('Nhận đơn đặt trước', 'Collect a preorder')}</strong>
              </span>
              <ArrowRight size={27} aria-hidden="true" />
            </button>
          </section>
        }
        <section className="kh-help" aria-labelledby="kh-help-title">
          <div className="kh-help-intro">
            <h2 id="kh-help-title">{tr('Bạn cần giúp đỡ?', 'Need a hand?')}</h2>
            {onReplacement && (
              <Button type="button" variant="outline" onClick={onReplacement}>
                {tr('Nhận hoa thay', 'Collect a replacement')}
              </Button>
            )}
          </div>
          {(['admin', 'shop'] as const).map((audience) => (
            <article className="kh-help-card" key={audience}>
              <div>
                <strong>
                  {audience === 'admin'
                    ? tr('Báo sự cố tủ', 'Report a kiosk issue')
                    : tr('Hỗ trợ đơn hàng & hoa', 'Order & flower support')}
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
      </main>
    </div>
  );
}
