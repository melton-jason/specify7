import React from 'react';

import type { SerializedCollection } from '../collection';
import type { AnySchema } from '../datamodelutils';
import { f } from '../functools';
import { defined } from '../types';
import { useAsyncState } from './hooks';

export function useCollection<SCHEMA extends AnySchema>(
  fetch: (offset: number) => Promise<SerializedCollection<SCHEMA>>
): Readonly<[SerializedCollection<SCHEMA> | undefined, () => Promise<void>]> {
  const fetchRef = React.useRef<
    Promise<SerializedCollection<SCHEMA> | undefined> | undefined
  >(undefined);
  const sizeRef = React.useRef<number>(0);
  const callback = React.useCallback(async () => {
    if (typeof fetchRef.current === 'object')
      return fetchRef.current.then(f.undefined);
    fetchRef.current = fetch(sizeRef.current).then((data) => {
      sizeRef.current = sizeRef.current += data.records.length;
      fetchRef.current = undefined;
      return data;
    });
    return fetchRef.current;
  }, [fetch]);
  const currentCallback = React.useRef(f.void);
  const [collection, setCollection] = useAsyncState(
    React.useCallback(async () => {
      currentCallback.current = callback;
      fetchRef.current = undefined;
      sizeRef.current = 0;
      return callback();
    }, [callback]),
    false,
    true
  );

  const fetchMore = React.useCallback(
    async () =>
      /*
       * Ignore calls to fetchMore before collection is fetched for the first
       * time
       */
      currentCallback.current === callback
        ? typeof fetchRef.current === 'object'
          ? callback().then(f.undefined)
          : callback().then((result) =>
              // If fetch function changed while fetching, discard the results
              currentCallback.current === callback
                ? setCollection((collection) => ({
                    records: [
                      ...defined(collection).records,
                      ...defined(result).records,
                    ],
                    totalCount: defined(collection).totalCount,
                  }))
                : undefined
            )
        : undefined,
    [callback, collection]
  );

  return [collection, fetchMore] as const;
}