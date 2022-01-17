import React from 'react';

import ajax from '../ajax';
import commonText from '../localization/common';
import * as navigation from '../navigation';
import * as querystring from '../querystring';
import router from '../router';
import type { IR, RA } from '../types';
import userInfo from '../userinfo';
import { Button, Form, Input, Link } from './basic';
import type { MenuItem, UserTool } from './main';
import { Dialog, dialogClassNames } from './modaldialog';
import { setCurrentOverlay } from '../specifyapp';

const routeMappings: IR<string> = {
  recordSetView: 'data',
  resourceView: 'data',
  newResourceView: 'data',
  byCatNo: 'data',
  storedQuery: 'query',
  ephemeralQuery: 'query',
  queryFromTable: 'query',
  'workbench-import': 'workbenches',
  'workbench-plan': 'workbenches',
};

export function HeaderItems({
  menuItems,
}: {
  readonly menuItems: RA<MenuItem>;
}): JSX.Element {
  const [activeTask, setActiveTask] = React.useState<string | undefined>(
    undefined
  );
  React.useEffect(() => {
    router.on('route', (route: string) => {
      if (menuItems.some(({ task }) => task === route)) setActiveTask(route);
      else setActiveTask(routeMappings[route] ?? undefined);
    });
  }, []);

  return (
    <nav
      className={`xl:m-0 lg:justify-center flex flex-row flex-wrap flex-1
        order-2 -mt-2 px-2`}
      aria-label="primary"
    >
      {menuItems.map(({ task, title, icon, view }) => (
        <Link.Default
          className={`
            p-3
            text-gray-700
            dark:text-neutral-300
            rounded
            relative
            inline-flex
            items-center
            gap-x-2
            active:bg-white
            active:dark:bg-neutral-600
            ${
              task === activeTask
                ? 'bg-white dark:bg-neutral-600 lg:bg-transparent'
                : ''
            }
            lg:after:absolute
            lg:after:-bottom-1
            lg:after:w-full
            lg:after:left-0
            lg:after:right-0
            lg:after:h-2
            lg:after:bg-transparent
            lg:hover:after:bg-gray-200
            lg:hover:after:dark:bg-neutral-800
            ${task === activeTask ? 'lg:after:bg-gray-200' : ''}
            ${task === activeTask ? 'lg:after:dark:bg-neutral-800' : ''}
          `}
          key={task}
          href={`/specify/task/${task}/`}
          aria-current={task === activeTask ? 'page' : undefined}
          onClick={(event): void => {
            event.preventDefault();
            const backboneView = view({
              onClose: (): void => void backboneView.remove(),
            });
            setCurrentOverlay(backboneView);
          }}
        >
          {icon}
          {title}
        </Link.Default>
      ))}
    </nav>
  );
}

type Collections = {
  readonly available: RA<Readonly<[number, string]>>;
  readonly current: number | null;
};

export function CollectionSelector(): JSX.Element {
  const [collections, setCollections] = React.useState<Collections | undefined>(
    undefined
  );

  React.useEffect(() => {
    void ajax<Collections>('/context/collection/', {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      headers: { Accept: 'application/json' },
    }).then(({ data: collections }) => {
      if (!destructorCalled) setCollections(collections);
      return undefined;
    });

    let destructorCalled = false;
    return (): void => {
      destructorCalled = true;
    };
  }, []);

  return (
    <select
      className="flex-1"
      title={commonText('currentCollection')}
      aria-label={commonText('currentCollection')}
      value={collections?.current ?? undefined}
      onChange={({ target }): void =>
        navigation.switchCollection(Number.parseInt(target.value), '/', () => {
          /* Nothing */
        })
      }
    >
      {collections?.available.map(([id, name]) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </select>
  );
}

export function ExpressSearch(): JSX.Element {
  const [searchQuery, setSearchQuery] = React.useState<string>(
    () => querystring.parse().q ?? ''
  );
  return (
    <Form
      onSubmit={(event): void => {
        event.preventDefault();
        const query = searchQuery.trim();
        if (query.length === 0) return;
        const url = querystring.format('/specify/express_search/', {
          // eslint-disable-next-line id-length
          q: query,
        });
        navigation.go(url);
      }}
      className="contents"
      action="/specify/express_search/"
      role="search"
    >
      <Input
        type="search"
        className="flex-1"
        name="q"
        placeholder={commonText('search')}
        aria-label={commonText('search')}
        value={searchQuery}
        onChange={({ target }): void => setSearchQuery(target.value)}
      />
    </Form>
  );
}

export function UserTools({
  userTools,
}: {
  readonly userTools: RA<UserTool>;
}): JSX.Element {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  return (
    <>
      <Button.Simple
        className="max-w-[110px] overflow-hidden whitespace-nowrap text-overflow-ellipsis"
        title={commonText('currentUser')}
        onClick={(): void => setIsOpen(true)}
      >
        {userInfo.name}
      </Button.Simple>
      <Dialog
        isOpen={isOpen}
        header={commonText('userToolsDialogTitle')}
        className={{
          container: dialogClassNames.narrowContainer,
        }}
        onClose={(): void => setIsOpen(false)}
        buttons={commonText('close')}
      >
        <nav>
          {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
          <ul role="list">
            {[
              {
                task: '/accounts/logout',
                title: commonText('logOut'),
                basePath: '',
                view: undefined,
              },
              {
                task: '/accounts/password_change',
                title: commonText('changePassword'),
                basePath: '',
                view: undefined,
              },
              ...userTools.map((userTool) => ({
                ...userTool,
                basePath: '/specify/task/',
              })),
            ].map(({ task, title, basePath, view }) => (
              <li key={task}>
                <Link.Default
                  href={`${basePath}${task}/`}
                  onClick={(event): void => {
                    if (typeof view === 'undefined') return;
                    event.preventDefault();
                    setIsOpen(false);
                    const backboneView = view({
                      onClose: (): void => void backboneView.remove(),
                    });
                    setCurrentOverlay(backboneView);
                  }}
                >
                  {title}
                </Link.Default>
              </li>
            ))}
          </ul>
        </nav>
      </Dialog>
    </>
  );
}
