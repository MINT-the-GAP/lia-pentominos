import type { BoardLike } from './hundredChart.ts';
import {
  PENTOMINO_COLORS,
  PENTOMINO_TYPES,
  coveredHundredChartNumbers,
  getAbsolutePentominoCells,
  getPentominoBounds,
  getPentominoCells,
  parsePentominoType
} from './pentominoes.ts';
import type { Cell, PentominoType } from './pentominoes.ts';

const PREVIEW_CELL_SIZE = 12;
const PLACED_PREVIEW_CELL_SIZE = 8;
const GHOST_CELL_SIZE = 13;
const DRAG_THRESHOLD = 4;
const RETURN_TARGET_TOLERANCE = 8;
const DEFAULT_DROP_POINTS: Cell[] = [
  [2, 8], [5, 8], [8, 8],
  [2, 5], [5, 5], [8, 5],
  [2, 2], [5, 2], [8, 2]
];

export interface ClientPointerLike {
  clientX: number;
  clientY: number;
}

export interface PentominoDockRequest {
  type: PentominoType;
  x: number;
  y: number;
  rotation: 0;
  cells: Cell[];
  numbers: number[];
}

export interface PentominoDockOptions {
  types?: PentominoType[];
  onAdd(request: PentominoDockRequest): string | null;
  onSetFixed(name: string, fixed: boolean): boolean;
  onRemove(name: string): boolean;
}

export interface PentominoDockController {
  element: HTMLElement;
  buttons: HTMLButtonElement[];
  toggleButton: HTMLButtonElement;
  panel: HTMLElement;
  placedItems: HTMLElement;
  activatePiece(name: string, event?: unknown): boolean;
  isAttached(): boolean;
  dispose(): void;
}

export interface PentominoDockTypeParseResult {
  types: PentominoType[];
  errors: string[];
}

interface BoardRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface ActiveDrag {
  pointerId: number;
  type: PentominoType;
  source: HTMLButtonElement;
  ghost: HTMLElement;
  startX: number;
  startY: number;
  moved: boolean;
}

interface ActivePlacedInteraction {
  name: string;
  family: 'pointer' | 'mouse' | 'touch';
  pointerId: number | null;
  generation: number;
}

interface ActiveDockSelection {
  owner: object;
  clear(): void;
}

let activeDockSelection: ActiveDockSelection | null = null;

export function parsePentominoDockTypes(
  rawValue: string | undefined
): PentominoDockTypeParseResult {
  let normalized = String(rawValue ?? '').trim();
  const errors: string[] = [];

  if (!normalized) {
    return { types: PENTOMINO_TYPES.slice(), errors };
  }
  if (
    normalized.length >= 2 &&
    normalized.charCodeAt(0) === 96 &&
    normalized.charCodeAt(normalized.length - 1) === 96
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  if (!normalized || /^all$/i.test(normalized) || normalized === '*') {
    return { types: PENTOMINO_TYPES.slice(), errors };
  }

  const startsWithBracket = normalized.startsWith('[');
  const endsWithBracket = normalized.endsWith(']');
  if (startsWithBracket !== endsWithBracket) {
    return {
      types: [],
      errors: ['Die Dock-Auswahl braucht zwei eckige Klammern, zum Beispiel [I2,L3,T5].']
    };
  }
  if (startsWithBracket) normalized = normalized.slice(1, -1).trim();
  if (!normalized) {
    return {
      types: [],
      errors: ['Die Dock-Auswahl darf nicht leer sein.']
    };
  }

  const types: PentominoType[] = [];
  const unknown: string[] = [];
  normalized.split(/[\s,;]+/).filter(Boolean).forEach(function(token) {
    const type = parsePentominoType(token);
    if (!type) {
      unknown.push(token);
      return;
    }
    if (!types.includes(type)) types.push(type);
  });

  if (unknown.length) {
    errors.push(
      'Unbekannte Pentomino-Namen: ' + unknown.join(', ') + '. Erlaubt sind ' +
      PENTOMINO_TYPES.join(', ') + '.'
    );
  }
  if (!types.length && !errors.length) {
    errors.push('Die Dock-Auswahl enthält kein gültiges Pentomino.');
  }
  return { types, errors };
}

function boardRect(board: BoardLike): BoardRect | null {
  const container = board && board.containerObj as HTMLElement | undefined;
  if (!container || typeof container.getBoundingClientRect !== 'function') {
    return null;
  }

  try {
    const rect = container.getBoundingClientRect();
    const left = Number(rect.left);
    const top = Number(rect.top);
    const right = Number.isFinite(rect.right)
      ? Number(rect.right)
      : left + Number(rect.width);
    const bottom = Number.isFinite(rect.bottom)
      ? Number(rect.bottom)
      : top + Number(rect.height);
    const width = right - left;
    const height = bottom - top;

    if (
      ![left, top, right, bottom, width, height].every(Number.isFinite) ||
      width <= 0 ||
      height <= 0
    ) {
      return null;
    }
    return { left, top, right, bottom, width, height };
  } catch (_error) {
    return null;
  }
}

function clientPointerFromEvent(
  value: unknown,
  preferChangedTouches = false
): (ClientPointerLike & { pointerId: number | null }) | null {
  const wrapped = value && typeof value === 'object'
    ? value as Record<string, any>
    : null;
  const event = wrapped?.originalEvent || wrapped?.event || wrapped?.evt || wrapped;
  if (!event) return null;

  const directX = Number(event.clientX);
  const directY = Number(event.clientY);
  if (Number.isFinite(directX) && Number.isFinite(directY)) {
    const directId = Number(event.pointerId);
    return {
      clientX: directX,
      clientY: directY,
      pointerId: Number.isFinite(directId) ? directId : null
    };
  }

  const touchLists = preferChangedTouches
    ? [event.changedTouches, event.touches]
    : [event.touches, event.changedTouches];
  for (const list of touchLists) {
    const touch = list && list.length ? list[0] : null;
    const touchX = Number(touch?.clientX);
    const touchY = Number(touch?.clientY);
    if (!Number.isFinite(touchX) || !Number.isFinite(touchY)) continue;
    const touchId = Number(touch?.identifier);
    return {
      clientX: touchX,
      clientY: touchY,
      pointerId: Number.isFinite(touchId) ? touchId : null
    };
  }
  return null;
}

function interactionFamily(value: unknown): 'pointer' | 'mouse' | 'touch' {
  const event = value && typeof value === 'object'
    ? value as Record<string, any>
    : null;
  const wrapped = event?.originalEvent || event?.event || event?.evt || event;
  const type = String(wrapped?.type || '').toLowerCase();
  if (type.startsWith('touch') || wrapped?.touches || wrapped?.changedTouches) {
    return 'touch';
  }
  if (type.startsWith('pointer') || Number.isFinite(Number(wrapped?.pointerId))) {
    return 'pointer';
  }
  return 'mouse';
}

function pointInsideElement(
  element: HTMLElement,
  pointer: ClientPointerLike | null,
  tolerance = 0
): boolean {
  if (!pointer || typeof element.getBoundingClientRect !== 'function') return false;
  try {
    const rect = element.getBoundingClientRect();
    return (
      pointer.clientX >= Number(rect.left) - tolerance &&
      pointer.clientX <= Number(rect.right) + tolerance &&
      pointer.clientY >= Number(rect.top) - tolerance &&
      pointer.clientY <= Number(rect.bottom) + tolerance
    );
  } catch (_error) {
    return false;
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element !== 'object') return false;
  const tagName = String(element.tagName || '').toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  if (element.isContentEditable) return true;
  return element.getAttribute?.('contenteditable') === 'true';
}

function coordinatesFromUnknown(value: unknown): Cell | null {
  if (Array.isArray(value)) {
    const offset = value.length >= 3 && Number(value[0]) === 1 ? 1 : 0;
    const x = Number(value[offset]);
    const y = Number(value[offset + 1]);
    return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  }

  const usrCoords = (
    value && typeof value === 'object' &&
    (value as { usrCoords?: unknown }).usrCoords
  );
  return usrCoords ? coordinatesFromUnknown(usrCoords) : null;
}

export function boardCoordinatesFromPointer(
  board: BoardLike,
  event: ClientPointerLike
): Cell | null {
  const rect = boardRect(board);
  const clientX = Number(event && event.clientX);
  const clientY = Number(event && event.clientY);

  if (
    !rect ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY) ||
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null;
  }

  const coordinateBoard = board as BoardLike & {
    getUsrCoordsOfMouse?(source: ClientPointerLike): unknown;
  };
  if (typeof coordinateBoard.getUsrCoordsOfMouse === 'function') {
    try {
      const coordinates = coordinatesFromUnknown(
        coordinateBoard.getUsrCoordsOfMouse(event)
      );
      if (coordinates) return coordinates;
    } catch (_error) {}
  }

  let boundingBox = [0, 10, 10, 0];
  try {
    const candidate = board.getBoundingBox?.();
    if (
      Array.isArray(candidate) &&
      candidate.length >= 4 &&
      candidate.slice(0, 4).every(Number.isFinite) &&
      candidate[2] > candidate[0] &&
      candidate[1] > candidate[3]
    ) {
      boundingBox = candidate.slice(0, 4);
    }
  } catch (_error) {}

  const horizontalRatio = (clientX - rect.left) / rect.width;
  const verticalRatio = (clientY - rect.top) / rect.height;
  return [
    boundingBox[0] + horizontalRatio * (boundingBox[2] - boundingBox[0]),
    boundingBox[1] - verticalRatio * (boundingBox[1] - boundingBox[3])
  ];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function pentominoDockPlacement(
  type: PentominoType,
  userX: number,
  userY: number
): PentominoDockRequest | null {
  if (
    !PENTOMINO_TYPES.includes(type) ||
    !Number.isFinite(userX) ||
    !Number.isFinite(userY)
  ) {
    return null;
  }

  const localCells = getPentominoCells(type, 0);
  const bounds = getPentominoBounds(localCells);
  const centroid = localCells.reduce(function(total, cell) {
    total[0] += cell[0] + 0.5;
    total[1] += cell[1] + 0.5;
    return total;
  }, [0, 0] as Cell);
  centroid[0] /= localCells.length;
  centroid[1] /= localCells.length;

  const x = clamp(
    Math.round(userX - centroid[0]),
    0,
    10 - bounds.width
  );
  const y = clamp(
    Math.round(userY - centroid[1]),
    0,
    10 - bounds.height
  );
  const cells = getAbsolutePentominoCells(type, 0, x, y);
  const numbers = coveredHundredChartNumbers(cells);
  if (numbers.length !== localCells.length) return null;

  return { type, x, y, rotation: 0, cells, numbers };
}

function ensureDockStyles(): void {
  const styleId = 'lia-pentomino-dock-styles';
  const existing = document.getElementById(styleId) as HTMLStyleElement | null;
  const style = existing || document.createElement('style');
  style.id = styleId;
  style.textContent =
    '.lia-pentomino-workspace{--pentomino-board-size:520px;display:grid!important;' +
    'grid-template-columns:var(--pentomino-board-size) minmax(4.4rem,35.4rem);' +
    'align-items:start;justify-content:center;gap:clamp(.75rem,2vw,1.35rem);' +
    'box-sizing:border-box;width:100%;' +
    'max-width:calc(var(--pentomino-board-size) + 36.75rem);' +
    'margin:.6rem auto 1rem}' +
    '.lia-pentomino-workspace-board,.lia-pentomino-workspace-sidebar{' +
    'box-sizing:border-box;min-width:0}' +
    '.lia-pentomino-workspace-board{' +
    'width:var(--pentomino-board-size);max-width:100%}' +
    '.lia-pentomino-workspace-sidebar{width:100%;max-width:35.4rem}' +
    '.lia-pentomino-dock-keep{display:block;box-sizing:border-box;width:100%}' +
    '.lia-pentomino-dock{--pentomino-accent:rgb(var(--color-highlight,0,150,170));' +
    'display:flex;align-items:stretch;box-sizing:border-box;width:4.4rem;' +
    'height:var(--pentomino-board-size,520px);max-width:100%;' +
    'max-height:var(--pentomino-board-size,520px);margin:0;overflow:visible;' +
    'color:rgb(var(--color-text,32,32,32));transition:width .16s ease}' +
    '.lia-pentomino-dock.is-expanded{width:min(35.4rem,100%)}' +
    '.lia-pentomino-dock-toggle{display:flex!important;align-items:center;' +
    'align-self:stretch;justify-content:center;flex:0 0 4.4rem;' +
    'flex-direction:column;gap:.65rem;width:4.4rem!important;height:100%!important;min-height:0;' +
    'margin:0!important;padding:.7rem .35rem!important;' +
    'border:1px solid rgba(var(--color-border,96,96,96),.42)!important;' +
    'border-radius:.6rem!important;background:rgba(var(--color-highlight,0,150,170),.12)!important;' +
    'color:rgb(var(--color-text,32,32,32))!important;font:inherit;' +
    'font-weight:600;font-size:1.4rem;line-height:1.25;' +
    'text-align:center;cursor:pointer;box-shadow:0 .18rem .65rem rgba(0,0,0,.12)}' +
    '.lia-pentomino-dock.is-expanded .lia-pentomino-dock-toggle{' +
    'border-right-color:transparent!important;border-radius:.6rem 0 0 .6rem!important}' +
    '.lia-pentomino-dock-toggle:hover{' +
    'background:rgba(var(--color-highlight,0,150,170),.2)!important}' +
    '.lia-pentomino-dock-toggle:focus-visible,.lia-pentomino-dock-item:focus-visible,' +
    '.lia-pentomino-dock-placed-item:focus-visible{' +
    'outline:.18rem solid var(--pentomino-accent)!important;outline-offset:-.18rem}' +
    '.lia-pentomino-dock-toggle-label{writing-mode:vertical-rl;' +
    'text-orientation:mixed;white-space:nowrap;letter-spacing:.04em;' +
    'transform:rotate(180deg);transform-origin:center}' +
    '.lia-pentomino-dock-chevron{display:inline-block;flex:none;font-size:1.15rem;' +
    'line-height:1;' +
    'transition:transform .16s ease}' +
    '.lia-pentomino-dock-toggle[aria-expanded=true] .lia-pentomino-dock-chevron{' +
    'transform:rotate(180deg)}' +
    '.lia-pentomino-dock-panel[hidden]{display:none!important}' +
    '.lia-pentomino-dock-panel{box-sizing:border-box;flex:1 1 31rem;min-width:0;' +
    'height:var(--pentomino-board-size,520px);' +
    'max-height:var(--pentomino-board-size,520px);' +
    'overflow-x:hidden;overflow-y:auto;' +
    'scrollbar-gutter:stable;padding:.5rem;' +
    'border:1px solid rgba(var(--color-border,96,96,96),.42);' +
    'border-radius:0 .6rem .6rem .6rem;background:rgb(var(--color-background,255,255,255));' +
    'box-shadow:0 .18rem .65rem rgba(0,0,0,.12)}' +
    '.lia-pentomino-dock-items{display:grid;' +
    'grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:6rem;' +
    'gap:.3rem;padding:0}' +
    '.lia-pentomino-dock-item{display:flex!important;align-items:center;' +
    'justify-content:center;box-sizing:border-box;min-width:0!important;' +
    'height:6rem;min-height:0;margin:0!important;padding:.15rem!important;' +
    'border:1px solid rgba(var(--color-border,96,96,96),.38)!important;' +
    'border-radius:.42rem!important;background:rgba(var(--color-text,32,32,32),.035)!important;' +
    'color:inherit!important;cursor:grab;touch-action:pan-y;' +
    'transition:transform .12s ease,box-shadow .12s ease,background .12s ease}' +
    '.lia-pentomino-dock-item:hover{' +
    'background:rgba(var(--color-highlight,0,150,170),.1)!important;' +
    'transform:translateY(-1px);box-shadow:0 .15rem .38rem rgba(0,0,0,.13)}' +
    '.lia-pentomino-dock.is-return-target .lia-pentomino-dock-toggle{' +
    'background:rgba(var(--color-highlight,0,150,170),.3)!important;' +
    'box-shadow:inset 0 0 0 .2rem var(--pentomino-accent),' +
    '0 .18rem .65rem rgba(0,0,0,.16)}' +
    '.lia-pentomino-dock.is-return-target .lia-pentomino-dock-panel{' +
    'outline:.2rem solid var(--pentomino-accent);outline-offset:-.2rem}' +
    '.lia-pentomino-dock-preview{position:relative;display:block;flex:none}' +
    '.lia-pentomino-dock-cell{position:absolute;box-sizing:border-box;' +
    'border:1px solid rgba(var(--color-text,32,32,32),.58);border-radius:1px}' +
    '.lia-pentomino-dock-ghost{position:fixed;z-index:2147483647;' +
    'display:flex;align-items:center;justify-content:center;padding:.55rem;' +
    'border-radius:.55rem;background:rgba(var(--color-background,255,255,255),.94);' +
    'box-shadow:0 7px 20px rgba(0,0,0,.28);pointer-events:none;' +
    'transform:translate(-50%,-50%) scale(1.08);opacity:.78}' +
    '.lia-pentomino-dock-ghost.is-over-board{opacity:1;' +
    'box-shadow:0 0 0 .18rem rgba(var(--color-highlight,0,150,170),.48),' +
    '0 .5rem 1.35rem rgba(0,0,0,.3)}' +
    '.lia-pentomino-dock-placed{margin-top:.45rem;' +
    'padding-top:.45rem;border-top:1px solid rgba(var(--color-border,96,96,96),.3)}' +
    '.lia-pentomino-dock-placed-title{display:block;margin:0 0 .3rem;' +
    'font:inherit;font-weight:600;font-size:1.2rem;line-height:1.25;opacity:.82}' +
    '.lia-pentomino-dock-placed-items{display:grid;gap:.25rem}' +
    '.lia-pentomino-dock-placed-item{display:flex;align-items:center;justify-content:center;' +
    'min-height:4.5rem;padding:.25rem .4rem;cursor:pointer;' +
    'border:1px solid rgba(var(--color-border,96,96,96),.34);border-radius:.42rem;' +
    'background:rgba(var(--color-text,32,32,32),.035)}' +
    '.lia-pentomino-dock-placed-item:hover{' +
    'background:rgba(var(--color-highlight,0,150,170),.08)}' +
    '.lia-pentomino-dock-placed-item.is-selected{' +
    'border-color:rgba(var(--color-highlight,0,150,170),.72);' +
    'background:rgba(var(--color-highlight,0,150,170),.16);' +
    'box-shadow:inset 0 0 0 .12rem var(--pentomino-accent)}' +
    '@media(max-width:70rem){.lia-pentomino-workspace{' +
    'grid-template-columns:minmax(0,max(var(--pentomino-board-size),35.4rem));' +
    'max-width:max(var(--pentomino-board-size),35.4rem)}' +
    '.lia-pentomino-workspace-board{justify-self:center}' +
    '.lia-pentomino-workspace-sidebar{max-width:35.4rem}' +
    '.lia-pentomino-dock.is-expanded{width:min(35.4rem,100%)}}' +
    '@media(max-width:34rem){.lia-pentomino-workspace{display:block!important}' +
    '.lia-pentomino-workspace-sidebar{margin-top:.7rem}' +
    '.lia-pentomino-dock.is-expanded{width:100%}}' +
    '@media(prefers-reduced-motion:reduce){.lia-pentomino-dock,' +
    '.lia-pentomino-dock-chevron{transition:none!important}}';
  if (!existing) (document.head || document.documentElement).appendChild(style);
}

function createPreview(
  type: PentominoType,
  className: string,
  cellSize = PREVIEW_CELL_SIZE
): HTMLElement {
  const cells = getPentominoCells(type, 0);
  const bounds = getPentominoBounds(cells);
  const preview = document.createElement('span');
  preview.className = className;
  preview.setAttribute('aria-hidden', 'true');
  preview.style.width = String(bounds.width * cellSize) + 'px';
  preview.style.height = String(bounds.height * cellSize) + 'px';

  cells.forEach(function(cell) {
    const square = document.createElement('span');
    square.className = 'lia-pentomino-dock-cell';
    square.style.left = String(cell[0] * cellSize) + 'px';
    square.style.top = String(
      (bounds.height - 1 - cell[1]) * cellSize
    ) + 'px';
    square.style.width = String(cellSize) + 'px';
    square.style.height = String(cellSize) + 'px';
    square.style.backgroundColor = PENTOMINO_COLORS[type];
    square.style.opacity = '0.72';
    preview.appendChild(square);
  });
  return preview;
}

function removeChildren(element: HTMLElement): void {
  while (element.firstChild) element.removeChild(element.firstChild);
}

export function createPentominoDock(
  marker: HTMLElement,
  board: BoardLike,
  options: PentominoDockOptions
): PentominoDockController {
  ensureDockStyles();

  const buttons: HTMLButtonElement[] = [];
  const cleanups: Array<() => void> = [];
  const placedRows = new Map<string, HTMLElement>();
  const placedRowCleanups = new Map<string, () => void>();
  const knownNames = new Set<string>();
  const selectionOwner = {};
  const suppressedClicks = new WeakSet<HTMLButtonElement>();
  let activeDrag: ActiveDrag | null = null;
  let activePlacedInteraction: ActivePlacedInteraction | null = null;
  let selectedName: string | null = null;
  let interactionGeneration = 0;
  let successfulAdds = 0;
  let disposed = false;

  let toggleButton = marker.querySelector<HTMLButtonElement>(
    '.lia-pentomino-dock-toggle'
  );
  if (!toggleButton) {
    toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className =
      'lia-btn lia-btn--outline lia-pentomino-dock-toggle';
    const label = document.createElement('span');
    label.className = 'lia-pentomino-dock-toggle-label';
    label.textContent = 'Pentominos';
    toggleButton.appendChild(label);
    const chevron = document.createElement('span');
    chevron.className = 'lia-pentomino-dock-chevron';
    chevron.textContent = '›';
    chevron.setAttribute('aria-hidden', 'true');
    toggleButton.appendChild(chevron);
    toggleButton.setAttribute('aria-expanded', 'false');
    marker.appendChild(toggleButton);
  } else {
    toggleButton.classList.add('lia-btn');
    toggleButton.classList.add('lia-btn--outline');
    toggleButton.classList.add('lia-pentomino-dock-toggle');
  }
  const toggleLabel = toggleButton.querySelector<HTMLElement>('span');
  if (
    toggleLabel &&
    !toggleLabel.classList.contains('lia-pentomino-dock-chevron')
  ) {
    toggleLabel.classList.add('lia-pentomino-dock-toggle-label');
    toggleLabel.textContent = 'Pentominos';
  }
  const toggleChevron = toggleButton.querySelector<HTMLElement>(
    '.lia-pentomino-dock-chevron'
  );
  if (toggleChevron) toggleChevron.textContent = '›';

  let panel = marker.querySelector<HTMLElement>('.lia-pentomino-dock-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'lia-pentomino-dock-panel';
    marker.appendChild(panel);
  }
  panel.querySelector<HTMLElement>('.lia-pentomino-dock-hint')?.remove();
  if (!panel.id) {
    panel.id = (marker.id || 'lia-pentomino-dock') + '-panel';
  }
  toggleButton.setAttribute('aria-controls', panel.id);
  const setExpanded = function(expanded: boolean): void {
    toggleButton!.setAttribute('aria-expanded', String(expanded));
    toggleButton!.setAttribute(
      'aria-label',
      expanded
        ? 'Pentomino-Inventar schließen'
        : 'Pentomino-Inventar nach rechts öffnen'
    );
    toggleButton!.setAttribute(
      'title',
      expanded ? 'Pentominos einklappen' : 'Pentominos nach rechts aufklappen'
    );
    marker.classList.toggle('is-expanded', expanded);
    panel!.hidden = !expanded;
  };
  setExpanded(toggleButton.getAttribute('aria-expanded') === 'true');
  const onToggle = function(event: MouseEvent): void {
    event.preventDefault();
    if (disposed) return;
    setExpanded(toggleButton!.getAttribute('aria-expanded') !== 'true');
  };
  toggleButton.addEventListener('click', onToggle);
  cleanups.push(function() {
    toggleButton!.removeEventListener('click', onToggle);
  });

  let items = marker.querySelector<HTMLElement>('.lia-pentomino-dock-items');
  if (!items) {
    items = document.createElement('div');
    items.className = 'lia-pentomino-dock-items';
    panel.appendChild(items);
  } else if (items.parentElement !== panel) {
    panel.appendChild(items);
  }
  items.setAttribute('role', 'group');
  items.setAttribute('aria-label', 'Pentomino-Inventar');
  removeChildren(items);

  let placed = marker.querySelector<HTMLElement>('.lia-pentomino-dock-placed');
  if (!placed) {
    placed = document.createElement('div');
    placed.className = 'lia-pentomino-dock-placed';
    panel.appendChild(placed);
  } else if (placed.parentElement !== panel) {
    panel.appendChild(placed);
  }
  let title = placed.querySelector<HTMLElement>(
    '.lia-pentomino-dock-placed-title'
  ) || placed.querySelector<HTMLElement>('strong');
  if (!title) {
    title = document.createElement('strong');
    title.className = 'lia-pentomino-dock-placed-title';
    title.textContent = 'Pentominos im Feld';
    placed.appendChild(title);
  } else {
    title.classList.add('lia-pentomino-dock-placed-title');
    title.textContent = 'Pentominos im Feld';
  }
  let placedItems = placed.querySelector<HTMLElement>(
    '.lia-pentomino-dock-placed-items'
  );
  if (!placedItems) {
    placedItems = document.createElement('div');
    placedItems.className = 'lia-pentomino-dock-placed-items';
    placedItems.setAttribute('role', 'listbox');
    placed.appendChild(placedItems);
  }
  placedItems.setAttribute('role', 'listbox');
  placedItems.setAttribute('aria-label', 'Pentominos im Feld');
  removeChildren(placedItems);
  placed.hidden = true;

  const requestedTypes = options.types === undefined
    ? PENTOMINO_TYPES.slice()
    : options.types.slice();
  const availableTypes = requestedTypes.filter(function(type, index) {
    return requestedTypes.indexOf(type) === index;
  });
  if (
    !availableTypes.length ||
    availableTypes.some(function(type) { return !PENTOMINO_TYPES.includes(type); })
  ) {
    throw new Error('Das Dock braucht mindestens einen gültigen Pentomino-Namen.');
  }

  const syncPlacedSelection = function(): void {
    placedRows.forEach(function(row, name) {
      const selected = selectedName === name;
      row.classList.toggle('is-selected', selected);
      row.setAttribute('aria-selected', String(selected));
    });
  };

  const removePlacedInteractionListeners = function(): void {
    window.removeEventListener('pointermove', onPlacedPointerMove, true);
    window.removeEventListener('pointerup', onPlacedPointerUp, true);
    window.removeEventListener('pointercancel', onPlacedPointerCancel, true);
    window.removeEventListener('mousemove', onPlacedPointerMove, true);
    window.removeEventListener('mouseup', onPlacedPointerUp, true);
    window.removeEventListener('touchmove', onPlacedPointerMove, true);
    window.removeEventListener('touchend', onPlacedPointerUp, true);
    window.removeEventListener('touchcancel', onPlacedPointerCancel, true);
  };

  const endPlacedInteraction = function(invalidate = true): void {
    removePlacedInteractionListeners();
    activePlacedInteraction = null;
    marker.classList.remove('is-return-target');
    if (invalidate) interactionGeneration += 1;
  };

  const clearPlacedSelection = function(): void {
    endPlacedInteraction(true);
    selectedName = null;
    if (activeDockSelection?.owner === selectionOwner) {
      activeDockSelection = null;
    }
    syncPlacedSelection();
  };

  const selectPlaced = function(name: string): boolean {
    if (disposed || !knownNames.has(name)) return false;
    if (activeDockSelection && activeDockSelection.owner !== selectionOwner) {
      const previous = activeDockSelection;
      activeDockSelection = null;
      previous.clear();
    }
    selectedName = name;
    activeDockSelection = { owner: selectionOwner, clear: clearPlacedSelection };
    syncPlacedSelection();
    return true;
  };

  const forgetPlacedItem = function(name: string): void {
    const row = placedRows.get(name);
    placedRowCleanups.get(name)?.();
    placedRowCleanups.delete(name);
    placedRows.delete(name);
    knownNames.delete(name);
    row?.remove();
    if (selectedName === name) clearPlacedSelection();
    placed!.hidden = placedRows.size === 0;
  };

  const removePlacedItem = function(name: string): boolean {
    if (disposed || !knownNames.has(name)) return false;
    let removed = false;
    try {
      removed = options.onRemove(name);
    } catch (_error) {}
    if (!removed) return false;
    forgetPlacedItem(name);
    return true;
  };

  const pointerMatchesInteraction = function(
    pointer: (ClientPointerLike & { pointerId: number | null }) | null
  ): boolean {
    if (!activePlacedInteraction || !pointer) return false;
    return (
      activePlacedInteraction.pointerId === null ||
      pointer.pointerId === null ||
      activePlacedInteraction.pointerId === pointer.pointerId
    );
  };

  const onPlacedPointerMove = function(event: Event): void {
    const pointer = clientPointerFromEvent(event);
    if (!pointerMatchesInteraction(pointer)) return;
    marker.classList.toggle(
      'is-return-target',
      pointInsideElement(marker, pointer, RETURN_TARGET_TOLERANCE)
    );
  };

  const onPlacedPointerUp = function(event: Event): void {
    const pointer = clientPointerFromEvent(event, true);
    if (!pointerMatchesInteraction(pointer) || !activePlacedInteraction) return;
    const interaction = activePlacedInteraction;
    const shouldRemove = pointInsideElement(
      marker,
      pointer,
      RETURN_TARGET_TOLERANCE
    );
    endPlacedInteraction(false);
    if (!shouldRemove) return;

    Promise.resolve().then(function() {
      if (
        disposed ||
        interaction.generation !== interactionGeneration ||
        !knownNames.has(interaction.name)
      ) {
        return;
      }
      removePlacedItem(interaction.name);
    });
  };

  const onPlacedPointerCancel = function(event: Event): void {
    const pointer = clientPointerFromEvent(event, true);
    if (
      activePlacedInteraction &&
      pointer &&
      !pointerMatchesInteraction(pointer)
    ) {
      return;
    }
    endPlacedInteraction(true);
  };

  const addPlacedInteractionListeners = function(
    family: ActivePlacedInteraction['family']
  ): void {
    if (family === 'pointer') {
      window.addEventListener('pointermove', onPlacedPointerMove, true);
      window.addEventListener('pointerup', onPlacedPointerUp, true);
      window.addEventListener('pointercancel', onPlacedPointerCancel, true);
      return;
    }
    if (family === 'touch') {
      window.addEventListener('touchmove', onPlacedPointerMove, true);
      window.addEventListener('touchend', onPlacedPointerUp, true);
      window.addEventListener('touchcancel', onPlacedPointerCancel, true);
      return;
    }
    window.addEventListener('mousemove', onPlacedPointerMove, true);
    window.addEventListener('mouseup', onPlacedPointerUp, true);
  };

  const activatePiece = function(name: string, event?: unknown): boolean {
    if (disposed || !knownNames.has(name)) return false;
    endPlacedInteraction(true);
    if (!selectPlaced(name)) return false;
    const pointer = clientPointerFromEvent(event);
    const family = interactionFamily(event);
    const generation = ++interactionGeneration;
    activePlacedInteraction = {
      name,
      family,
      pointerId: pointer?.pointerId ?? null,
      generation
    };
    marker.classList.toggle(
      'is-return-target',
      pointInsideElement(marker, pointer, RETURN_TARGET_TOLERANCE)
    );
    addPlacedInteractionListeners(family);
    return true;
  };

  const onPlacedKeyDown = function(event: KeyboardEvent): void {
    if (disposed || activeDockSelection?.owner !== selectionOwner) return;
    if (event.key === 'Escape') {
      clearPlacedSelection();
      event.preventDefault();
      return;
    }
    if (
      event.key !== 'Delete' ||
      event.altKey || event.ctrlKey || event.metaKey ||
      activePlacedInteraction ||
      isEditableTarget(event.target)
    ) {
      return;
    }
    const name = selectedName;
    if (!name || !removePlacedItem(name)) return;
    event.preventDefault();
    event.stopPropagation?.();
  };
  window.addEventListener('keydown', onPlacedKeyDown, true);
  cleanups.push(function() {
    window.removeEventListener('keydown', onPlacedKeyDown, true);
  });

  const addPlacedItem = function(type: PentominoType, name: string): void {
    knownNames.add(name);
    const row = document.createElement('div');
    row.className = 'lia-pentomino-dock-placed-item';
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', 'false');
    row.setAttribute(
      'aria-label',
      type + '-Pentomino im Feld auswählen; Entf löscht es'
    );
    row.setAttribute('title', 'Auswählen und mit Entf löschen');
    row.tabIndex = 0;
    row.appendChild(
      createPreview(
        type,
        'lia-pentomino-dock-preview',
        PLACED_PREVIEW_CELL_SIZE
      )
    );

    const onSelect = function(): void { selectPlaced(name); };
    row.addEventListener('pointerdown', onSelect);
    row.addEventListener('focus', onSelect);
    row.addEventListener('click', onSelect);
    placedRowCleanups.set(name, function() {
      row.removeEventListener('pointerdown', onSelect);
      row.removeEventListener('focus', onSelect);
      row.removeEventListener('click', onSelect);
    });
    placedItems!.appendChild(row);
    placedRows.set(name, row);
    placed!.hidden = false;
  };

  const addAt = function(
    type: PentominoType,
    userX: number,
    userY: number
  ): boolean {
    if (disposed) return false;
    const request = pentominoDockPlacement(type, userX, userY);
    if (!request) return false;
    const name = options.onAdd(request);
    if (typeof name !== 'string' || !name.trim()) return false;
    addPlacedItem(type, name);
    return true;
  };

  const positionGhost = function(
    drag: ActiveDrag,
    event: ClientPointerLike
  ): void {
    drag.ghost.style.left = String(event.clientX) + 'px';
    drag.ghost.style.top = String(event.clientY) + 'px';
    drag.ghost.classList.toggle(
      'is-over-board',
      boardCoordinatesFromPointer(board, event) !== null
    );
  };

  const removeWindowListeners = function(): void {
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerCancel, true);
    window.removeEventListener('keydown', onKeyDown, true);
  };

  const endActiveDrag = function(): ActiveDrag | null {
    const drag = activeDrag;
    if (!drag) return null;
    activeDrag = null;
    removeWindowListeners();
    try { drag.source.releasePointerCapture?.(drag.pointerId); } catch (_error) {}
    try { drag.ghost.remove(); } catch (_error) {}
    return drag;
  };

  const onPointerMove = function(event: PointerEvent): void {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    const deltaX = Number(event.clientX) - activeDrag.startX;
    const deltaY = Number(event.clientY) - activeDrag.startY;
    if (Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD) {
      activeDrag.moved = true;
    }
    positionGhost(activeDrag, event);
    event.preventDefault();
  };

  const onPointerUp = function(event: PointerEvent): void {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    const coordinates = boardCoordinatesFromPointer(board, event);
    const drag = endActiveDrag();
    if (!drag) return;

    let added = false;
    if (coordinates) {
      added = addAt(drag.type, coordinates[0], coordinates[1]);
      if (added) successfulAdds += 1;
    }
    if (drag.moved || added) suppressedClicks.add(drag.source);
    event.preventDefault();
  };

  const onPointerCancel = function(event: PointerEvent): void {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    const drag = endActiveDrag();
    if (drag && drag.moved) suppressedClicks.add(drag.source);
  };

  const onKeyDown = function(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !activeDrag) return;
    const drag = endActiveDrag();
    if (drag) suppressedClicks.add(drag.source);
    event.preventDefault();
  };

  availableTypes.forEach(function(type) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lia-btn lia-btn--outline lia-pentomino-dock-item';
    button.dataset.pentominoType = type;
    button.draggable = false;
    button.setAttribute(
      'aria-label',
      type + '-Pentomino ins Hunderterfeld ziehen oder durch Antippen einfügen'
    );
    button.appendChild(createPreview(type, 'lia-pentomino-dock-preview'));

    const onPointerDown = function(event: PointerEvent): void {
      if (disposed || (Number.isFinite(event.button) && event.button !== 0)) {
        return;
      }
      endActiveDrag();

      const ghost = document.createElement('div');
      ghost.className = 'lia-pentomino-dock-ghost';
      ghost.appendChild(
        createPreview(type, 'lia-pentomino-dock-preview', GHOST_CELL_SIZE)
      );
      (document.body || document.documentElement).appendChild(ghost);

      activeDrag = {
        pointerId: event.pointerId,
        type,
        source: button,
        ghost,
        startX: Number(event.clientX),
        startY: Number(event.clientY),
        moved: false
      };
      positionGhost(activeDrag, event);
      try { button.setPointerCapture?.(event.pointerId); } catch (_error) {}
      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', onPointerUp, true);
      window.addEventListener('pointercancel', onPointerCancel, true);
      window.addEventListener('keydown', onKeyDown, true);
      event.preventDefault();
    };

    const onClick = function(event: MouseEvent): void {
      if (suppressedClicks.has(button)) {
        suppressedClicks.delete(button);
        event.preventDefault();
        return;
      }
      const point = DEFAULT_DROP_POINTS[
        successfulAdds % DEFAULT_DROP_POINTS.length
      ];
      if (addAt(type, point[0], point[1])) successfulAdds += 1;
    };

    const onDragStart = function(event: DragEvent): void {
      event.preventDefault();
    };

    const onLostPointerCapture = function(event: PointerEvent): void {
      if (activeDrag && event.pointerId === activeDrag.pointerId) {
        endActiveDrag();
      }
    };

    button.addEventListener('pointerdown', onPointerDown);
    button.addEventListener('click', onClick);
    button.addEventListener('dragstart', onDragStart);
    button.addEventListener('lostpointercapture', onLostPointerCapture);
    cleanups.push(function() {
      button.removeEventListener('pointerdown', onPointerDown);
      button.removeEventListener('click', onClick);
      button.removeEventListener('dragstart', onDragStart);
      button.removeEventListener('lostpointercapture', onLostPointerCapture);
    });

    items!.appendChild(button);
    buttons.push(button);
  });

  return {
    element: marker,
    buttons,
    toggleButton,
    panel,
    placedItems,
    activatePiece,
    isAttached: function() {
      return (
        !disposed &&
        marker.isConnected &&
        !!board.containerObj &&
        board.containerObj.isConnected !== false
      );
    },
    dispose: function() {
      if (disposed) return;
      disposed = true;
      interactionGeneration += 1;
      endActiveDrag();
      clearPlacedSelection();
      marker.classList.remove('is-return-target');
      placedRowCleanups.forEach(function(cleanup) { cleanup(); });
      placedRowCleanups.clear();
      cleanups.splice(0).forEach(function(cleanup) { cleanup(); });
      removeChildren(items!);
      removeChildren(placedItems!);
      placed!.hidden = true;
      placedRows.clear();
      knownNames.clear();
    }
  };
}
