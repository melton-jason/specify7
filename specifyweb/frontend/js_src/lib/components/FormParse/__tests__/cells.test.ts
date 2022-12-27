import type { PartialBy } from '../../../utils/types';
import { strictParseXml } from '../../AppResources/codeMirrorLinters';
import { schema } from '../../DataModel/schema';
import type { CellTypes, FormCellDefinition } from '../cells';
import {
  parseFormCell,
  parseSpecifyProperties,
  processColumnDefinition,
} from '../cells';
import { theories } from '../../../tests/utils';
import { requireContext } from '../../../tests/helpers';

requireContext();

theories(processColumnDefinition, [
  {
    in: ['100px,2px,195px,5px,86px,2px,210px,5px,74px,2px,146px,15px,p:g'],
    out: [100, 195, 86, 210, 74, 146],
  },
  {
    in: [
      'p,2px,min(p;150px),5px:g,p,2px,p:g(2),5px:g,p,2px,p:g(2),5px:g,p,2px,p:g(2)',
    ],
    out: [
      undefined,
      150,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ],
  },
  {
    in: ['p,2px,p:g,5px:g,p,2px,p:g(2),5px:g,p,2px,p:g(2)'],
    out: [undefined, undefined, undefined, undefined, undefined, undefined],
  },
  { in: ['130px,2px,705px,25px,95px,0px,p:g'], out: [130, 705, 95] },
  { in: ['p,2px,p:g(4),p:g,p,0px'], out: [undefined, undefined, undefined] },
]);

theories(parseSpecifyProperties, [
  {
    in: [''],
    out: {},
  },
  {
    in: ['name=Agent;title=Catalog Agent'],
    out: {
      name: 'Agent',
      title: 'Catalog Agent',
    },
  },
  {
    in: ['name=PartialDateUI;df=catalogedDate;tp=catalogedDatePrecision'],
    out: {
      name: 'PartialDateUI',
      df: 'catalogedDate',
      tp: 'catalogedDatePrecision',
    },
  },
  {
    in: ['name=CollectingEvent;clonebtn=true'],
    out: {
      name: 'CollectingEvent',
      clonebtn: 'true',
    },
  },
  {
    in: ['align=left;'],
    out: {
      align: 'left',
    },
  },
  {
    in: ['align=right;fg=0,190,0'],
    out: {
      align: 'right',
      fg: '0,190,0',
    },
  },
  {
    in: [
      'name=LocalityGeoRef;title=Geo Ref;geoid=geography;locid=localityName;llid=5',
    ],
    out: {
      name: 'LocalityGeoRef',
      title: 'Geo Ref',
      geoid: 'geography',
      locid: 'localityName',
      llid: '5',
    },
  },
]);

const cell = (
  cell: CellTypes[keyof CellTypes] &
    PartialBy<
      FormCellDefinition,
      'align' | 'ariaLabel' | 'colSpan' | 'id' | 'visible'
    >
): FormCellDefinition => ({
  id: undefined,
  colSpan: 1,
  align: 'left',
  visible: true,
  ariaLabel: undefined,
  ...cell,
});

describe('parseFormCell', () => {
  test('base case', () =>
    expect(
      parseFormCell(schema.models.CollectionObject, strictParseXml('<cell />'))
    ).toEqual(
      cell({
        type: 'Unsupported',
        cellType: undefined,
      })
    ));

  test('unsupported cell with some attributes', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml(
          '<cell invisible="true" type=" test2 " initialize="align=Center" colSpan=" 5 " id="test" />'
        )
      )
    ).toEqual(
      cell({
        id: 'test',
        colSpan: 3,
        align: 'center',
        // Cannot make "Unsupported" cell invisible
        visible: true,
        type: 'Unsupported',
        cellType: ' test2 ',
      })
    ));

  test('invisible field', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml(
          '<cell type=" field " uiType="text" invisible="true" name="CatalogNumber" isRequired="TRuE " initialize="align=RIGHT" colSpan=" 5 " id="test" />'
        )
      )
    ).toEqual(
      cell({
        id: 'test',
        colSpan: 3,
        align: 'right',
        visible: false,
        type: 'Field',
        fieldName: 'catalogNumber',
        isRequired: true,
        fieldDefinition: {
          defaultValue: undefined,
          isReadOnly: false,
          max: undefined,
          min: undefined,
          step: undefined,
          type: 'Text',
        },
      })
    ));

  test('field required by schema', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml(
          '<cell type="field" uiType="text" name="  CollectionObject.CollectionMemberId  " />'
        )
      )
    ).toEqual(
      cell({
        type: 'Field',
        isRequired: true,
        fieldName: 'collectionMemberId',
        fieldDefinition: {
          defaultValue: undefined,
          isReadOnly: false,
          max: undefined,
          min: undefined,
          step: undefined,
          type: 'Text',
        },
      })
    ));

  test('unknown field', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml('<cell type="field" uiType="text" name="this" />')
      )
    ).toEqual(
      cell({
        type: 'Field',
        isRequired: false,
        fieldName: 'this',
        fieldDefinition: {
          defaultValue: undefined,
          isReadOnly: false,
          max: undefined,
          min: undefined,
          step: undefined,
          type: 'Text',
        },
      })
    ));

  test('fieldName unset by LatLonUI plugin', () =>
    expect(
      parseFormCell(
        schema.models.Locality,
        strictParseXml(
          '<cell type="field" uiType="plugin" name="localityName" initialize=";;;name  =  LatLonUI;;;;" readOnly="true" />'
        )
      )
    ).toEqual(
      cell({
        type: 'Field',
        // The field is required by the data model
        isRequired: true,
        fieldName: undefined,
        fieldDefinition: {
          type: 'Plugin',
          isReadOnly: true,
          pluginDefinition: {
            type: 'LatLonUI',
            step: undefined,
            latLongType: 'Point',
          },
        },
      })
    ));

  test('relationship field names are parsed correctly', () =>
    expect(
      parseFormCell(
        schema.models.Collector,
        strictParseXml(
          '<cell type="field" uiType="text" name="agent.lastName" />'
        )
      )
    ).toEqual(
      cell({
        type: 'Field',
        // The field is required by the data model
        isRequired: false,
        fieldName: 'agent.lastName',
        fieldDefinition: {
          defaultValue: undefined,
          isReadOnly: false,
          max: undefined,
          min: undefined,
          step: undefined,
          type: 'Text',
        },
      })
    ));

  test('fieldName overwritten by the PartialDateUI plugin', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml(
          '<cell type="field" uiType="plugin" initialize="name=PartialDateUI;df=catalogedDate" />'
        )
      )
    ).toEqual(
      cell({
        type: 'Field',
        isRequired: false,
        fieldName: 'catalogeddate',
        fieldDefinition: {
          type: 'Plugin',
          isReadOnly: false,
          pluginDefinition: {
            type: 'PartialDateUI',
            defaultValue: undefined,
            dateField: 'catalogeddate',
            precisionField: undefined,
            defaultPrecision: 'full',
          },
        },
      })
    ));

  test('simple label with custom text', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml('<cell type="Label" label="some text" />')
      )
    ).toEqual(
      cell({
        // Labels are right aligned by default
        align: 'right',
        type: 'Label',
        text: 'some text',
        title: undefined,
        labelForCellId: undefined,
        fieldName: undefined,
      })
    ));

  test('label with Specify 6 localization string', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml('<cell type="Label" label="FINDNEXT" labelfor=" 42" />')
      )
    ).toEqual(
      cell({
        align: 'right',
        type: 'Label',
        text: 'Find Next',
        title: undefined,
        labelForCellId: '42',
        fieldName: undefined,
      })
    ));

  test('Separator', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml(
          '<cell type="separator"   label="FINDNEXT" name="unused" additional="unused" icon=" 42" forClass=" CollectionObject" />'
        )
      )
    ).toEqual(
      cell({
        type: 'Separator',
        label: 'Find Next',
        icon: '42',
        forClass: 'CollectionObject',
      })
    ));

  test('basic SubView', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml('<cell type="subView" name="determinationS "  />')
      )
    ).toEqual(
      cell({
        type: 'SubView',
        formType: 'form',
        fieldName: 'determinations',
        viewName: undefined,
        isButton: false,
        icon: undefined,
        sortField: undefined,
      })
    ));

  test('SubView button with custom icon and sorting', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml(
          '<cell type="subView" name="determinations" defaultType="table" viewName="testView " initialize="sortField=-iscurrent ;btn=true  ; icon=test" />'
        )
      )
    ).toEqual(
      cell({
        type: 'SubView',
        formType: 'formTable',
        fieldName: 'determinations',
        viewName: 'testView',
        isButton: true,
        icon: 'test',
        sortField: '-isCurrent',
      })
    ));

  test('Panel', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml(
          `<cell type="panel" colDef="1px,2px,2px">
            <rows>
              <row>
                <cell type="Label" label="FINDNEXT" labelfor=" 42" />
              </row>
            </rows>
          </cell>`
        )
      )
    ).toEqual(
      cell({
        type: 'Panel',
        columns: [1, 2],
        align: 'left',
        rows: [
          [
            cell({
              align: 'right',
              labelForCellId: '42',
              type: 'Label',
              fieldName: undefined,
              text: 'Find Next',
              title: undefined,
            }),
            cell({
              type: 'Blank',
              visible: false,
            }),
          ],
        ],
        display: 'block',
      })
    ));

  test('inline Panel', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml(
          '<cell type="panel" colDef="p:g,2px,2px" panelType="buttonBar" />'
        )
      )
    ).toEqual(
      cell({
        type: 'Panel',
        columns: [undefined, 2],
        rows: [],
        display: 'inline',
      })
    ));

  test('Command', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml(
          '<cell type="command" name="ReturnLoan" label="generateLabelBtn" />'
        )
      )
    ).toEqual(
      cell({
        type: 'Command',
        commandDefinition: {
          commandDefinition: {
            type: 'ReturnLoan',
          },
          label: 'generateLabelBtn',
        },
      })
    ));

  test('Blank', () =>
    expect(
      parseFormCell(
        schema.models.CollectionObject,
        strictParseXml('<cell type="blank" name="ignored" />')
      )
    ).toEqual(cell({ type: 'Blank' })));
});