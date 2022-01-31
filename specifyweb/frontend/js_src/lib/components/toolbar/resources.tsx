import React from 'react';

import commonText from '../../localization/common';
import { userInformation } from '../../userinfo';
import { Link } from '../basic';
import { useTitle } from '../hooks';
import type { UserTool } from '../main';
import { Dialog } from '../modaldialog';
import createBackboneView from '../reactbackboneextend';

function AppResourceDialog({
  onClose: handleClose,
}: {
  readonly onClose: () => void;
}): JSX.Element {
  useTitle(commonText('resources'));

  return (
    <Dialog
      title={commonText('resourcesDialogTitle')}
      header={commonText('resourcesDialogHeader')}
      onClose={handleClose}
      buttons={commonText('cancel')}
    >
      <nav className="contents">
        <Link.Default
          href="/specify/appresources/"
          className="intercept-navigation"
        >
          {commonText('appResources')}
        </Link.Default>
        <Link.Default
          href="/specify/viewsets/"
          className="intercept-navigation"
        >
          {commonText('viewSets')}
        </Link.Default>
      </nav>
    </Dialog>
  );
}

const View = createBackboneView(AppResourceDialog);

const userTool: UserTool = {
  task: 'resources',
  title: commonText('resources'),
  view: ({ onClose }) => new View({ onClose }),
  enabled: () => userInformation.isadmin,
};

export default userTool;
