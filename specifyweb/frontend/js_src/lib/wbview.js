'use strict';

require('../css/workbench.css');
require('../css/theme.css');

const $ = require('jquery');
const _ = require('underscore');
const Backbone = require('./backbone.js');
const Q = require('q');
const Handsontable = require('handsontable').default;
const Papa = require('papaparse');

require('handsontable/dist/handsontable.full.css');

const schema = require('./schema.js');
const app = require('./specifyapp.js');
const userInfo = require('./userinfo.js');
const DataSetMeta = require('./datasetmeta.js').default;
const navigation = require('./navigation.js');
const NotFoundView = require('./notfoundview.js');
const WBUploadedView = require('./components/wbuploadedview.tsx').default;
const dataModelStorage = require('./wbplanviewmodel').default;
const WBStatus = require('./wbstatus.js');
const WBUtils = require('./wbutils.js');
const {
  valueIsTreeRank,
  mappingPathToString,
  getNameFromTreeRankName,
  formatReferenceItem,
  formatTreeRank,
} = require('./wbplanviewmodelhelper');
const {
  mappingsTreeToArrayOfSplitMappings,
} = require('./wbplanviewtreehelper.ts');
const { uploadPlanToMappingsTree } = require('./uploadplantomappingstree.ts');
const { extractDefaultValues } = require('./wbplanviewhelper.ts');
const { getTableFromMappingPath } = require('./wbplanviewnavigator.ts');
const fetchDataModelPromise = require('./wbplanviewmodelfetcher.ts').default;
const { capitalize } = require('./wbplanviewhelper.ts');
const icons = require('./icons.js');
const formatObj = require('./dataobjformatters.js').format;
const template = require('./templates/wbview.html');
const cache = require('./cache.ts');

const getDefaultCellMeta = () => ({
  // The value in this cell would be used to create a new record
  isNew: false,
  /*
   * This cell has been modified since last change
   * Possible values:
   *   false - not modified
   *   true - modified
   *   'persistent' - same as true, but is shown even if cell's value didn't
   *     change (useful for disambiguation)
   *   'shadow' - if cell has not issues, acts like true. Else, acts like false
   *     (useful for detecting picklist value errors on the front end, without
   *     querying the back-end)
   * */
  isModified: false,
  // Whether the cells matches search query
  isSearchResult: false,
  // List of strings representing the validation errors
  issues: [],
});

const WBView = Backbone.View.extend({
  __name__: 'WbForm',
  className: 'wbs-form content-no-shadow',
  events: {
    'click .wb-upload': 'upload',
    'click .wb-validate': 'upload',
    'click .wb-data-check': 'toggleDataCheck',
    'click .wb-plan': 'openPlan',
    'click .wb-show-plan': 'showPlan',
    'click .wb-revert': 'revertChanges',
    'click .wb-save': 'saveClicked',
    'click .wb-delete-data-set': 'delete',
    'click .wb-export-data-set': 'export',
    'click .wb-change-data-set-owner': 'changeOwner',

    'click .wb-show-upload-view': 'displayUploadedView',
    'click .wb-unupload': 'unupload',
  },

  // Constructors & Renderers
  initialize({ dataset, refreshInitiatedBy, refreshInitiatorAborted }) {
    this.dataset = dataset;
    this.data = dataset.rows;
    this.originalData = this.data.map((row) => [...row]);
    if (this.data.length < 1) {
      this.data.push(Array(this.dataset.columns.length).fill(null));
    }

    this.mappings = undefined;
    this.validationMode = this.dataset.rowresults == null ? 'off' : 'static';
    this.liveValidationStack = [];
    this.liveValidationActive = false;
    this.hasUnSavedChanges = false;
    this.sortConfigIsSet = false;
    this.hotIsReady = false;
    this.hotPlugins = {};

    // Meta data for each cell (indexed by physical columns)
    this.cellMeta = undefined;
    // Meta data for each cell (indexed by visual columns)
    this.indexedCellMeta = undefined;
    this.flushIndexedCellData = true;

    this.wbutils = new WBUtils({
      wbview: this,
      el: this.el,
    });
    this.wbstatus = undefined;

    this.datasetmeta = new DataSetMeta({
      dataset: this.dataset,
      el: this.el,
      getRowCount: () =>
        typeof this.hot === 'undefined'
          ? this.dataset.rows.length
          : this.hot.countRows() - this.hot.countEmptyRows(true),
    });

    /*
     * If DS is uploaded, you will see appropriate label and cells won't be
     * editable.
     * Though, you are still able to sort and rearrange columns
     * */
    this.uploaded =
      this.dataset.uploadresult !== null && this.dataset.uploadresult.success;
    /*
     * Disables column sort/move. Disables adding removing rows
     * */
    this.readOnly = this.uploaded;
    this.uploadedView = undefined;
    this.refreshInitiatedBy = refreshInitiatedBy;
    this.refreshInitiatorAborted = refreshInitiatorAborted;
    this.ambiguousMatches = [];

    this.resize = this.resize.bind(this);

    // Throttle cell count update depending on the DS size (between 10ms and 2s)
    this.updateCellInfoStats = _.throttle(
      this.updateCellInfoStats,
      Math.ceil(Math.min(2000, Math.max(10, this.data.length / 10)))
    );
  },
  render() {
    this.$el.append(
      template({
        is_uploaded: this.uploaded,
        is_manager: userInfo.usertype === 'Manager',
      })
    );

    this.datasetmeta.render();

    if (this.dataset.rowresults === null) {
      this.$('.wb-show-upload-view')
        .prop('disabled', true)
        .prop('title', 'The data set must be validated or uploaded');
    } else this.$('.wb-show-upload-view').prop('disabled', false);

    if (this.dataset.uploaderstatus) this.openStatus();

    this.cellMeta = Array.from({ length: this.dataset.rows.length }, () =>
      Array.from({ length: this.dataset.columns.length }, getDefaultCellMeta)
    );

    if (this.refreshInitiatedBy && this.refreshInitiatorAborted)
      this.operationAbortedMessage();

    const initDataModelIntegration = () =>
      this.hot.batch(() => {
        if (!this.uploaded && !(this.mappings?.arrayOfMappings.length > 0)) {
          $(`<div>
        No upload plan has been defined for this Data Set. Create one now?
       </div>`).dialog({
            title: 'No upload plan is defined',
            modal: true,
            buttons: {
              Create: this.openPlan.bind(this),
              Cancel: function () {
                $(this).dialog('close');
              },
            },
          });
          this.$('.wb-validate, .wb-data-check')
            .prop('disabled', true)
            .prop(
              'title',
              'Please define an upload plan before validating the Data Set'
            );
        } else this.$('.wb-validate, .wb-data-check').prop('disabled', false);

        // These methods update HOT's cells settings, which resets meta data
        // Thus, need to run them first
        this.identifyDefaultValues();
        this.identifyPickLists();

        if (this.dataset.rowresults) this.getValidationResults();

        // The rest goes in order of importance
        this.identifyMappedHeaders();
        if (this.dataset.visualorder?.some((column, index) => column !== index))
          this.hot.updateSettings({
            manualColumnMove: this.dataset.visualorder,
          });
        this.fetchSortConfig();
        this.wbutils.findLocalityColumns();
        this.identifyCoordinateColumns();
        this.identifyTreeRanks();

        this.trigger('loaded');
        this.hotIsReady = true;
      });

    this.initHot().then(() => {
      this.resize();

      if (this.dataset.uploadplan) {
        fetchDataModelPromise().then(() => {
          this.mappings = uploadPlanToMappingsTree(
            this.dataset.columns,
            this.dataset.uploadplan
          );
          this.mappings.arrayOfMappings = mappingsTreeToArrayOfSplitMappings(
            this.mappings.mappingsTree
          );

          this.mappings.tableNames = this.mappings.arrayOfMappings.map(
            ({ mappingPath }) =>
              getTableFromMappingPath({
                baseTableName: this.mappings.baseTableName,
                mappingPath: mappingPath.slice(0, -1),
              })
          );

          initDataModelIntegration();
        });
      } else initDataModelIntegration();
    });

    this.updateValidationButton();
    if (this.validationMode === 'static') {
      this.el.classList.remove('wb-hide-invalid-cells');
      this.el.classList.add('wb-hide-new-cells');
    }

    $(window).on('resize', this.resize);

    this.flushIndexedCellData = true;

    return this;
  },
  initHot() {
    return new Promise((resolve) =>
      setTimeout(() => {
        this.hot = new Handsontable(this.$('.wb-spreadsheet')[0], {
          data: this.data,
          columns: this.dataset.columns.map((__, i) => ({
            data: i,
            ...getDefaultCellMeta(),
          })),
          cells: () => ({ type: 'text' }),
          colHeaders: (physicalCol) => {
            const tableIcon = this.mappings?.mappedHeaders?.[physicalCol];
            const isMapped = typeof tableIcon !== 'undefined';
            const tableName =
              tableIcon?.split('/').slice(-1)?.[0]?.split('.')?.[0] ||
              tableIcon;
            return `<div class="wb-col-header">
              ${
                isMapped
                  ? `<img
                      class="wb-header-icon"
                      alt="${tableName}"
                      src="${tableIcon}"
                    >`
                  : `<img
                      class="wb-header-icon"
                      alt="Unmapped Header"
                      src="/static/img/stop_sign.svg"
                    >`
              }
              <span class="wb-header-name columnSorting">
                  ${this.dataset.columns[physicalCol]}
              </span>
            </div>`;
          },
          hiddenColumns: {
            // hide the disambiguation column
            columns: [this.dataset.columns.length],
            indicators: false,
            copyPasteEnabled: false,
          },
          minSpareRows: 1,
          comments: {
            displayDelay: 100,
          },
          commentedCellClassName: 'htCommentCell wb-invalid-cell',
          invalidCellClassName: '--l',
          rowHeaders: true,
          autoWrapCol: false,
          autoWrapRow: false,
          manualColumnResize: true,
          manualColumnMove: true,
          outsideClickDeselects: false,
          multiColumnSorting: true,
          sortIndicator: true,
          contextMenu: {
            items: this.uploaded
              ? {}
              : {
                  row_above: 'row_above',
                  row_below: 'row_below',
                  remove_row: 'remove_row',
                  disambiguate: {
                    name: 'Disambiguate',
                    disabled: () => !this.isAmbiguousCell(),
                    callback: (__, selection) =>
                      this.disambiguateCell(selection),
                  },
                  separator_1: '---------',
                  fill_down: this.wbutils.fillCellsContextMenuItem(
                    'Fill Down',
                    this.wbutils.fillDown
                  ),
                  fill_up: this.wbutils.fillCellsContextMenuItem(
                    'Fill Up',
                    this.wbutils.fillUp
                  ),
                  separator_2: '---------',
                  undo: 'undo',
                  redo: 'redo',
                },
          },
          licenseKey: 'non-commercial-and-evaluation',
          stretchH: 'all',
          readOnly: this.uploaded,
          afterChange: this.afterChange.bind(this),
          beforeValidate: this.beforeValidate.bind(this),
          afterValidate: this.afterValidate.bind(this),
          beforeCreateRow: () => !this.readOnly,
          afterCreateRow: this.afterCreateRow.bind(this),
          beforeRemoveRow: () => !this.readOnly,
          afterRemoveRow: this.afterRemoveRow.bind(this),
          beforeColumnSort: this.beforeColumnSort.bind(this),
          afterColumnSort: this.afterColumnSort.bind(this),
          beforeColumnMove: this.beforeColumnMove.bind(this),
          afterColumnMove: this.afterColumnMove.bind(this),
          afterRenderer: this.afterRenderer.bind(this),
          afterPaste: this.afterPaste.bind(this),
        });
        resolve();
      }, 0)
    );
  },
  remove() {
    this.hot.destroy();
    this.liveValidationStack = [];
    this.liveValidationActive = false;
    this.validationMode = 'off';
    $(window).off('resize', this.resize);
  },
  identifyMappedHeaders() {
    if (!this.mappings) return;

    this.mappings.mappedHeaders = Object.fromEntries(
      this.mappings.tableNames.map((tableName, index) => [
        // physicalCol
        this.dataset.columns.indexOf(
          this.mappings.arrayOfMappings[index].headerName
        ),
        icons.getIcon(tableName),
      ])
    );
  },
  identifyCoordinateColumns() {
    if (!this.mappings) return;

    const columnHandlers = {
      'locality.latitude1': 'Lat',
      'locality.longitude1': 'Long',
      'locality.latitude2': 'Lat',
      'locality.longitude2': 'Long',
    };

    this.mappings.coordinateColumns = Object.fromEntries(
      this.wbutils.localityColumns.flatMap((localityColumns) =>
        Object.entries(localityColumns)
          .filter(([fieldName]) => fieldName in columnHandlers)
          .map(([fieldName, headerName]) => [
            this.hot.toPhysicalColumn(this.dataset.columns.indexOf(headerName)),
            columnHandlers[fieldName],
          ])
      )
    );
  },
  identifyDefaultValues() {
    if (!this.mappings) return;

    this.mappings.defaultValues = Object.fromEntries(
      Object.entries(
        typeof this.mappings.arrayOfMappings === 'undefined'
          ? {}
          : extractDefaultValues(this.mappings.arrayOfMappings, true)
      ).map(([headerName, defaultValue]) => [
        this.dataset.columns.indexOf(headerName),
        defaultValue,
      ])
    );

    this.hot.updateSettings({
      columns: (index) =>
        typeof this.mappings.defaultValues[index] === 'undefined'
          ? {}
          : { placeholder: this.mappings.defaultValues[index] },
    });
  },
  identifyPickLists() {
    if (!this.mappings) return;
    const pickLists = Object.fromEntries(
      this.mappings.tableNames
        .map((tableName, index) => ({
          tableName,
          fieldName:
            this.mappings.arrayOfMappings[index].mappingPath.slice(-1)[0],
          headerName: this.mappings.arrayOfMappings[index].headerName,
        }))
        .map(({ tableName, fieldName, headerName }) => ({
          physicalCol: this.dataset.columns.indexOf(headerName),
          pickList:
            dataModelStorage.tables[tableName].fields[fieldName].pickList,
        }))
        .filter(({ pickList }) => typeof pickList !== 'undefined')
        .map(Object.values)
    );
    this.hot.updateSettings({
      cells: (_physicalRow, physicalCol, _prop) =>
        physicalCol in pickLists
          ? {
              type: 'autocomplete',
              source: pickLists[physicalCol].items,
              strict: pickLists[physicalCol].readOnly,
              allowInvalid: true,
              filter: false,
              trimDropdown: false,
            }
          : { type: 'text' },
    });
  },
  identifyTreeRanks() {
    if (!this.mappings) return;

    this.mappings.treeRanks = Object.values(
      this.mappings.arrayOfMappings
        .map((splitMappingPath, index) => ({
          ...splitMappingPath,
          index,
        }))
        .filter(
          ({ mappingPath }) =>
            valueIsTreeRank(mappingPath.slice(-2)[0]) &&
            mappingPath.slice(-1)[0] === 'name'
        )
        .map(({ mappingPath, headerName, index }) => ({
          mappingGroup: mappingPathToString(mappingPath.slice(0, -2)),
          tableName: this.mappings.tableNames[index],
          rankName: getNameFromTreeRankName(mappingPath.slice(-2)[0]),
          physicalCol: this.dataset.columns.indexOf(headerName),
        }))
        .map(({ mappingGroup, tableName, rankName, physicalCol }) => ({
          mappingGroup,
          physicalCol,
          rankId: Object.keys(dataModelStorage.ranks[tableName]).indexOf(
            rankName
          ),
        }))
        .reduce((groupedRanks, { mappingGroup, ...rankMapping }) => {
          groupedRanks[mappingGroup] ??= [];
          groupedRanks[mappingGroup].push(rankMapping);
          return groupedRanks;
        }, {})
    );
  },
  async fetchSortConfig() {
    const currentCollection = await cache.getCurrentCollectionId();
    const sortConfig = cache.get(
      'workbench-sort-config',
      `${currentCollection}_${this.dataset.id}`
    );
    if (!Array.isArray(sortConfig)) return;
    const visualSortConfig = sortConfig.map(({ physicalCol, ...rest }) => ({
      ...rest,
      column: this.hot.toVisualColumn(physicalCol),
    }));
    this.getHotPlugin('multiColumnSorting').sort(visualSortConfig);
  },

  // Hooks
  afterRenderer(td, visualRow, visualCol, _prop, _value) {
    if (typeof this.hot === 'undefined') return;
    const physicalRow = this.hot.toPhysicalRow(visualRow);
    const physicalCol = this.hot.toPhysicalColumn(visualCol);
    if (physicalCol >= this.dataset.columns.length) return;
    const cellProperties = this.cellMeta[physicalRow][physicalCol];
    if (cellProperties.isModified)
      this.updateCellMeta(physicalRow, physicalCol, 'isModified', true, {
        cell: td,
        forceReRender: true,
        visualRow,
        visualCol,
      });
    if (cellProperties.isNew)
      this.updateCellMeta(physicalRow, physicalCol, 'isNew', true, {
        cell: td,
        forceReRender: true,
        visualRow,
        visualCol,
      });
    if (cellProperties.isSearchResult)
      this.updateCellMeta(physicalRow, physicalCol, 'isSearchResult', true, {
        cell: td,
        forceReRender: true,
        visualRow,
        visualCol,
      });
    if (typeof this.mappings?.mappedHeaders?.[physicalCol] === 'undefined')
      td.classList.add('wb-cell-unmapped');
    if (typeof this.mappings?.coordinateColumns?.[physicalCol] !== 'undefined')
      td.classList.add('wb-coordinate-cell');
  },
  beforeValidate(value, _visualRow, prop) {
    if (value) return value;

    const visualCol = this.hot.propToCol(prop);
    const physicalCol = this.hot.toPhysicalColumn(visualCol);

    return typeof this.mappings.defaultValues[physicalCol] === 'undefined'
      ? value
      : this.mappings.defaultValues[physicalCol];
  },
  afterValidate(isValid, value, visualRow, prop) {
    const visualCol = this.hot.propToCol(prop);

    const physicalRow = this.hot.toPhysicalRow(visualRow);
    const physicalCol = this.hot.toPhysicalColumn(visualCol);
    const issues = this.cellMeta[physicalRow][physicalCol]['issues'] ?? [];
    const getValidationMessage = (value) =>
      `${value ? `"${value}"` : ''} is not a legal value in this picklist field.
      Click on the arrow to choose among available options.`
        .trim()
        .replace(/ {2,}/, ' ');
    const newIssues = [
      ...new Set([
        ...(isValid ? [] : [getValidationMessage(value)]),
        ...issues.filter((issue) => !issue.endsWith(getValidationMessage(''))),
      ]),
    ];
    if (JSON.stringify(issues) !== JSON.stringify(newIssues)) {
      this.updateCellMeta(physicalRow, physicalCol, 'issues', newIssues);
      // remove isModified state to make error state visible
      if (!isValid)
        setTimeout(
          // need to reset the state after the afterChange hook
          () =>
            this.updateCellMeta(
              physicalRow,
              physicalCol,
              'isModified',
              'shadow',
              { visualRow, visualCol }
            ),
          0
        );
    }
  },
  afterChange(unfilteredChanges, source) {
    if (
      ![
        'edit',
        'CopyPaste.paste',
        'CopyPaste.cut',
        'Autofill.fill',
        'UndoRedo.undo',
        'UndoRedo.redo',
      ].includes(source)
    )
      return;

    const changes = unfilteredChanges
      .map(([visualRow, prop, oldValue, newValue]) => ({
        visualRow: visualRow,
        visualCol: this.hot.propToCol(prop),
        physicalRow: this.hot.toPhysicalRow(visualRow),
        physicalCol: this.hot.toPhysicalColumn(this.hot.propToCol(prop)),
        oldValue,
        newValue,
      }))
      .filter(
        ({ oldValue, newValue, visualCol }) =>
          // Ignore cases when value didn't change
          oldValue !== newValue &&
          // or when value changed from null to empty
          (oldValue !== null || newValue !== '') &&
          // or the column does not exist
          visualCol < this.dataset.columns.length
      );

    if (changes.length === 0) return;

    changes.forEach(
      ({ physicalRow, physicalCol, newValue, visualRow, visualCol }) => {
        this.clearDisambiguation(physicalRow);
        this.updateCellMeta(physicalRow, physicalCol, 'isModified', true, {
          visualRow,
          visualCol,
        });
        if (
          this.wbutils.searchPreferences.search.liveUpdate &&
          this.wbutils.searchQuery !== ''
        )
          this.updateCellMeta(
            physicalRow,
            physicalCol,
            'isSearchResult',
            this.wbutils.searchFunction(this.wbutils.searchQuery, newValue),
            { visualRow, visualCol }
          );
      }
    );

    this.spreadSheetChanged();
    void this.updateCellInfoStats();

    if (this.dataset.uploadplan)
      new Set(
        changes
          // Ignore changes to unmapped columns
          .filter(
            ({ physicalCol }) =>
              this.mappings.arrayOfMappings.findIndex(
                ({ headerName }) =>
                  this.dataset.columns.indexOf(headerName) === physicalCol
              ) !== -1
          )
          .sort(
            ({ visualRow: visualRowLeft }, { visualRow: visualRowRight }) =>
              visualRowLeft > visualRowRight
          )
          .map(({ physicalRow }) => physicalRow)
      ).forEach((physicalRow) => this.startValidateRow(physicalRow));
  },
  afterCreateRow(visualRowStart, amount, source) {
    /*
     * This may be called before full initialization of the workbench because
     * of the minSpareRows setting in HOT. Thus, be sure to check if
     * this.hotIsReady is true
     *
     * Also, I don't think this is ever called with amount > 1.
     * Even if multiple new rows where created at once (e.x on paste), HOT calls
     * this hook one row at a time
     *
     * */

    const addedRows = Array.from(
      { length: amount },
      (_, index) =>
        /*
         * If HOT is not yet initialized, we can assume that physical row order
         * and visual row order is the same
         */
        this.hot?.toPhysicalRow(visualRowStart + index) ??
        visualRowStart + index
    ).sort();

    this.flushIndexedCellData = true;
    addedRows.forEach((physicalRow) => {
      this.cellMeta = [
        ...this.cellMeta.slice(0, physicalRow),
        this.dataset.columns.map(getDefaultCellMeta),
        ...this.cellMeta.slice(physicalRow),
      ];
    });
    if (this.hotIsReady && source !== 'auto') this.spreadSheetChanged();
  },
  afterRemoveRow(visualRowStart, amount, source) {
    const removedRows = Array.from({ length: amount }, (_, index) =>
      this.hot.toPhysicalRow(visualRowStart + index)
    );
    this.liveValidationStack = this.liveValidationStack.filter(
      (physicalRow) => !removedRows.includes(physicalRow)
    );

    this.flushIndexedCellData = true;
    this.cellMeta = this.cellMeta.filter(
      (_, physicalRow) => !removedRows.includes(physicalRow)
    );

    if (this.hotIsReady && source !== 'auto') {
      this.spreadSheetChanged();
      void this.updateCellInfoStats();
    }
  },
  beforeColumnSort(currentSortConfig, newSortConfig) {
    this.flushIndexedCellData = true;

    /*
     * If a tree column is about to be sorted, overwrite the sort config by
     * finding all lower level ranks of that tree and sorting them in the same
     * direction
     * */

    if (this.readOnly) return false;

    if (!this.mappings || this.sortConfigIsSet) return true;

    const findTreeColumns = (sortConfig, deltaSearchConfig) =>
      sortConfig
        .map(({ column: visualCol, sortOrder }) => ({
          sortOrder,
          visualCol,
          physicalCol: this.hot.toPhysicalColumn(visualCol),
        }))
        .map(({ physicalCol, ...rest }) => ({
          ...rest,
          rankGroup: this.mappings.treeRanks
            ?.map((rankGroup, groupIndex) => ({
              rankId: rankGroup.find(
                (mapping) => mapping.physicalCol === physicalCol
              )?.rankId,
              groupIndex,
            }))
            .filter(({ rankId }) => typeof rankId !== 'undefined')?.[0],
        }))
        // Filter out columns that aren't tree ranks
        .filter(({ rankGroup }) => typeof rankGroup !== 'undefined')
        /*
         * Filter out columns that didn't change
         * In the end, there should only be 0 or 1 columns
         * */
        .filter(({ sortOrder, visualCol }) => {
          const deltaColumnState = deltaSearchConfig.find(
            ({ column }) => column === visualCol
          );
          return (
            typeof deltaColumnState === 'undefined' ||
            deltaColumnState.sortOrder !== sortOrder
          );
        })[0];

    let changedTreeColumn = findTreeColumns(newSortConfig, currentSortConfig);
    let newSortOrderIsUnset = false;

    if (typeof changedTreeColumn === 'undefined') {
      changedTreeColumn = findTreeColumns(currentSortConfig, newSortConfig);
      newSortOrderIsUnset = true;
    }

    if (typeof changedTreeColumn === 'undefined') return true;

    /*
     * Filter out columns with higher rank than the changed column
     * (lower rankId corresponds to a higher tree rank)
     * */
    const columnsToSort = this.mappings.treeRanks[
      changedTreeColumn.rankGroup.groupIndex
    ]
      .filter(({ rankId }) => rankId >= changedTreeColumn.rankGroup.rankId)
      .map(({ physicalCol }) => this.hot.toVisualColumn(physicalCol));

    // Filter out columns that are about to be sorted
    const partialSortConfig = newSortConfig.filter(
      ({ column }) => !columnsToSort.includes(column)
    );

    const fullSortConfig = [
      ...partialSortConfig,
      ...(newSortOrderIsUnset
        ? []
        : columnsToSort.map((visualCol) => ({
            column: visualCol,
            sortOrder: changedTreeColumn.sortOrder,
          }))),
    ];

    this.sortConfigIsSet = true;
    this.getHotPlugin('multiColumnSorting').sort(fullSortConfig);
    this.sortConfigIsSet = false;

    return false;
  },
  async afterColumnSort(_previousSortConfig, sortConfig) {
    const currentCollection = await cache.getCurrentCollectionId();
    const physicalSortConfig = sortConfig.map(
      ({ column: visualCol, ...rest }) => ({
        ...rest,
        physicalCol: this.hot.toPhysicalColumn(visualCol),
      })
    );
    cache.set(
      'workbench-sort-config',
      `${currentCollection}_${this.dataset.id}`,
      physicalSortConfig,
      {
        overwrite: true,
      }
    );
  },
  beforeColumnMove(_columnIndexes, startPosition, endPosition) {
    // An ugly fix for jQuery dialogs conflicting with HOT
    return (
      !this.readOnly &&
      (typeof endPosition !== 'undefined' || this.hotIsReady === false)
    );
  },
  afterColumnMove(_columnIndexes, _startPosition, endPosition) {
    if (typeof endPosition === 'undefined' || !this.hotIsReady) return;

    this.flushIndexedCellData = true;

    const columnOrder = this.dataset.columns.map((_, visualCol) =>
      this.hot.toPhysicalColumn(visualCol)
    );

    if (
      this.dataset.visualorder == null ||
      columnOrder.some((i, j) => i !== this.dataset.visualorder[j])
    ) {
      this.dataset.visualorder = columnOrder;
      $.ajax(`/api/workbench/dataset/${this.dataset.id}/`, {
        type: 'PUT',
        data: JSON.stringify({ visualorder: columnOrder }),
        dataType: 'json',
        processData: false,
      }).fail(this.checkDeletedFail.bind(this));
    }
  },
  afterPaste(data, coords) {
    const lastCoords = coords.slice(-1)[0];
    if (data.some((row) => row.length === this.dataset.columns.length))
      // Do not scroll the viewport to the last column after inserting a row
      this.hot.scrollViewportTo(lastCoords.endRow, lastCoords.startCol);
  },
  updateCellMeta(
    physicalRow,
    physicalCol,
    key,
    value,
    {
      cell: initialCell = undefined,
      render = true,
      forceReRender = false,
      visualRow: initialVisualRow = undefined,
      visualCol: initialVisualCol = undefined,
    } = {}
  ) {
    const visualRow = initialVisualRow ?? this.hot.toVisualRow(physicalRow);
    const visualCol = initialVisualCol ?? this.hot.toVisualColumn(physicalCol);
    const cell =
      render && typeof initialCell === 'undefined'
        ? this.hot.getCell(visualRow, visualCol)
        : initialCell;

    // Current value of the meta property
    const currentValue = this.cellMeta[physicalRow][physicalCol][key];
    // The value for which to run the sideEffect
    let effectValue = value;
    // The value to store in the metaObject
    let metaValue = value;

    // side effects
    const effects = {
      isNew: (value) =>
        cell?.classList[value === true ? 'add' : 'remove']('wb-no-match-cell'),
      isModified: (value) =>
        cell?.classList[value === true ? 'add' : 'remove']('wb-modified-cell'),
      isSearchResult: (value) =>
        cell?.classList[value === true ? 'add' : 'remove'](
          'wb-search-match-cell'
        ),
      issues: (value) => {
        cell?.classList[value.length === 0 ? 'remove' : 'add'](
          'wb-invalid-cell'
        );
        if (value.length === 0)
          this.getHotPlugin('comments').removeCommentAtCell(
            visualRow,
            visualCol
          );
        else {
          this.getHotPlugin('comments').setCommentAtCell(
            visualRow,
            visualCol,
            value.join('\n')
          );
          this.getHotPlugin('comments').updateCommentMeta(
            visualRow,
            visualCol,
            {
              readOnly: true,
            }
          );
        }
      },
    };

    if (!(key in effects))
      throw new Error(
        `Tried to set unknown metaData record ${key}=${value} for cell
         ${visualRow}x${visualCol}`
      );

    if (key === 'isModified') {
      // Remove isModified state when cell is returned to it's original value
      if (
        (currentValue === 'persistent' && value !== false) ||
        value === 'persistent'
      ) {
        metaValue = 'persistent';
        effectValue = true;
      } else if (
        value !== 'persistent' &&
        `${this.originalData[physicalRow]?.[physicalCol] ?? ''}` ===
          `${this.data[physicalRow][physicalCol] ?? ''}`
      ) {
        metaValue = false;
        effectValue = false;
      } else if (
        value === 'shadow' &&
        this.cellMeta[physicalRow][physicalCol].issues.length > 0
      )
        effectValue = false;
    }

    const valueIsChanged = !(
      (['isNew', 'isModified', 'isSearchResult'].includes(key) &&
        currentValue === metaValue) ||
      (key === 'issues' &&
        currentValue.length === metaValue.length &&
        JSON.stringify(currentValue) === JSON.stringify(metaValue))
    );

    // Do not run the side effect if state is already in it's correct position,
    // unless asked to forceReRender
    if (render && (forceReRender || valueIsChanged)) effects[key](effectValue);

    this.cellMeta[physicalRow][physicalCol][key] = metaValue;

    if (valueIsChanged) this.flushIndexedCellData = true;
  },

  // Disambiguation
  getDisambiguation(physicalRow) {
    const cols = this.dataset.columns.length;
    const hidden = this.data[physicalRow][cols];
    const extra = hidden ? JSON.parse(hidden) : {};
    return extra.disambiguation || {};
  },
  isAmbiguousCell() {
    if (!this.mappings) return false;

    const [visualRow, visualCol] = this.wbutils.getSelectedLast();
    const physicalRow = this.hot.toPhysicalRow(visualRow);
    const physicalCol = this.hot.toPhysicalColumn(visualCol);
    const da = this.getDisambiguation(physicalRow);

    return (this.ambiguousMatches[physicalRow] ?? []).some(
      ({ physicalCols, mappingPath }) =>
        physicalCols.includes(physicalCol) &&
        typeof da[mappingPathToString(mappingPath)] !== 'number'
    );
  },
  clearDisambiguation(physicalRow) {
    const cols = this.dataset.columns.length;
    const hidden = this.data[physicalRow][cols];
    const extra = hidden ? JSON.parse(hidden) : {};
    extra.disambiguation = {};
    this.data[physicalRow][cols] = JSON.stringify(extra);
  },
  setDisambiguation(physicalRow, mappingPath, id, affectedColumns) {
    const cols = this.dataset.columns.length;
    const hidden = this.data[physicalRow][cols];
    const extra = hidden ? JSON.parse(hidden) : {};
    const da = extra.disambiguation || {};
    da[mappingPathToString(mappingPath)] = id;
    extra.disambiguation = da;
    this.data[physicalRow][cols] = JSON.stringify(extra);
    this.spreadSheetChanged();

    affectedColumns.forEach((physicalCol) =>
      this.updateCellMeta(physicalRow, physicalCol, 'isModified', 'persistent')
    );
    void this.updateCellInfoStats();
  },
  disambiguateCell([
    {
      start: { col: visualCol, row: visualRow },
    },
  ]) {
    if (!this.mappings) return;

    const physicalRow = this.hot.toPhysicalRow(visualRow);
    const physicalCol = this.hot.toPhysicalColumn(visualCol);

    const matches = this.ambiguousMatches[physicalRow].find(
      ({ physicalCols }) => physicalCols.includes(physicalCol)
    );
    const tableName = getTableFromMappingPath({
      baseTableName: this.mappings.baseTableName,
      mappingPath: matches.mappingPath,
    });
    const model = schema.getModel(tableName);
    const resources = new model.LazyCollection({
      filters: { id__in: matches.ids.join(',') },
    });

    const doDA = (selected) => {
      this.setDisambiguation(
        physicalRow,
        matches.mappingPath,
        parseInt(selected, 10),
        matches.physicalCols
      );
      this.startValidateRow(physicalRow);
    };
    const doAll = (selected) => {
      // loop backwards so the live validation will go from top to bottom
      for (let visualRow = this.data.length - 1; visualRow >= 0; visualRow--) {
        const physicalRow = this.hot.toPhysicalRow(visualRow);
        if (
          !this.ambiguousMatches[physicalRow]?.find(
            ({ key, mappingPath }) =>
              key === matches.key &&
              typeof this.getDisambiguation(physicalRow)[
                mappingPathToString(mappingPath)
              ] !== 'number'
          )
        )
          continue;
        this.setDisambiguation(
          physicalRow,
          matches.mappingPath,
          parseInt(selected, 10),
          matches.physicalCols
        );
        this.startValidateRow(physicalRow);
      }
    };

    const content = $('<div class="da-container">');
    resources.fetch({ limit: 0 }).done(() => {
      if (resources.length < 1) {
        $(`<div>
          None of the matched records currently exist in the database.
          This can happen if all of the matching records were deleted since the
          validation process occurred, or if all of the matches were ambiguous
          with respect other records in this data set. In the latter case, you
          will need to add fields and values to the data set to resolve the
          ambiguity.
        </div>`).dialog({
          title: 'Disambiguate',
          modal: true,
          close() {
            $(this).remove();
          },
          buttons: [
            {
              text: 'Close',
              click() {
                $(this).dialog('close');
              },
            },
          ],
        });
        return;
      }

      resources.forEach((resource) => {
        const row = $(
          `<label class="da-row">
            <input
              type="radio"
              class="da-option"
              name="disambiguate" value="${resource.id}"
            >
            <span class="label">${resource.id}</span>
            <a
              href="${resource.viewUrl()}"
              target="_blank"
            >ℹ️</a>
          <label/>`
        ).appendTo(content);
        if (model.getField('rankid')) {
          resource
            .rget('parent.fullname')
            .done((parentName) =>
              row
                .find('.label')
                .text(`${resource.get('fullname')} (in ${parentName})`)
            );
        } else {
          formatObj(resource).done((formatted) =>
            row.find('.label').text(formatted)
          );
        }
      });

      const dialog = $('<div>')
        .append(content)
        .dialog({
          title: 'Disambiguate Multiple Record Matches',
          minWidth: 400,
          minHeight: 300,
          modal: true,
          close() {
            $(this).remove();
            clearInterval(interval);
          },
          buttons: [
            {
              text: 'Cancel',
              click() {
                $(this).dialog('close');
              },
            },
            {
              text: 'Apply',
              click() {
                const selected = $('input.da-option:checked', this).val();
                if (selected != null) {
                  doDA(selected);
                  $(this).dialog('close');
                }
              },
            },
            {
              id: 'applyAllButton',
              text: 'Apply All',
              click() {
                const selected = $('input.da-option:checked', this).val();
                if (selected != null) {
                  doAll(selected);
                  $(this).dialog('close');
                }
              },
            },
          ],
        });

      let applyAllAvailable = true;
      const applyAllButton = dialog.parent().find('#applyAllButton');

      const updateIt = () => {
        const newState = this.liveValidationStack.length === 0;
        if (newState !== applyAllAvailable) {
          applyAllAvailable = newState;
          applyAllButton.button('option', 'disabled', !newState);
          applyAllButton[0][newState ? 'removeAttribute' : 'setAttribute'](
            'title',
            `"Apply All" is not available while Data Check is in progress.`
          );
        }
      };

      const interval = setInterval(updateIt, 100);
    });
  },

  // Tools
  displayUploadedView() {
    if (!this.dataset.rowresults) return;

    const uploadView = this.$el.find('.wb-upload-view')[0];

    if (typeof this.uploadedView !== 'undefined') return;

    uploadView.innerHTML = '<div></div>';
    const container = uploadView.children[0];

    this.uploadedView = new WBUploadedView({
      dataset: this.dataset,
      hot: this.hot,
      el: container,
      removeCallback: () => (this.uploadedView = undefined),
    }).render();
  },
  openPlan() {
    navigation.go(`/workbench-plan/${this.dataset.id}/`);
  },
  showPlan() {
    const dataset = this.dataset;
    const $this = this;
    const planJson = JSON.stringify(dataset.uploadplan, null, 4);
    $('<div>')
      .append($('<textarea cols="120" rows="50">').text(planJson))
      .dialog({
        title: 'Upload plan',
        width: 'auto',
        modal: true,
        close() {
          $(this).remove();
        },
        buttons: {
          Save() {
            dataset.uploadplan = JSON.parse($('textarea', this).val());
            $.ajax(`/api/workbench/dataset/${dataset.id}/`, {
              type: 'PUT',
              data: JSON.stringify({ uploadplan: dataset.uploadplan }),
              dataType: 'json',
              processData: false,
            }).fail(this.checkDeletedFail.bind(this));
            $(this).dialog('close');
            $this.trigger('refresh');
          },
          Close() {
            $(this).dialog('close');
          },
        },
      });
  },
  changeOwner() {
    this.datasetmeta.dataSetMeta.changeOwnerWindow.call(this.datasetmeta);
  },

  // Actions
  unupload() {
    const dialog = $(`<div>
      Rolling back will remove the data records this Data Set added to the
      Specify database. The entire rollback will be cancelled if any of the
      uploaded data have been referenced (re-used) by other data records in the
      database since the time they were uploaded.
    </div>`).dialog({
      modal: true,
      title: 'Start Data Set Rollback?',
      close() {
        $(this).remove();
      },
      buttons: {
        Rollback: () => {
          if (typeof this.uploadedView !== 'undefined') {
            this.uploadedView.remove();
            this.uploadedView = undefined;
          }
          $.post(`/api/workbench/unupload/${this.dataset.id}/`);
          dialog.remove();
          this.openStatus('unupload');
        },
        Cancel() {
          $(this).remove();
        },
      },
    });
  },
  upload(evt) {
    const mode = $(evt.currentTarget).is('.wb-upload') ? 'upload' : 'validate';
    if (this.mappings?.arrayOfMappings.length > 0) {
      if (mode === 'upload') {
        const dialog = $(`<div>
          Uploading the Data Set will transfer the data into the main Specify
          tables.
        </div>`).dialog({
          modal: true,
          title: 'Start Data Set Upload?',
          close() {
            dialog.remove();
          },
          buttons: {
            Upload: () => {
              this.startUpload(mode);
              dialog.remove();
            },
            Cancel() {
              dialog.remove();
            },
          },
        });
      } else {
        this.startUpload(mode);
      }
    } else {
      $(
        '<div>No plan has been defined for this dataset. Create one now?</div>'
      ).dialog({
        title: 'No Plan is defined',
        modal: true,
        buttons: {
          Cancel: function () {
            $(this).dialog('close');
          },
          Create: () => this.openPlan(),
        },
      });
    }
  },
  startUpload(mode) {
    this.clearAllMetaData();
    this.liveValidationStack = [];
    this.liveValidationActive = false;
    this.validationMode = 'off';
    this.updateValidationButton();
    $.post(`/api/workbench/${mode}/${this.dataset.id}/`)
      .fail((jqxhr) => {
        this.checkDeletedFail(jqxhr);
        this.checkConflictFail(jqxhr);
      })
      .done(() => {
        this.openStatus(mode);
      });
  },
  openStatus(mode) {
    this.wbstatus = new WBStatus({ dataset: this.dataset })
      .render()
      .on('done', (wasAborted) => {
        this.trigger('refresh', mode, wasAborted);
        this.wbstatus = undefined;
      });
  },
  delete: function () {
    const dialog = $(`<div>
        Deleting a Data Set permanently removes it and its Upload Plan.
        Data mappings will no longer be available for re-use with other
        Data Sets. Also after deleting, Rollback will not be an option for
        an uploaded Data Set.
      </div>`).dialog({
      modal: true,
      title: 'Delete Data Set',
      close: () => dialog.remove(),
      buttons: {
        Delete: () => {
          $.ajax(`/api/workbench/dataset/${this.dataset.id}/`, {
            type: 'DELETE',
          })
            .done(() => {
              this.$el.empty();
              dialog.dialog('close');

              $(`<p>Data Set successfully deleted.</p>`).dialog({
                title: 'Delete Data Set',
                modal: true,
                close: () => navigation.go('/'),
                buttons: {
                  Close: function () {
                    $(this).dialog('close');
                  },
                },
              });
            })
            .fail((jqxhr) => {
              this.checkDeletedFail(jqxhr);
              dialog.dialog('close');
            });
        },
        Cancel: () => dialog.dialog('close'),
      },
    });
  },
  export() {
    const data = Papa.unparse({
      fields: this.dataset.columns,
      data: this.dataset.rows,
    });
    const wbName = this.dataset.name;
    const filename = wbName.match(/\.csv$/) ? wbName : wbName + '.csv';
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.setAttribute('download', filename);
    a.click();
  },
  revertChanges() {
    $(`<div>
      This action will discard all changes to the Data Set since the last save.
    </div>`).dialog({
      modal: true,
      title: 'Revert Unsaved Changes?',
      close() {
        $(this).remove();
      },
      buttons: {
        Revert: () => {
          navigation.removeUnloadProtect(this);
          this.trigger('refresh');
        },
        Cancel() {
          $(this).dialog('close');
        },
      },
    });
  },
  saveClicked: function () {
    this.save().done();
  },
  save: function () {
    // clear validation
    this.clearAllMetaData();
    this.dataset.rowresults = null;
    this.validationMode = 'off';
    this.updateValidationButton();

    //show saving progress bar
    const dialog = $('<div><div class="progress-bar"></div></div>').dialog({
      title: 'Saving',
      modal: true,
      open(evt, ui) {
        $('.ui-dialog-titlebar-close', ui.dialog).hide();
      },
      close() {
        $(this).remove();
      },
    });
    $('.progress-bar', dialog).progressbar({ value: false });

    //send data
    return Q(
      $.ajax(`/api/workbench/rows/${this.dataset.id}/`, {
        data: JSON.stringify(this.data),
        error: this.checkDeletedFail.bind(this),
        type: 'PUT',
      })
    )
      .then(() => {
        this.spreadSheetUpToDate();
      })
      .finally(() => dialog.dialog('close'));
  },

  // Validation
  toggleDataCheck() {
    this.validationMode = this.validationMode === 'live' ? 'off' : 'live';

    if (!(this.mappings?.arrayOfMappings.length > 0))
      this.validationMode = 'off';

    switch (this.validationMode) {
      case 'live':
        this.liveValidationStack = Array.from(
          { length: this.hot.countRows() },
          (_, visualRow) => this.hot.toPhysicalRow(visualRow)
        ).reverse();
        this.triggerLiveValidation();
        this.el.classList.remove('wb-hide-new-cells', 'wb-hide-invalid-cells');
        this.el.classList.add('wb-hide-modified-cells');
        break;
      case 'static':
        this.getValidationResults();
        this.el.classList.remove('wb-hide-invalid-cells');
        this.el.classList.add('wb-hide-new-cells');
        this.liveValidationStack = [];
        this.liveValidationActive = false;
        break;
      case 'off':
        this.liveValidationStack = [];
        this.liveValidationActive = false;
        break;
    }

    this.clearAllMetaData();
    this.updateValidationButton();
  },
  startValidateRow(physicalRow) {
    if (this.validationMode !== 'live') return;
    this.liveValidationStack = this.liveValidationStack
      .filter((row) => row !== physicalRow)
      .concat(physicalRow);
    this.triggerLiveValidation();
  },
  triggerLiveValidation() {
    const pumpValidation = () => {
      this.updateValidationButton();
      if (this.liveValidationStack.length === 0) {
        this.liveValidationActive = false;
        return;
      }
      this.liveValidationActive = true;
      const physicalRow = this.liveValidationStack.pop();
      if (physicalRow === null) return;
      const rowData = this.hot.getSourceDataAtRow(physicalRow);
      Q(
        $.post(
          `/api/workbench/validate_row/${this.dataset.id}/`,
          JSON.stringify(rowData)
        )
      )
        .then((result) => this.gotRowValidationResult(physicalRow, result))
        .fin(pumpValidation);
    };

    if (!this.liveValidationActive) {
      pumpValidation();
    }
  },
  updateValidationButton() {
    if (this.validationMode === 'live') {
      const n = this.liveValidationStack.length;
      this.$('.wb-data-check').text(
        'Data Check: On' + (n > 0 ? ` (${n})` : '')
      );
    } else {
      this.$('.wb-data-check').text('Data Check');
    }
  },
  gotRowValidationResult(physicalRow, result) {
    if (this.validationMode !== 'live' || this.hot.isDestroyed) return;
    this.ambiguousMatches[physicalRow] = [];
    this.hot.batch(() =>
      this.applyRowValidationResults(physicalRow, result?.result, true)
    );
    this.updateCellInfoStats();
  },
  resolveValidationColumns(
    initialColumns,
    mappingPathFilter,
    inferColumns = true
  ) {
    // See https://github.com/specify/specify7/issues/810
    let columns = initialColumns.filter((column) => column);
    if (inferColumns) {
      if (columns.length === 0)
        columns = this.mappings.arrayOfMappings
          .filter(({ mappingPath }) =>
            mappingPathToString(mappingPath).startsWith(
              mappingPathToString(mappingPathFilter)
            )
          )
          .map(({ headerName }) => headerName);
      if (columns.length === 0)
        columns = this.mappings.arrayOfMappings.map(
          ({ headerName }) => headerName
        );
      if (columns.length === 0) columns = this.dataset.columns;
    }
    return columns
      .map((column) => this.dataset.columns.indexOf(column))
      .filter((physicalCol) => physicalCol !== -1);
  },
  applyRowValidationResults(physicalRow, result, isLive) {
    const rowMeta = this.cellMeta[physicalRow];
    const newRowMeta = rowMeta.map((cellMeta) => ({
      ...getDefaultCellMeta(),
      isModified: (isLive && cellMeta.isModified) ?? false,
      isSearchResult: cellMeta.isSearchResult ?? false,
      issues: [],
    }));

    const setMeta = (
      key,
      value,
      initialColumns,
      mappingPathFilter,
      inferColumns = true
    ) =>
      this.resolveValidationColumns(
        initialColumns,
        mappingPathFilter,
        inferColumns
      ).forEach((physicalCol) => {
        if (key === 'issues')
          newRowMeta[physicalCol][key].push(capitalize(value));
        else newRowMeta[physicalCol][key] = value;
      });

    if (result) this.parseRowValidationResults(result, setMeta, physicalRow);

    newRowMeta.forEach((cellMeta, physicalCol) => {
      Object.entries(cellMeta).map(([key, value]) =>
        this.updateCellMeta(physicalRow, physicalCol, key, value)
      );
    });
  },
  parseRowValidationResults(
    result,
    setMetaCallback,
    physicalRow,
    initialMappingPath = []
  ) {
    const uploadResult = result.UploadResult;
    const uploadStatus = Object.keys(uploadResult.record_result)[0];
    const statusData = uploadResult.record_result[uploadStatus];

    const mappingPath = statusData.info?.treeInfo
      ? [...initialMappingPath, formatTreeRank(statusData.info.treeInfo.rank)]
      : initialMappingPath;

    if (['NullRecord', 'PropagatedFailure', 'Matched'].includes(uploadStatus)) {
    } else if (uploadStatus === 'ParseFailures')
      statusData.failures.forEach(([column, issue]) =>
        setMetaCallback('issues', issue, [column], mappingPath)
      );
    else if (uploadStatus === 'NoMatch')
      setMetaCallback(
        'issues',
        'No matching record for must-match table.',
        statusData.info.columns,
        mappingPath
      );
    else if (uploadStatus === 'FailedBusinessRule')
      setMetaCallback(
        'issues',
        statusData.message,
        statusData.info.columns,
        mappingPath
      );
    else if (uploadStatus === 'MatchedMultiple') {
      this.ambiguousMatches[physicalRow] ??= [];
      this.ambiguousMatches[physicalRow].push({
        physicalCols: this.resolveValidationColumns(
          statusData.info.columns,
          mappingPath
        ),
        mappingPath,
        ids: statusData.ids,
        key: statusData.key,
      });
      setMetaCallback(
        'issues',
        'This value matches two or more existing database records and must ' +
          'be manually disambiguated before uploading.',
        statusData.info.columns,
        mappingPath
      );
    } else if (uploadStatus === 'Uploaded')
      setMetaCallback(
        'isNew',
        true,
        statusData.info.columns,
        mappingPath,
        false
      );
    else
      throw new Error(
        `Trying to parse unknown uploadStatus type "${uploadStatus}" at
        row ${this.hot.toVisualRow(physicalRow)}`
      );

    Object.entries(uploadResult.toOne).forEach(([fieldName, uploadResult]) =>
      this.parseRowValidationResults(
        uploadResult,
        setMetaCallback,
        physicalRow,
        [...mappingPath, fieldName]
      )
    );

    Object.entries(uploadResult.toMany).forEach(([fieldName, uploadResults]) =>
      uploadResults.forEach((uploadResult, toManyIndex) =>
        this.parseRowValidationResults(
          uploadResult,
          setMetaCallback,
          physicalRow,
          [...mappingPath, fieldName, formatReferenceItem(toManyIndex + 1)]
        )
      )
    );
  },
  getValidationResults() {
    if (typeof this.wbstatus !== 'undefined') return;

    if (this.dataset.rowresults === null) {
      this.validationMode = 'off';
      this.updateValidationButton();
      return;
    }

    this.hot.batch(() => {
      this.dataset.rowresults.forEach((result, physicalRow) => {
        this.applyRowValidationResults(physicalRow, result, false);
      });
    });

    void this.updateCellInfoStats();
  },

  // Helpers
  getHotPlugin(pluginName) {
    if (!this.hotPlugins[pluginName])
      this.hotPlugins[pluginName] = this.hot.getPlugin(pluginName);
    return this.hotPlugins[pluginName];
  },
  spreadSheetChanged() {
    if (this.hasUnSavedChanges) return;
    this.hasUnSavedChanges = true;

    this.$(
      '.wb-upload, .wb-validate, .wb-export-data-set, .wb-change-data-set-owner'
    )
      .prop('disabled', true)
      .prop('title', 'This action requires all changes to be saved');
    this.$('.wb-save').prop('disabled', false);
    this.$('.wb-revert').prop('disabled', false);
    this.$('.wb-show-upload-view')
      .prop('disabled', true)
      .prop('title', 'The data set must be validated or uploaded');
    navigation.addUnloadProtect(
      this,
      'Changes to this Data Set have not been saved.'
    );
  },
  checkDeletedFail(jqxhr) {
    if (!jqxhr.errorHandled && jqxhr.status === 404) {
      this.$el.empty().append('Data Set was deleted by another session.');
      jqxhr.errorHandled = true;
    }
  },
  checkConflictFail(jqxhr) {
    if (!jqxhr.errorHandled && jqxhr.status === 409) {
      /*
       * Upload/Validation/Un-Upload has been initialized by another session
       * Need to reload the page to display the new state
       * */
      this.trigger('reload');
      jqxhr.errorHandled = true;
    }
  },
  spreadSheetUpToDate: function () {
    if (!this.hasUnSavedChanges) return;
    this.hasUnSavedChanges = false;
    this.$(
      '.wb-upload, .wb-validate, .wb-export-data-set, .wb-change-data-set-owner'
    )
      .prop('disabled', false)
      .prop('title', '');
    this.$('.wb-save').prop('disabled', true);
    this.$('.wb-revert').prop('disabled', true);
    navigation.removeUnloadProtect(this);
  },
  resize: function () {
    if (!this.hot) return;
    this.hot.updateSettings({
      height: this.$el.find('.wb-spreadsheet').height(),
    });
    return true;
  },

  // MetaData
  async updateCellInfoStats() {
    const cellMeta = this.cellMeta.flat(2);

    const cellCounts = {
      newCells: cellMeta.reduce(
        (count, info) => count + (info.isNew ? 1 : 0),
        0
      ),
      invalidCells: cellMeta.reduce(
        (count, info) => count + (info.issues?.length ? 1 : 0),
        0
      ),
      searchResults: cellMeta.reduce(
        (count, info) => count + (info.isSearchResult ? 1 : 0),
        0
      ),
      modifiedCells: cellMeta.reduce(
        (count, info) => count + (info.isModified ? 1 : 0),
        0
      ),
    };

    //update navigation information
    Object.values(
      this.el.getElementsByClassName('wb-navigation-total')
    ).forEach((navigationTotalElement) => {
      const navigationContainer = navigationTotalElement.closest(
        '.wb-navigation-section'
      );
      const navigationType = navigationContainer.getAttribute(
        'data-navigation-type'
      );
      navigationTotalElement.innerText = cellCounts[navigationType];

      if (cellCounts[navigationType] === 0) {
        const currentPositionElement =
          navigationContainer.getElementsByClassName(
            'wb-navigation-position'
          )?.[0];
        if (currentPositionElement !== 'undefined')
          currentPositionElement.innerText = 0;
      }
    });

    if (this.refreshInitiatedBy) this.operationCompletedMessage(cellCounts);
  },
  operationCompletedMessage(cellCounts) {
    if (!this.refreshInitiatedBy) return;

    const messages = {
      validate:
        cellCounts.invalidCells === 0
          ? {
              title: 'Validation Completed with No Errors',
              message: `Validation found no errors in the Data Set. It is
                        ready to be uploaded into the database.<br><br>

                        Cell validations and their status highlighting will
                        remain with the Data Set until it is edited and
                        re-saved. If any cells are edited, Validation should
                        always be re-run as the last step prior to uploading,
                        to confirm that no errors have been introduced.`,
            }
          : {
              title: 'Validation Completed with Errors',
              message: `Validation found errors in some cell values in this
                        Data Set.<br><br>

                        If any cells are edited and the Data Set re-saved,
                        Validation should always be re-run as the last step
                        prior to uploading, to confirm that no errors have
                        been introduced.`,
            },
      upload:
        cellCounts.invalidCells === 0
          ? {
              title: 'Upload Completed with No Errors',
              message: `Click on the "Results" button above to see values for
                        new records added to each database table.`,
            }
          : {
              title: 'Upload failed due to validation errors',
              message: `The Data Set upload failed due to one or more cell
                        value errors.<br><br>
                        Run "Data Check" or "Validate" again, review the
                        mouseover hints for each error cell, and make the
                        appropriate corrections. Save changes and retry the
                        Upload.`,
            },
      unupload: {
        title: 'Data Set Rollback',
        message: 'Data Set was rolled back successfully.',
      },
    };

    const title = messages[this.refreshInitiatedBy].title;
    const message = messages[this.refreshInitiatedBy].message;
    const dialog = $(`<div>
        ${message}
    </div>`).dialog({
      title,
      modal: true,
      width: 400,
      buttons: {
        Close: () => dialog.dialog('destroy'),
      },
    });

    this.refreshInitiatedBy = undefined;
    this.refreshInitiatorAborted = false;
  },
  operationAbortedMessage() {
    if (!this.refreshInitiatedBy || !this.refreshInitiatorAborted) return;

    const action =
      this.refreshInitiatedBy === 'validate'
        ? 'Validation'
        : this.refreshInitiatedBy === 'unupload'
        ? 'Rollback'
        : this.refreshInitiatedBy;
    const title = `${capitalize(action)} Process Status`;
    const message = `${capitalize(action)} cancelled.`;
    const dialog = $(`<div>
        ${message}
    </div>`).dialog({
      title,
      modal: true,
      width: 400,
      buttons: {
        Close: () => dialog.dialog('destroy'),
      },
    });
    this.refreshInitiatedBy = undefined;
    this.refreshInitiatorAborted = false;
  },
  clearAllMetaData() {
    if (this.hot.isDestroyed) return;
    const { isSearchResult: _, ...partialDefaultCellMeta } =
      getDefaultCellMeta();
    const cellMeta = Object.entries(partialDefaultCellMeta);
    const columnIndexes = this.dataset.columns.map(
      (_, physicalCol) => physicalCol
    );
    this.ambiguousMatches = [];
    this.hot.batch(() =>
      Array.from({ length: this.hot.countRows() }, (_, physicalRow) =>
        columnIndexes.forEach((physicalCol) =>
          cellMeta.forEach(([key, value]) =>
            this.updateCellMeta(physicalRow, physicalCol, key, value)
          )
        )
      )
    );
    void this.updateCellInfoStats();
  },
  getCellMetaObject() {
    /*
     * Return's this.cellMeta, but instead of being indexed by physical row/col
     * indexes, the resulting array is indexed by visual row/col indexes.
     *
     * This is used for navigation among cells.
     *
     * Also, if the navigation direction is set to ColByCol, the resulting array
     * is transposed.
     * */
    if (this.flushIndexedCellData) {
      const getPosition = (visualRow, visualCol, first) =>
        (this.wbutils.searchPreferences.navigation.direction === 'rowFirst') ===
        first
          ? visualRow
          : visualCol;

      const [toVisualRow, toVisualColumn] =
        this.wbutils.getToVisualConvertors();
      const indexedCellMeta = [];
      Object.entries(this.cellMeta).forEach(([physicalRow, metaRow]) =>
        Object.entries(metaRow).forEach(([physicalCol, cellMeta]) => {
          const visualRow = toVisualRow[physicalRow];
          const visualCol = toVisualColumn[physicalCol];
          indexedCellMeta[getPosition(visualRow, visualCol, true)] ??= [];
          indexedCellMeta[getPosition(visualRow, visualCol, true)][
            getPosition(visualRow, visualCol, false)
          ] = cellMeta;
        })
      );
      this.indexedCellMeta = indexedCellMeta;
    }
    this.flushIndexedCellData = false;
    return this.indexedCellMeta;
  },
});

module.exports = function loadDataset(
  id,
  refreshInitiatedBy = undefined,
  refreshInitiatorAborted = false
) {
  let dialog;
  function showLoadingBar() {
    dialog = $('<div><div class="progress-bar"></div></div>').dialog({
      title: 'Loading',
      modal: true,
      open(evt, ui) {
        $('.ui-dialog-titlebar-close', ui.dialog).hide();
      },
      close() {
        $(this).remove();
      },
    });
    $('.progress-bar', dialog).progressbar({ value: false });
  }
  showLoadingBar();

  $.get(`/api/workbench/dataset/${id}/`)
    .done((dataset) => {
      const view = new WBView({
        dataset,
        refreshInitiatedBy,
        refreshInitiatorAborted,
      })
        .on('refresh', (mode, wasAborted) => loadDataset(id, mode, wasAborted))
        .on('loaded', () => dialog.dialog('close'));
      app.setCurrentView(view);
      showLoadingBar();
    })
    .fail((jqXHR) => {
      if (jqXHR.status === 404) {
        jqXHR.errorHandled = true;
        app.setCurrentView(new NotFoundView());
        app.setTitle('Page Not Found');
        return '(not found)';
      }
      return jqXHR;
    });
};
