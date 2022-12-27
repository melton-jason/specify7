/**
 * Attachments viewer
 */

import React from 'react';

import { useAsyncState } from '../../hooks/useAsyncState';
import { useCachedState } from '../../hooks/useCachedState';
import { useCollection } from '../../hooks/useCollection';
import { commonText } from '../../localization/common';
import { formsText } from '../../localization/forms';
import { f } from '../../utils/functools';
import { filterArray } from '../../utils/types';
import { Container, H2 } from '../Atoms';
import { className } from '../Atoms/className';
import { Input, Label, Select } from '../Atoms/Form';
import { DEFAULT_FETCH_LIMIT, fetchCollection } from '../DataModel/collection';
import { getModel, schema } from '../DataModel/schema';
import type { Tables } from '../DataModel/types';
import { useMenuItem } from '../Header';
import { hasTablePermission } from '../Permissions/helpers';
import { ProtectedTable } from '../Permissions/PermissionDenied';
import { OrderPicker } from '../UserPreferences/Renderers';
import { AttachmentGallery } from './Gallery';

const allTablesWithAttachments = f.store(() =>
  filterArray(
    Object.keys(schema.models)
      .filter((tableName) => tableName.endsWith('Attachment'))
      .map((tableName) =>
        getModel(tableName.slice(0, -1 * 'Attachment'.length))
      )
  )
);
/** Exclude tables without read access*/
export const tablesWithAttachments = f.store(() =>
  allTablesWithAttachments().filter((model) =>
    hasTablePermission(model.name, 'read')
  )
);

const defaultScale = 10;
const minScale = 4;
const maxScale = 50;
const defaultSortOrder = '-timestampCreated';
const defaultFilter = { type: 'all' } as const;

export function AttachmentsView(): JSX.Element {
  return (
    <ProtectedTable action="read" tableName="Attachment">
      <Attachments />
    </ProtectedTable>
  );
}

function Attachments(): JSX.Element {
  useMenuItem('attachments');

  const [order = defaultSortOrder, setOrder] = useCachedState(
    'attachments',
    'sortOrder'
  );

  const [filter = defaultFilter, setFilter] = useCachedState(
    'attachments',
    'filter'
  );

  const [collectionSizes] = useAsyncState(
    React.useCallback(
      async () =>
        f.all({
          all: fetchCollection(
            'Attachment',
            {
              limit: 1,
            },
            allTablesWithAttachments().length === tablesWithAttachments().length
              ? {}
              : {
                  tableId__in: tablesWithAttachments()
                    .map(({ tableId }) => tableId)
                    .join(','),
                }
          ).then<number>(({ totalCount }) => totalCount),
          unused: fetchCollection(
            'Attachment',
            { limit: 1 },
            { tableId__isNull: 'true' }
          ).then<number>(({ totalCount }) => totalCount),
          byTable: f.all(
            Object.fromEntries(
              tablesWithAttachments().map(({ name, tableId }) => [
                name,
                fetchCollection('Attachment', {
                  limit: 1,
                  tableID: tableId,
                }).then<number>(({ totalCount }) => totalCount),
              ])
            )
          ),
        }),
      []
    ),
    false
  );

  const [scale = defaultScale, setScale] = useCachedState(
    'attachments',
    'scale'
  );

  const [collection, fetchMore] = useCollection(
    React.useCallback(
      async (offset) =>
        fetchCollection(
          'Attachment',
          {
            domainFilter: true,
            offset,
            orderBy: order,
            limit: DEFAULT_FETCH_LIMIT,
          },
          filter.type === 'unused'
            ? { tableId__isNull: 'true' }
            : filter.type === 'byTable'
            ? {
                tableId: schema.models[filter.tableName].tableId,
              }
            : allTablesWithAttachments().length ===
              tablesWithAttachments().length
            ? {}
            : {
                tableId__in: tablesWithAttachments()
                  .map(({ tableId }) => tableId)
                  .join(','),
              }
        ),
      [order, filter]
    )
  );

  return (
    <Container.FullGray>
      <header
        className={`flex flex-wrap items-center gap-2 ${className.hasAltBackground}`}
      >
        <H2>{commonText('attachments')}</H2>
        <Label.Inline>
          <span className="sr-only">{commonText('filter')}</span>
          <Select
            value={filter.type === 'byTable' ? filter.tableName : filter.type}
            onValueChange={(filter): void =>
              setFilter(
                filter === 'all' || filter === 'unused'
                  ? { type: filter }
                  : {
                      type: 'byTable',
                      tableName: filter as keyof Tables,
                    }
              )
            }
          >
            <option value="all">
              {commonText('all')}
              {typeof collectionSizes === 'object'
                ? ` (${collectionSizes.all})`
                : ''}
            </option>
            {collectionSizes?.unused !== 0 && (
              <option value="unused">
                {commonText('unused')}
                {typeof collectionSizes === 'object'
                  ? ` (${collectionSizes.unused})`
                  : ''}
              </option>
            )}
            <optgroup label={commonText('tables')}>
              {tablesWithAttachments()
                .filter(({ name }) => collectionSizes?.byTable[name] !== 0)
                .map(({ name, label }) => (
                  <option key={name} value={name}>
                    {label}
                    {typeof collectionSizes === 'object'
                      ? ` (${collectionSizes.byTable[name]})`
                      : ''}
                  </option>
                ))}
            </optgroup>
          </Select>
        </Label.Inline>
        <Label.Inline>
          {formsText('orderBy')}
          <div>
            <OrderPicker
              model={schema.models.Attachment}
              order={order}
              onChange={setOrder}
            />
          </div>
        </Label.Inline>
        <span className="-ml-2 flex-1" />
        <Label.Inline>
          {commonText('scale')}
          <Input.Generic
            max={maxScale}
            min={minScale}
            type="range"
            value={scale}
            onValueChange={(value) => setScale(Number.parseInt(value))}
          />
        </Label.Inline>
      </header>
      <AttachmentGallery
        attachments={collection?.records ?? []}
        isComplete={
          typeof collection === 'object' &&
          collection.totalCount === collection.records.length
        }
        scale={scale}
        onFetchMore={fetchMore}
      />
    </Container.FullGray>
  );
}