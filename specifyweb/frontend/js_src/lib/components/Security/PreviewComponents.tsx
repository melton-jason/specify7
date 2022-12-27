import React from 'react';

import { useId } from '../../hooks/useId';
import { adminText } from '../../localization/admin';
import type { IR } from '../../utils/types';
import { Input } from '../Atoms/Form';
import { Link } from '../Atoms/Link';
import { schema } from '../DataModel/schema';
import type { Tables } from '../DataModel/types';
import { TableIcon } from '../Molecules/TableIcon';
import { tableActions } from '../Permissions/definitions';
import type { PreviewCell } from './Preview';
import { actionToLabel, resourceNameToLabel } from './utils';
import { commonText } from '../../localization/common';

export function PreviewRow({
  row,
  tableName,
  getOpenRoleUrl,
}: {
  readonly row: IR<PreviewCell>;
  readonly tableName: keyof Tables;
  readonly getOpenRoleUrl: (roleId: number) => string;
}): JSX.Element {
  const [view, setView] = React.useState<
    typeof tableActions[number] | undefined
  >(undefined);
  const id = useId('preview-row');
  return (
    <>
      <div aria-controls={id('reason')} role="row">
        {tableActions.map((action) => (
          <div
            className={`
              cursor-pointer justify-center rounded p-2
              ${view === action ? 'bg-brand-100 dark:bg-brand-500' : ''}
            `}
            key={action}
            role="cell"
            onClick={(): void => setView(action === view ? undefined : action)}
          >
            <Input.Checkbox
              aria-expanded={view === action}
              checked={row[action].allowed}
              className="pointer-events-none"
              disabled
            />
          </div>
        ))}
        <div className="p-2" role="cell">
          <TableIcon label={false} name={tableName} />
          {schema.models[tableName].label}
        </div>
      </div>
      <div
        className={typeof view === 'string' ? '' : '!hidden'}
        id={id('reason')}
        role="row"
      >
        {typeof view === 'string' && (
          <div className="col-span-full" role="cell">
            <PermissionExplanation
              cell={row[view]}
              getOpenRoleUrl={getOpenRoleUrl}
            />
          </div>
        )}
      </div>
    </>
  );
}

export function PermissionExplanation({
  cell: { matching_role_policies, matching_user_policies },
  getOpenRoleUrl,
}: {
  readonly cell: PreviewCell;
  readonly getOpenRoleUrl: (roleId: number) => string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4 py-2">
      <div
        className="grid-table grid-cols-[auto_auto_auto] rounded border border-gray-500"
        role="table"
      >
        <div role="row">
          {[
            adminText('collectionUserRoles'),
            adminText('action'),
            adminText('resource'),
          ].map((label, index, { length }) => (
            <div
              className={`
                bg-gray-350 p-2 dark:bg-neutral-600
                ${
                  index === 0
                    ? 'rounded-l'
                    : index + 1 === length
                    ? 'rounded-r'
                    : ''
                }
              `}
              key={index}
              role="columnheader"
            >
              {label}
            </div>
          ))}
        </div>
        <div role="rowgroup">
          {matching_role_policies.map((role, index) => (
            <Link.Default
              href={getOpenRoleUrl(role.roleid)}
              key={index}
              role="row"
            >
              {[
                role.rolename,
                actionToLabel(role.action),
                resourceNameToLabel(role.resource),
              ].map((value, index) => (
                <div className="p-2" key={index} role="cell">
                  {value}
                </div>
              ))}
            </Link.Default>
          ))}
          {matching_role_policies.length === 0 && (
            <div role="row">
              <div className="col-span-full p-2" role="cell">
                {commonText('none')}
              </div>
            </div>
          )}
        </div>
      </div>
      <div
        className="grid-table w-full grid-cols-[auto_auto_auto_auto] rounded border border-gray-500"
        role="table"
      >
        <div role="row">
          {[
            adminText('userPolicies'),
            schema.models.Collection.label,
            adminText('action'),
            adminText('resource'),
          ].map((label, index, { length }) => (
            <div
              className={`
                bg-gray-350 p-2 dark:bg-neutral-600
                ${
                  index === 0
                    ? 'rounded-l'
                    : index + 1 === length
                    ? 'rounded-r'
                    : ''
                }
              `}
              key={index}
              role="columnheader"
            >
              {label}
            </div>
          ))}
        </div>
        <div role="rowgroup">
          {matching_user_policies.map((policy, index) => (
            <div key={index} role="row">
              {[
                policy.userid === null
                  ? adminText('allUsers')
                  : adminText('thisUser'),
                policy.collectionid === null
                  ? adminText('allCollections')
                  : adminText('thisCollection'),
                actionToLabel(policy.action),
                resourceNameToLabel(policy.resource),
              ].map((value, index) => (
                <div className="p-2" key={index} role="cell">
                  {value}
                </div>
              ))}
            </div>
          ))}
          {matching_user_policies.length === 0 && (
            <div role="row">
              <div className="col-span-full p-2" role="cell">
                {commonText('none')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}