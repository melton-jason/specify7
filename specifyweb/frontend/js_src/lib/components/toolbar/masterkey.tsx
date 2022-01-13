import React from 'react';

import ajax, { formData, Http } from '../../ajax';
import commonText from '../../localization/common';
import { Button, Form, Input, Label, Submit } from '../basic';
import { useId, useTitle, useValidation } from '../hooks';
import type { UserTool } from '../main';
import { Dialog, LoadingScreen } from '../modaldialog';
import createBackboneView from '../reactbackboneextend';

function MasterKey({
  onClose: handleClose,
}: {
  readonly onClose: () => void;
}): JSX.Element {
  useTitle(commonText('generateMasterKey'));

  const [password, setPassword] = React.useState<string>('');
  const [masterKey, setMasterKey] = React.useState<string | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const id = useId('master-key');

  const { validationRef, setValidation } = useValidation();

  return isLoading ? (
    <LoadingScreen />
  ) : typeof masterKey === 'undefined' ? (
    <Dialog
      title={commonText('generateMasterKeyDialogTitle')}
      header={commonText('generateMasterKeyDialogHeader')}
      onClose={handleClose}
      buttons={
        <>
          <Button.DialogClose>{commonText('cancel')}</Button.DialogClose>
          <Submit.Blue form={id('form')} value={commonText('generate')} />
        </>
      }
    >
      <Form
        className="contents"
        id={id('form')}
        onSubmit={(event): void => {
          event.preventDefault();
          setIsLoading(true);
          ajax(
            '/api/master_key/',
            {
              method: 'POST',
              body: formData({ password }),
              headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                Accept: 'text/plain',
              },
            },
            {
              expectedResponseCodes: [Http.FORBIDDEN, Http.OK],
            }
          )
            .then(({ data, status }) =>
              status === Http.FORBIDDEN
                ? setValidation(commonText('incorrectPassword'))
                : setMasterKey(data)
            )
            // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
            .catch((error: Error) => setValidation(error.message))
            .finally(() => {
              setIsLoading(false);
            });
        }}
      >
        <Label>
          {commonText('userPassword')}
          <Input
            forwardRef={validationRef}
            type="password"
            value={password}
            onChange={({ target }): void => {
              setPassword(target.value);
              target.setCustomValidity('');
            }}
            required
          />
        </Label>
      </Form>
    </Dialog>
  ) : (
    <ShowKey masterKey={masterKey} onClose={handleClose} />
  );
}

function ShowKey({
  onClose: handleClose,
  masterKey,
}: {
  readonly onClose: () => void;
  readonly masterKey: string;
}): JSX.Element {
  return (
    <Dialog
      title={commonText('masterKeyDialogTitle')}
      header={commonText('masterKeyDialogHeader')}
      onClose={handleClose}
      buttons={commonText('close')}
    >
      <Label>
        {commonText('masterKeyFieldLabel')}
        <Input type="text" readOnly value={masterKey} />
      </Label>
    </Dialog>
  );
}

const MasterKeyView = createBackboneView(MasterKey);

const toolBarItem: UserTool = {
  task: 'master-key',
  title: commonText('generateMasterKey'),
  view: ({ onClose }) => new MasterKeyView({ onClose }),
};

export default toolBarItem;
