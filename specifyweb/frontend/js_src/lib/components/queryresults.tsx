import React from 'react';

import type { SpAuditLog, Tables } from '../datamodel';
import type { AnySchema } from '../datamodelutils';
import { format } from '../dataobjformatters';
import { fieldFormat } from '../fieldformat';
import type { SpecifyResource } from '../legacytypes';
import type { QueryFieldSpec } from '../queryfieldspec';
import { getModel, getModelById } from '../schema';
import type { LiteralField, Relationship } from '../specifyfield';
import type { SpecifyModel } from '../specifymodel';
import { isResourceOfType } from '../specifymodel';
import type { RA } from '../types';
import { defined } from '../types';
import { crash } from './errorboundary';

type FieldToSet = {
  readonly name: 'parentTableNum' | 'tableNum';
  readonly index: number;
};

class AuditRecordFormatter {
  private readonly fieldSpecs: RA<QueryFieldSpec>;

  public readonly active: boolean;

  private readonly fieldsToSet: RA<FieldToSet>;

  public constructor(fieldSpecs: RA<QueryFieldSpec>) {
    this.fieldSpecs = fieldSpecs;
    this.active = this.needsFormatting();
    this.fieldsToSet = this.buildFieldsToSet();
  }

  private buildFieldsToSet(): RA<FieldToSet> {
    return this.fieldSpecs
      .map((fieldSpec, index) => ({
        name:
          fieldSpec.table.name === 'SpAuditLog' &&
          ['parentTableNum', 'tableNum'].includes(
            fieldSpec.getField()?.name ?? ''
          )
            ? fieldSpec.getField()?.name
            : undefined,
        index,
      }))
      .filter(
        (fieldToSet): fieldToSet is FieldToSet =>
          typeof fieldToSet.name === 'string'
      );
  }

  private hasField<TABLE_NAME extends 'SpAuditLog' | 'SpAuditLogField'>(
    tableName: TABLE_NAME,
    fieldName: keyof Tables[TABLE_NAME]['fields']
  ): boolean {
    return this.fieldSpecs.some(
      (fieldSpec) =>
        tableName === fieldSpec.table.name &&
        fieldName === fieldSpec.getField()?.name
    );
  }

  private needsFormatting(): boolean {
    return (
      this.hasField('SpAuditLog', 'parentRecordId') ||
      this.hasField('SpAuditLog', 'recordId') ||
      this.hasField('SpAuditLogField', 'oldValue') ||
      this.hasField('SpAuditLogField', 'newValue')
    );
  }

  public hasRequiredFields(): boolean {
    return (
      (!this.hasField('SpAuditLog', 'parentRecordId') ||
        this.hasField('SpAuditLog', 'parentTableNum')) &&
      (!this.hasField('SpAuditLog', 'recordId') ||
        this.hasField('SpAuditLog', 'tableNum')) &&
      ((!this.hasField('SpAuditLogField', 'oldValue') &&
        !this.hasField('SpAuditLogField', 'newValue')) ||
        this.hasField('SpAuditLogField', 'fieldName'))
    );
  }

  public setRequiredResourceFields(
    resource: SpecifyResource<SpAuditLog>,
    resultRow: RA<string | number>
  ): void {
    if (isResourceOfType(resource, 'SpAuditLog'))
      this.fieldsToSet
        .filter(({ name }) => typeof resource.get(name) !== 'number')
        .forEach(({ name, index }) =>
          resource.set(name, resultRow[index + 1] as number)
        );
  }

  public async format(
    field: LiteralField | Relationship,
    result: RA<string | number>,
    resource: SpecifyResource<SpAuditLog>,
    value: string
  ): Promise<string> {
    const auditingModel = this.getAuditLogForeignKeyModel(
      field.name as keyof SpAuditLog['fields'],
      result,
      resource
    );
    if (typeof auditingModel === 'undefined') return value;

    if (
      ['tableNum', 'parentTableNum', 'fieldName'].includes(
        field.name.toLowerCase()
      ) &&
      !field.isRelationship
    ) {
      return AuditRecordFormatter.localize(field, value, auditingModel);
    } else {
      const collection = new auditingModel.LazyCollection({
        filters: { id: Number(value) },
      });
      return collection
        .fetch({ limit: 1 })
        .then(async ({ models }) =>
          format(models[0]).then(
            (string) => string ?? `${auditingModel.name}:{${value}}`
          )
        );
    }
  }

  private getAuditLogForeignKeyModel(
    fieldName: keyof SpAuditLog['fields'],
    result: RA<string | number>,
    resource: SpecifyResource<SpAuditLog>
  ): SpecifyModel | undefined {
    if (
      [
        'recordId',
        'parentRecordId',
        'tableNum',
        'parentTableNum',
        'fieldName',
      ].includes(fieldName)
    ) {
      const tableNumber = fieldName.startsWith('parent')
        ? resource.get('parentTableNum')
        : resource.get('tableNum');
      return getModelById(AuditRecordFormatter.parseTableId(tableNumber ?? -1));
    } else if (['newValue', 'oldValue'].includes(fieldName)) {
      const auditedField = this.getAuditedField(result, resource);
      if (auditedField?.isRelationship === true)
        return getModel(auditedField.relatedModelName);
    }
    return undefined;
  }

  private static localize(
    field: LiteralField,
    value: string,
    model: SpecifyModel
  ): string {
    return ['tableNum', 'parentTableNum'].includes(field.name.toLowerCase())
      ? model.getLocalizedName()
      : model.getField(value.toLowerCase())?.getLocalizedName() ?? value;
  }

  /**
   * Extract table ID from formatted name
   *
   * @example
   * parseTableId('Discipline [24]');  // 24
   */
  private static parseTableId(tableNameWithId: string | number): number {
    return Number.parseInt(/\d+/.exec(tableNameWithId.toString())?.[0] ?? '-1');
  }

  /** Get definition of a field that the audit record describes */
  private getAuditedField(
    result: RA<string | number>,
    resource: SpecifyResource<SpAuditLog>
  ): LiteralField | Relationship | undefined {
    const auditedFieldName =
      result[
        this.fieldSpecs.findIndex(
          (fieldSpec) => fieldSpec.getField()?.name === 'fieldName'
        ) ?? -1
      ]?.toString();
    if (typeof auditedFieldName === 'undefined') return undefined;
    const tableNumber = resource.get('tableNum');
    const model = getModelById(AuditRecordFormatter.parseTableId(tableNumber));
    return model?.getField(auditedFieldName);
  }
}

function QueryResultCell({
  fieldSpec,
  value,
  getFormattedValue,
}: {
  readonly fieldSpec: QueryFieldSpec;
  readonly value: string | number;
  readonly getFormattedValue?: () => Promise<string>;
}): JSX.Element {
  const [formatted, setFormatted] = React.useState<string | number | undefined>(
    () =>
      typeof field !== 'undefined' &&
      !field.isRelationship &&
      (typeof fieldSpec.datePart === 'undefined' ||
        fieldSpec.datePart === 'fullDate')
        ? fieldFormat(field, value.toString())
        : value
  );

  React.useEffect(
    () => void getFormattedValue?.().then(setFormatted).catch(crash),
    [value]
  );

  const field = fieldSpec.getField();
  return (
    <span
      role="cell"
      className="border-gray-500 border-r
     bg-[color:var(--bg)] first:border-l p-1 min-h-[theme(spacing.8)]"
    >
      {formatted}
    </span>
  );
}

function QueryResult({
  model,
  fieldSpecs,
  idFieldIndex,
  result,
  forceResourceLoad,
  auditRecordFormatter,
}: {
  readonly model: SpecifyModel;
  readonly fieldSpecs: RA<QueryFieldSpec>;
  readonly idFieldIndex: number | undefined;
  readonly result: RA<string | number>;
  readonly forceResourceLoad: boolean;
  readonly auditRecordFormatter: AuditRecordFormatter;
}): JSX.Element {
  const [resource, setResource] = React.useState<
    SpecifyResource<AnySchema> | undefined | false
  >(
    forceResourceLoad
      ? undefined
      : () => {
          if (typeof idFieldIndex === 'undefined') return false;
          const resource = new model.Resource({
            id: result[idFieldIndex],
          });
          auditRecordFormatter.setRequiredResourceFields(
            resource as SpecifyResource<SpAuditLog>,
            result
          );
          return resource;
        }
  );

  React.useEffect(() => {
    if (
      typeof resource !== 'undefined' ||
      !forceResourceLoad ||
      typeof idFieldIndex === 'undefined'
    )
      return;

    const collection = new model.LazyCollection({
      filters: { id: result[idFieldIndex] as number },
    });
    collection
      .fetch({ limit: 1 })
      .then(({ models }) => setResource(models[0]), crash);
  }, [result, resource, forceResourceLoad, idFieldIndex, model]);

  const cells = result.map((value, index) => (
    <QueryResultCell
      key={index}
      value={value}
      fieldSpec={fieldSpecs[index]}
      getFormattedValue={
        value.toString().length > 0 &&
        auditRecordFormatter.active &&
        typeof resource === 'object'
          ? (): Promise<string> =>
              auditRecordFormatter.format(
                defined(fieldSpecs[index].getField()),
                result,
                resource as SpecifyResource<SpAuditLog>,
                value.toString()
              )
          : undefined
      }
    />
  ));
  const className = `query-result sticky even:[--bg:transparent]
    odd:[--bg:theme(colors.gray.100)]
    odd:dark:[--bg:theme(colors.neutral.700)]`;

  return typeof resource === 'object' ? (
    <a
      href={resource?.viewUrl()}
      target="_blank"
      role="row"
      className={`${className} link`}
      rel="noreferrer"
    >
      {cells}
    </a>
  ) : (
    <div role="row" className={className}>
      {cells}
    </div>
  );
}

// TODO: consider merging this
export function QueryResults({
  model,
  fieldSpecs,
  idFieldIndex,
  results,
}: {
  readonly model: SpecifyModel;
  readonly fieldSpecs: RA<QueryFieldSpec>;
  readonly idFieldIndex: number | undefined;
  readonly results: RA<RA<string | number>>;
}): JSX.Element {
  const auditRecordFormatter = new AuditRecordFormatter(fieldSpecs);
  const forceResourceLoad =
    auditRecordFormatter.active && !auditRecordFormatter.hasRequiredFields();

  return (
    <div role="rowgroup">
      {results.map((result, index) => (
        <QueryResult
          key={index}
          model={model}
          fieldSpecs={fieldSpecs}
          idFieldIndex={idFieldIndex}
          result={result}
          forceResourceLoad={forceResourceLoad}
          auditRecordFormatter={auditRecordFormatter}
        />
      ))}
    </div>
  );
}