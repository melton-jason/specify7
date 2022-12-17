import React from 'react';

import { commonText } from '../../../localization/common';
import { f } from '../../../utils/functools';
import { Button, DialogContext } from '../Button';
import { className } from '../className';
import { mount, snapshot } from '../../../tests/reactUtils';

test('DialogButton closes the dialog', async () => {
  const handleClose = jest.fn();
  const { asFragment, getByRole, user } = mount(
    <DialogContext.Provider value={handleClose}>
      <Button.DialogClose>{commonText.title()}</Button.DialogClose>
    </DialogContext.Provider>
  );

  const button = getByRole('button');
  await user.click(button);
  expect(handleClose).toHaveBeenCalledTimes(1);

  expect(asFragment()).toMatchSnapshot();
});

snapshot(Button.LikeLink, { onClick: f.never });
describe('Button.Small', () => {
  snapshot(Button.Small, { onClick: f.never }, 'default variant');
  snapshot(
    Button.Small,
    {
      onClick: f.never,
      variant: className.blueButton,
      className: 'a',
    },
    'custom variant'
  );
});
snapshot(Button.Fancy, { onClick: f.never });
snapshot(Button.Gray, { onClick: f.never });
snapshot(Button.BorderedGray, { onClick: f.never });
snapshot(Button.Red, { onClick: f.never });
snapshot(Button.Blue, { onClick: f.never });
snapshot(Button.Orange, { onClick: f.never });
snapshot(Button.Green, { onClick: f.never });
snapshot(Button.Icon, { onClick: f.never, title: 'Title', icon: 'cog' });
