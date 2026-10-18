import BouquetImage from '../BouquetImage';
import { SLOT_STATUS_LABELS, type VirtualSlot as VirtualSlotModel } from './virtualCabinet.types';

export function VirtualSlot({ slot }: { slot: VirtualSlotModel }) {
  return (
    <article
      className={`virtual-slot virtual-slot--${slot.status.toLowerCase()}`}
      aria-label={`Ô ${slot.code}: ${SLOT_STATUS_LABELS[slot.status]}`}
    >
      <div className="virtual-slot__header">
        <strong>Ô {slot.code}</strong>
        <span className="virtual-slot__status">{SLOT_STATUS_LABELS[slot.status]}</span>
      </div>
      <div className="virtual-slot__chamber">
        <span className="virtual-slot__led" aria-hidden="true" />
        {slot.image && slot.bouquetName ? (
          <BouquetImage
            src={`${import.meta.env.BASE_URL}${slot.image}`}
            alt={slot.bouquetName}
            className="virtual-slot__image"
            width={260}
            height={150}
          />
        ) : (
          <div className="virtual-slot__empty">Ô trống</div>
        )}
        <div className="virtual-slot__door" aria-hidden="true">
          <span>{slot.status === 'OPEN' ? 'CỬA ĐANG MỞ' : 'FLORABOT'}</span>
        </div>
      </div>
      <p className="virtual-slot__product">{slot.bouquetName || 'Đang chờ nạp hoa'}</p>
    </article>
  );
}
