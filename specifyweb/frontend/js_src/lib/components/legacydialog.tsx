// TODO: get rid of this once everything is using React
import type jQuery from 'jquery';
import React from 'react';

import { Dialog, dialogClassNames } from './modaldialog';
import { createBackboneView } from './reactbackboneextend';

/** Wrapper for using React dialog in Backbone views */
function LegacyDialogWrapper({
  content,
  ...props
}: Omit<Parameters<typeof Dialog>[0], 'isOpen' | 'children'> & {
  readonly content: HTMLElement | typeof jQuery | string;
}): JSX.Element {
  const [contentElement, setContentElement] =
    React.useState<HTMLElement | null>(null);
  React.useEffect(
    () =>
      contentElement?.replaceChildren(
        typeof content === 'object' && 'jquery' in content
          ? (content[0] as HTMLElement)
          : (content as HTMLElement)
      ),
    [content, contentElement]
  );

  return (
    <Dialog
      {...props}
      forwardRef={{ content: setContentElement }}
      className={{
        ...props.className,
        container:
          props.className?.container ?? dialogClassNames.normalContainer,
      }}
    >
      {''}
    </Dialog>
  );
}

const dialogClass = createBackboneView(LegacyDialogWrapper);

export const openDialogs: Set<() => void> = new Set();
export const showDialog = (
  props: ConstructorParameters<typeof dialogClass>[0]
) => {
  const view = new dialogClass(props).render();

  /*
   * Removed Backbone components may leave dangling dialogs
   * This helps SpecifyApp.js clean them up
   */
  if (props?.forceToTop !== true) {
    const originalDestructor = view.remove.bind(view);
    view.remove = (): typeof view => {
      originalDestructor();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      openDialogs.delete(view.remove);
      return view;
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method
    openDialogs.add(view.remove);
  }

  return view;
};