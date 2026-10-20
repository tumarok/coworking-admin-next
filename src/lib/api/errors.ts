import { apiErrorSchema, type ApiErrorBody, type BookingConflict } from '@/lib/contract/common';

/** An error response of the API (or of the BFF, which uses the same body). */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string> | undefined;
  readonly conflicts: BookingConflict[] | undefined;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = body.fieldErrors;
    this.conflicts = body.conflicts;
  }
}

/** Body used when the response carries no usable error body (HTML from a proxy, empty body). */
export const fallbackErrorMessage = (status: number) =>
  status >= 500 ? 'The server failed to handle the request' : 'The request failed';

/** Reads the error body of a non-2xx response; never throws. */
export const parseApiError = async (response: Response): Promise<ApiError> => {
  const text = await response.text().catch(() => '');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  const parsed = apiErrorSchema.safeParse(json);
  return new ApiError(
    response.status,
    parsed.success ? parsed.data : { message: fallbackErrorMessage(response.status) },
  );
};
