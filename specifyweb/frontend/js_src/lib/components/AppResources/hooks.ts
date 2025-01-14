import React from 'react';

import { useAsyncState } from '../../hooks/useAsyncState';
import { f } from '../../utils/functools';
import type { GetOrSet, IR, RA } from '../../utils/types';
import { addMissingFields } from '../DataModel/addMissingFields';
import { fetchCollection } from '../DataModel/collection';
import type { SerializedResource } from '../DataModel/helperTypes';
import type {
  Collection,
  Discipline,
  SpAppResource,
  SpAppResourceData,
  SpAppResourceDir,
  SpecifyUser,
  SpViewSetObj as SpViewSetObject,
} from '../DataModel/types';
import { getAppResourceCount, getAppResourceMode } from './helpers';
import { getAppResourceTree } from './tree';
import { LocalizedString } from 'typesafe-i18n';

export type AppResources = {
  readonly directories: RA<SerializedResource<SpAppResourceDir>>;
  readonly disciplines: RA<SerializedResource<Discipline>>;
  readonly collections: RA<SerializedResource<Collection>>;
  readonly users: RA<SerializedResource<SpecifyUser>>;
  readonly appResources: RA<SerializedResource<SpAppResource>>;
  readonly viewSets: RA<SerializedResource<SpViewSetObject>>;
};

export function useAppResources(): GetOrSet<AppResources | undefined> {
  return useAsyncState(
    React.useCallback(
      async () =>
        f.all({
          directories: fetchCollection('SpAppResourceDir', { limit: 0 }).then(
            ({ records }) => records
          ),
          disciplines: fetchCollection('Discipline', { limit: 0 }).then(
            ({ records }) => records
          ),
          collections: fetchCollection('Collection', { limit: 0 }).then(
            ({ records }) => records
          ),
          users: fetchCollection('SpecifyUser', { limit: 0 }).then(
            ({ records }) => records
          ),
          appResources: fetchCollection('SpAppResource', { limit: 0 }).then(
            ({ records }) => records
          ),
          viewSets: fetchCollection('SpViewSetObj', { limit: 0 }).then(
            ({ records }) => records
          ),
        }),
      []
    ),
    true
  );
}

export type AppResourcesTree = RA<{
  readonly label: LocalizedString;
  /*
   * A string that would be stable thought the lifecycle of an object.
   * Used to identify a tree node when storing conformation it in localStorage.
   */
  readonly key: string;
  readonly directory: SerializedResource<SpAppResourceDir> | undefined;
  readonly appResources: RA<SerializedResource<SpAppResource>>;
  readonly viewSets: RA<SerializedResource<SpViewSetObject>>;
  readonly subCategories: AppResourcesTree;
}>;

export function useResourcesTree(resources: AppResources): AppResourcesTree {
  return React.useMemo<AppResourcesTree>(
    () => getAppResourceTree(resources),
    [resources]
  );
}

export function useAppResourceCount(
  resourcesTree: AppResourcesTree[number]
): number {
  return React.useMemo(
    () => getAppResourceCount(resourcesTree),
    [resourcesTree]
  );
}

export function useAppResourceData(
  resource: SerializedResource<SpAppResource | SpViewSetObject>,
  initialData: string | undefined
): {
  readonly resourceData: SerializedResource<SpAppResourceData> | undefined;
  readonly setResourceData: (
    newResource: SerializedResource<SpAppResourceData> | undefined
  ) => void;
  readonly isChanged: boolean;
} {
  const initialValue = React.useRef<string | null>('');
  const [resourceData, setResourceData] = useAsyncState<
    SerializedResource<SpAppResourceData>
  >(
    React.useCallback(async () => {
      const relationshipName =
        getAppResourceMode(resource) === 'appResources'
          ? 'spAppResource'
          : 'spViewSetObj';
      const newResource = addMissingFields('SpAppResourceData', {
        [relationshipName]: resource.id,
        data: initialData,
      });
      const dataResource =
        typeof resource.id === 'number'
          ? await fetchCollection('SpAppResourceData', {
              limit: 1,
              [relationshipName]: resource.id,
            }).then(({ records }) =>
              typeof records[0] === 'object' ? records[0] : newResource
            )
          : newResource;
      const newData = fixLineBreaks(dataResource.data ?? '');
      initialValue.current = newData;
      return { ...dataResource, data: newData };
    }, [resource, initialData]),
    true
  );
  return {
    resourceData,
    setResourceData,
    isChanged: initialValue.current !== resourceData?.data,
  };
}

const fixLineBreaks = (string: string): string =>
  string.replace(/[\n\r]+/gu, '\n');

export const getAppResourceExtension = (
  resource: SerializedResource<SpAppResource | SpViewSetObject>
): string =>
  resource._tableName === 'SpViewSetObj'
    ? 'xml'
    : getResourceExtension(resource as SerializedResource<SpAppResource>);

function getResourceExtension(
  resource: SerializedResource<SpAppResource>
): 'jrxml' | 'json' | 'properties' | 'txt' | 'xml' {
  const mimeType = resource.mimeType?.toLowerCase() ?? '';
  if (mimeType in mimeMapper) return mimeMapper[mimeType];
  else if (mimeType.startsWith('jrxml')) return 'jrxml';
  else if (resource.name === 'preferences' && mimeType === '')
    return 'properties';
  else return 'txt';
}

const mimeMapper: IR<'json' | 'properties' | 'txt' | 'xml'> = {
  'application/json': 'json',
  'text/xml': 'xml',
  'text/plain': 'txt',
};
