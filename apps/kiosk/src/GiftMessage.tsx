import { useKioskLanguage } from './kiosk-language';
export default function GiftMessage({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { tr } = useKioskLanguage();
  // PostgreSQL length(text) counts Unicode code points rather than UTF-16 units.
  const length = Array.from(value).length;
  return (
    <div className="gift-message-editor">
      <h2>{tr('Vài lời dành cho người thương', 'A few words for someone special')}</h2>
      <label htmlFor="ecard-message">
        {tr('Lời nhắn tặng hoa (không bắt buộc)', 'Gift message (optional)')}
      </label>
      <textarea
        id="ecard-message"
        rows={3}
        value={value}
        disabled={disabled}
        autoComplete="off"
        aria-invalid={length > 150}
        aria-describedby={`ecard-help ecard-count${length > 150 ? ' ecard-error' : ''}`}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id="ecard-count">
        {length}/150 {tr('ký tự', 'characters')}
      </p>
      <p id="ecard-help" className="quiet">
        {tr(
          'Lời nhắn được lưu cùng đơn. Hiện chưa hỗ trợ in thiệp hoặc gửi riêng cho người nhận.',
          'Your message is saved with the order. Card printing and separate delivery are not currently available.',
        )}
      </p>
      {length > 150 && (
        <p id="ecard-error" className="error" role="alert">
          Rút gọn thêm {length - 150} ký tự để lưu lời nhắn nhé.
        </p>
      )}
    </div>
  );
}
