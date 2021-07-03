import type { RA } from '../components/wbplanview';
import { createDictionary } from './utils';

// Refer to "Guidelines for Programmers" in ./utils.tsx before editing this file

const queryText = createDictionary({
  queryBoxDescription: (fieldNames: RA<string>) =>
    `Searches: ${fieldNames.join(', ')}`,
  fieldIsRequired: 'Field is required',
  selectFields: 'Select Field...',
  treeRankAuthor: (rankName: string) => `${rankName} Author`,
  selectOp: 'Select Op...',
  any: 'any',
  addValuesHint: 'Add values one by one, or as comma-separated list:',
  saveQueryDialogTitle: 'Save query as...',
  savingQueryDialogTitle: 'Saving...',
  saveQueryDialogMessage: 'Enter a name for the new query.',
  saveClonedQueryDialogMessage: `
    The query will be saved with a new name leaving the current query
    unchanged.`,
  queryName: 'Query Name:',
  queryDeleteIncompleteDialogTitle: 'Incomplete fields',
  queryDeleteIncompleteDialogMessage: `
    There are uncompleted fields in the query definition. Do you want to
    remove them?`,
  queryUnloadProtectDialogMessage: 'This query definition has not been saved.',
  recordSetToQueryDialogTitle: 'Record Set from Query',
  recordSetToQueryDialogMessage: 'Generating record set.',
  openNewlyCreatedRecordSet: 'Open newly created record set now?',
  unableToExportAsKmlDialogTitle: 'Unable to Export',
  unableToExportAsKmlDialogMessage:
    'Please add latitude and longitude fields to the query.',
  queryExportStartedDialogTitle: 'Query Started',
  queryExportStartedDialogMessage: (exportFileType: string) => `
    The query has begun executing. You will receive a notification when the
    results ${exportFileType} file is ready for download.`,
  invalidPicklistValue: (value: string) => `${value} (current, invalid value)`,
  missingRequiredPicklistValue: 'Invalid null selection',
});

export default queryText;
