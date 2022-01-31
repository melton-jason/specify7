/**
 * Generic React Components
 *
 * @module
 *
 */

import React from 'react';

import { getIcon } from '../icons';
import commonText from '../localization/common';
import { spanNumber } from '../wbplanviewhelper';
import { icons } from './icons';
import { getModel } from '../schema';

const MAX_HUE = 360;

/**
 * Convert first 2 characters of a table name to a number [0,255] corresponding
 * to color hue.
 *
 * Used for autogenerated table icons if table icon image is missing.
 */
const getHue = spanNumber(
  // eslint-disable-next-line unicorn/prefer-code-point
  'a'.charCodeAt(0) * 2,
  // eslint-disable-next-line unicorn/prefer-code-point
  'z'.charCodeAt(0) * 2,
  0,
  MAX_HUE
);

/**
 * Renders a table icon or autogenerates a new one
 */
export function TableIcon({
  tableName,
  tableLabel,
}: {
  readonly tableName: string;
  readonly tableLabel?: string | false;
}): JSX.Element {
  const tableIconSource = getIcon(tableName);
  const resolvedTableLabel =
    tableLabel === false
      ? undefined
      : tableLabel ?? getModel(tableName)?.getLocalizedName() ?? '';
  if (tableIconSource !== '/images/unknown.png')
    return (
      <span
        className="w-table-icon h-table-icon bg-center bg-no-repeat bg-contain"
        role={typeof resolvedTableLabel === 'undefined' ? undefined : 'img'}
        style={{ backgroundImage: `url('${tableIconSource}')` }}
        title={resolvedTableLabel}
        aria-label={resolvedTableLabel}
        aria-hidden={typeof resolvedTableLabel === 'undefined'}
      />
    );

  // eslint-disable-next-line unicorn/prefer-code-point
  const colorHue = getHue(tableName.charCodeAt(0) + tableName.charCodeAt(0));
  const color = `hsl(${colorHue}, 70%, 50%)`;
  return (
    <span
      style={{ backgroundColor: color }}
      role={typeof resolvedTableLabel === 'undefined' ? undefined : 'img'}
      className="w-table-icon h-table-icon flex items-center justify-center text-white rounded"
      title={resolvedTableLabel}
      aria-label={resolvedTableLabel}
      aria-hidden={typeof resolvedTableLabel === 'undefined'}
    >
      {tableName.slice(0, 2).toUpperCase()}
    </span>
  );
}

export const tableIconUndefined = (
  <span
    className="w-table-icon h-table-icon flex items-center justify-center font-bold text-red-600"
    aria-label={commonText('unmapped')}
    role="img"
  >
    {icons.ban}
  </span>
);

export const tableIconSelected = (
  <span
    className="w-table-icon h-table-icon flex items-center justify-center font-bold text-green-500"
    aria-label={commonText('mapped')}
    role="img"
  >
    {icons.check}
  </span>
);

export const tableIconEmpty = (
  <span className="w-table-icon h-table-icon" aria-hidden={true} />
);

/** Internationalized bi-directional string comparison function */
export const compareValues = (
  ascending: boolean,
  valueLeft: string | undefined,
  valueRight: string | undefined
): number =>
  (valueLeft ?? '').localeCompare(valueRight ?? '') * (ascending ? -1 : 1);

export type SortConfig<FIELD_NAMES extends string> = {
  readonly sortField: FIELD_NAMES;
  readonly ascending: boolean;
};

export function SortIndicator<FIELD_NAMES extends string>({
  fieldName,
  sortConfig,
}: {
  readonly fieldName: string;
  readonly sortConfig: SortConfig<FIELD_NAMES>;
}): JSX.Element {
  const isSorted = sortConfig.sortField === fieldName;
  return (
    <span
      className="text-brand-300"
      aria-label={
        isSorted
          ? sortConfig.ascending
            ? commonText('ascending')
            : commonText('descending')
          : undefined
      }
    >
      {isSorted
        ? sortConfig.ascending
          ? icons.chevronUp
          : icons.chevronDown
        : undefined}
    </span>
  );
}
