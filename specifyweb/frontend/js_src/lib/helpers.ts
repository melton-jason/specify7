/**
 * Collection of various helper methods
 *
 * @module
 */

import { f } from './functools';
import type { IR, RA, RR } from './types';
import { KeysToLowerCase } from './datamodelutils';

export const capitalize = <T extends string>(string: T): Capitalize<T> =>
  (string.charAt(0).toUpperCase() + string.slice(1)) as Capitalize<T>;

export const unCapitalize = <T extends string>(string: T): Uncapitalize<T> =>
  (string.charAt(0).toLowerCase() + string.slice(1)) as Uncapitalize<T>;

export const upperToKebab = (value: string): string =>
  value.toLowerCase().split('_').join('-');

export const lowerToHuman = (value: string): string =>
  value.toLowerCase().split('_').map(capitalize).join(' ');

export const camelToKebab = (value: string): string =>
  value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

export const camelToHuman = (value: string): string =>
  capitalize(value.replace(/([a-z])([A-Z])/g, '$1 $2')).replace(/Dna\b/, 'DNA');

/** Type-safe variant of toLowerCase */
export const toLowerCase = <T extends string>(string: T): Lowercase<T> =>
  string.toLowerCase() as Lowercase<T>;

/**
 * Finds the point at which the source array begins to have values
 * different from the ones in the search array
 *
 * @example
 * Returns 0 if search array is empty
 * Returns -1 if source array is empty / is shorter than the search array
 * Examples:
 *   If:
 *     source is ['Accession','Accession Agents','#1','Agent','First Name'] and
 *     search is []
 *   returns 0
 *   If:
 *     source is ['Accession','Accession Agents','#1','Agent','First Name'] and
 *     search is ['Accession','Accession Agents',]
 *   returns 2
 *   If
 *     source is ['Accession','Accession Agents','#1','Agent','First Name'] and
 *     search is ['Accession','Accession Agents','#2']
 *   returns -1
 *
 */
export function findArrayDivergencePoint<T>(
  // The source array to use in the comparison
  source: RA<T>,
  // The search array to use in the comparison
  search: RA<T>
): number {
  if (source === null || search === null) return -1;

  const sourceLength = source.length;
  const searchLength = search.length;

  if (searchLength === 0) return 0;

  if (sourceLength === 0 || sourceLength < searchLength) return -1;

  return (
    mappedFind(Object.entries(source), ([index, sourceValue]) => {
      const searchValue = search[Number(index)];

      if (typeof searchValue === 'undefined') return Number(index);
      else if (sourceValue === searchValue) return undefined;
      else return -1;
    }) ?? searchLength - 1
  );
}

/** Scale a number from original range into new range */
export const spanNumber =
  (
    minInput: number,
    maxInput: number,
    minOutput: number,
    maxOutput: number
  ): ((input: number) => number) =>
  (input: number): number =>
    ((input - minInput) / (maxInput - minInput)) * (maxOutput - minOutput) +
    minOutput;

/** Get Dictionary's key in a case insensitive way */
export const caseInsensitiveHash = <
  KEY extends string,
  DICTIONARY extends RR<KEY, unknown>
>(
  dictionary: DICTIONARY,
  searchKey:
    | KEY
    | Lowercase<KEY>
    | Uppercase<KEY>
    | Capitalize<KEY>
    | Uncapitalize<KEY>
): DICTIONARY[KEY] =>
  Object.entries(dictionary).find(
    ([key]) => (key as string).toLowerCase() === searchKey.toLowerCase()
  )?.[1] as DICTIONARY[KEY];

/** Generate a sort function for Array.prototype.sort */
export const sortFunction =
  <T, V extends boolean | number | string | null>(
    mapper: (value: T) => V,
    reverse = false
  ): ((left: T, right: T) => -1 | 0 | 1) =>
  (left: T, right: T): -1 | 0 | 1 => {
    const [leftValue, rightValue] = reverse
      ? [mapper(right), mapper(left)]
      : [mapper(left), mapper(right)];
    if (leftValue === rightValue) return 0;
    return typeof leftValue === 'string' && typeof rightValue === 'string'
      ? (leftValue.localeCompare(rightValue) as -1 | 0 | 1)
      : leftValue > rightValue
      ? 1
      : -1;
  };

/** Split array in half according to a discriminator function */
export const split = <ITEM>(
  array: RA<ITEM>,
  // If returns true, item would go to the right array
  discriminator: (item: ITEM, index: number, array: RA<ITEM>) => boolean
): Readonly<[left: RA<ITEM>, right: RA<ITEM>]> =>
  array
    .map((item, index) => [item, discriminator(item, index, array)] as const)
    .reduce<Readonly<[left: RA<ITEM>, right: RA<ITEM>]>>(
      ([left, right], [item, isRight]) => [
        [...left, ...(isRight ? [] : [item])],
        [...right, ...(isRight ? [item] : [])],
      ],
      [[], []]
    );

/**
 * Convert an array of [key,value] tuples to a RA<[key, RA<value>]>
 *
 * @remarks
 * KEY doesn't have to be a string. It can be of any time
 */
export const group = <KEY, VALUE>(
  entries: RA<Readonly<[key: KEY, value: VALUE]>>
): RA<Readonly<[key: KEY, values: RA<VALUE>]>> =>
  Array.from(
    entries
      .reduce<Map<KEY, RA<VALUE>>>(
        (grouped, [key, value]) =>
          grouped.set(key, [...(grouped.get(key) ?? []), value]),
        new Map()
      )
      .entries()
  );

// Find a value in an array, and return it's mapped variant
export function mappedFind<ITEM, RETURN_TYPE>(
  array: RA<ITEM>,
  callback: (item: ITEM, index: number) => RETURN_TYPE | undefined
): RETURN_TYPE | undefined {
  let value = undefined;
  array.some((item, index) => {
    value = callback(item, index);
    return typeof value !== 'undefined';
  });
  return value;
}

/**
 * Create a new object with given keys removed
 */
export const removeKey = <
  DICTIONARY extends IR<unknown>,
  OMIT extends keyof DICTIONARY
>(
  object: DICTIONARY,
  ...toOmit: RA<OMIT>
): {
  readonly [KEY in keyof DICTIONARY as KEY extends OMIT
    ? never
    : KEY]: DICTIONARY[KEY];
} =>
  // @ts-expect-error
  Object.fromEntries(
    Object.entries(object).filter(([key]) => !f.includes(toOmit, key))
  );

export const clamp = (min: number, value: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** Create a new array with a new item at a given position */
export const insertItem = <T>(array: RA<T>, index: number, item: T): RA<T> => [
  ...array.slice(0, index),
  item,
  ...array.slice(index),
];

/** Create a new array with a given item replaced */
export const replaceItem = <T>(array: RA<T>, index: number, item: T): RA<T> =>
  array[index] === item
    ? array
    : [...array.slice(0, index), item, ...array.slice(index + 1)];

/** Create a new array without a given item */
export const removeItem = <T>(array: RA<T>, index: number): RA<T> => [
  ...array.slice(0, index),
  ...array.slice(index + 1),
];

/** Remove item from array if present, otherwise, add it */
export const toggleItem = <T>(array: RA<T>, item: T): RA<T> =>
  array.includes(item)
    ? array.filter((value) => value !== item)
    : [...array, item];

/** Creates a new object with a given key replaced */
export const replaceKey = <T extends IR<unknown>>(
  object: T,
  targetKey: keyof T,
  newValue: T[keyof T]
): T =>
  object[targetKey] === newValue
    ? object
    : {
        // Despite what it looks like, this would preserve the order of keys
        ...object,
        [targetKey]: newValue,
      };

/** Convert an array of objects with IDs into a dictionary */
export const index = <T extends { readonly id: number }>(data: RA<T>): IR<T> =>
  Object.fromEntries(data.map((item) => [item.id, item]));

export const escapeRegExp = (string: string): string =>
  string.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');

/** Fix for "getAttribute" being case-sensetive for non-HTML elements */
export const getAttribute = (cell: Element, name: string): string | undefined =>
  cell.getAttribute(name.toLowerCase()) ?? undefined;

/** Like getAttribute, but also trim the value and discard empty values */
export const getParsedAttribute = (
  cell: Element,
  name: string
): string | undefined =>
  f.maybe(getAttribute(cell, name)?.trim(), (value) =>
    value.length === 0 ? undefined : value
  );

export const getBooleanAttribute = (
  cell: Element,
  name: string
): boolean | undefined =>
  f.maybe(
    getParsedAttribute(cell, name),
    (value) => value.toLowerCase() === 'true'
  );

/** Recursively convert keys on an object to lowercase */
export const keysToLowerCase = <OBJECT extends IR<unknown>>(
  resource: OBJECT
): KeysToLowerCase<OBJECT> =>
  Object.fromEntries(
    Object.entries(resource).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value)
        ? value.map(keysToLowerCase)
        : typeof value === 'object' && value !== null
        ? keysToLowerCase(value as IR<unknown>)
        : value,
    ])
  ) as unknown as KeysToLowerCase<OBJECT>;
