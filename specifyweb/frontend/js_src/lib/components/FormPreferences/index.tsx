import React from 'react';

import { useBooleanState } from '../../hooks/useBooleanState';
import { commonText } from '../../localization/common';
import { formsText } from '../../localization/forms';
import { f } from '../../utils/functools';
import { H3 } from '../Atoms';
import { Button } from '../Atoms/Button';
import { icons } from '../Atoms/Icons';
import { toTable } from '../DataModel/helpers';
import type { AnySchema } from '../DataModel/helperTypes';
import type { SpecifyResource } from '../DataModel/legacyTypes';
import { GenerateLabel } from '../FormCommands';
import { PrintOnSave } from '../FormFields/Checkbox';
import { SubViewContext } from '../Forms/SubView';
import { isTreeResource } from '../InitialContext/treeRanks';
import { Dialog } from '../Molecules/Dialog';
import {
  ProtectedAction,
  ProtectedTool,
} from '../Permissions/PermissionDenied';
import { AutoNumbering } from './AutoNumbering';
import { CarryForwardButton } from './CarryForward';
import { Definition } from './Definition';
import { PickListUsages } from './PickListUsages';
import { QueryTreeUsages } from './QueryTreeUsages';
import { ReadOnlyMode } from './ReadOnlyMode';
import { RecordHistory } from './RecordHistory';
import { ShareRecord } from './ShareRecord';
import { SubViewPreferences } from './SubViewPreferences';
import { usePref } from '../UserPreferences/usePref';

/**
 * Form preferences host context aware user preferences and other meta-actions.
 * List of available features: https://github.com/specify/specify7/issues/1330
 */
export function FormPreferences({
  resource,
  className,
}: {
  readonly resource: SpecifyResource<AnySchema> | undefined;
  readonly className?: string;
}): JSX.Element | null {
  const [isOpen, _, handleClose, handleToggle] = useBooleanState();
  const [isReadOnly] = usePref('form', 'preferences', 'readOnlyMode');
  return typeof resource === 'object' ? (
    <>
      <Button.Small
        aria-label={commonText('preferences')}
        className={className}
        title={commonText('preferences')}
        onClick={handleToggle}
      >
        {icons.cog}
        {isReadOnly && commonText('readOnly')}
      </Button.Small>
      {isOpen && typeof resource === 'object' ? (
        <PreferencesDialog resource={resource} onClose={handleClose} />
      ) : undefined}
    </>
  ) : null;
}

function PreferencesDialog({
  resource,
  onClose: handleClose,
}: {
  readonly resource: SpecifyResource<AnySchema>;
  readonly onClose: () => void;
}): JSX.Element {
  const subView = React.useContext(SubViewContext);
  return (
    <Dialog
      buttons={commonText('close')}
      header={resource.specifyModel.label}
      modal={false}
      onClose={handleClose}
    >
      <div className="flex flex-col gap-2 pb-2">
        <H3>{formsText('formConfiguration')}</H3>
        <div className="flex max-w-[theme(spacing.96)] flex-wrap gap-2">
          <CarryForwardButton model={resource.specifyModel} type="button" />
          <AutoNumbering resource={resource} />
          <Definition model={resource.specifyModel} />
          {subView === undefined ? (
            <ReadOnlyMode isNew={resource.isNew()} />
          ) : undefined}
          <GenerateLabel
            id={undefined}
            label={formsText('printLabel')}
            resource={resource}
          />
        </div>
        <PrintOnSave
          defaultValue={false}
          fieldName={undefined}
          id={undefined}
          model={resource.specifyModel}
          text={formsText('printOnSave')}
        />
      </div>
      {typeof subView === 'object' ? (
        <div className="flex flex-col gap-2 pb-2">
          <H3>{formsText('recordSelectorConfiguration')}</H3>
          <SubViewPreferences model={resource.specifyModel} subView={subView} />
        </div>
      ) : undefined}
      <div className="flex flex-col gap-2 pb-2">
        <H3>{formsText('recordInformation')}</H3>
        <div className="flex flex-wrap gap-2">
          <ProtectedTool action="read" tool="auditLog">
            <ProtectedAction action="execute" resource="/querybuilder/query">
              <RecordHistory resource={resource} />
            </ProtectedAction>
          </ProtectedTool>
          {isTreeResource(resource) && <QueryTreeUsages resource={resource} />}
          <ProtectedTool action="read" tool="pickLists">
            <ProtectedAction action="execute" resource="/querybuilder/query">
              {f.maybe(toTable(resource, 'PickList'), (pickList) => (
                <PickListUsages pickList={pickList} />
              ))}
            </ProtectedAction>
          </ProtectedTool>
        </div>
        {!resource.isNew() && <ShareRecord resource={resource} />}
      </div>
    </Dialog>
  );
}
