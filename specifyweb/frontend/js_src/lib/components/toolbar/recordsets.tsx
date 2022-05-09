import React from 'react';

import { fetchCollection } from '../../collection';
import { commonText } from '../../localization/common';
import { hasToolPermission } from '../../permissions';
import { getUserPref } from '../../preferencesutils';
import { userInformation } from '../../userinfo';
import { icons } from '../icons';
import type { MenuItem } from '../main';
import { RecordSetsDialog } from '../recordsetsdialog';

export const menuItem: MenuItem = {
  task: 'recordsets',
  title: commonText('recordSets'),
  icon: icons.collection,
  isOverlay: true,
  enabled: () =>
    getUserPref('header', 'menu', 'showRecordSets') &&
    hasToolPermission('recordSets', 'read'),
  view: ({ onClose: handleClose }) => {
    const recordSetsPromise = React.useMemo(
      async () =>
        fetchCollection('RecordSet', {
          specifyUser: userInformation.id,
          type: 0,
          limit: 5000,
          domainFilter: true,
          orderBy: '-timestampCreated',
        }),
      []
    );
    return (
      <RecordSetsDialog
        recordSetsPromise={recordSetsPromise}
        isReadOnly={false}
        onClose={handleClose}
      />
    );
  },
};