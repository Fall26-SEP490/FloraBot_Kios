import { useKioskLanguage } from './kiosk-language';
import { Check, Flower2, PackageCheck, ShieldCheck } from '@florabot/ui';

export function KioskBrand() {
  const { tr } = useKioskLanguage();
  return (
    <div className="fb-brand" aria-label="FloraBot">
      <span className="fb-brand-mark">
        <Flower2 size={27} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span>
        FloraBot<span className="fb-brand-dot">.</span>
        <small>{tr('HOA ĐẸP · TRAO THƯƠNG', 'FLOWERS · WITH LOVE')}</small>
      </span>
    </div>
  );
}

export function KioskSteps({ stage = 0 }: { stage?: number }) {
  const { tr } = useKioskLanguage();
  return (
    <ol className="fb-steps" aria-label="Tiến trình mua hoa">
      {[
        tr('Chọn hoa', 'Choose flowers'),
        tr('Thanh toán', 'Payment'),
        tr('Nhận hoa', 'Collect'),
      ].map((label, index) => (
        <li key={label} aria-current={stage === index ? 'step' : undefined}>
          <span>{index < stage ? <Check size={14} aria-hidden="true" /> : `0${index + 1}`}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export function KioskHero() {
  const { tr } = useKioskLanguage();
  return (
    <section className="fb-hero" aria-labelledby="fb-hero-title">
      <div className="fb-hero-copy">
        <p className="fb-eyebrow">
          <span /> {tr('MỘT CHÚT HOA, MỘT CHÚT THƯƠNG', 'A LITTLE FLOWER, A LITTLE LOVE')}
        </p>
        <h1 id="fb-hero-title">
          {tr('Một bó hoa,', 'A bouquet,')}
          <br />
          <em>{tr('một ngày vui.', 'a brighter day.')}</em>
        </h1>
        <p>
          {tr('Gửi một món quà nhỏ. Giữ một niềm vui lâu.', 'A little gift. A lasting joy.')}
          <br />
          {tr(
            'Chọn bó hoa bạn thích và nhận ngay tại tủ.',
            'Pick a bouquet you love and collect it here.',
          )}
        </p>
        <div className="fb-hero-features">
          <span>
            <Flower2 size={17} aria-hidden="true" />{' '}
            {tr('Hoa nhân tạo cao cấp', 'Premium artificial flowers')}
          </span>
          <span>
            <PackageCheck size={17} aria-hidden="true" />{' '}
            {tr('Chọn · Thanh toán · Nhận hoa', 'Choose · Pay · Collect')}
          </span>
        </div>
      </div>
      <div className="fb-hero-art">
        <img
          src={`${import.meta.env.BASE_URL}images/demo-pastel-bouquet.png`}
          width={500}
          height={500}
          alt="Bó hoa nhân tạo tông hồng và tím pastel, ảnh minh họa"
          fetchPriority="high"
        />
        <span className="fb-hero-stamp">
          <Flower2 size={23} aria-hidden="true" />
          <span>
            {tr('Một món quà', 'A little gift')}
            <br />
            <em>{tr('thay lời muốn nói', 'says it all')}</em>
          </span>
        </span>
        <span className="fb-image-note">{tr('HÌNH ẢNH MINH HỌA', 'ILLUSTRATIVE IMAGE')}</span>
      </div>
    </section>
  );
}

export function KioskFooter() {
  const { tr } = useKioskLanguage();
  return (
    <footer className="fb-footer">
      <span>
        <Flower2 size={18} aria-hidden="true" />{' '}
        {tr(
          'Một bó hoa cho người thương. Một chút yêu cho chính mình.',
          'Flowers for someone special. A little love for yourself.',
        )}
      </span>
      <span>
        <ShieldCheck size={16} aria-hidden="true" />{' '}
        {tr('Thanh toán qua payOS', 'Payments by payOS')}
      </span>
    </footer>
  );
}
