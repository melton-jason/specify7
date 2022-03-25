/**
 * Renderer for Specify forms
 */

import React from 'react';

import { error } from '../assert';
import type { AnySchema } from '../datamodelutils';
import { autoGenerateViewDefinition } from '../generateformdefinitions';
import type { SpecifyResource } from '../legacytypes';
import type { FormMode, FormType, ViewDescription } from '../parseform';
import { getView, parseViewDefinition } from '../parseform';
import type { SpecifyModel } from '../specifymodel';
import { f } from '../wbplanviewhelper';
import { DataEntry, FormHeader } from './basic';
import { useAsyncState, useId } from './hooks';
import { FormCell } from './specifyformcell';

/** A hardcoded view description for an attachment table */
const getAttachmentFormDefinition = (
  formType: FormType,
  mode: FormMode
): ViewDescription =>
  ({
    columns: [undefined],
    formType,
    mode,
    model: undefined,
    rows: [
      [
        {
          id: undefined,
          type: 'Field',
          fieldName: '',
          fieldDefinition: {
            isReadOnly: false,
            type: 'Plugin',
            pluginDefinition: {
              type: 'AttachmentPlugin',
            },
          },
          isRequired: false,
          colSpan: 1,
          align: 'left',
          visible: true,
        },
      ],
    ],
  } as const);

/**
 * A hook to get information needed to display a form
 * Can be used independently of <SpecifyForm> if need to get form definition
 * for alternative purposes (i.e a different renderer)
 */
export function useViewDefinition({
  model,
  viewName = model.view,
  formType,
  mode,
}: {
  readonly model: SpecifyModel;
  readonly viewName?: string;
  readonly formType: FormType;
  readonly mode: FormMode;
}): ViewDescription | undefined {
  const [viewDefinition] = useAsyncState<ViewDescription>(
    React.useCallback(
      async () =>
        viewName === 'ObjectAttachment'
          ? getAttachmentFormDefinition(formType, mode)
          : getView(viewName)
              .catch(f.undefined)
              .then((viewDefinition) =>
                typeof viewDefinition === 'object'
                  ? parseViewDefinition(viewDefinition, formType, mode)
                  : undefined
              )
              .then((viewDefinition) =>
                typeof viewDefinition === 'object'
                  ? viewDefinition.model === model
                    ? viewDefinition
                    : error(
                        'View definition model does not match resource model'
                      )
                  : autoGenerateViewDefinition(model, formType, mode)
              ),
      [viewName, formType, mode, model]
    ),
    false
  );
  return viewDefinition;
}

// FIXME: review all original specifyform files to check everything was migrated
/** Renders a form and populates it with data from a resource */
export function SpecifyForm({
  resource,
  viewName = resource.specifyModel.view,
  formType,
  mode,
  hasHeader,
}: {
  readonly resource: SpecifyResource<AnySchema>;
  readonly viewName?: string;
  readonly formType: FormType;
  readonly mode: FormMode;
  readonly hasHeader: boolean;
}): JSX.Element {
  const viewDefinition = useViewDefinition({
    model: resource.specifyModel,
    viewName,
    formType,
    mode,
  });

  return (
    <RenderForm
      resource={resource}
      viewDefinition={viewDefinition}
      hasHeader={hasHeader}
    />
  );
}

/**
 * Renders a form from ViewDescription
 * Useful when need to render a hard-coded front-end only form
 */
export function RenderForm<SCHEMA extends AnySchema>({
  resource,
  viewDefinition,
  hasHeader,
}: {
  readonly resource: SpecifyResource<SCHEMA>;
  readonly viewDefinition: ViewDescription | undefined;
  readonly hasHeader: boolean;
}): JSX.Element {
  const id = useId(
    `form-${resource.specifyModel.name ?? viewDefinition?.model?.name ?? ''}`
  );
  const [loadedResource] = useAsyncState(
    React.useCallback(async () => resource.fetchPromise(), [resource]),
    false
  );
  return (
    <div className="gap-y-2 flex flex-col">
      {/* FIXME: STYLE: check usages, consider removing it */}
      {hasHeader && <FormHeader>{resource.specifyModel.name}</FormHeader>}
      {typeof viewDefinition === 'object' &&
      typeof loadedResource === 'object' ? (
        <DataEntry.Grid viewDefinition={viewDefinition}>
          {/* Cells are wrapped in rows for debugging purposes only */}
          {viewDefinition.rows.map((cells, index) => (
            <div className="contents" key={index}>
              {cells.map(
                (
                  { colSpan, align, visible, id: cellId, ...cellData },
                  index
                ) => (
                  <DataEntry.Cell
                    key={index}
                    colSpan={colSpan}
                    align={align}
                    visible={visible}
                  >
                    <FormCell
                      resource={loadedResource}
                      mode={viewDefinition.mode}
                      formType={viewDefinition.formType}
                      cellData={cellData}
                      id={cellId}
                      formatId={id}
                    />
                  </DataEntry.Cell>
                )
              )}
            </div>
          ))}
        </DataEntry.Grid>
      ) : undefined}
    </div>
  );
}