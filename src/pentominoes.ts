import type { BoardLike, HundredChartKind } from './hundredChart.ts';

export type PentominoType =
  | 'I2'
  | 'I3'
  | 'L3'
  | 'I4'
  | 'O4'
  | 'T4'
  | 'L4'
  | 'S4'
  | 'F5'
  | 'I5'
  | 'L5'
  | 'P5'
  | 'N5'
  | 'T5'
  | 'U5'
  | 'V5'
  | 'W5'
  | 'X5'
  | 'Y5'
  | 'Z5';

export type Cell = [number, number];

export interface PentominoConfig {
  name: string;
  type: PentominoType;
  x: number;
  y: number;
  rotation: number;
  fixed: boolean;
  maskedNumber: number | null;
  color: string;
  opacity: number;
}

export interface PentominoParseError {
  line: number;
  message: string;
}

export interface PentominoParseResult {
  configs: PentominoConfig[];
  errors: PentominoParseError[];
}

export interface PentominoState {
  name: string;
  type: PentominoType;
  x: number;
  y: number;
  rotation: number;
  fixed: boolean;
  maskedNumber: number | null;
  width: number;
  height: number;
  color: string;
  opacity: number;
  cells: Cell[];
  coveredNumbers: number[];
}

export interface PentominoPiece {
  objects: any[];
  polygons: any[];
  rotationButton: any | null;
  getState(): PentominoState;
  setFixed(fixed: boolean): boolean;
  rotate(): void;
  snap(): void;
  isAttached(): boolean;
  dispose(): void;
}

export interface CreatePentominoOptions {
  onChange?: (state: PentominoState) => void;
  onInteractionStart?: (state: PentominoState, event?: unknown) => void;
}

export const PENTOMINO_TYPES: PentominoType[] = [
  'I2',
  'I3',
  'L3',
  'I4',
  'O4',
  'T4',
  'L4',
  'S4',
  'F5',
  'I5',
  'L5',
  'P5',
  'N5',
  'T5',
  'U5',
  'V5',
  'W5',
  'X5',
  'Y5',
  'Z5'
];

export const PENTOMINO_CELLS: Record<PentominoType, Cell[]> = {
  I2: [[0, 0], [1, 0]],
  I3: [[0, 0], [1, 0], [2, 0]],
  L3: [[0, 0], [1, 0], [0, 1]],
  I4: [[0, 0], [1, 0], [2, 0], [3, 0]],
  O4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T4: [[1, 0], [0, 1], [1, 1], [2, 1]],
  L4: [[0, 0], [1, 0], [0, 1], [0, 2]],
  S4: [[1, 0], [2, 0], [0, 1], [1, 1]],
  F5: [[1, 0], [0, 1], [1, 1], [1, 2], [2, 2]],
  I5: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  L5: [[0, 0], [1, 0], [0, 1], [0, 2], [0, 3]],
  P5: [[0, 0], [0, 1], [1, 1], [0, 2], [1, 2]],
  N5: [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1]],
  T5: [[1, 0], [1, 1], [0, 2], [1, 2], [2, 2]],
  U5: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]],
  V5: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]],
  W5: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
  X5: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  Y5: [[0, 0], [0, 1], [0, 2], [1, 2], [0, 3]],
  Z5: [[1, 0], [2, 0], [1, 1], [0, 2], [1, 2]]
};

export const PENTOMINO_COLORS: Record<PentominoType, string> = {
  I2: '#006d77',
  I3: '#8338ec',
  L3: '#ff6b6b',
  I4: '#118ab2',
  O4: '#f4a261',
  T4: '#6a994e',
  L4: '#e76f51',
  S4: '#9b5de5',
  F5: '#3569b7',
  I5: '#e88918',
  L5: '#d43d51',
  P5: '#2a9d8f',
  N5: '#4f8f3a',
  T5: '#d6a800',
  U5: '#7a4fb3',
  V5: '#d95f9d',
  W5: '#8c5a3c',
  X5: '#56616b',
  Y5: '#169cc4',
  Z5: '#83951c'
};

export const DEFAULT_PENTOMINO_OPACITY = 0.58;
const ROTATION_BUTTON_GAP = 0.34;
const ROTATION_BUTTON_HALF_SIZE = 0.28;
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,47}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const ALLOWED_KEYS = new Set([
  'name',
  'type',
  'numbers',
  'fixed',
  'color',
  'opacity'
]);

function normalizeCells(cells: Cell[]): Cell[] {
  const minX = Math.min.apply(null, cells.map(function(cell) { return cell[0]; }));
  const minY = Math.min.apply(null, cells.map(function(cell) { return cell[1]; }));

  return cells
    .map(function(cell): Cell {
      return [cell[0] - minX, cell[1] - minY];
    })
    .sort(function(left, right) {
      return (left[1] - right[1]) || (left[0] - right[0]);
    });
}

export function normalizeRotation(rotation: number): number {
  const quarterTurns = Math.round((Number(rotation) || 0) / 90);
  return ((quarterTurns % 4) + 4) % 4 * 90;
}

export function getPentominoCells(
  type: PentominoType,
  rotation = 0
): Cell[] {
  let cells = PENTOMINO_CELLS[type].map(function(cell): Cell {
    return [cell[0], cell[1]];
  });
  const turns = normalizeRotation(rotation) / 90;

  for (let turn = 0; turn < turns; turn += 1) {
    cells = cells.map(function(cell): Cell {
      // Clockwise rotation in the board's Cartesian coordinate system.
      return [cell[1], -cell[0]];
    });
    cells = normalizeCells(cells);
  }

  return normalizeCells(cells);
}

export function getPentominoBounds(cells: Cell[]): {
  width: number;
  height: number;
} {
  return {
    width: Math.max.apply(null, cells.map(function(cell) { return cell[0]; })) + 1,
    height: Math.max.apply(null, cells.map(function(cell) { return cell[1]; })) + 1
  };
}

export function getAbsolutePentominoCells(
  type: PentominoType,
  rotation: number,
  x: number,
  y: number
): Cell[] {
  return getPentominoCells(type, rotation).map(function(cell): Cell {
    return [cell[0] + x, cell[1] + y];
  });
}

export function coveredHundredChartNumbers(cells: Cell[]): number[] {
  return cells
    .filter(function(cell) {
      return (
        Number.isInteger(cell[0]) &&
        Number.isInteger(cell[1]) &&
        cell[0] >= 0 &&
        cell[0] < 10 &&
        cell[1] >= 0 &&
        cell[1] < 10
      );
    })
    .map(function(cell) {
      return (9 - cell[1]) * 10 + cell[0] + 1;
    })
    .sort(function(left, right) { return left - right; });
}

export function hundredChartCoverageSum(
  numbers: number[],
  expectedCount = 5,
  chartKind: HundredChartKind = 'standard'
): number | null {
  if (
    !Number.isSafeInteger(expectedCount) ||
    expectedCount < 1 ||
    !Array.isArray(numbers) ||
    numbers.length !== expectedCount
  ) {
    return null;
  }

  const uniqueNumbers = new Set<number>();
  let sum = 0;
  for (const value of numbers) {
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > 100 ||
      uniqueNumbers.has(value)
    ) {
      return null;
    }
    uniqueNumbers.add(value);
    sum += value;
  }

  return chartKind === 'negative'
    ? 51 * expectedCount - sum
    : sum;
}

export function parsePentominoType(rawType: string): PentominoType | null {
  const normalized = String(rawType || '').trim().toUpperCase();
  if (PENTOMINO_TYPES.includes(normalized as PentominoType)) {
    return normalized as PentominoType;
  }

  // Backwards compatibility: bare letters have always denoted pentominoes.
  if (/^[FILPNTUVWXYZ]$/.test(normalized)) {
    return (normalized + '5') as PentominoType;
  }
  return null;
}

function parseInteger(rawValue: string | undefined): number | null {
  const normalized = String(rawValue ?? '').trim();

  if (!/^[+-]?\d+$/.test(normalized)) {
    return null;
  }

  const value = Number(normalized);
  return Number.isSafeInteger(value) ? value : null;
}

interface PentominoPlacement {
  x: number;
  y: number;
  rotation: number;
}

interface ParsedCoverage {
  numbers: number[];
  maskedNumber: number | null;
  hasUnknown: boolean;
  errors: string[];
}

function parseFixed(rawValue: string | undefined): boolean | null {
  if (rawValue === undefined) return false;
  const normalized = String(rawValue).trim().toLowerCase();
  if (['true', '1', 'yes', 'ja'].includes(normalized)) return true;
  if (['false', '0', 'no', 'nein'].includes(normalized)) return false;
  return null;
}

function hundredChartNumberToCell(value: number): Cell {
  const zeroBased = value - 1;
  return [zeroBased % 10, 9 - Math.floor(zeroBased / 10)];
}

function numberSetKey(numbers: number[]): string {
  return numbers.slice().sort(function(left, right) {
    return left - right;
  }).join(',');
}

function placementForCoverage(
  type: PentominoType,
  numbers: number[]
): PentominoPlacement | null {
  const targetCells = numbers.map(hundredChartNumberToCell);
  const x = Math.min.apply(null, targetCells.map(function(cell) {
    return cell[0];
  }));
  const y = Math.min.apply(null, targetCells.map(function(cell) {
    return cell[1];
  }));
  const targetKey = numberSetKey(numbers);
  const expectedCount = PENTOMINO_CELLS[type].length;

  for (const rotation of [0, 90, 180, 270]) {
    const candidateNumbers = coveredHundredChartNumbers(
      getAbsolutePentominoCells(type, rotation, x, y)
    );
    if (
      candidateNumbers.length === expectedCount &&
      numberSetKey(candidateNumbers) === targetKey
    ) {
      return { x, y, rotation };
    }
  }

  return null;
}

function placementsForUnknown(
  type: PentominoType,
  knownNumbers: number[]
): Array<PentominoPlacement & { maskedNumber: number }> {
  const known = new Set(knownNumbers);
  const expectedCount = PENTOMINO_CELLS[type].length;
  const candidates = new Map<
    string,
    PentominoPlacement & { maskedNumber: number }
  >();

  for (const rotation of [0, 90, 180, 270]) {
    const bounds = getPentominoBounds(getPentominoCells(type, rotation));
    for (let y = 0; y <= 10 - bounds.height; y += 1) {
      for (let x = 0; x <= 10 - bounds.width; x += 1) {
        const candidateNumbers = coveredHundredChartNumbers(
          getAbsolutePentominoCells(type, rotation, x, y)
        );
        if (
          candidateNumbers.length !== expectedCount ||
          !knownNumbers.every(function(value) {
            return candidateNumbers.includes(value);
          })
        ) {
          continue;
        }

        const missing = candidateNumbers.filter(function(value) {
          return !known.has(value);
        });
        if (missing.length !== 1) continue;

        const key = numberSetKey(candidateNumbers);
        if (!candidates.has(key)) {
          candidates.set(key, {
            x,
            y,
            rotation,
            maskedNumber: missing[0]
          });
        }
      }
    }
  }

  return Array.from(candidates.values());
}

function parseCoverage(
  rawValue: string | undefined,
  expectedCount: number
): ParsedCoverage {
  const errors: string[] = [];
  const normalized = String(rawValue ?? '').trim();
  const bracketMatch = normalized.match(/^\[([\s\S]*)\]$/);
  if (!bracketMatch) {
    return {
      numbers: [],
      maskedNumber: null,
      hasUnknown: false,
      errors: ['numbers muss eine Liste wie [6,7,8,17,27] sein.']
    };
  }

  const tokens = bracketMatch[1].split(',').map(function(token) {
    return token.trim();
  });
  if (
    tokens.length !== expectedCount ||
    tokens.some(function(token) { return !token; })
  ) {
    errors.push(
      'numbers muss genau ' + expectedCount + ' Einträge enthalten.'
    );
  }

  const numbers: number[] = [];
  let maskedNumber: number | null = null;
  let hasUnknown = false;
  let maskTokens = 0;

  tokens.forEach(function(token) {
    if (/^x$/i.test(token)) {
      hasUnknown = true;
      maskTokens += 1;
      return;
    }

    const explicitMask = token.match(
      /^(?:([+-]?\d+)\s*=\s*x|x\s*=\s*([+-]?\d+))$/i
    );
    const rawNumber = explicitMask
      ? String(explicitMask[1] ?? explicitMask[2])
      : token;
    const value = parseInteger(rawNumber);
    if (value === null) {
      errors.push('Ungültiger numbers-Eintrag: ' + token + '.');
      return;
    }
    if (value < 1 || value > 100) {
      errors.push('Hunderterfeldzahlen müssen zwischen 1 und 100 liegen.');
      return;
    }

    numbers.push(value);
    if (explicitMask) {
      maskedNumber = value;
      maskTokens += 1;
    }
  });

  if (maskTokens > 1) {
    errors.push('Pro Pentomino darf höchstens ein Feld als x markiert sein.');
  }
  if (new Set(numbers).size !== numbers.length) {
    errors.push('Die Einträge in numbers müssen verschieden sein.');
  }
  if (
    (hasUnknown && numbers.length !== expectedCount - 1) ||
    (!hasUnknown && numbers.length !== expectedCount)
  ) {
    errors.push(
      'numbers muss ' + expectedCount + ' verschiedene Felder beschreiben.'
    );
  }

  return { numbers, maskedNumber, hasUnknown, errors };
}

function parseSpecLine(
  rawLine: string,
  lineNumber: number
): { config?: PentominoConfig; errors: PentominoParseError[] } {
  const errors: PentominoParseError[] = [];
  const values: Record<string, string> = {};

  rawLine.split(';').forEach(function(rawPart) {
    const part = rawPart.trim();
    if (!part) return;
    const separator = part.indexOf('=');
    if (separator <= 0) {
      errors.push({ line: lineNumber, message: 'Erwartet wird schlüssel=wert.' });
      return;
    }

    const key = part.slice(0, separator).trim().toLowerCase();
    const value = part.slice(separator + 1).trim();
    if (!ALLOWED_KEYS.has(key)) {
      errors.push({ line: lineNumber, message: 'Unbekannte Option: ' + key + '.' });
      return;
    }
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      errors.push({ line: lineNumber, message: 'Option doppelt gesetzt: ' + key + '.' });
      return;
    }
    values[key] = value;
  });

  const name = String(values.name || '').trim();
  if (!NAME_PATTERN.test(name)) {
    errors.push({
      line: lineNumber,
      message: 'name muss mit einem Buchstaben beginnen und darf nur Buchstaben, Ziffern, _ und - enthalten.'
    });
  }

  const type = parsePentominoType(values.type);
  if (!type) {
    errors.push({
      line: lineNumber,
      message: 'type muss einer der Werte ' + PENTOMINO_TYPES.join(', ') + ' sein.'
    });
  }

  const coverage = parseCoverage(
    values.numbers,
    type ? PENTOMINO_CELLS[type].length : 5
  );
  coverage.errors.forEach(function(message) {
    errors.push({ line: lineNumber, message });
  });

  let placement: PentominoPlacement | null = null;
  let maskedNumber = coverage.maskedNumber;
  if (type && coverage.errors.length === 0) {
    if (coverage.hasUnknown) {
      const candidates = placementsForUnknown(type, coverage.numbers);
      if (candidates.length === 1) {
        placement = candidates[0];
        maskedNumber = candidates[0].maskedNumber;
      } else if (candidates.length === 0) {
        errors.push({
          line: lineNumber,
          message:
            'Die angegebenen Zahlen und x bilden kein passendes ' + type + '.'
        });
      } else {
        const possibleNumbers = Array.from(new Set(
          candidates.map(function(candidate) { return candidate.maskedNumber; })
        )).sort(function(left, right) { return left - right; });
        errors.push({
          line: lineNumber,
          message:
            'Das Feld x ist nicht eindeutig (mögliche Zahlen: ' +
            possibleNumbers.join(', ') +
            '). Markiere es explizit, zum Beispiel 27=x.'
        });
      }
    } else {
      placement = placementForCoverage(type, coverage.numbers);
      if (!placement) {
        errors.push({
          line: lineNumber,
          message:
            'Die Zahlen in numbers bilden kein passendes ' + type + '.'
        });
      }
    }
  }

  const fixed = parseFixed(values.fixed);
  if (fixed === null) {
    errors.push({
      line: lineNumber,
      message: 'fixed muss true oder false sein.'
    });
  }

  const color = values.color === undefined
    ? (type ? PENTOMINO_COLORS[type] : '#777777')
    : values.color;
  if (!COLOR_PATTERN.test(color)) {
    errors.push({ line: lineNumber, message: 'color muss ein sechsstelliger Hexwert wie #3569b7 sein.' });
  }

  const opacity = values.opacity === undefined
    ? DEFAULT_PENTOMINO_OPACITY
    : Number(values.opacity);
  if (!Number.isFinite(opacity) || opacity < 0.2 || opacity > 0.85) {
    errors.push({ line: lineNumber, message: 'opacity muss zwischen 0.2 und 0.85 liegen.' });
  }

  if (errors.length || !type || !placement || fixed === null) return { errors };
  return {
    errors,
    config: {
      name,
      type,
      x: placement.x,
      y: placement.y,
      rotation: placement.rotation,
      fixed,
      maskedNumber,
      color: color.toLowerCase(),
      opacity
    }
  };
}

function stripFlattenedComment(record: string): string {
  for (let index = 0; index < record.length; index += 1) {
    if (record[index] !== '#') continue;

    let previous = index - 1;
    while (previous >= 0 && /\s/.test(record[previous])) previous -= 1;

    // A hexadecimal color starts with =# and is part of the configuration.
    if (previous >= 0 && record[previous] === '=') continue;
    return record.slice(0, index);
  }

  return record;
}

function splitSpecRecords(input: string): string[] {
  const records: string[] = [];

  String(input || '').split(/\r?\n/).forEach(function(rawLine) {
    const starts: number[] = [];
    const nameKey = /name\s*=/gi;
    let match: RegExpExecArray | null;
    while ((match = nameKey.exec(rawLine)) !== null) {
      starts.push(match.index);
    }

    if (!starts.length) {
      records.push(rawLine);
      return;
    }

    // LiaScript can flatten a fenced macro parameter before inserting it into
    // the hidden marker. Every configuration has a required name key, so a
    // second name= occurrence is an unambiguous record boundary.
    const leadingComment = rawLine.trimStart().startsWith('#');
    let start = leadingComment ? starts[0] : 0;
    starts.slice(1).forEach(function(nextStart) {
      records.push(stripFlattenedComment(rawLine.slice(start, nextStart)));
      start = nextStart;
    });
    records.push(stripFlattenedComment(rawLine.slice(start)));
  });

  return records;
}

export function parsePentominoSpecs(input: string): PentominoParseResult {
  const configs: PentominoConfig[] = [];
  const errors: PentominoParseError[] = [];
  const names = new Set<string>();

  splitSpecRecords(input).forEach(function(rawLine, index) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    const parsed = parseSpecLine(line, index + 1);
    errors.push.apply(errors, parsed.errors);
    if (!parsed.config) return;

    if (names.has(parsed.config.name)) {
      errors.push({
        line: index + 1,
        message: 'Der Instanzname ' + parsed.config.name + ' kommt mehrfach vor.'
      });
      return;
    }
    names.add(parsed.config.name);
    configs.push(parsed.config);
  });

  if (!configs.length && !errors.length) {
    errors.push({ line: 1, message: 'Mindestens eine Polyomino-Konfiguration wird benötigt.' });
  }

  return { configs, errors };
}

function pointCoordinates(point: any): Cell {
  if (point && typeof point.X === 'function' && typeof point.Y === 'function') {
    return [Number(point.X()), Number(point.Y())];
  }

  const coordinates = point && point.coords && point.coords.usrCoords;
  if (coordinates && coordinates.length >= 3) {
    return [Number(coordinates[1]), Number(coordinates[2])];
  }

  return [0, 0];
}

function setPointCoordinates(point: any, x: number, y: number): void {
  const coordinateMode = (
    typeof window !== 'undefined' &&
    (window as any).JXG &&
    Number.isFinite((window as any).JXG.COORDS_BY_USER)
  ) ? (window as any).JXG.COORDS_BY_USER : 1;

  if (point && typeof point.setPositionDirectly === 'function') {
    point.setPositionDirectly(coordinateMode, [x, y]);
    return;
  }
  if (point && typeof point.setPosition === 'function') {
    point.setPosition(coordinateMode, [x, y]);
    return;
  }
  if (point && point.coords && typeof point.coords.setCoordinates === 'function') {
    point.coords.setCoordinates(coordinateMode, [x, y]);
  }
}

function createInvisiblePoint(
  board: BoardLike,
  x: number,
  y: number,
  fixed = false
): any {
  return board.create('point', [x, y], {
    name: '',
    withLabel: false,
    visible: false,
    fixed,
    frozen: false,
    highlight: false,
    showInfobox: false,
    size: 0
  });
}

function removeObjects(
  board: BoardLike,
  objects: any[],
  manageUpdates = true
): void {
  const updateWasSuspended = board.isSuspendedUpdate === true;
  let suspendedHere = false;

  if (manageUpdates && !updateWasSuspended && typeof board.suspendUpdate === 'function') {
    try {
      board.suspendUpdate();
      suspendedHere = true;
    } catch (_error) {}
  }

  for (let index = objects.length - 1; index >= 0; index -= 1) {
    try {
      board.removeObject?.(objects[index]);
    } catch (_error) {}
  }

  if (suspendedHere) {
    try {
      board.unsuspendUpdate?.();
    } catch (_error) {}
  }
  if (manageUpdates && !updateWasSuspended && !suspendedHere) {
    try {
      board.update?.();
    } catch (_error) {}
  }
}

function objectsAreAttached(board: BoardLike, objects: any[]): boolean {
  if (!objects.length) return false;
  return objects.every(function(object) {
    if (!object || (object.board && object.board !== board)) return false;
    const objectId = typeof object.id === 'string' ? object.id : '';
    if (board.objects && objectId) return board.objects[objectId] === object;
    return object.board === board;
  });
}

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(
    'lia-pentomino-styles'
  ) as HTMLStyleElement | null;
  const style = existing || document.createElement('style');
  style.id = 'lia-pentomino-styles';
  style.textContent =
    '.lia-pentomino-rotate-button>button{' +
    'width:1.6rem;min-width:1.6rem;height:1.6rem;padding:0;' +
    'border:1px solid rgba(var(--color-border,96,96,96),.58);border-radius:50%;' +
    'background:rgba(var(--color-background,255,255,255),.94);color:inherit;' +
    'font:600 1rem/1 sans-serif;cursor:pointer;touch-action:manipulation;' +
    'opacity:.82;box-shadow:0 1px 4px rgba(0,0,0,.24);' +
    'transition:opacity .15s ease,transform .15s ease,background .15s ease}' +
    '.lia-pentomino-rotate-button>button:hover{' +
    'opacity:1;background:rgba(var(--color-highlight,0,150,170),.12);' +
    'transform:scale(1.06)}' +
    '.lia-pentomino-rotate-button>button:focus-visible{' +
    'opacity:1;background:rgba(var(--color-highlight,0,150,170),.12);' +
    'outline:3px solid rgb(var(--color-highlight,0,150,170));outline-offset:2px}';
  if (!existing) (document.head || document.documentElement).appendChild(style);
}

function cloneState(state: PentominoState): PentominoState {
  return {
    name: state.name,
    type: state.type,
    x: state.x,
    y: state.y,
    rotation: state.rotation,
    fixed: state.fixed,
    maskedNumber: state.maskedNumber,
    width: state.width,
    height: state.height,
    color: state.color,
    opacity: state.opacity,
    cells: state.cells.map(function(cell): Cell { return [cell[0], cell[1]]; }),
    coveredNumbers: state.coveredNumbers.slice()
  };
}

export function createPentomino(
  board: BoardLike,
  config: PentominoConfig,
  options: CreatePentominoOptions = {}
): PentominoPiece {
  ensureStyles();

  const objects: any[] = [];
  const polygons: any[] = [];
  const cellPoints: any[][] = [];
  const allMovablePoints: any[] = [];
  const interactionBindings: Array<{
    polygon: any;
    event: 'down' | 'drag' | 'up';
    handler: (event?: unknown) => void;
  }> = [];
  const eventBindings: Array<{
    polygon: any;
    event: 'down' | 'drag' | 'up';
    handler: (event?: unknown) => void;
  }> = [];
  let rotation = normalizeRotation(config.rotation);
  let fixed = config.fixed;
  let orientedCells = getPentominoCells(config.type, rotation);
  let bounds = getPentominoBounds(orientedCells);
  const draggedCells = new Set<any[]>();
  let disposed = false;
  let origin: any;
  let rotationButton: any | null = null;

  const emitChange = function(): void {
    if (!disposed && options.onChange) options.onChange(piece.getState());
  };

  const emitInteractionStart = function(event?: unknown): void {
    if (disposed || fixed || !options.onInteractionStart) return;
    try {
      options.onInteractionStart(piece.getState(), event);
    } catch (_error) {}
  };

  const updateBoard = function(): void {
    try {
      board.update?.();
    } catch (_error) {}
  };

  const rotationButtonPosition = function(): Cell {
    const originPosition = pointCoordinates(origin);
    let left = -0.15;
    let top = 10.15;
    let right = 10.15;
    let bottom = -0.15;

    try {
      const boundingBox = board.getBoundingBox?.();
      if (
        Array.isArray(boundingBox) &&
        boundingBox.length >= 4 &&
        boundingBox.slice(0, 4).every(function(value) {
          return Number.isFinite(value);
        }) &&
        boundingBox[2] > boundingBox[0] &&
        boundingBox[1] > boundingBox[3]
      ) {
        left = boundingBox[0];
        top = boundingBox[1];
        right = boundingBox[2];
        bottom = boundingBox[3];
      }
    } catch (_error) {}

    const minimumX = left + ROTATION_BUTTON_HALF_SIZE;
    const maximumX = right - ROTATION_BUTTON_HALF_SIZE;
    const rightCandidate =
      originPosition[0] + bounds.width + ROTATION_BUTTON_GAP;
    const leftCandidate = originPosition[0] - ROTATION_BUTTON_GAP;
    let x: number;

    if (rightCandidate <= maximumX) {
      x = rightCandidate;
    } else if (leftCandidate >= minimumX) {
      x = leftCandidate;
    } else {
      x = Math.max(minimumX, Math.min(maximumX, rightCandidate));
    }

    const minimumY = bottom + ROTATION_BUTTON_HALF_SIZE;
    const maximumY = top - ROTATION_BUTTON_HALF_SIZE;
    const preferredY = originPosition[1] + bounds.height - 0.5;
    const y = Math.max(minimumY, Math.min(maximumY, preferredY));

    return [x, y];
  };

  const unbindEvents = function(): void {
    eventBindings.splice(0).forEach(function(binding) {
      try {
        binding.polygon.off?.(binding.event, binding.handler);
      } catch (_error) {}
    });
  };

  const bindEvents = function(): void {
    if (disposed || fixed || eventBindings.length) return;
    interactionBindings.forEach(function(binding) {
      try {
        binding.polygon.on?.(binding.event, binding.handler);
        eventBindings.push(binding);
      } catch (_error) {}
    });
  };

  const moveAllBy = function(deltaX: number, deltaY: number): void {
    allMovablePoints.forEach(function(point) {
      const current = pointCoordinates(point);
      setPointCoordinates(point, current[0] + deltaX, current[1] + deltaY);
    });
  };

  const layoutCells = function(): void {
    const originPosition = pointCoordinates(origin);
    orientedCells.forEach(function(cell, cellIndex) {
      const x = originPosition[0] + cell[0];
      const y = originPosition[1] + cell[1];
      const corners: Cell[] = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
      corners.forEach(function(corner, cornerIndex) {
        setPointCoordinates(cellPoints[cellIndex][cornerIndex], corner[0], corner[1]);
      });
    });
  };

  const snap = function(shouldEmit = true, shouldUpdate = true): void {
    if (disposed || fixed) return;
    const current = pointCoordinates(origin);
    const targetX = Math.round(current[0]);
    const targetY = Math.round(current[1]);
    moveAllBy(targetX - current[0], targetY - current[1]);
    if (shouldUpdate) updateBoard();
    if (shouldEmit) emitChange();
  };

  const rotatePiece = function(shouldUpdate: boolean): void {
    if (disposed || fixed) return;
    snap(false, false);
    rotation = normalizeRotation(rotation + 90);
    orientedCells = getPentominoCells(config.type, rotation);
    bounds = getPentominoBounds(orientedCells);
    layoutCells();
    if (shouldUpdate) updateBoard();
    emitChange();
  };

  const syncDrag = function(activeCellPoints: any[], cellIndex: number): void {
    if (disposed || fixed) return;
    const originPosition = pointCoordinates(origin);
    const activePosition = pointCoordinates(activeCellPoints[0]);
    const expectedX = originPosition[0] + orientedCells[cellIndex][0];
    const expectedY = originPosition[1] + orientedCells[cellIndex][1];
    const deltaX = activePosition[0] - expectedX;
    const deltaY = activePosition[1] - expectedY;

    setPointCoordinates(
      origin,
      originPosition[0] + deltaX,
      originPosition[1] + deltaY
    );
    layoutCells();
    draggedCells.add(activeCellPoints);
  };

  const finishDrag = function(activeCellPoints: any[]): void {
    if (disposed || fixed) return;
    if (!draggedCells.delete(activeCellPoints)) return;
    if (draggedCells.size === 0) snap(true, true);
  };

  const state = function(): PentominoState {
    const originPosition = pointCoordinates(origin);
    const cells = orientedCells.map(function(cell): Cell {
      return [originPosition[0] + cell[0], originPosition[1] + cell[1]];
    });

    return {
      name: config.name,
      type: config.type,
      x: originPosition[0],
      y: originPosition[1],
      rotation,
      fixed,
      maskedNumber: config.maskedNumber,
      width: bounds.width,
      height: bounds.height,
      color: config.color,
      opacity: config.opacity,
      cells,
      coveredNumbers: coveredHundredChartNumbers(cells)
    };
  };

  const setObjectAttributes = function(
    object: any,
    attributes: Record<string, unknown>
  ): void {
    try {
      object?.setAttribute?.(attributes);
    } catch (_error) {}
    if (object && object.attributes && typeof object.attributes === 'object') {
      Object.assign(object.attributes, attributes);
    }
  };

  const applyFixedAttributes = function(nextFixed: boolean): void {
    allMovablePoints.forEach(function(point) {
      setObjectAttributes(point, { fixed: nextFixed });
    });
    polygons.forEach(function(polygon) {
      setObjectAttributes(polygon, {
        fixed: nextFixed,
        highlight: !nextFixed,
        dragToTopOfLayer: !nextFixed
      });
      if (
        polygon &&
        polygon.attributes &&
        polygon.attributes.vertices &&
        typeof polygon.attributes.vertices === 'object'
      ) {
        polygon.attributes.vertices.fixed = nextFixed;
      }
    });
  };

  const removeRotationButton = function(): void {
    if (!rotationButton) return;
    const button = rotationButton;
    rotationButton = null;
    const index = objects.indexOf(button);
    if (index >= 0) objects.splice(index, 1);
    try {
      board.removeObject?.(button);
    } catch (_error) {}
  };

  const createRotationButton = function(): void {
    if (disposed || fixed || rotationButton) return;
    const button = board.create(
      'button',
      [
        function() { return rotationButtonPosition()[0]; },
        function() { return rotationButtonPosition()[1]; },
        '↻',
        function() { rotatePiece(false); }
      ],
      {
        name: '',
        fixed: true,
        highlight: false,
        anchorX: 'middle',
        anchorY: 'middle',
        layer: 9,
        cssClass: 'lia-pentomino-rotate-button',
        highlightCssClass: 'lia-pentomino-rotate-button'
      }
    );
    if (!button) throw new Error('Der Drehknopf konnte nicht erzeugt werden.');
    rotationButton = button;
    objects.push(button);

    if (rotationButton && rotationButton.rendNodeButton) {
      rotationButton.rendNodeButton.setAttribute('type', 'button');
      rotationButton.rendNodeButton.setAttribute(
        'aria-label',
        'Pentomino um 90 Grad im Uhrzeigersinn drehen'
      );
      rotationButton.rendNodeButton.setAttribute(
        'title',
        'Pentomino um 90° drehen'
      );
    }
  };

  const setFixed = function(nextValue: boolean): boolean {
    if (disposed) return false;
    const nextFixed = !!nextValue;
    if (nextFixed === fixed) return true;

    if (nextFixed) snap(false, false);
    fixed = nextFixed;
    draggedCells.clear();
    applyFixedAttributes(fixed);

    if (fixed) {
      unbindEvents();
      removeRotationButton();
    } else {
      bindEvents();
      try {
        createRotationButton();
      } catch (_error) {
        unbindEvents();
        fixed = true;
        applyFixedAttributes(true);
        updateBoard();
        return false;
      }
    }

    updateBoard();
    emitChange();
    return true;
  };

  const piece: PentominoPiece = {
    objects,
    polygons,
    get rotationButton() { return rotationButton; },
    getState: function() { return cloneState(state()); },
    setFixed,
    rotate: function() { rotatePiece(true); },
    snap: function() { snap(true, true); },
    isAttached: function() { return !disposed && objectsAreAttached(board, objects); },
    dispose: function() {
      if (disposed) return;
      disposed = true;
      draggedCells.clear();
      unbindEvents();
      removeObjects(board, objects);
    }
  };

  const updateWasSuspended = board.isSuspendedUpdate === true;
  let suspendedForCreation = false;

  try {
    if (!updateWasSuspended && typeof board.suspendUpdate === 'function') {
      board.suspendUpdate();
      suspendedForCreation = true;
    }
    origin = createInvisiblePoint(board, config.x, config.y, fixed);
    objects.push(origin);
    allMovablePoints.push(origin);

    orientedCells.forEach(function(cell) {
      const x = config.x + cell[0];
      const y = config.y + cell[1];
      const points = [
        createInvisiblePoint(board, x, y, fixed),
        createInvisiblePoint(board, x + 1, y, fixed),
        createInvisiblePoint(board, x + 1, y + 1, fixed),
        createInvisiblePoint(board, x, y + 1, fixed)
      ];
      cellPoints.push(points);
      allMovablePoints.push.apply(allMovablePoints, points);
      objects.push.apply(objects, points);
    });

    cellPoints.forEach(function(points, index) {
      const polygon = board.create('polygon', points, {
        name: '',
        withLabel: false,
        showInfobox: false,
        fixed,
        frozen: false,
        rotatable: false,
        scalable: false,
        hasInnerPoints: true,
        highlight: !fixed,
        fillColor: config.color,
        highlightFillColor: config.color,
        fillOpacity: config.opacity,
        highlightFillOpacity: Math.min(0.88, config.opacity + 0.16),
        strokeColor: config.color,
        strokeOpacity: 0.96,
        strokeWidth: 1.5,
        layer: 6,
        dragToTopOfLayer: !fixed,
        vertices: {
          name: '',
          withLabel: false,
          visible: false,
          fixed,
          highlight: false,
          size: 0
        },
        borders: {
          fixed: true,
          highlight: false,
          strokeColor: config.color,
          strokeOpacity: 0.96,
          strokeWidth: 1.5,
          layer: 7
        }
      });

      const downHandler = function(event?: unknown): void {
        emitInteractionStart(event);
      };
      const dragHandler = function(): void { syncDrag(points, index); };
      const upHandler = function(): void { finishDrag(points); };
      interactionBindings.push(
        { polygon, event: 'down', handler: downHandler },
        { polygon, event: 'drag', handler: dragHandler },
        { polygon, event: 'up', handler: upHandler }
      );
      polygons.push(polygon);
      objects.push(polygon);
    });

    bindEvents();
    createRotationButton();

    return piece;
  } catch (error) {
    disposed = true;
    draggedCells.clear();
    unbindEvents();
    removeObjects(board, objects, false);
    throw error;
  } finally {
    if (suspendedForCreation) {
      try {
        board.unsuspendUpdate?.();
      } catch (_error) {}
    }
    if (!updateWasSuspended && !suspendedForCreation) updateBoard();
  }
}
