/** User shape that is safe to send to the browser. */
export type PublicUser = {
  id: string;
  name: string;
  connectionId: string;
  avatar: string | null;
};

/** Partner shape: never exposes the partner's connection ID or internals. */
export type PartnerInfo = {
  name: string;
  avatar: string | null;
};

export type ApiFailure = { ok: false; error: string; code?: string };
export type ApiResponse<T> = ({ ok: true } & T) | ApiFailure;
