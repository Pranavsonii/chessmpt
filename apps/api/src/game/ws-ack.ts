import type { ApiErrorBody } from '../common/api-response';

/**
 * Every socket event the client emits with a callback gets exactly one of these back.
 * The socket twin of the REST envelope (`ok` instead of `success`, same error body).
 *
 *   success: { ok: true,  data }
 *   error:   { ok: false, error: { code, message, details? } }
 */
export type Ack<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody };

/** Return this from a handler; Nest passes it to the client's ack callback. */
export const ok = <T>(data: T): Ack<T> => ({ ok: true, data });

export const fail = (error: ApiErrorBody): Ack<never> => ({ ok: false, error });
