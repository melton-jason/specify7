/*
 *
 * Workbench Upload Results UI
 *
 *
 */

'use strict';

import type Handsontable from 'handsontable';
import React from 'react';
import '../../css/wbuploaded.css';
import type { Action, State } from 'typesafe-reducer';
import { generateReducer } from 'typesafe-reducer';
import dataModelStorage from '../wbplanviewmodel';
import fetchDataModel from '../wbplanviewmodelfetcher';
import type {
  UploadedPicklistItem,
  UploadedPicklistItems,
  UploadedRow,
  UploadedRows,
  UploadedRowsTable,
} from '../wbuploadedparser';
import { parseUploadResults } from '../wbuploadedparser';
import { ModalDialog } from './modaldialog';
import createBackboneView from './reactbackboneextend';
import type { Dataset, IR, RA } from './wbplanview';

interface WBUploadedViewConstructorProps {
  dataset: Dataset;
  hot: Handsontable;
  removeCallback: () => void;
}

interface WBUploadedViewDataParseProps {
  readonly handleClose: () => void;
  readonly hot: Handsontable;
  readonly dataset: Dataset;
}

interface WBUploadedViewComponentProps {
  readonly handleClose: () => void;
  readonly uploadedRows: UploadedRows;
  readonly uploadedPicklistItems: UploadedPicklistItems;
  readonly hot: Handsontable;
  readonly isUploaded: boolean;
}

type UploadedRecordsTypes = 'table' | 'picklist';
type HandleCellClicked = (rowIndex: number, columnIndex: number) => void;

interface UploadedTableRowBaseProps {
  readonly onCellClicked: HandleCellClicked;
  readonly getRecordViewUrl?: (rowId: number) => string;
  readonly isUploaded: boolean;
}

type RecordsVisibilityState = IR<boolean>;

type WBUploadedState = State<
  'WBUploadedState',
  {
    tableRecordsVisibilityState: RecordsVisibilityState;
    picklistRecordsVisibilityState: RecordsVisibilityState;
    props: WBUploadedViewComponentProps;
  }
>;

type CreateRecordSetAction = Action<
  'CreateRecordSetAction',
  {
    tableName: string;
  }
>;

type CreateDataSetAction = Action<
  'CreateDataSetAction',
  {
    tableName: string;
  }
>;

type ToggleTableRecordsVisibilityAction = Action<
  'ToggleTableRecordsVisibilityAction',
  {
    tableName: string;
    destination:
      | 'tableRecordsVisibilityState'
      | 'picklistRecordsVisibilityState';
  }
>;

type CellClickedAction = Action<
  'CellClickedAction',
  {
    rowIndex: number;
    columnIndex: number;
  }
>;

type WBUploadedActions =
  | CreateRecordSetAction
  | CreateDataSetAction
  | ToggleTableRecordsVisibilityAction
  | CellClickedAction;

let ranks: IR<RA<string>>;
const fetchDataModelPromise: Promise<void> = fetchDataModel();

function UploadedTableRowsHeaderProps({
  columnNames,
}: {
  readonly columnNames: RA<string>;
}): JSX.Element {
  return (
    <thead>
      <tr>
        {columnNames.map((columnName, index) => (
          <th key={index}>{columnName}</th>
        ))}
      </tr>
    </thead>
  );
}

function CellLink({
  getRecordViewUrl,
  recordId,
  children,
}: {
  readonly getRecordViewUrl: (recordId: number) => string;
  readonly recordId?: number;
  readonly children: JSX.Element | React.ReactText;
}): JSX.Element {
  return typeof recordId === 'undefined' ? (
    <>{children}</>
  ) : (
    <a target="_blank" href={getRecordViewUrl(recordId)} rel="noreferrer">
      {children}
    </a>
  );
}

function UploadedTableRow({
  rows,
  isUploaded,
  onCellClicked: handleCellClicked,
  groupBoundaries,
  getRecordViewUrl,
}: UploadedTableRowBaseProps & {
  readonly rows: RA<UploadedRow>;
  readonly groupBoundaries?: RA<boolean>;
  readonly getRecordViewUrl: (rowId: number) => string;
}): JSX.Element {
  return (
    <tbody>
      {rows.map(({ rowIndex, columns }, index) => (
        <tr key={index}>
          {columns.map(
            (
              {
                columnIndex,
                cellValue,
                rowIndex: cellRowIndex,
                recordId,
                spanSize,
                matched,
              },
              index
            ) => (
              <React.Fragment key={index}>
                {typeof groupBoundaries !== 'undefined' &&
                  groupBoundaries[index] && (
                    <td
                      key="viewRecord"
                      className="wb-upload-results-record-link"
                    >
                      {typeof recordId !== 'undefined' &&
                        recordId >= 0 &&
                        isUploaded && (
                          <a
                            target="_blank"
                            href={getRecordViewUrl(recordId)}
                            rel="noreferrer"
                          >
                            👁
                          </a>
                        )}
                    </td>
                  )}
                <td
                  className={`wb-upload-results-cell ${
                    matched ? 'wb-upload-results-cell-matched' : ''
                  } ${columnIndex < 0 ? 'wb-upload-results-undefined-cell' : ''}
              `}
                  rowSpan={spanSize}
                  onClick={(): void =>
                    handleCellClicked(
                      rowIndex < 0 ? cellRowIndex ?? -1 : rowIndex,
                      columnIndex
                    )
                  }
                  title={
                    columnIndex < 0
                      ? undefined
                      : `${['Uploaded', 'Matched'][matched ? 1 : 0]} record`
                  }
                >
                  <CellLink
                    getRecordViewUrl={getRecordViewUrl}
                    recordId={recordId}
                  >
                    {typeof cellValue === 'undefined' ? 'Uploaded' : cellValue}
                  </CellLink>
                </td>
              </React.Fragment>
            )
          )}
        </tr>
      ))}
    </tbody>
  );
}

function UploadedPicklistRow({
  rows,
  onCellClicked: handleCellClicked,
}: UploadedTableRowBaseProps & {
  readonly rows: RA<UploadedPicklistItem>;
}): JSX.Element {
  return (
    <tbody>
      {rows.map(({ rowIndex, columnIndex, picklistValue: value }, index) => (
        <tr key={index}>
          <td
            className="wb-upload-results-cell"
            onClick={(): void => handleCellClicked(rowIndex, columnIndex)}
          >
            {value}
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function UploadedTableRows({
  type,
  isUploaded,
  rows,
  columnNames,
  getRecordViewUrl,
  onCellClicked: handleCellClicked,
  tableIsTree,
  groupBoundaries,
}: {
  readonly rows: (UploadedRow | UploadedPicklistItem)[];
  readonly columnNames?: RA<string>;
  readonly getRecordViewUrl?: (rowId: number) => string;
  readonly groupBoundaries?: RA<boolean>;
  readonly type: UploadedRecordsTypes;
  readonly isUploaded: boolean;
  readonly onCellClicked: HandleCellClicked;
  readonly tableIsTree: boolean;
} & (
  | {
      readonly rows: RA<UploadedRow>;
      readonly columnNames: RA<string>;
      readonly getRecordViewUrl: (rowId: number) => string;
      readonly type: 'table';
      readonly groupBoundaries?: RA<boolean>;
    }
  | {
      readonly rows: RA<UploadedPicklistItem>;
      readonly type: 'picklist';
    }
)): JSX.Element {
  /*
   * If there is only one group, and records haven't been uploaded yet,
   * don't show group boundary
   */
  const modifiedGroupBoundaries: RA<boolean> | undefined =
    !isUploaded && groupBoundaries?.filter((boundary) => boundary).length === 1
      ? groupBoundaries.map(() => false)
      : groupBoundaries;

  return (
    <div className="wb-upload-results-rows-container">
      <table
        className={`wb-upload-results-rows ${
          tableIsTree ? 'wb-upload-results-rows-tree' : ''
        }`}
      >
        <UploadedTableRowsHeaderProps
          columnNames={
            type === 'table' && columnNames
              ? typeof modifiedGroupBoundaries === 'undefined'
                ? columnNames
                : [
                    ...modifiedGroupBoundaries.flatMap((isBoundary, index) =>
                      !isBoundary
                        ? [columnNames[index]]
                        : ['', columnNames[index]]
                    ),
                  ]
              : ['Picklist value']
          }
        />
        {type === 'table' && getRecordViewUrl ? (
          <UploadedTableRow
            // @ts-expect-error
            rows={rows}
            isUploaded={isUploaded}
            groupBoundaries={modifiedGroupBoundaries}
            onCellClicked={handleCellClicked}
            getRecordViewUrl={getRecordViewUrl}
          />
        ) : (
          <UploadedPicklistRow
            // @ts-expect-error
            rows={rows}
            isUploaded={isUploaded}
            onCellClicked={handleCellClicked}
          />
        )}
      </table>
    </div>
  );
}

function UploadedTableHeader({
  tableIcon,
  tableName,
  label,
  rowsCount,
  tableIsCollapsed,
  onCreateRecordSet: handleCreateRecordSet,
  onCreateDataSet: handleCreateDataSet,
  onToggleTableRecordsVisibility: handleToggleTableRecordsVisibility,
}: {
  readonly tableIcon?: string;
  readonly tableName?: string;
  readonly label: string;
  readonly rowsCount: number;
  readonly tableIsCollapsed: boolean;
  readonly onCreateRecordSet?: () => void;
  readonly onCreateDataSet?: () => void;
  readonly onToggleTableRecordsVisibility: () => void;
  readonly type: UploadedRecordsTypes;
} & (
  | {
      readonly tableIcon: string;
      readonly tableName: string;
      readonly label: string;
      readonly rowsCount: number;
      readonly tableIsCollapsed: boolean;
      readonly onCreateRecordSet: () => void;
      readonly onCreateDataSet: () => void;
      readonly onToggleTableRecordsVisibility: () => void;
      readonly type: UploadedRecordsTypes;
    }
  | {
      readonly label: string;
      readonly rowsCount: number;
      readonly tableIsCollapsed: boolean;
      readonly onToggleTableRecordsVisibility: () => void;
      readonly type: UploadedRecordsTypes;
    }
)): JSX.Element {
  return (
    <div
      className="wb-upload-results-header"
      onClick={(event): void => {
        if ((event.target as HTMLElement).tagName === 'BUTTON') return;
        handleToggleTableRecordsVisibility();
      }}
    >
      <div className="wb-upload-results-table-name">
        {tableIsCollapsed ? '\u25B2' : '\u25BC'}
        {tableIcon && (
          <img
            className="wb-upload-results-table-icon"
            src={tableIcon}
            alt={tableName}
          />
        )}
        <div className="wb-upload-results-table-label">{label}</div>
        <div className="wb-upload-results-table-rows-count">- {rowsCount}</div>
      </div>
      <div className="wb-upload-results-controls">
        {
          /* TODO: enable these buttons */
          rowsCount === -1 && (
            <>
              <button type="button" onClick={handleCreateRecordSet}>
                Record Set
              </button>
              <button type="button" onClick={handleCreateDataSet}>
                Data Set
              </button>
            </>
          )
        }
      </div>
    </div>
  );
}

function UploadedTable({
  uploadedTable,
  type,
  isUploaded,
  tableName,
  tableIsCollapsed,
  onCreateRecordSet: handleCreateRecordSet,
  onCreateDataSet: handleCreateDataSet,
  onToggleTableRecordsVisibility: handleToggleTableRecordsVisibility,
  onCellClicked: handleCellClicked,
}: {
  readonly tableName: string;
  readonly tableIsCollapsed: boolean;
  readonly onToggleTableRecordsVisibility: () => void;
  readonly onCellClicked: HandleCellClicked;
  readonly onCreateRecordSet?: () => void;
  readonly onCreateDataSet?: () => void;
  readonly isUploaded: boolean;
} & (
  | {
      readonly uploadedTable: UploadedRowsTable;
      readonly onCreateRecordSet: () => void;
      readonly onCreateDataSet: () => void;
      readonly type: 'table';
    }
  | {
      readonly type: 'picklist';
      readonly uploadedTable: UploadedPicklistItems;
    }
)): JSX.Element {
  return (
    <div className="wb-upload-results-table">
      {/* @ts-expect-error*/}
      <UploadedTableHeader
        type={type}
        tableName={tableName}
        tableIsCollapsed={tableIsCollapsed}
        onCreateRecordSet={handleCreateRecordSet}
        onCreateDataSet={handleCreateDataSet}
        onToggleTableRecordsVisibility={handleToggleTableRecordsVisibility}
        {...(type === 'table'
          ? {
              tableIcon: uploadedTable.tableIcon,
              label: uploadedTable.tableLabel,
              rowsCount: uploadedTable.rowsCount ?? uploadedTable.rows.length,
            }
          : {
              label: tableName,
              rowsCount: Object.keys(uploadedTable).length,
            })}
      />
      {tableIsCollapsed ? undefined : (
        // @ts-expect-error
        <UploadedTableRows
          type={type}
          isUploaded={isUploaded}
          onCellClicked={handleCellClicked}
          tableIsTree={typeof uploadedTable.rowsCount !== 'undefined'}
          {...(type === 'table'
            ? {
                rows: uploadedTable.rows,
                columnNames: uploadedTable.columnNames,
                getRecordViewUrl: uploadedTable.getRecordViewUrl,
                groupBoundaries: uploadedTable.groupBoundaries,
              }
            : {
                rows: uploadedTable,
              })}
        />
      )}
    </div>
  );
}

function UploadedRecords({
  uploadedRecords,
  tableRecordsVisibilityState,
  type,
  isUploaded,
  onCreateRecordSet: handleCreateRecordSet,
  onCreateDataSet: handleCreateDataSet,
  onToggleTableRecordsVisibility: handleToggleTableRecordsVisibility,
  onCellClicked: handleCellClicked,
}: {
  readonly onToggleTableRecordsVisibility: (tableName: string) => void;
  readonly tableRecordsVisibilityState: RecordsVisibilityState;
  readonly onCellClicked: HandleCellClicked;
  readonly onCreateRecordSet?: (tableName: string) => void;
  readonly onCreateDataSet?: (tableName: string) => void;
  readonly isUploaded: boolean;
} & (
  | {
      readonly uploadedRecords: UploadedRows;
      readonly onCreateRecordSet: (tableName: string) => void;
      readonly onCreateDataSet: (tableName: string) => void;
      readonly type: 'table';
    }
  | {
      readonly uploadedRecords: UploadedPicklistItems;
      readonly type: 'picklist';
    }
)): JSX.Element {
  return (
    <>
      {Object.entries(uploadedRecords).map(([tableName, tableData]) => (
        // @ts-expect-error
        <UploadedTable
          isUploaded={isUploaded}
          uploadedTable={tableData}
          tableName={tableName}
          key={tableName}
          type={type}
          tableIsCollapsed={tableRecordsVisibilityState[tableName]}
          onCreateRecordSet={handleCreateRecordSet?.bind(undefined, tableName)}
          onCreateDataSet={handleCreateDataSet?.bind(undefined, tableName)}
          onToggleTableRecordsVisibility={handleToggleTableRecordsVisibility.bind(
            undefined,
            tableName
          )}
          onCellClicked={handleCellClicked}
        />
      ))}
    </>
  );
}

const reducer = generateReducer<WBUploadedState, WBUploadedActions>({
  CreateRecordSetAction: ({ state }) => {
    alert('TEST: Create record set');
    return state;
  },
  CreateDataSetAction: ({ state }) => {
    alert('TEST: Create data set');
    return state;
  },
  ToggleTableRecordsVisibilityAction: ({ state, action }) => ({
    ...state,
    [action.destination]: Object.fromEntries(
      Object.entries(
        state[action.destination]
      ).map(([tableName, isCollapsed]) => [
        tableName,
        isCollapsed !== (tableName === action.tableName),
      ])
    ),
  }),
  CellClickedAction: ({ state, action: { rowIndex, columnIndex } }) => {
    if (rowIndex >= 0 && columnIndex >= 0)
      state.props.hot.selectCell(rowIndex, columnIndex);
    return state;
  },
});

const generateInitialVisibilityState = <T,>(sourceDictionary: IR<T>) =>
  Object.fromEntries(
    Object.keys(sourceDictionary).map((keyName) => [keyName, true])
  );

const getInitialWBUploadedViewState = (
  props: WBUploadedViewComponentProps
): WBUploadedState => ({
  type: 'WBUploadedState',
  tableRecordsVisibilityState: generateInitialVisibilityState(
    props.uploadedRows
  ),
  picklistRecordsVisibilityState: generateInitialVisibilityState(
    props.uploadedPicklistItems
  ),
  props,
});

function WBUploadedView(props: WBUploadedViewComponentProps): JSX.Element {
  const [state, dispatch] = React.useReducer(
    reducer,
    props,
    getInitialWBUploadedViewState
  );

  return (
    <ModalDialog
      onCloseCallback={props.handleClose}
      properties={{
        title: props.isUploaded
          ? 'View Upload Results'
          : 'View Potential Upload Results',
        width: 600,
        maxHeight: 600,
        modal: false,
      }}
    >
      <div className="wb-upload-results">
        {Object.keys(props.uploadedRows).length === 0 &&
          Object.keys(props.uploadedPicklistItems).length === 0 &&
          'No records were uploaded / all records were matched to ' +
            'database records'}
        <UploadedRecords
          type="table"
          isUploaded={props.isUploaded}
          uploadedRecords={props.uploadedRows}
          tableRecordsVisibilityState={state.tableRecordsVisibilityState}
          onCreateRecordSet={(tableName: string): void =>
            dispatch({
              type: 'CreateRecordSetAction',
              tableName,
            })
          }
          onCreateDataSet={(tableName: string): void =>
            dispatch({
              type: 'CreateDataSetAction',
              tableName,
            })
          }
          onCellClicked={(rowIndex: number, columnIndex: number): void =>
            dispatch({
              type: 'CellClickedAction',
              rowIndex,
              columnIndex,
            })
          }
          onToggleTableRecordsVisibility={(tableName: string): void =>
            dispatch({
              type: 'ToggleTableRecordsVisibilityAction',
              destination: 'tableRecordsVisibilityState',
              tableName,
            })
          }
        />
        <UploadedRecords
          type="picklist"
          isUploaded={props.isUploaded}
          uploadedRecords={props.uploadedPicklistItems}
          tableRecordsVisibilityState={state.picklistRecordsVisibilityState}
          onCellClicked={(rowIndex: number, columnIndex: number): void =>
            dispatch({
              type: 'CellClickedAction',
              rowIndex,
              columnIndex,
            })
          }
          onToggleTableRecordsVisibility={(tableName: string): void =>
            dispatch({
              type: 'ToggleTableRecordsVisibilityAction',
              destination: 'picklistRecordsVisibilityState',
              tableName,
            })
          }
        />
      </div>
    </ModalDialog>
  );
}

function WBUploadedViewDataParser(
  props: WBUploadedViewDataParseProps
): JSX.Element {
  const [treeRanks, setTreeRanks] = React.useState<IR<RA<string>> | undefined>(
    ranks
  );
  const [uploadedRows, setUploadedRows] = React.useState<
    UploadedRows | undefined
  >(undefined);
  const [uploadedPicklistItems, setUploadedPicklistItems] = React.useState<
    UploadedPicklistItems | undefined
  >(undefined);
  React.useEffect(
    () =>
      // Fetch tree ranks
      void fetchDataModelPromise
        .then(() =>
          setTreeRanks(
            Object.fromEntries(
              Object.entries(
                dataModelStorage.ranks
              ).map(([tableName, tableRanks]) => [
                tableName,
                [
                  dataModelStorage.rootRanks[tableName],
                  ...Object.keys(tableRanks),
                ],
              ])
            )
          )
        )
        .catch(() => {
          throw new Error('Failure fetching tree ranks');
        }),
    []
  );

  React.useEffect(() => {
    // Parse uploaded data
    if (props.dataset.rowresults === null || typeof treeRanks === 'undefined')
      return;

    const [uploadedRows, uploadedPicklistItems] = parseUploadResults(
      props.dataset.rowresults,
      props.dataset.columns,
      props.dataset.rows,
      treeRanks,
      props.dataset.uploadplan
    );

    setUploadedRows(uploadedRows);
    setUploadedPicklistItems(uploadedPicklistItems);
  }, [treeRanks]);

  return typeof uploadedRows !== 'undefined' &&
    typeof uploadedPicklistItems !== 'undefined' ? (
    <WBUploadedView
      handleClose={props.handleClose}
      uploadedRows={uploadedRows}
      uploadedPicklistItems={uploadedPicklistItems}
      hot={props.hot}
      isUploaded={props.dataset.uploadresult?.success ?? false}
    />
  ) : (
    <></>
  );
}

export default createBackboneView<
  WBUploadedViewConstructorProps,
  WBUploadedViewConstructorProps,
  WBUploadedViewDataParseProps
>({
  moduleName: 'WBUploadedView',
  title: 'Upload Results',
  className: 'wb-uploaded',
  initialize(self, { dataset, hot, removeCallback }) {
    self.dataset = dataset;
    self.hot = hot;
    self.removeCallback = removeCallback;
  },
  remove: (self) => self.removeCallback(),
  Component: WBUploadedViewDataParser,
  getComponentProps: (self) => ({
    handleClose: self.remove.bind(self),
    hot: self.hot,
    dataset: self.dataset,
  }),
});
