import React from 'react';
import _ from 'underscore';

import { useAsyncState } from '../../hooks/useAsyncState';
import { useBooleanState } from '../../hooks/useBooleanState';
import { commonText } from '../../localization/common';
import type { RA } from '../../utils/types';
import { showLeafletMap } from './index';
import { addFullScreenButton, LeafletInstance } from './addOns';
import type L from './extend';
import type { LocalityData } from './helpers';
import { leafletLayersPromise } from './layers';
import { Dialog, dialogClassNames } from '../Molecules/Dialog';
import { LocalizedString } from 'typesafe-i18n';
import { localityText } from '../../localization/locality';

const resizeThrottle = 250;

export function LeafletMap({
  localityPoints,
  onMarkerClick: handleMarkerClick,
  forwardRef,
  header = localityText.geoMap(),
  headerButtons,
  buttons = commonText.close(),
  onClose: handleClose,
  modal = true,
}: {
  readonly localityPoints: RA<LocalityData>;
  readonly onMarkerClick?: (index: number, event: L.LeafletEvent) => void;
  readonly forwardRef?: React.RefCallback<LeafletInstance>;
  readonly header?: LocalizedString;
  readonly headerButtons?: JSX.Element;
  readonly buttons?: JSX.Element | LocalizedString;
  readonly onClose?: () => void;
  readonly modal?: boolean;
}): JSX.Element {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);

  const [handleResize, setHandleResize] = React.useState<
    (() => void) | undefined
  >(undefined);
  const [isFullScreen, __, ___, handleToggleFullScreen] = useBooleanState();
  const [tileLayers] = useAsyncState(
    React.useCallback(async () => leafletLayersPromise, []),
    true
  );

  const handleClickRef =
    React.useRef<typeof handleMarkerClick>(handleMarkerClick);
  React.useEffect(() => {
    handleClickRef.current = handleMarkerClick;
  }, [handleMarkerClick]);

  React.useEffect(() => {
    if (container === null || tileLayers === undefined) return undefined;
    const map = showLeafletMap({
      tileLayers,
      container,
      localityPoints,
      onMarkerClick: (...args) => handleClickRef.current?.(...args),
    });
    setHandleResize(() =>
      _.throttle(() => map.invalidateSize(), resizeThrottle)
    );
    addFullScreenButton(map, handleToggleFullScreen);
    forwardRef?.(map);
    return (): void => void map.remove();
  }, [
    tileLayers,
    container,
    localityPoints,
    forwardRef,
    handleToggleFullScreen,
  ]);

  return (
    <Dialog
      buttons={buttons}
      className={{
        container: isFullScreen
          ? dialogClassNames.fullScreen
          : dialogClassNames.extraWideContainer,
      }}
      header={header}
      headerButtons={headerButtons}
      modal={modal}
      onClose={handleClose}
      onResize={handleResize}
    >
      <div
        ref={setContainer}
        style={{ '--transition-duration': 0 } as React.CSSProperties}
      />
    </Dialog>
  );
}
