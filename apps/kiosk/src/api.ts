import { QueryClient } from '@tanstack/react-query';
import type { components } from '../../../packages/contracts/src/generated/api';
export type Checkout = components['schemas']['CheckoutResponse'];
export type PaymentLink = components['schemas']['PaymentLinkResponse'];
export type Device = { id: string; key: string };
export type CustomerSession = components['schemas']['CustomerSession'];
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 5000 }, mutations: { retry: false } },
});
export async function request<T>(
  device: Device,
  path: string,
  body?: unknown,
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`/api/kiosks/${device.id}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : { 'X-Kiosk-Key': device.key }),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as {
      detail?: string;
      title?: string;
      message?: string;
    };
    throw new ApiError(
      response.status,
      problem.detail ||
        problem.message ||
        problem.title ||
        (response.status === 429
          ? 'Bạn thử quá nhiều lần. Vui lòng chờ trước khi thử lại.'
          : 'Chưa kết nối được tủ hoa. Bạn vui lòng thử lại.'),
    );
  }
  return response.json() as Promise<T>;
}
