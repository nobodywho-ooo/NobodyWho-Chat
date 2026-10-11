import { Model } from 'types';

export const mockFetchResolve = (models: Model[]) => {
  (globalThis as any).fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: () => Promise.resolve(models) });
};

export const mockFetchReject = () => {
  (globalThis as any).fetch = jest
    .fn()
    .mockRejectedValue(new Error('network failure'));
};
