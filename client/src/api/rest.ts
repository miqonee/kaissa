/** Keep status codes available to callers: a network failure is not a sign-out. */
export class ApiError extends Error {
  constructor(message: string, public status = 0) { super(message); this.name = 'ApiError'; }
}
async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method, credentials: 'include', signal: controller.signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch { throw new ApiError('Сервер временно недоступен. Попробуйте ещё раз', res.status); }
    if (!res.ok) throw new ApiError(typeof data.error === 'string' ? data.error : `Ошибка ${res.status}`, res.status);
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(controller.signal.aborted ? 'Сервер не ответил вовремя. Попробуйте ещё раз' : 'Нет связи с сервером. Проверьте соединение');
  } finally { clearTimeout(timer); }
}
export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body: unknown) => request<T>('POST', url, body),
  delete: <T>(url: string) => request<T>('DELETE', url),
};
