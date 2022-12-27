import type { MappingLine } from '../Mapper';
import { schema } from '../../DataModel/schema';
import type { IR, RA } from '../../../utils/types';
import type { UploadPlan } from '../uploadPlanParser';
import { parseUploadPlan } from '../uploadPlanParser';
import mappingLines1 from '../../../tests/fixtures/mappinglines.1.json';
import uploadPlan1 from '../../../tests/fixtures/uploadplan.1.json';
import { requireContext } from '../../../tests/helpers';

requireContext();

test('parseUploadPlan', () => {
  expect(parseUploadPlan(uploadPlan1.uploadPlan as UploadPlan)).toEqual({
    baseTable: schema.models[mappingLines1.baseTableName as 'CollectionObject'],
    lines: mappingLines1.lines as RA<MappingLine>,
    mustMatchPreferences: mappingLines1.mustMatchPreferences as IR<boolean>,
  });
});
