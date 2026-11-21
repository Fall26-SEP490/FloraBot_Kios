// Tag codes follow the seller product form.
export const flowerTags = {
  rose: 'Hoa hồng',
  sunflower: 'Hướng dương',
  tulip: 'Tulip',
  chrysanthemum: 'Hoa cúc',
  gerbera: 'Đồng tiền',
  lisianthus: 'Cát tường',
  carnation: 'Cẩm chướng',
  hydrangea: 'Cẩm tú cầu',
  lily: 'Hoa ly',
  orchid: 'Hoa lan',
  peony: 'Mẫu đơn',
  'babys-breath': 'Hoa baby',
  other: 'Loại khác',
};

export const flowerColors = {
  red: 'Đỏ',
  pink: 'Hồng',
  white: 'Trắng',
  yellow: 'Vàng',
  orange: 'Cam',
  purple: 'Tím',
  blue: 'Xanh',
  multicolor: 'Nhiều màu',
};

export const flowerMaterials = {
  wax: 'Sáp',
  fabric: 'Lụa/vải',
  yarn: 'Len',
  paper: 'Giấy',
  plastic: 'Nhựa',
  other: 'Khác',
};

export const giftTagGroups = {
  flower: { label: 'Loại hoa', options: flowerTags },
  color: { label: 'Màu sắc', options: flowerColors },
  material: { label: 'Chất liệu', options: flowerMaterials },
};
export type GiftPreferences = { flower: string; color: string; material: string };
export function matchesGiftTags(tags: readonly string[] | undefined, preferences: GiftPreferences) {
  return Object.entries(preferences).every(
    ([group, value]) => !value || (tags ?? []).includes(`${group}:${value}`),
  );
}
