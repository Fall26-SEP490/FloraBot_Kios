import * as z from 'zod/mini';
export const registrationSchema = z.object({
  shopName: z
    .string()
    .check(
      z.trim(),
      z.minLength(2, 'Nhập tên shop từ 2 ký tự.'),
      z.maxLength(120, 'Tên shop tối đa 120 ký tự.'),
    ),
  phone: z
    .string()
    .check(
      z.regex(/^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$/, 'Nhập số điện thoại Việt Nam hợp lệ.'),
    ),
  area: z
    .string()
    .check(
      z.trim(),
      z.minLength(2, 'Nhập khu vực của shop.'),
      z.maxLength(200, 'Khu vực tối đa 200 ký tự.'),
    ),
  packageId: z.enum(
    ['20000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000b'],
    { error: 'Chọn gói bạn quan tâm.' },
  ),
  website: z.optional(z.string().check(z.maxLength(0))),
});
export type RegistrationInput = z.infer<typeof registrationSchema>;
export const packages = [
  { id: '20000000-0000-0000-0000-00000000000a', name: 'Cơ bản', fee: 400000, slots: 3 },
  { id: '20000000-0000-0000-0000-00000000000b', name: 'Chuyên nghiệp', fee: 1500000, slots: 10 },
] as const;
export const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
