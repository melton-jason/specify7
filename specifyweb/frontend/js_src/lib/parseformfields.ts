/**
 * Parse XML cell with a field definition into JSON
 */

import type { State } from 'typesafe-reducer';

import type { PluginDefinition } from './parseuiplugins';
import { parseUiPlugin } from './parseuiplugins';
import type { IR } from './types';
import { getAttribute } from './parseformcells';

export type FieldTypes = {
  readonly Checkbox: State<
    'Checkbox',
    {
      defaultValue: boolean | undefined;
      label: string | undefined;
      printOnSave: boolean;
    }
  >;
  readonly TextArea: State<
    'TextArea',
    {
      defaultValue: string | undefined;
      rows: number | undefined;
    }
  >;
  readonly ComboBox: State<
    'ComboBox',
    {
      defaultValue: string | undefined;
      pickList: string | undefined;
    }
  >;
  readonly QueryComboBox: State<
    'QueryComboBox',
    {
      readonly hasCloneButton: boolean;
      readonly typeSearch: string | undefined;
    }
  >;
  readonly Text: State<
    'Text',
    {
      readonly defaultValue: string | undefined;
      // These are used by number input box:
      readonly min: number | undefined;
      readonly max: number | undefined;
      readonly step: number | undefined;
    }
  >;
  readonly Plugin: State<
    'Plugin',
    {
      readonly pluginDefinition: PluginDefinition;
    }
  >;
  readonly FilePicker: State<'FilePicker'>;
};

const withStringDefault = (
  cell: Element
): {
  readonly defaultValue: string | undefined;
} => ({
  defaultValue: getAttribute(cell, 'default'),
});

const processFieldType: {
  readonly [KEY in keyof FieldTypes]: (
    cell: Element,
    properties: IR<string | undefined>
  ) => FieldTypes[KEY];
} = {
  Checkbox: (cell) => ({
    type: 'Checkbox',
    defaultValue: getAttribute(cell, 'default')?.toLowerCase() === 'true',
    label: getAttribute(cell, 'label'),
    printOnSave:
      getAttribute(cell, 'ignore')?.toLowerCase() === 'true' &&
      ['printonsave', 'generateinvoice', 'generatelabelchk'].includes(
        getAttribute(cell, 'name')?.toLowerCase() ?? ''
      ),
  }),
  TextArea(cell) {
    const rows = Number.parseInt(getAttribute(cell, 'rows') ?? '');
    return {
      type: 'TextArea',
      ...withStringDefault(cell),
      rows: Number.isNaN(rows)
        ? getAttribute(cell, 'uiType')?.toLowerCase() === 'textareabrief'
          ? 1
          : undefined
        : rows,
    };
  },
  ComboBox: (cell) => ({
    type: 'ComboBox',
    ...withStringDefault(cell),
    pickList: getAttribute(cell, 'pickList') ?? undefined,
  }),
  Text(cell, properties) {
    const min = Number.parseInt(properties.min ?? '');
    const max = Number.parseInt(properties.max ?? '');
    const step = Number.parseInt(properties.step ?? '');
    return {
      type: 'Text',
      ...withStringDefault(cell),
      min: Number.isNaN(min) ? undefined : min,
      max: Number.isNaN(max) ? undefined : max,
      // TODO: factor in this value when displaing a field
      // TODO: figure out how this could be used for latlong fields
      step: Number.isNaN(step) ? undefined : step,
    };
  },
  QueryComboBox: (_cell, properties) => ({
    type: 'QueryComboBox',
    hasCloneButton: properties.clonebtn?.toLowerCase() === 'true',
    typeSearch: properties.name,
  }),
  Plugin: (cell, properties) => ({
    type: 'Plugin',
    pluginDefinition: parseUiPlugin(
      properties,
      withStringDefault(cell).defaultValue
    ),
  }),
  FilePicker: () => ({ type: 'FilePicker' }),
};

const fieldTypesTranslations: IR<keyof FieldTypes> = {
  checkbox: 'Checkbox',
  textarea: 'TextArea',
  textareabrief: 'TextArea',
  combobox: 'ComboBox',
  spinner: 'Text',
  querycbx: 'QueryComboBox',
  text: 'Text',
  dsptextfield: 'Text',
  formattedtext: 'Text',
  label: 'Text',
  plugin: 'Plugin',
  browse: 'FilePicker',
};

export type FormFieldDefinition = FieldTypes[keyof FieldTypes] & {
  readonly isReadOnly: boolean;
};

export function parseFormField(
  cell: Element,
  properties: IR<string | undefined>
): FormFieldDefinition {
  let uiType = getAttribute(cell, 'uiType') ?? undefined;
  if (typeof uiType === 'undefined') {
    console.error('field is missing uiType', cell);
    uiType = 'text';
  }

  const isReadOnly =
    getAttribute(cell, 'readOnly')?.toLowerCase() === 'true' ||
    uiType.toLowerCase() === 'dsptextfield';

  let parser = processFieldType[fieldTypesTranslations[uiType.toLowerCase()]];
  if (typeof parser === 'undefined') {
    console.error('unknown field uiType', { uiType, cell });
    parser = processFieldType.Text;
  }

  return {
    isReadOnly,
    ...parser(cell, properties),
  };
}