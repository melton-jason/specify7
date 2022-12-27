import React from 'react';
import { useOutletContext } from 'react-router';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { ping } from '../../utils/ajax/ping';
import { f } from '../../utils/functools';
import { removeKey, replaceKey } from '../../utils/utils';
import { schema } from '../DataModel/schema';
import type { GetOrSet, IR } from '../../utils/types';
import { defined } from '../../utils/types';
import { LoadingContext } from '../Core/Contexts';
import { LoadingScreen } from '../Molecules/Dialog';
import { NotFoundView } from '../Router/NotFoundView';
import { createLibraryRole } from './CreateLibraryRole';
import type { NewRole, Role } from './Role';
import { RoleView } from './Role';
import type { SecurityOutlet } from '../Toolbar/Security';
import { decompressPolicies } from './policyConverter';
import { Http } from '../../utils/ajax/definitions';
import { locationToState, useStableLocation } from '../Router/RouterState';

const closeUrl = '/specify/security/institution/';

export function SecurityLibraryRole(): JSX.Element {
  const { getSetLibraryRoles, institution } =
    useOutletContext<SecurityOutlet>();
  const [libraryRoles, handleChangeLibraryRoles] = getSetLibraryRoles;
  const role = useRole(libraryRoles);
  const navigate = useNavigate();
  const loading = React.useContext(LoadingContext);
  return typeof libraryRoles === 'object' &&
    typeof role === 'object' &&
    typeof institution === 'object' ? (
    <RoleView
      closeUrl={closeUrl}
      collectionId={schema.domainLevelIds.collection}
      parentName={institution.name ?? schema.models.Institution.label}
      permissionName="/permissions/library/roles"
      role={role}
      userRoles={undefined}
      onAddUsers={undefined}
      roleUsers={undefined}
      onDelete={(): void =>
        typeof role.id === 'number'
          ? loading(
              ping(
                `/permissions/library_role/${role.id}/`,
                {
                  method: 'DELETE',
                },
                { expectedResponseCodes: [Http.NO_CONTENT] }
              )
                .then((): void =>
                  handleChangeLibraryRoles(
                    removeKey(libraryRoles, role.id!.toString())
                  )
                )
                .then((): void => navigate(closeUrl, { replace: true }))
            )
          : undefined
      }
      onSave={(role): void =>
        loading(
          (typeof role.id === 'number'
            ? updateLibraryRole(handleChangeLibraryRoles, role as Role)
            : createLibraryRole(handleChangeLibraryRoles, role as Role)
          ).then((): void => navigate(closeUrl))
        )
      }
    />
  ) : role === false ? (
    <NotFoundView container={false} />
  ) : (
    <LoadingScreen />
  );
}

function useRole(
  libraryRoles: IR<Role> | undefined
): NewRole | Role | false | undefined {
  const location = useStableLocation(useLocation());
  const state = locationToState(location, 'SecurityRole');
  const role = state?.role;
  const { roleId } = useParams();
  return React.useMemo(() => {
    if (typeof role === 'object') return role;
    const id = f.parseInt(roleId);
    if (typeof id === 'number') {
      return typeof libraryRoles === 'object'
        ? libraryRoles[id] ?? false
        : undefined;
    } else
      return {
        id: undefined,
        name: '',
        description: '',
        policies: [],
      };
  }, [libraryRoles, roleId, role]);
}

export const updateLibraryRole = async (
  handleChange: GetOrSet<IR<Role> | undefined>[1],
  role: Role
): Promise<void> =>
  ping(
    `/permissions/library_role/${role.id}/`,
    {
      method: 'PUT',
      body: {
        ...role,
        policies: decompressPolicies(role.policies),
      },
    },
    { expectedResponseCodes: [Http.NO_CONTENT] }
  ).then((): void =>
    handleChange((roles) =>
      replaceKey(defined(roles), role.id.toString(), role)
    )
  );