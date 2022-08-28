import React from 'react';

import type { AnySchema } from '../DataModel/helpers';
import type { SpecifyResource } from '../DataModel/legacyTypes';
import { commonText } from '../../localization/common';
import { formsText } from '../../localization/forms';
import type { LiteralField } from '../DataModel/specifyField';
import type { SpecifyModel } from '../DataModel/specifyModel';
import type { RA } from '../../utils/types';
import { defined } from '../../utils/types';
import { Dialog } from '../Molecules/Dialog';
import { useCachedState } from '../../hooks/useCachedState';
import { Button } from '../Atoms/Button';
import { Ul } from '../Atoms';
import { Input, Label } from '../Atoms/Form';
import { useBooleanState } from '../../hooks/useBooleanState';

export function AutoNumbering({
  resource,
}: {
  readonly resource: SpecifyResource<AnySchema>;
}): JSX.Element | null {
  const fields = getAutoNumberingFields(resource.specifyModel);
  const [isOpen, handleOpen, handleClose] = useBooleanState();
  return fields.length > 0 ? (
    <>
      <Button.Small onClick={handleOpen}>
        {formsText('autoNumbering')}
      </Button.Small>
      {isOpen && (
        <AutoNumberingDialog
          fields={fields}
          resource={resource}
          onClose={handleClose}
        />
      )}
    </>
  ) : null;
}

const getAutoNumberingFields = (model: SpecifyModel): RA<LiteralField> =>
  model.literalFields.filter(
    (field) => field.getUiFormatter()?.canAutonumber() === true
  );

function AutoNumberingDialog({
  resource,
  fields,
  onClose: handleClose,
}: {
  readonly resource: SpecifyResource<AnySchema>;
  readonly fields: RA<LiteralField>;
  readonly onClose: () => void;
}): JSX.Element {
  const [globalConfig = {}, setGlobalConfig] = useCachedState(
    'forms',
    'autoNumbering'
  );
  const config =
    (globalConfig[resource.specifyModel.name] as RA<string>) ?? fields;

  function handleEnableAutoNumbering(fieldName: string): void {
    const stringValue = ((resource.get(fieldName) as string) ?? '').toString();
    if (stringValue.length === 0) {
      const field = defined(resource.specifyModel.getLiteralField(fieldName));
      const formatter = defined(field.getUiFormatter());
      const wildCard = formatter.valueOrWild();
      resource.set(fieldName, wildCard as never);
    }
    handleChange([...config, fieldName]);
  }

  function handleDisableAutoNumbering(fieldName: string): void {
    const field = defined(resource.specifyModel.getLiteralField(fieldName));
    const formatter = defined(field.getUiFormatter());
    const wildCard = formatter.valueOrWild();
    if (resource.get(fieldName) === wildCard)
      resource.set(fieldName, null as never);
    handleChange(config.filter((name) => name !== fieldName));
  }

  const handleChange = (config: RA<string>): void =>
    setGlobalConfig({
      ...globalConfig,
      [resource.specifyModel.name]: config,
    });

  return (
    <Dialog
      buttons={commonText('close')}
      header={formsText('autoNumbering')}
      onClose={handleClose}
    >
      <Ul>
        {fields.map(({ name, label }) => (
          <li key={name}>
            <Label.Inline>
              <Input.Checkbox
                checked={config.includes(name)}
                onValueChange={(checked): void =>
                  checked
                    ? handleEnableAutoNumbering(name)
                    : handleDisableAutoNumbering(name)
                }
              />
              {label}
            </Label.Inline>
          </li>
        ))}
      </Ul>
    </Dialog>
  );
}
