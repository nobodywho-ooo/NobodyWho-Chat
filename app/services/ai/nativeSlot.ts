import React, { useCallback, useMemo, useRef } from 'react';
import { log } from 'helpers';
import { Model, ModelSlot, modelSlotSpec } from 'types';

import { NativeBackend } from './nativeBackend';
import { AiModelState, AiServiceState, SlotStateKey } from './state';

export interface NativeInstance {
  destroy: () => void;
}

const attempt = (what: string, run: () => void) => {
  try {
    run();
  } catch (error) {
    log(`AiService ${what} failed`, error, { capture: true });
  }
};

export interface EngineSpec<TInstance extends NativeInstance, TOptions> {
  slot: ModelSlot;
  open: (
    model: Model,
    opts: TOptions,
  ) => Promise<{ instance: TInstance; state?: Partial<AiServiceState> }>;
  cleared?: Partial<AiServiceState>;
  stop?: (instance: TInstance) => void;
}

export interface NativeSlot<TInstance extends NativeInstance, TOptions> {
  ref: React.RefObject<TInstance | undefined>;
  create: (opts: TOptions & { model: Model }) => Promise<boolean>;
  dispose: () => void;
  borrow: <R>(
    work: (instance: TInstance) => Promise<R>,
  ) => Promise<R | undefined>;
}

export const useNativeSlot = <TInstance extends NativeInstance, TOptions>(
  spec: EngineSpec<TInstance, TOptions>,
  setState: React.Dispatch<React.SetStateAction<AiServiceState>>,
  backend: NativeBackend,
): NativeSlot<TInstance, TOptions> => {
  const { slot, open, cleared, stop } = spec;
  const { accepts } = modelSlotSpec(slot);
  const stateKey: SlotStateKey = `${slot}State`;

  const ref = useRef<TInstance | undefined>(undefined);
  const loadedModelId = useRef<number | undefined>(undefined);
  // Bumped on every dispose — see the generation note above.
  const generation = useRef(0);
  // Work borrowed against the live instance. A teardown waits for it: none of
  // these engines can be interrupted, so destroying under a running call frees
  // the handle from under Rust.
  const borrowed = useRef(new Set<Promise<unknown>>());

  const publish = useCallback(
    (next: AiModelState, extra?: Partial<AiServiceState>) =>
      setState(current => ({
        ...current,
        ...({ [stateKey]: next } as Partial<AiServiceState>),
        ...extra,
      })),
    [setState, stateKey],
  );

  const clearSlot = useCallback(() => {
    ref.current = undefined;
    loadedModelId.current = undefined;
  }, []);

  const release = useCallback(
    async (instance: TInstance) => {
      while (borrowed.current.size > 0) {
        await Promise.all([...borrowed.current]);
      }

      attempt(`${slot} stop`, () => stop?.(instance));
      attempt(`${slot} destroy`, () => instance.destroy());
    },
    [slot, stop],
  );

  const releaseAndSettle = useCallback(
    async (instance: TInstance) => {
      await release(instance);
      await backend.settleAfterFree();
    },
    [backend, release],
  );

  const create = useCallback(
    async (opts: TOptions & { model: Model }): Promise<boolean> => {
      const { model } = opts;

      if (ref.current && loadedModelId.current === model.id) {
        return true; // already serving exactly this model
      }

      if (!accepts(model.pipeline)) {
        throw new Error(
          `AiService: model ${model.id} (${model.name}) is not a valid ${slot} model`,
        );
      }

      const startedAt = generation.current;
      const outdated = () => startedAt !== generation.current;

      try {
        return await backend.allocate(async () => {
          if (outdated()) {
            return false;
          }

          const stale = ref.current;

          if (stale) {
            if (loadedModelId.current === model.id) {
              return true;
            }

            clearSlot();
            await releaseAndSettle(stale);

            // Freeing takes a destroy plus a settle, which is long enough for a
            // dispose to land in the middle of it. Re-checked so that dispose's
            // NotLoaded stays the last word: announcing Loading past it would
            // leave the slot claiming a load the exit below then abandons.
            if (outdated()) {
              return false;
            }
          }

          publish(AiModelState.Loading);

          const { instance, state } = await open(model, opts);

          if (outdated()) {
            // Disposed while loading, and a newer load may be queued behind us
            // — settling here is what keeps its allocation off our buffers.
            await releaseAndSettle(instance);
            // Undo the Loading, or the slot keeps claiming a load nobody is
            // running. Unconditional despite that newer load: it is queued
            // behind us, so its own Loading is published after this and wins.
            publish(AiModelState.NotLoaded, cleared);
            return false;
          }

          ref.current = instance;
          loadedModelId.current = model.id;
          publish(AiModelState.Ready, state);
          return true;
        });
      } catch (error) {
        log(`AiService create ${slot}`, error, { capture: true });
        // Only the generation that still owns the slot may surface the error; a
        // superseded load must not flip a newer load's state to Error.
        if (!outdated()) {
          publish(AiModelState.Error);
        }
        throw error;
      }
    },
    [
      accepts,
      backend,
      cleared,
      clearSlot,
      open,
      publish,
      releaseAndSettle,
      slot,
    ],
  );

  const dispose = useCallback(() => {
    generation.current += 1;

    const instance = ref.current;
    // Cleared before the teardown runs, so a throwing destroy() can't leave a
    // stale instance blocking the next create, and so borrow() stops handing
    // the handle out while we are freeing it.
    clearSlot();

    if (instance) {
      backend.free(() => release(instance));
    }

    publish(AiModelState.NotLoaded, cleared);
  }, [backend, cleared, clearSlot, publish, release]);

  const borrow = useCallback(
    async <R>(
      work: (instance: TInstance) => Promise<R>,
    ): Promise<R | undefined> => {
      const instance = ref.current;

      if (!instance) {
        return undefined;
      }

      const running = work(instance);
      // Tracked separately so a rejection here can't reject a teardown's wait —
      // the borrower still sees the original rejection below.
      const tracked = running.catch(() => undefined);
      borrowed.current.add(tracked);

      try {
        return await running;
      } finally {
        borrowed.current.delete(tracked);
      }
    },
    [],
  );

  return useMemo(
    () => ({ ref, create, dispose, borrow }),
    [borrow, create, dispose],
  );
};
