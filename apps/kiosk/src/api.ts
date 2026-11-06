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
export function mapSetupError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Mã kiosk (UUID) hoặc khóa thiết bị (API key) chưa chính xác. Lưu ý: Mã hiển thị như K-DEMO-SIM chỉ là nhãn tủ, không phải khóa bí mật (API key). Vui lòng kiểm tra lại thông tin cấu hình được cấp.';
    }
    if (error.status === 429) {
      return 'Hệ thống đang bị giới hạn số lần kết nối (429). Vui lòng chờ giây lát trước khi thử lại.';
    }
    if (error.status === 404) {
      return 'Không tìm thấy kiosk tương ứng với mã UUID này trên hệ thống (404).';
    }
    if (error.status === 403) {
      return 'Khóa thiết bị không có quyền truy cập kiosk này (403).';
    }
    if (error.status >= 500) {
      return `Hệ thống tủ đang bảo trì hoặc máy chủ gặp sự cố (${error.status}). Vui lòng thử lại sau.`;
    }
    return 'Chưa kết nối được tủ hoa. Bạn vui lòng kiểm tra lại thông tin thiết lập.';
  }
  const isTimeout =
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')) ||
    (error instanceof Error && error.name === 'TimeoutError') ||
    (error instanceof Error && /timed_?out|timeout/i.test(error.message));
  if (isTimeout) {
    return 'Hết thời gian chờ phản hồi từ máy chủ (timeout). Vui lòng kiểm tra kết nối mạng và thử lại.';
  }
  const isNetwork =
    error instanceof TypeError ||
    (error instanceof Error && /fetch|network|failed|connection|load/i.test(error.message));
  if (isNetwork) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng hoặc địa chỉ máy chủ.';
  }
  return 'Chưa kết nối được tủ hoa. Bạn vui lòng kiểm tra kết nối mạng và thử lại.';
}
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 5000 }, mutations: { retry: false } },
});
export async function request<T>(
  device: Device,
  path: string,
  body?: unknown,
  accessToken?: string,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`/api/kiosks/${device.id}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      ...extraHeaders,
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
