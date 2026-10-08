import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';

export default function AccessoryPicker({
  items,
  quantities,
  opened,
  loading,
  error,
  disabled,
  onOpen,
  onChange,
  onClear,
  invalid,
}: {
  items: components['schemas']['KioskAccessoryResponse'][] | undefined;
  quantities: Record<string, string>;
  opened: boolean;
  loading: boolean;
  error: string | undefined;
  disabled: boolean;
  onOpen: () => void;
  onChange: (id: string, value: string) => void;
  onClear: () => void;
  invalid: boolean;
}) {
  return (
    <section className="accessory-picker" aria-labelledby="accessory-title">
      <h2 id="accessory-title">Thêm một chút cho món quà</h2>
      <p>
        Chọn phụ kiện tại tủ nếu bạn cần. Bạn có thể mua cùng hoa hoặc mua riêng, rồi lấy ở ngăn phụ
        kiện sau khi thanh toán.
      </p>
      <Button
        variant="outline"
        disabled={disabled}
        aria-busy={opened && loading}
        onClick={() => {
          if (!opened || !loading) onOpen();
        }}
      >
        {!opened
          ? 'Xem phụ kiện tại tủ'
          : loading
            ? 'Đang xem phụ kiện…'
            : error
              ? 'Tải lại phụ kiện'
              : 'Cập nhật phụ kiện'}
      </Button>
      {opened && loading && <p role="status">Đang xem phụ kiện còn sẵn…</p>}
      {error && (
        <p role="alert" className="error">
          Chưa lấy được danh sách phụ kiện. Bạn có thể tải lại hoặc bỏ phụ kiện để tiếp tục mua hoa.
        </p>
      )}
      {opened && items?.length === 0 && <p>Tủ hiện chưa có phụ kiện sẵn sàng.</p>}
      <ul className="accessories">
        {items?.map((item) => {
          const quantity = Number(quantities[item.id] || 0);
          const invalidQuantity =
            !Number.isSafeInteger(quantity) ||
            quantity < 0 ||
            quantity > Number(item.stockQuantity);
          const safePrice = Number.isSafeInteger(Number(item.price)) && Number(item.price) > 0;
          return (
            <li key={item.id}>
              <div>
                <h3>{item.name}</h3>
                <p>
                  {item.shopName} ·{' '}
                  {safePrice
                    ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                        Number(item.price),
                      )
                    : 'Chưa hiển thị được giá chính xác'}
                </p>
                <p id={`accessory-help-${item.id}`} className="quiet">
                  Còn {item.stockQuantity} · Để 0 nếu chưa cần.
                </p>
              </div>
              <div>
                <label htmlFor={`accessory-${item.id}`}>Số lượng {item.name}</label>
                <input
                  id={`accessory-${item.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={item.stockQuantity}
                  step={1}
                  value={quantities[item.id] ?? '0'}
                  disabled={disabled || !!error || !safePrice}
                  aria-invalid={invalidQuantity}
                  aria-describedby={`accessory-help-${item.id}${invalidQuantity ? ` accessory-error-${item.id}` : ''}`}
                  onChange={(event) => onChange(item.id, event.target.value)}
                />
                {invalidQuantity && (
                  <p id={`accessory-error-${item.id}`} className="error">
                    Nhập số nguyên từ 0 đến {item.stockQuantity}.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {invalid && (
        <p role="alert" className="error">
          Số lượng hoặc tình trạng phụ kiện chưa hợp lệ. Kiểm tra lại hoặc bỏ phụ kiện đã chọn.
        </p>
      )}
      {Object.values(quantities).some((value) => Number(value || 0) !== 0) && (
        <Button variant="outline" disabled={disabled} onClick={onClear}>
          Bỏ phụ kiện đã chọn
        </Button>
      )}
    </section>
  );
}
