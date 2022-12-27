import { adminText } from '../../localization/admin';
import { commonText } from '../../localization/common';
import { queryText } from '../../localization/query';
import { f } from '../../utils/functools';
import type { IR, R, RA } from '../../utils/types';
import { ensure } from '../../utils/types';
import { lowerToHuman } from '../../utils/utils';
import { schema } from '../DataModel/schema';
import type { Tables } from '../DataModel/types';
import {
  frontEndPermissions,
  institutionPermissions,
  operationPolicies,
  tableActions,
} from '../Permissions/definitions';
import {
  actionToLabel,
  anyResource,
  getAllActions,
  partsToResourceName,
  resourceNameToParts,
  tableNameToResourceName,
  tablePermissionsPrefix,
  toolPermissionPrefix,
} from './utils';

/**
 * Convert a part like ['table','locality'] to an array of information for
 * each item
 */
export const getRegistriesFromPath = (
  resourceParts: RA<string>
): RA<IR<Registry> | undefined> =>
  resourceParts.reduce<RA<IR<Registry> | undefined>>(
    (parts, part) => [...parts, parts.at(-1)?.[part]?.children],
    [buildRegistry()]
  );

export type Registry = {
  readonly label: string;
  readonly children: IR<Registry>;
  readonly actions: RA<string>;
  readonly groupName: string;
  readonly isInstitutional: boolean;
};

type WritableRegistry = {
  readonly label: string;
  readonly children: R<WritableRegistry>;
  readonly actions: RA<string>;
  readonly groupName: string;
  // eslint-disable-next-line functional/prefer-readonly-type
  isInstitutional: boolean;
};

/** Build a registry of all permissions, their labels and possible actions */
const buildRegistry = f.store(
  (): IR<Registry> =>
    [
      ...Object.values(schema.models)
        .filter(({ name }) => !f.has(toolTables(), name))
        .map(({ name, label, isHidden, isSystem }) => ({
          resource: tableNameToResourceName(name),
          localized: [adminText('table'), label],
          actions: tableActions,
          groupName: isSystem || isHidden ? adminText('advancedTables') : '',
        })),
      ...Object.entries(toolDefinitions()).map(([name, { label }]) => ({
        resource: partsToResourceName([toolPermissionPrefix, name]),
        localized: [commonText('tool'), label],
        actions: tableActions,
        groupName: '',
      })),
      ...Object.entries(operationPolicies).map(([resource, actions]) => ({
        resource,
        localized: resourceNameToParts(resource).map(lowerToHuman),
        actions,
        groupName: '',
      })),
      ...Object.entries(frontEndPermissions).map(([resource, actions]) => ({
        resource,
        localized: resourceNameToParts(resource).map(lowerToHuman),
        actions,
        groupName: '',
      })),
    ].reduce<R<WritableRegistry>>(
      (registry, { resource, localized, groupName }) => {
        const resourceParts = resourceNameToParts(resource);
        resourceParts.reduce<R<WritableRegistry>>(
          (place, part, index, { length }) => {
            place[part] ??= {
              label: localized[index],
              children:
                index + 1 === length
                  ? {}
                  : {
                      [anyResource]: {
                        label: tablePermissionsPrefix.includes(part)
                          ? adminText('allTables')
                          : commonText('all'),
                        children: {},
                        actions: getAllActions(
                          partsToResourceName(resourceParts.slice(0, index + 1))
                        ),
                        groupName: '',
                        isInstitutional: false,
                      },
                    },
              groupName: index + 1 === length ? groupName : '',
              actions:
                index + 1 === length
                  ? getAllActions(
                      partsToResourceName(resourceParts.slice(0, index + 1))
                    )
                  : [],
              isInstitutional: true,
            };
            if (!institutionPermissions.has(resource))
              place[part].isInstitutional = false;
            return place[part].children;
          },
          registry
        );
        return registry;
      },
      {
        [anyResource]: {
          label: commonText('all'),
          children: {},
          actions: getAllActions(partsToResourceName([])),
          groupName: '',
          isInstitutional: false,
        },
      }
    )
);

/**
 * Convert registry of policies to a TSV format.
 * May be used for documentation and development purposes
 */
export function policiesToTsv(): string {
  const iterate = (
    data: IR<Registry>,
    path: RA<string> = [],
    isInstitutional = false
  ): RA<RA<string>> =>
    Object.entries(data).flatMap(([key, entry]) =>
      key === '%'
        ? []
        : Object.keys(entry.children).length > 0
        ? iterate(
            entry.children,
            [...path, entry.label],
            isInstitutional || entry.isInstitutional
          )
        : entry.actions.map((action) => [
            [...path, entry.label].join(' > '),
            actionToLabel(action),
            isInstitutional || entry.isInstitutional
              ? 'Institution'
              : 'Collection',
            entry.groupName,
          ])
    );

  return [
    ['Path', 'Action', 'Scope', 'Group Name'],
    ...iterate(buildRegistry()),
  ]
    .map((row) => row.join('\t'))
    .join('\n');
}

/**
 * Consolidate permissions for several system tables under a single label
 *
 * If user doesn't have some access to any of these tables, user does not
 * have access to a tool
 */
export const toolDefinitions = f.store(() =>
  ensure<
    IR<{
      readonly label: string;
      readonly tables: RA<keyof Tables>;
    }>
  >()({
    schemaConfig: {
      label: commonText('schemaConfig'),
      tables: ['SpLocaleContainer', 'SpLocaleContainerItem', 'SpLocaleItemStr'],
    },
    queryBuilder: {
      label: queryText('queryBuilder'),
      tables: ['SpQuery', 'SpQueryField'],
    },
    recordSets: {
      label: commonText('recordSets'),
      tables: ['RecordSet', 'RecordSetItem'],
    },
    resources: {
      label: commonText('appResources'),
      tables: [
        'SpAppResource',
        'SpAppResourceData',
        'SpAppResourceDir',
        'SpViewSetObj',
      ],
    },
    pickLists: {
      label: commonText('pickList'),
      tables: ['PickList', 'PickListItem'],
    },
    auditLog: {
      label: schema.models.SpAuditLog.label,
      tables: ['SpAuditLog', 'SpAuditLogField'],
    },
  } as const)
);

export const toolTables = f.store(
  () =>
    new Set(Object.values(toolDefinitions()).flatMap(({ tables }) => tables))
);