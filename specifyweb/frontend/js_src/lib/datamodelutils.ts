import type { Tables } from './datamodel';
import type { SpecifyResource } from './legacytypes';
import { parseResourceUrl } from './resourceapi';
import { getModel } from './schema';
import type { IR, RA } from './types';
import { defined } from './types';

/* The dataModel types types were generated using this code snippet: */
/* eslint-disable multiline-comment-style*/
/* ;
import { schema } from './schema';

const javaTypeToTypeScript = {
  text: 'string',
  'java.lang.String': 'string',
  'java.lang.Byte': 'number',
  'java.lang.Short': 'number',
  'java.lang.Integer': 'number',
  'java.lang.Float': 'number',
  'java.lang.Double': 'number',
  'java.lang.Long': 'number',
  'java.math.BigDecimal': 'number',
  'java.lang.Boolean': 'boolean',
  'java.sql.Timestamp': 'string',
  'java.util.Calendar': 'string',
  'java.util.Date': 'string',
} as const;

function regenerate() {
  const index = `export type Tables = {${Object.keys(schema.models).map(
    (tableName) => `readonly ${tableName}: ${tableName}`
  )}};`;
  const models = Object.entries(schema.models)
    .map(([tableName, { fields }]) => {
      const groups = fields.reduce(
        (
          model,
          {
            isRequired,
            isRelationship,
            dependent,
            relatedModel,
            type,
            name,
          }
        ) => {
          const field = `readonly ${name}:${
            isRelationship
              ? `${type.endsWith('-to-many') ? 'RA<' : ''}${relatedModel.name}${
                  type.endsWith('-to-many') ? '>' : ''
                }`
              : javaTypeToTypeScript[type]
          }${
            (isRelationship && type.endsWith('-to-many')) || isRequired
              ? ''
              : '|null'
          };`;
          model[
            isRelationship
              ? `${type.endsWith('-to-many') ? 'toMany' : 'toOne'}${
                  dependent ? 'Dependent' : 'Independent'
                }`
              : 'fields'
          ] += field;
          return model;
        },
        {
          tableName,
          fields: '',
          toOneDependent: '',
          toOneIndependent: '',
          toManyDependent: '',
          toManyIndependent: '',
        }
      );
      return `export type ${tableName} = TableSchema & {${Object.entries(groups)
        .map(
          ([group, fields]) =>
            `readonly ${group}: ${
              typeof fields === 'string'
                ? fields
                : fields.length === 0
                ? 'RR<never, never>'
                : `{${fields}}`
            }`
        )
        .join(';')}}`;
    })
    .join(';');
  return `${index}${models}`;
}

*/
/* eslint-enable multiline-comment-style*/

export type AnySchema = {
  readonly tableName: keyof Tables;
  readonly fields: IR<unknown>;
  readonly toOneDependent: IR<AnySchema | null>;
  readonly toOneIndependent: IR<AnySchema | null>;
  readonly toManyDependent: IR<RA<AnySchema>>;
  readonly toManyIndependent: IR<RA<AnySchema>>;
};

export type TableFields<SCHEMA extends AnySchema> =
  | keyof SCHEMA['fields']
  | keyof SCHEMA['toOneDependent']
  | keyof SCHEMA['toOneIndependent']
  | keyof SCHEMA['toManyDependent']
  | keyof SCHEMA['toManyIndependent'];

export type ToMany = AnySchema['toManyDependent'];

// All tables that contain independent -to-one called "definitionItem"
export type AnyTree = Extract<
  Tables[keyof Tables],
  {
    readonly toOneIndependent: {
      readonly definitionItem: AnySchema;
    };
  }
>;

export type FilterTablesByEndsWith<ENDS_WITH extends string> = Tables[Extract<
  keyof Tables,
  `${string}${ENDS_WITH}`
>];

export type RecordSetInfo = {
  readonly index: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly recordsetid: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  readonly total_count: number;
};

export type CommonFields = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  readonly resource_uri: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  readonly recordset_info?: RecordSetInfo;
  readonly id: number;
};

export type SerializedModel<SCHEMA extends AnySchema> = KeysToLowerCase<
  SerializedResource<SCHEMA>
>;

export type SerializedResource<SCHEMA extends AnySchema> = {
  readonly [KEY in
    | keyof CommonFields
    | keyof SCHEMA['fields']
    | keyof SCHEMA['toOneDependent']
    | keyof SCHEMA['toOneIndependent']
    | keyof SCHEMA['toManyDependent']
    | keyof SCHEMA['toManyIndependent']]: KEY extends keyof CommonFields
    ? CommonFields[KEY]
    : KEY extends keyof SCHEMA['fields']
    ? SCHEMA['fields'][KEY]
    : KEY extends keyof SCHEMA['toOneDependent']
    ?
        | Partial<
            SerializedResource<Exclude<SCHEMA['toOneDependent'][KEY], null>>
          >
        | Exclude<SCHEMA['toOneDependent'][KEY], AnySchema>
    : KEY extends keyof SCHEMA['toOneIndependent']
    ? string | Exclude<SCHEMA['toOneIndependent'][KEY], AnySchema>
    : KEY extends keyof SCHEMA['toManyDependent']
    ? RA<SerializedResource<SCHEMA['toManyDependent'][KEY][number]>>
    : KEY extends keyof SCHEMA['toManyIndependent']
    ? string
    : never;
};

export type KeysToLowerCase<DICTIONARY extends IR<unknown>> = {
  [KEY in keyof DICTIONARY as Lowercase<KEY & string>]: DICTIONARY[KEY];
};

/** Like resource.toJSON(), but keys are converted to camel case */
export const serializeResource = <SCHEMA extends AnySchema>(
  resource: SpecifyResource<SCHEMA>
): SerializedResource<SCHEMA> =>
  serializeModel<SCHEMA>(
    resource?.toJSON() ?? resource,
    resource?.specifyModel.name
  );

const specialFields = new Set(['id', 'resource_uri']);

function serializeModel<SCHEMA extends AnySchema>(
  resource: SerializedModel<SCHEMA>,
  tableName?: keyof Tables
): SerializedResource<SCHEMA> {
  const model = defined(
    getModel(defined(tableName ?? parseResourceUrl(resource.resource_uri)?.[0]))
  );
  const fields = model.fields.map(({ name }) => name);

  return Object.fromEntries(
    Object.entries(resource).map(([lowercaseFieldName, value]) => {
      let camelFieldName = fields.find(
        (fieldName) => fieldName.toLowerCase() === lowercaseFieldName
      );
      if (typeof camelFieldName === 'undefined') {
        camelFieldName = lowercaseFieldName;
        if (!specialFields.has(lowercaseFieldName))
          console.warn(
            `Trying to serialize unknown field ${lowercaseFieldName} for table ${model.name}`,
            resource
          );
      }
      if (typeof value === 'object' && value !== null) {
        const field = model.getField(lowercaseFieldName);
        const tableName =
          typeof field === 'undefined' || !field.isRelationship
            ? undefined
            : field.relatedModel.name;
        return [
          camelFieldName,
          Array.isArray(value)
            ? value.map((value) => serializeModel(value, tableName))
            : serializeModel(value as SerializedModel<AnySchema>, tableName),
        ];
      } else return [camelFieldName, value];
    })
  ) as SerializedResource<SCHEMA>;
}
