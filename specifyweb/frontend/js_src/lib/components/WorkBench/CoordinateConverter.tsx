import type Handsontable from 'handsontable';
import React from 'react';

import { useCachedState } from '../../hooks/useCachedState';
import { commonText } from '../../localization/common';
import { localityText } from '../../localization/locality';
import { wbText } from '../../localization/workbench';
import type { ConversionFunction } from '../../utils/latLong';
import { Lat, Long } from '../../utils/latLong';
import type { RA, RR } from '../../utils/types';
import { Ul } from '../Atoms';
import { Button } from '../Atoms/Button';
import { Input, Label } from '../Atoms/Form';
import { Dialog } from '../Molecules/Dialog';
import { getSelectedCells, getSelectedLast, setHotData } from './hotHelpers';

const options: RA<{
  readonly label: string;
  readonly convertor: ConversionFunction;
  readonly showCardinalDirection: boolean;
}> = [
  {
    label: localityText.degrees(),
    convertor: 'toDegs',
    showCardinalDirection: false,
  },
  {
    label: localityText.degreesMinutes(),
    convertor: 'toDegsMins',
    showCardinalDirection: false,
  },
  {
    label: localityText.degreesMinutesSeconds(),
    convertor: 'toDegsMinsSecs',
    showCardinalDirection: false,
  },
  {
    label: localityText.degreesWithDirection(),
    convertor: 'toDegs',
    showCardinalDirection: true,
  },
  {
    label: localityText.degreesMinutesWithDirection(),
    convertor: 'toDegsMins',
    showCardinalDirection: true,
  },
  {
    label: localityText.degreesMinutesSecondsWithDirection(),
    convertor: 'toDegsMinsSecs',
    showCardinalDirection: true,
  },
];

export function CoordinateConverter({
  hot,
  data,
  columns,
  coordinateColumns,
  onClose: handleClose,
}: {
  readonly hot: Handsontable;
  readonly data: RA<RA<string>>;
  readonly columns: RA<string>;
  readonly coordinateColumns: RR<number, 'Lat' | 'Long'>;
  readonly onClose: () => void;
}): JSX.Element {
  const [applyAll = true, setApplyAll] = useCachedState(
    'coordinateConverter',
    'applyAll'
  );
  const [includeSymbols = false, setIncludeSymbols] = useCachedState(
    'coordinateConverter',
    'includeSymbols'
  );
  const [conversionFunction, setConversionFunction] = React.useState<
    ConversionFunction | undefined
  >(undefined);
  const [showDirection, setShowDirection] = React.useState<boolean>(false);

  const changeCount = React.useRef<number>(0);

  // List of coordinate columns
  const columnsToWorkWith = React.useMemo(
    () =>
      Object.keys(coordinateColumns).map((physicalCol) =>
        hot.toVisualColumn(Number.parseInt(physicalCol))
      ),
    []
  );

  React.useEffect(() => {
    if (conversionFunction === undefined) return;

    const selectedCells = getSelectedCells(hot, columnsToWorkWith);
    if (Object.keys(selectedCells).length === 0)
      hot.scrollViewportTo(getSelectedLast(hot)[0], columnsToWorkWith[0]);

    const toPhysicalCol = columns.map((_, visualCol) =>
      hot.toPhysicalColumn(visualCol)
    );

    const includeSymbolsFunction = includeSymbols
      ? (coordinate: string): string => coordinate
      : (coordinate: string): string => coordinate.replace(/[^\s\w.-]/gu, '');

    const stripCardinalDirections = (finalValue: string): string =>
      showDirection
        ? finalValue
        : 'SW'.includes(finalValue.at(-1)!)
        ? `-${finalValue.slice(0, -1)}`
        : 'NE'.includes(finalValue.at(-1)!)
        ? finalValue.slice(0, -1)
        : finalValue;

    const originalState = columnsToWorkWith.flatMap((visualCol) =>
      Array.from({ length: hot.countRows() }, (_, visualRow) => {
        const physicalRow = hot.toPhysicalRow(visualRow);
        const physicalCol = toPhysicalCol[visualCol];
        return [visualRow, visualCol, data[physicalRow][physicalCol]] as const;
      })
    );

    const changes = originalState
      .map(([visualRow, visualCol, originalValue]) => {
        let value = originalValue;
        if (
          originalValue !== null &&
          (applyAll || selectedCells[visualRow]?.has(visualCol))
        ) {
          const columnRole = coordinateColumns[toPhysicalCol[visualCol]];
          const coordinate = (columnRole === 'Lat' ? Lat : Long).parse(
            originalValue
          );
          if (typeof coordinate === 'object')
            value = includeSymbolsFunction(
              stripCardinalDirections(
                coordinate[conversionFunction]().format(undefined)
              )
            ).trim();
        }
        return [visualRow, visualCol, value] as const;
      })
      .filter(([visualRow, visualCol, value]) => {
        const physicalRow = hot.toPhysicalRow(visualRow);
        const physicalCol = toPhysicalCol[visualCol];
        return value !== data[physicalRow][physicalCol];
      });
    if (changes.length > 0) {
      changeCount.current += 1;
      setHotData(hot, changes);
    }
  }, [
    hot,
    coordinateColumns,
    applyAll,
    includeSymbols,
    conversionFunction,
    showDirection,
    columns,
    data,
  ]);

  return (
    <Dialog
      buttons={
        <>
          <Button.DialogClose>{commonText.cancel()}</Button.DialogClose>
          <Button.Blue onClick={handleClose}>{commonText.apply()}</Button.Blue>
        </>
      }
      header={wbText.coordinateConverter()}
      modal={false}
      onClose={(): void => {
        hot.batch(() =>
          Array.from({ length: changeCount.current }).forEach(() => hot.undo())
        );
        handleClose();
      }}
    >
      {wbText.coordinateConverterDescription()}
      <Ul>
        {Object.values(options).map(
          ({ label, convertor, showCardinalDirection }, optionIndex) => (
            <li key={optionIndex}>
              <Label.Inline>
                <Input.Radio
                  name="latLongFormat"
                  onChange={(): void => {
                    setConversionFunction(convertor);
                    setShowDirection(showCardinalDirection);
                  }}
                />
                {label}
              </Label.Inline>
            </li>
          )
        )}
        <br />
        <li>
          <Label.Inline>
            <Input.Checkbox
              defaultChecked={includeSymbols}
              onValueChange={setIncludeSymbols}
            />
            {wbText.includeDmsSymbols()}
          </Label.Inline>
        </li>
        <li>
          <Label.Inline>
            <Input.Checkbox
              defaultChecked={applyAll}
              onValueChange={setApplyAll}
            />
            {commonText.applyAll()}
          </Label.Inline>
        </li>
      </Ul>
    </Dialog>
  );
}