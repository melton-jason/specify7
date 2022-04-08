import React from 'react';

import { ajax } from '../ajax';
import type { SpecifyUser } from '../datamodel';
import adminText from '../localization/admin';
import commonText from '../localization/common';
import { Button, Input } from './basic';
import { LoadingContext } from './contexts';
import { Dialog } from './modaldialog';

export function UserInviteLinkPlugin({
  user,
}: {
  readonly user: SerializedResource<SpecifyUser>;
}): JSX.Element {
  const loading = React.useContext(LoadingContext);
  const [link, setLink] = React.useState<string | undefined>(undefined);

  return (
    <>
      <Button.Simple
        onClick={(): void =>
          loading(
            ajax(`/accounts/invite_link/${user.id}/`, {
              headers: { Accept: 'text/plain' },
            }).then(({ data }) => setLink(data))
          )
        }
      >
        {adminText('createInviteLink')}
      </Button.Simple>
      {typeof link === 'string' && (
        <Dialog
          header={adminText('userInviteLinkDialogHeader')}
          onClose={(): void => setLink(undefined)}
          buttons={commonText('close')}
        >
          {adminText('userInviteLinkDialogMessage')}
          <div className="flex gap-2">
            <Input.Text isReadOnly className="w-full" value={link} />
            <Button.Blue
              onClick={(): void => {
                window.navigator.clipboard.writeText(link).catch(console.error);
              }}
            >
              {adminText('copyToClipboard')}
            </Button.Blue>
          </div>
        </Dialog>
      )}
    </>
  );
}