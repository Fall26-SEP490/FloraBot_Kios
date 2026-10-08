export default function GiftMessage({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  // PostgreSQL length(text) counts Unicode code points rather than UTF-16 units.
  const length = Array.from(value).length;
  return (
    <div className="gift-message-editor">
      <h2>Vài lời dành cho người thương</h2>
      <label htmlFor="ecard-message">Lời nhắn tặng hoa (không bắt buộc)</label>
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
      <p id="ecard-count">{length}/150 ký tự</p>
      <p id="ecard-help" className="quiet">
        Lời nhắn được lưu cùng đơn. Hiện chưa hỗ trợ in thiệp hoặc gửi riêng cho người nhận.
      </p>
      {length > 150 && (
        <p id="ecard-error" className="error" role="alert">
          Rút gọn thêm {length - 150} ký tự để lưu lời nhắn nhé.
        </p>
      )}
    </div>
  );
}
