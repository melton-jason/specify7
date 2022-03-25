import React from 'react';

import type { Tables } from '../datamodel';
import adminText from '../localization/admin';
import commonText from '../localization/common';
import type { PermissionsQuery } from '../permissions';
import { getTablePermissions, queryUserPermissions } from '../permissions';
import { resourceNameToModel, resourceNameToParts } from '../securityutils';
import type { IR, R, RA } from '../types';
import { capitalize, group, lowerToHuman } from '../wbplanviewhelper';
import { className, Input, Label, Ul } from './basic';
import { TableIcon } from './common';
import { useAsyncState, useBooleanState, useId } from './hooks';

function PreviewCell({ cell }: { readonly cell: Cell }): JSX.Element {
  return (
    <div role="cell" className="justify-center">
      <Input.Checkbox
        disabled
        checked={cell.allowed}
        className="cursor-pointer"
      />
    </div>
  );
}

function ReasonExplanation({ cell }: { readonly cell: Cell }): JSX.Element {
  // FIXME: humanize
  return (
    <pre role="cell" className="col-span-5">
      {JSON.stringify(cell, null, '\t')}
    </pre>
  );
}

function PreviewRow({
  row,
  tableName,
}: {
  readonly row: IR<Cell>;
  readonly tableName: keyof Tables;
}): JSX.Element {
  const [isOpen, _, __, handleToggle] = useBooleanState();
  const id = useId('preview-row');
  return (
    <>
      <div
        className="cursor-pointer"
        role="row"
        onClick={handleToggle}
        aria-controls={id('reason')}
        aria-expanded={isOpen}
      >
        <PreviewCell cell={row.read} />
        <PreviewCell cell={row.create} />
        <PreviewCell cell={row.update} />
        <PreviewCell cell={row.delete} />
        <div role="cell">
          <TableIcon name={tableName} tableLabel={false} />
          {tableName}
        </div>
      </div>
      <div
        role="row"
        className={isOpen ? undefined : '!hidden'}
        id={id('reason')}
      >
        {adminText('read')}:
        <ReasonExplanation cell={row.read} />
        {commonText('create')}:
        <ReasonExplanation cell={row.create} />
        {commonText('update')}:
        <ReasonExplanation cell={row.update} />
        {commonText('delete')}:
        <ReasonExplanation cell={row.delete} />
      </div>
    </>
  );
}

type Cell = Omit<PermissionsQuery['details'][number], 'action' | 'resource'>;

function PreviewTables({
  query,
}: {
  readonly query: PermissionsQuery;
}): JSX.Element {
  const table = React.useMemo<RA<Readonly<[keyof Tables, IR<Cell>]>>>(
    () =>
      Object.entries(
        group(
          query.details
            .filter(({ resource }) => resource in getTablePermissions())
            .map(
              ({ resource, ...rest }) =>
                [resourceNameToModel(resource).name, rest] as const
            )
        )
      ).map(
        ([tableName, items]) =>
          [
            tableName,
            Object.fromEntries(
              items.map(({ action, ...rest }) => [action, rest])
            ),
          ] as const
      ),
    [query]
  );
  return (
    <div
      className={`grid-table grid-cols-[repeat(4,min-content)_auto] gap-2
        relative overflow-x-hidden h-80`}
      role="table"
    >
      <div role="row">
        {[
          adminText('read'),
          commonText('create'),
          commonText('update'),
          commonText('delete'),
          adminText('table'),
        ].map((header) => (
          <div
            key={header}
            role="columnheader"
            className={`sticky top-0 ${className.containerBackground}`}
          >
            {header}
          </div>
        ))}
      </div>
      <div role="rowgroup">
        {table.map(([tableName, permissions]) => (
          <PreviewRow key={tableName} row={permissions} tableName={tableName} />
        ))}
      </div>
    </div>
  );
}

export type Tree = {
  readonly label: string;
  readonly children: IR<Tree>;
  readonly actions: RA<Omit<PermissionsQuery['details'][number], 'resource'>>;
};

type WritableTree = {
  readonly label: string;
  readonly children: R<WritableTree>;
  readonly actions: RA<Omit<PermissionsQuery['details'][number], 'resource'>>;
};

function TreeView({ tree }: { readonly tree: IR<Tree> }): JSX.Element {
  return (
    <Ul className="pl-5 list-disc">
      {Object.entries(tree).map(([name, { label, children, actions }]) => (
        <li key={name}>
          {label}
          {actions.length > 0 && (
            <Ul className="pl-5">
              {actions.map(({ action, ...rest }) => (
                <li key={action}>
                  <details>
                    <summary>
                      <Label.ForCheckbox>
                        <Input.Checkbox
                          disabled
                          checked={rest.allowed}
                          className="cursor-pointer"
                        />{' '}
                        {lowerToHuman(action)}
                      </Label.ForCheckbox>
                    </summary>
                    <ReasonExplanation cell={rest} />
                  </details>
                </li>
              ))}
            </Ul>
          )}
          {Object.keys(children).length > 0 && <TreeView tree={children} />}
        </li>
      ))}
    </Ul>
  );
}

function PreviewOperations({
  query,
}: {
  readonly query: PermissionsQuery;
}): JSX.Element {
  const tree = React.useMemo(
    () =>
      Object.entries(
        group(
          query.details
            .filter(({ resource }) => !(resource in getTablePermissions()))
            .map(({ resource, ...rest }) => [resource, rest] as const)
        )
      ).reduce<R<WritableTree>>((registry, [resource, actions]) => {
        const resourceParts = resourceNameToParts(resource);
        resourceParts.reduce<R<WritableTree>>(
          (place, part, index, { length }) => {
            place[part] ??= {
              label: capitalize(part),
              children: {},
              actions: index + 1 === length ? actions : [],
            };
            return place[part].children;
          },
          registry
        );
        return registry;
      }, {}),
    [query]
  );
  return <TreeView tree={tree} />;
}

export function PreviewPermissions({
  userId,
  collectionId,
  changesMade,
}: {
  readonly userId: number;
  readonly collectionId: number;
  readonly changesMade: boolean;
}): JSX.Element {
  const [query] = useAsyncState(
    React.useCallback(
      async () => queryUserPermissions(userId, collectionId),
      [userId, collectionId]
    ),
    false
  );
  return (
    <section className="contents">
      <h4>{adminText('preview')}</h4>
      {typeof query === 'object' ? (
        <>
          {changesMade && <p>{adminText('outOfDateWarning')}</p>}
          <div className="flex flex-wrap flex-1 gap-4">
            <PreviewTables query={query} />
            <PreviewOperations query={query} />
          </div>
        </>
      ) : (
        commonText('loading')
      )}
    </section>
  );
}