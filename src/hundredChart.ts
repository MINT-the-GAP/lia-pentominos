export const HUNDRED_CHART_SIZE = 10;

export type HundredChartKind = 'standard' | 'negative';

export interface BoardLike {
  create(type: string, parents: unknown[], attributes: Record<string, unknown>): any;
  containerObj?: Node;
  getBoundingBox?(): number[];
  isSuspendedUpdate?: boolean;
  objects?: Record<string, any>;
  removeObject?(object: any): void;
  suspendUpdate?(): void;
  unsuspendUpdate?(): void;
  update?(): void;
}

const BACKGROUND_COLOR = '#ffffff';
const LINE_COLOR = '#202020';
const TEXT_COLOR = '#111111';
const MASKED_LABEL = '𝑥';

interface HundredChartMaskState {
  maskedNumbers: Set<number>;
  signature: string;
}

const maskStates = new WeakMap<any[], HundredChartMaskState>();

export function boardIsConnected(
  board: BoardLike,
  root: Node = document.documentElement
): boolean {
  const container = board && board.containerObj;
  if (!container || container.isConnected === false) return false;

  // JSXGraph's LiaScript component mounts its real board container inside a
  // ShadowRoot. That node is connected even though documentElement.contains()
  // cannot see it. Comparing composed roots accepts that case while still
  // rejecting a board which belongs to another document.
  if (container.isConnected === true) {
    try {
      if (
        typeof container.getRootNode === 'function' &&
        typeof root.getRootNode === 'function'
      ) {
        return (
          container.getRootNode({ composed: true }) ===
          root.getRootNode({ composed: true })
        );
      }
    } catch (_error) {}

    // DOM-like test doubles and older implementations may expose
    // isConnected without getRootNode. It is then the best signal available.
    return true;
  }

  try {
    return root.contains(container);
  } catch (_error) {
    return false;
  }
}

export function hundredChartIsAttached(board: BoardLike, objects: any[]): boolean {
  if (!board || !Array.isArray(objects) || objects.length === 0) return false;

  return objects.every(function(object) {
    if (!object) return false;
    if (object.board && object.board !== board) return false;

    const objectId = typeof object.id === 'string' ? object.id : '';
    if (board.objects && objectId) {
      return board.objects[objectId] === object;
    }

    return object.board === board;
  });
}

function createHiddenPoint(board: BoardLike, x: number, y: number): any {
  return board.create('point', [x, y], {
    name: '',
    withLabel: false,
    visible: false,
    fixed: true,
    frozen: false,
    highlight: false,
    showInfobox: false,
    size: 0
  });
}

function createGridSegment(
  board: BoardLike,
  objects: any[],
  start: [number, number],
  end: [number, number]
): void {
  const point1 = createHiddenPoint(board, start[0], start[1]);
  const point2 = createHiddenPoint(board, end[0], end[1]);
  const segment = board.create('segment', [point1, point2], {
    name: '',
    withLabel: false,
    fixed: true,
    highlight: false,
    strokeColor: LINE_COLOR,
    highlightStrokeColor: LINE_COLOR,
    strokeWidth: 1,
    highlightStrokeWidth: 1,
    straightFirst: false,
    straightLast: false,
    layer: 2
  });

  // Keep dependencies before their segment so reverse-order cleanup removes
  // the segment first.
  objects.push(point1, point2, segment);
}

function removeHundredChartObjects(
  board: BoardLike,
  objects: any[],
  manageUpdates: boolean
): void {
  if (!board || !Array.isArray(objects)) return;

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

export function removeHundredChart(board: BoardLike, objects: any[]): void {
  removeHundredChartObjects(board, objects, true);
  maskStates.delete(objects);
}

export function setHundredChartMaskedNumbers(
  objects: any[],
  values: Iterable<number>
): boolean {
  const state = maskStates.get(objects);
  if (!state) return false;

  const numbers = Array.from(values)
    .filter(function(value) {
      return Number.isSafeInteger(value) && value >= 1 && value <= 100;
    })
    .filter(function(value, index, all) {
      return all.indexOf(value) === index;
    })
    .sort(function(left, right) { return left - right; });
  const signature = numbers.join(',');
  if (signature === state.signature) return false;

  state.maskedNumbers = new Set(numbers);
  state.signature = signature;
  return true;
}

export function createHundredChart(
  board: BoardLike,
  chartKind: HundredChartKind = 'standard'
): any[] {
  const objects: any[] = [];
  const maskState: HundredChartMaskState = {
    maskedNumbers: new Set<number>(),
    signature: ''
  };
  maskStates.set(objects, maskState);
  const updateWasSuspended = board.isSuspendedUpdate === true;
  let suspendedForCreation = false;

  try {
    if (!updateWasSuspended && typeof board.suspendUpdate === 'function') {
      board.suspendUpdate();
      suspendedForCreation = true;
    }

    const background = board.create(
      'polygon',
      [[0, 0], [HUNDRED_CHART_SIZE, 0], [HUNDRED_CHART_SIZE, HUNDRED_CHART_SIZE], [0, HUNDRED_CHART_SIZE]],
      {
        name: '',
        withLabel: false,
        fixed: true,
        highlight: false,
        fillColor: BACKGROUND_COLOR,
        highlightFillColor: BACKGROUND_COLOR,
        fillOpacity: 1,
        highlightFillOpacity: 1,
        layer: 1,
        vertices: {
          name: '',
          withLabel: false,
          visible: false,
          fixed: true,
          highlight: false,
          size: 0
        },
        borders: {
          visible: false,
          highlight: false
        }
      }
    );
    objects.push(background);

    for (let coordinate = 0; coordinate <= HUNDRED_CHART_SIZE; coordinate += 1) {
      createGridSegment(board, objects, [coordinate, 0], [coordinate, HUNDRED_CHART_SIZE]);
      createGridSegment(board, objects, [0, coordinate], [HUNDRED_CHART_SIZE, coordinate]);
    }

    for (let row = 0; row < HUNDRED_CHART_SIZE; row += 1) {
      for (let column = 0; column < HUNDRED_CHART_SIZE; column += 1) {
        const index = row * HUNDRED_CHART_SIZE + column;
        const value = chartKind === 'negative' ? 50 - index : index + 1;
        const text = board.create(
          'text',
          [
            column + 0.5,
            HUNDRED_CHART_SIZE - row - 0.5,
            function() {
              return maskState.maskedNumbers.has(value)
                ? MASKED_LABEL
                : String(value);
            }
          ],
          {
            name: '',
            fixed: true,
            highlight: false,
            parse: false,
            useMathJax: false,
            display: 'html',
            anchorX: 'middle',
            anchorY: 'middle',
            strokeColor: TEXT_COLOR,
            highlightStrokeColor: TEXT_COLOR,
            fillColor: TEXT_COLOR,
            highlightFillColor: TEXT_COLOR,
            fontSize: 16,
            layer: 3,
            cssStyle: 'color:#111111;font-family:Georgia,"Times New Roman",serif;font-variant-numeric:tabular-nums;line-height:1;pointer-events:none;user-select:none;'
          }
        );
        objects.push(text);
      }
    }

    return objects;
  } catch (error) {
    removeHundredChartObjects(board, objects, false);
    maskStates.delete(objects);
    throw error;
  } finally {
    if (suspendedForCreation) {
      try {
        board.unsuspendUpdate?.();
      } catch (_error) {}
    }
    if (!updateWasSuspended && !suspendedForCreation) {
      try {
        board.update?.();
      } catch (_error) {}
    }
  }
}
