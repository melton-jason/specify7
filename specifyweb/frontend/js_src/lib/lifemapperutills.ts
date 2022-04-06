import type { CollectionObject } from './datamodel';
import type { SpecifyResource } from './legacytypes';
import { snServer } from './lifemapperconfig';
import type { IR, RA } from './types';
import { ajax } from './ajax';

export const fetchLocalScientificName = async (
  model: SpecifyResource<CollectionObject>,
  defaultValue = ''
): Promise<string> =>
  model.rgetCollection('determinations').then(({ models: determinations }) =>
    determinations.length === 0
      ? defaultValue
      : determinations[0]
          .rgetPromise('preferredTaxon')
          .then((preferredTaxon) => preferredTaxon?.get('fullName'))
          .then((scientificName) =>
            typeof scientificName === 'string' ? scientificName : defaultValue
          )
  );

export const formatLifemapperViewPageRequest = (
  occurrenceGuid: string,
  speciesName: string
): string =>
  `${snServer}/api/v1/frontend/?occid=${occurrenceGuid}&namestr=${speciesName}&origin=${window.location.origin}`;

export const formatOccurrenceDataRequest = (occurrenceGuid: string): string =>
  `${snServer}/api/v1/occ/${occurrenceGuid}?count_only=0`;

export const fetchOccurrenceName = (
  model: SpecifyResource<CollectionObject>
): Promise<string> =>
  model
    .fetchPromise()
    .then(async () =>
      ajax<{
        readonly records: RA<{
          readonly records: RA<IR<string>>;
        }>;
      }>(
        formatOccurrenceDataRequest(model.get('guid')),
        {
          mode: 'cors',
          headers: { Accept: 'application/json' },
        },
        { strict: false }
      )
    )
    .then(({ data }) =>
      data.records
        .filter(({ records }) => records.length > 0)
        .map(({ records }) => records[0]['dwc:scientificName'])
        .find((occurrenceName) => occurrenceName)
    )
    .catch(console.error)
    .then(
      (remoteOccurrence) => remoteOccurrence ?? fetchLocalScientificName(model)
    )
    .catch(console.error)
    .then((occurrenceName) => occurrenceName ?? '');
