import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@florabot/ui';
import type { components } from '../../../packages/contracts/src/generated/api';
import { ApiError } from './api';

const choices = {
  recipient: [
    ['MOTHER', 'Mẹ'],
    ['FATHER', 'Bố'],
    ['LOVER', 'Người yêu'],
    ['FRIEND', 'Bạn bè'],
    ['COLLEAGUE', 'Đồng nghiệp'],
    ['TEACHER', 'Thầy cô'],
    ['BOSS', 'Cấp trên'],
    ['OTHER', 'Người khác'],
  ],
  age: [
    ['UNDER_18', 'Dưới 18 tuổi'],
    ['18_25', '18–25 tuổi'],
    ['26_40', '26–40 tuổi'],
    ['41_60', '41–60 tuổi'],
    ['OVER_60', 'Trên 60 tuổi'],
  ],
  occasion: [
    ['BIRTHDAY', 'Sinh nhật'],
    ['ANNIVERSARY', 'Kỷ niệm'],
    ['VALENTINE', 'Valentine'],
    ['WOMENS_DAY', 'Ngày Phụ nữ'],
    ['TEACHERS_DAY', 'Ngày Nhà giáo'],
    ['MOTHERS_DAY', 'Ngày của Mẹ'],
    ['APOLOGY', 'Lời xin lỗi'],
    ['CONGRATS', 'Chúc mừng'],
    ['SYMPATHY', 'Chia buồn'],
    ['OTHER', 'Một dịp khác'],
  ],
  tone: [
    ['WARM', 'Ấm áp'],
    ['ROMANTIC', 'Lãng mạn'],
    ['FORMAL', 'Trang trọng'],
    ['FUNNY', 'Vui vẻ'],
  ],
} as const;
const schema = z.object({
  recipient: z.enum([
    'MOTHER',
    'FATHER',
    'LOVER',
    'FRIEND',
    'COLLEAGUE',
    'TEACHER',
    'BOSS',
    'OTHER',
  ]),
  age: z.enum(['UNDER_18', '18_25', '26_40', '41_60', 'OVER_60']),
  occasion: z.enum([
    'BIRTHDAY',
    'ANNIVERSARY',
    'VALENTINE',
    'WOMENS_DAY',
    'TEACHERS_DAY',
    'MOTHERS_DAY',
    'APOLOGY',
    'CONGRATS',
    'SYMPATHY',
    'OTHER',
  ]),
  tone: z.enum(['WARM', 'ROMANTIC', 'FORMAL', 'FUNNY']),
  budget: z
    .number({ error: 'Nhập ngân sách bằng số.' })
    .int('Nhập số tiền tròn đồng.')
    .min(1, 'Ngân sách cần lớn hơn 0 đ.')
    .max(1_000_000_000, 'Ngân sách tối đa 1 tỷ đồng.'),
});
type Values = z.infer<typeof schema>;
type Props = {
  request: <T>(path: string, body?: unknown) => Promise<T>;
  online: boolean;
  disabled: boolean;
  available: Set<string>;
  selected: string[];
  onSelect: (id: string) => void;
  onUseMessage: (message: string) => void;
};
const labels = {
  recipient: 'Bạn muốn tặng ai?',
  age: 'Người ấy bao nhiêu tuổi?',
  occasion: 'Bạn tặng vào dịp nào?',
  tone: 'Bạn muốn gửi lời thế nào?',
};
const money = (price: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(price));

export default function GiftAdvisor({
  request,
  online,
  disabled,
  available,
  selected,
  onSelect,
  onUseMessage,
}: Props) {
  const [session] = useState(() => crypto.randomUUID());
  const [surveyId, setSurveyId] = useState<string>();
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      recipient: 'MOTHER',
      age: '41_60',
      occasion: 'BIRTHDAY',
      tone: 'WARM',
      budget: 300000,
    },
  });
  const create = useMutation({
    mutationFn: async (values: Values) => {
      const input: components['schemas']['AiSuggestRequest'] = {
        p_session: session,
        p_recipient: values.recipient,
        p_age: values.age,
        p_occasion: values.occasion,
        p_tone: values.tone,
        p_budget: values.budget,
      };
      const result = await request<components['schemas']['FlowResult']>('/flows/ai_suggest', input);
      if (typeof result.result !== 'string' || !z.uuid().safeParse(result.result).success)
        throw new Error('Chưa nhận được gợi ý. Bạn thử lại nhé.');
      return result.result;
    },
    onSuccess: (id) => setSurveyId(id),
  });
  const survey = useQuery({
    queryKey: ['gift-survey', session, surveyId],
    queryFn: () => request<components['schemas']['GiftSurveyResponse']>(`/surveys/${surveyId}`),
    enabled: !!surveyId && online,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (survey.data?.id) heading.current?.focus();
  }, [survey.data?.id]);
  const busy = create.isPending || (!!surveyId && survey.isFetching);
  const locked = disabled || !online || busy;
  return (
    <details className="gift-advisor">
      <summary>Cần một chút gợi ý để chọn hoa?</summary>
      <p>
        Nghĩ về người bạn muốn tặng. Năm câu trả lời nhỏ sẽ giúp bạn tìm một bó hoa phù hợp trong
        tủ.
      </p>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setSurveyId(undefined);
          setNotice('');
          create.mutate(values);
        })}
      >
        <fieldset disabled={locked}>
          <legend className="sr-only">Sở thích và ngân sách tặng hoa</legend>
          <div className="advisor-fields">
            {(Object.keys(choices) as Array<keyof typeof choices>).map((field) => (
              <div key={field}>
                <label htmlFor={`gift-${field}`}>{labels[field]}</label>
                <select id={`gift-${field}`} {...form.register(field)}>
                  {choices[field].map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div>
              <label htmlFor="gift-budget">Ngân sách tối đa (đồng)</label>
              <input
                id="gift-budget"
                type="number"
                inputMode="numeric"
                min="1"
                max="1000000000"
                step="1"
                {...form.register('budget', { valueAsNumber: true })}
                aria-invalid={!!form.formState.errors.budget}
                aria-describedby="gift-budget-error"
              />
              <p id="gift-budget-error" className="error">
                {form.formState.errors.budget?.message}
              </p>
            </div>
          </div>
          <Button type="submit">{busy ? 'Đang tìm hoa phù hợp…' : 'Tìm hoa phù hợp'}</Button>
        </fieldset>
      </form>
      {busy && <p role="status">Đang xem những bó hoa dành cho bạn…</p>}
      {create.isError && (
        <p role="alert" className="error">
          {create.error instanceof ApiError
            ? create.error.message
            : 'Chưa nhận được gợi ý. Câu trả lời vẫn được giữ, bạn thử lại nhé.'}
        </p>
      )}
      {surveyId && survey.isError && (
        <div>
          <p role="alert" className="error">
            Chưa tải được gợi ý đã tạo. Bạn có thể tải lại mà không cần trả lời lần nữa.
          </p>
          <Button
            variant="outline"
            disabled={!online || disabled}
            onClick={() => void survey.refetch()}
          >
            Tải lại gợi ý
          </Button>
        </div>
      )}
      {survey.data && (
        <section aria-labelledby="gift-result-title">
          <h2 id="gift-result-title" ref={heading} tabIndex={-1}>
            Một chút cảm hứng cho món quà
          </h2>
          <p className="quiet">
            {survey.data.source === 'FALLBACK'
              ? 'Gợi ý dựa trên dịp tặng và ngân sách bạn chọn.'
              : 'Gợi ý có hỗ trợ AI, đã được kiểm tra theo hoa trong tủ.'}{' '}
            Hoa chỉ được giữ khi bạn chuyển sang thanh toán.
          </p>
          {survey.data.suggestions.length === 0 && (
            <p>
              Chưa có bó hoa phù hợp lúc này. Bạn thử đổi ngân sách hoặc xem hoa đang có trong tủ
              nhé.
            </p>
          )}
          <ol className="advisor-results">
            {survey.data.suggestions.map((item) => (
              <li key={item.bouquetId}>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.reason}</p>
                  {item.cardMessage && (
                    <div>
                      <p className="gift-message">Lời nhắn gợi ý: “{item.cardMessage}”</p>
                      <Button
                        variant="outline"
                        disabled={locked}
                        onClick={() => {
                          onUseMessage(item.cardMessage!);
                          setNotice(
                            'Đã điền lời nhắn vào giỏ. Bạn có thể sửa trước khi thanh toán.',
                          );
                        }}
                      >
                        Dùng lời nhắn này
                      </Button>
                    </div>
                  )}
                  <p>
                    <strong>{money(item.price)}</strong>
                  </p>
                </div>
                <div>
                  <Button
                    variant="outline"
                    disabled={
                      locked || !available.has(item.bouquetId) || selected.includes(item.bouquetId)
                    }
                    onClick={() => {
                      onSelect(item.bouquetId);
                      setNotice(`Đã thêm ${item.name} vào giỏ hoa.`);
                    }}
                  >
                    {selected.includes(item.bouquetId) ? 'Đã chọn bó này' : `Chọn ${item.name}`}
                  </Button>
                  {!available.has(item.bouquetId) && (
                    <p className="quiet">Bó này hiện không còn sẵn sàng.</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      <p role="status">{notice}</p>
    </details>
  );
}
