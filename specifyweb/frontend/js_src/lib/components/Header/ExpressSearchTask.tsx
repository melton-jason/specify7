/**
 * Express Search UI
 */

import React from 'react';

import { ajax } from '../../utils/ajax';
import { Http } from '../../utils/ajax/helpers';
import { contextUnlockedPromise, foreverFetch } from '../InitialContext';
import { commonText } from '../../localization/common';
import { QueryFieldSpec } from '../QueryBuilder/fieldSpec';
import { formatUrl, parseUrl } from '../Router/queryString';
import { getModel } from '../DataModel/schema';
import type { SpecifyModel } from '../DataModel/specifyModel';
import { legacyLocalize } from '../InitialContext/legacyUiLocalization';
import type { IR, RA } from '../../utils/types';
import { defined, filterArray } from '../../utils/types';
import { Container, H3 } from '../Atoms';
import { ErrorBoundary } from '../Errors/ErrorBoundary';
import { useSearchParam as useSearchParameter } from '../../hooks/navigation';
import { QueryResultsTable } from '../QueryBuilder/ResultsTable';
import {useAsyncState} from '../../hooks/useAsyncState';

const relatedSearchesPromise = contextUnlockedPromise.then(async (entrypoint) =>
  entrypoint === 'main'
    ? ajax<RA<string>>(
        '/context/available_related_searches.json',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        { headers: { Accept: 'application/json' } }
      ).then(({ data }) => data)
    : foreverFetch<RA<string>>()
);

type FieldSpec = {
  readonly stringId: string;
  readonly isRelationship: boolean;
};

export type QueryTableResult = {
  readonly fieldSpecs: RA<FieldSpec>;
  readonly results: RA<RA<number | string>>;
  readonly totalCount: number;
};

type RawQueryTableResult = {
  readonly model: SpecifyModel;
  readonly caption: string;
  readonly tableResults: QueryTableResult;
  readonly ajaxUrl: string;
};

type RelatedTableResult = {
  readonly definition: {
    readonly columns: RA<string>;
    readonly fieldSpecs: RA<FieldSpec>;
    readonly link: string | null;
    readonly name: string;
    readonly root: string;
  };
  readonly results: RA<RA<number | string>>;
  readonly totalCount: number;
};

const fetchSize = 40;

function TableResults({
  header,
  queryResults,
}: {
  readonly header: string;
  readonly queryResults: RA<RawQueryTableResult> | undefined;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-1">
      <H3>{header}</H3>
      {queryResults === undefined ? (
        <p aria-live="polite">{commonText('running')}</p>
      ) : Object.keys(queryResults).length === 0 ? (
        <p aria-live="polite">{commonText('noMatches')}</p>
      ) : (
        queryResults.map(({ model, caption, tableResults, ajaxUrl }, index) => (
          <details key={index}>
            <summary
              className="link list-item rounded bg-brand-200 p-1.5
                hover:!text-white dark:bg-brand-500 hover:dark:!bg-brand-400"
            >
              {`${caption} (${tableResults.totalCount})`}
            </summary>
            <ErrorBoundary dismissable>
              <QueryResultsTable
                createRecordSet={undefined}
                extraButtons={undefined}
                fetchResults={async (
                  offset: number
                ): Promise<RA<RA<number | string>>> =>
                  ajax<IR<QueryTableResult> | QueryTableResult>(
                    formatUrl(ajaxUrl, {
                      name: model.name,
                      // The URL may already have a "name" parameter
                      ...parseUrl(ajaxUrl),
                      offset: offset.toString(),
                    }),
                    {
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      headers: { Accept: 'application/json' },
                    }
                  ).then(
                    ({ data }) =>
                      (model.name in data
                        ? (data as IR<QueryTableResult>)[model.name]
                        : (data as QueryTableResult)
                      ).results
                  )
                }
                fetchSize={fetchSize}
                fieldSpecs={tableResults.fieldSpecs.map(
                  ({ stringId, isRelationship }) =>
                    QueryFieldSpec.fromStringId(stringId, isRelationship)
                )}
                hasIdField
                initialData={tableResults.results}
                label={model.label}
                model={model}
                tableClassName="max-h-[70vh]"
                totalCount={tableResults.totalCount}
              />
            </ErrorBoundary>
          </details>
        ))
      )}
    </section>
  );
}

export function ExpressSearchView(): JSX.Element {
  const [query = ''] = useSearchParameter('q');
  const ajaxUrl = formatUrl('/express_search/', {
    q: query,
    limit: fetchSize.toString(),
  });

  const [primaryResults] = useAsyncState<RA<RawQueryTableResult> | false>(
    React.useCallback(
      async () =>
        ajax<IR<QueryTableResult>>(
          ajaxUrl,
          {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            headers: { Accept: 'application/json' },
          },
          {
            expectedResponseCodes: [Http.OK, Http.FORBIDDEN],
          }
        ).then(({ data, status }) =>
          status === Http.FORBIDDEN
            ? false
            : Object.entries(data)
                .filter(([_tableName, { totalCount }]) => totalCount > 0)
                .map(([tableName, tableResults]) => ({
                  model: defined(getModel(tableName)),
                  caption: defined(getModel(tableName)).label,
                  tableResults,
                  ajaxUrl,
                }))
        ),
      [ajaxUrl]
    ),
    false
  );
  const [secondaryResults] = useAsyncState<RA<RawQueryTableResult>>(
    React.useCallback(
      async () =>
        relatedSearchesPromise
          .then(async (relatedSearches) =>
            Promise.all(
              relatedSearches.map(async (name) => {
                const ajaxUrl = formatUrl('/express_search/related/', {
                  q: query,
                  name,
                  limit: fetchSize.toString(),
                });
                return ajax<RelatedTableResult>(
                  ajaxUrl,
                  {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    headers: { Accept: 'application/json' },
                  },
                  {
                    expectedResponseCodes: [Http.OK, Http.FORBIDDEN],
                  }
                ).then(({ data, status }) =>
                  status === Http.FORBIDDEN
                    ? undefined
                    : ([ajaxUrl, data] as const)
                );
              })
            )
          )
          .then((results) =>
            filterArray(results)
              .filter(([_ajaxUrl, { totalCount }]) => totalCount > 0)
              .map(([ajaxUrl, tableResult]) => {
                const model = defined(getModel(tableResult.definition.root));
                const idFieldIndex = 0;
                /*
                 * FEATURE: decide if this code is needed
                 * It is responsible for making express search on
                 * "Taxon CollectionObject" link out to Taxon records rather
                 * than CollectionObject
                 */
                /*
                 *Const fieldSpecs = tableResult.definition.fieldSpecs.map(
                 *({ stringId, isRelationship }) =>
                 *  QueryFieldSpec.fromStringId(stringId, isRelationship)
                 *);
                 *if (tableResult.definition.link !== null) {
                 *idFieldIndex = fieldSpecs.length - 1;
                 *const relationship = defined(
                 *  fieldSpecs.slice(-1)[0]?.getField()
                 *);
                 *if (relationship.isRelationship)
                 *  model = relationship.relatedModel;
                 * // If field is TaxonID
                 *else if (relationship === relationship.model.idField)
                 *  model = relationship.model;
                 *else throw new Error('Unable to extract relationship');
                 *}
                 */

                return {
                  model,
                  idFieldIndex,
                  caption:
                    legacyLocalize(tableResult.definition.name) ??
                    tableResult.definition.name,
                  tableResults: {
                    results: tableResult.results,
                    fieldSpecs: tableResult.definition.fieldSpecs,
                    totalCount: tableResult.totalCount,
                  },
                  ajaxUrl,
                };
              })
          ),
      [query]
    ),
    false
  );

  return (
    <Container.Full>
      {primaryResults !== false && (
        <TableResults
          header={commonText('primarySearch')}
          queryResults={primaryResults}
        />
      )}
      <TableResults
        header={commonText('secondarySearch')}
        queryResults={secondaryResults}
      />
    </Container.Full>
  );
}
