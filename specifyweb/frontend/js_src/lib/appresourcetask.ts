'use strict';

import router from './router';

function appResources(type: 'appResources' | 'viewSets', id?: string) {
  import('./appresources').then((appResourcesModule) => {
    const idInt = Number.parseInt(id ?? '');
    appResourcesModule[type](Number.isNaN(idInt) ? null : idInt);
  });
}

export default function () {
  router.route('appresources/', 'appresources', () =>
    appResources('appResources')
  );
  router.route('appresources/:id/', 'appresource', (id: string) =>
    appResources('appResources', id)
  );
  router.route('viewsets/', 'viewsets', () => appResources('viewSets'));
  router.route('viewsets/:id/', 'viewset', (id: string) =>
    appResources('viewSets', id)
  );
}