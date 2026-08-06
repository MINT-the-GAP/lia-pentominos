import {
  BoardLike,
  HundredChartKind,
  boardIsConnected,
  createHundredChart,
  hundredChartIsAttached,
  removeHundredChart,
  setHundredChartMaskedNumbers
} from './hundredChart';
import {
  createPentominoDock,
  parsePentominoDockTypes
} from './dock';
import type {
  PentominoDockController,
  PentominoDockRequest
} from './dock';
import {
  DEFAULT_PENTOMINO_OPACITY,
  PENTOMINO_COLORS,
  PentominoConfig,
  PentominoPiece,
  PentominoState,
  PentominoType,
  createPentomino,
  hundredChartCoverageSum,
  parsePentominoSpecs
} from './pentominoes';

const HUNDRED_MARKER_CLASS = 'lia-pentomino-hundred-chart';
const CONFIG_MARKER_CLASS = 'lia-pentomino-config';
const DOCK_MARKER_CLASS = 'lia-pentomino-dock';
const BOARD_CLASS = 'jxgbox';
const HUNDRED_MARKER_SELECTOR =
  '.lia-pentomino-hundred-chart[data-board-id]';
const CONFIG_MARKER_SELECTOR =
  '.lia-pentomino-config[data-board-id]';
const DOCK_MARKER_SELECTOR =
  '.lia-pentomino-dock[data-board-id]';
const BOARD_SELECTOR = '.jxgbox';
const RELEVANT_SELECTOR = [
  HUNDRED_MARKER_SELECTOR,
  CONFIG_MARKER_SELECTOR,
  DOCK_MARKER_SELECTOR,
  BOARD_SELECTOR
].join(', ');
const MAX_RETRY_ATTEMPTS = 40;
const RETRY_DELAY_MS = 250;
const SETTLE_WINDOW_MS = MAX_RETRY_ATTEMPTS * RETRY_DELAY_MS;

let bootstrapFrame = 0;
let retryTimer = 0;
let retryAttempts = 0;
let settleDeadline = 0;

const runtimeToken = {};
window.__pentominoHundredChartObserver?.disconnect();
window.__pentominoHundredChartRuntimeToken = runtimeToken;

function runtimeIsCurrent(): boolean {
  return window.__pentominoHundredChartRuntimeToken === runtimeToken;
}

function hundredChartEntries(): Record<string, PentominoHundredChartEntry> {
  window.__pentominoHundredChartEntries =
    window.__pentominoHundredChartEntries || {};
  return window.__pentominoHundredChartEntries;
}

function pieceEntries(): Record<string, PentominoConfigRenderEntry> {
  window.__pentominoPieceEntries = window.__pentominoPieceEntries || {};
  return window.__pentominoPieceEntries;
}

function dockEntries(): Record<string, PentominoDockRenderEntry> {
  window.__pentominoDockEntries = window.__pentominoDockEntries || {};
  return window.__pentominoDockEntries;
}

function removeHundredChartEntry(markerId: string): void {
  const registry = hundredChartEntries();
  const entry = registry[markerId];
  if (!entry) return;

  removeHundredChart(entry.board as BoardLike, entry.objects);
  delete registry[markerId];
}

function removePieceEntry(markerId: string): void {
  const registry = pieceEntries();
  const entry = registry[markerId];
  if (!entry) return;

  entry.pieces.forEach(function(piece) {
    piece.dispose();
  });
  delete registry[markerId];
}

function removeDockEntry(markerId: string): void {
  const registry = dockEntries();
  const entry = registry[markerId];
  if (!entry) return;

  entry.controller.dispose();
  entry.pieces.forEach(function(piece) { piece.dispose(); });
  delete registry[markerId];
}

function registeredBoard(boardId: string): BoardLike | undefined {
  const board =
    window.__boards && window.__boards[boardId] as BoardLike | undefined;
  if (!board || !boardIsConnected(board, document.documentElement)) {
    return undefined;
  }
  return board;
}

function renderHundredChartMarker(marker: HTMLElement): boolean {
  const markerId = String(marker.id || '').trim();
  const boardId = String(marker.dataset.boardId || '').trim();
  const chartKind: HundredChartKind =
    marker.dataset.chartKind === 'negative' ? 'negative' : 'standard';

  if (!markerId || !boardId) {
    if (markerId) removeHundredChartEntry(markerId);
    return false;
  }

  const board = registeredBoard(boardId);
  if (!board) {
    removeHundredChartEntry(markerId);
    return false;
  }

  const current = hundredChartEntries()[markerId];
  if (
    current &&
    current.runtimeToken === runtimeToken &&
    current.marker === marker &&
    current.board === board &&
    current.boardId === boardId &&
    current.chartKind === chartKind &&
    current.container === board.containerObj &&
    hundredChartIsAttached(board, current.objects)
  ) {
    return true;
  }

  removeHundredChartEntry(markerId);

  try {
    hundredChartEntries()[markerId] = {
      markerId,
      boardId,
      chartKind,
      runtimeToken,
      marker,
      board,
      container: board.containerObj as Node,
      objects: createHundredChart(board, chartKind)
    };
    return true;
  } catch (_error) {
    removeHundredChartEntry(markerId);
    return false;
  }
}

function formatErrors(errors: Array<{ line: number; message: string }>): string {
  return errors.map(function(error) {
    return 'Zeile ' + error.line + ': ' + error.message;
  }).join(' ');
}

function setMarkerError(marker: HTMLElement, message: string): void {
  if (marker.dataset.pentominoError === message) return;
  marker.dataset.pentominoError = message;
  console.warn('[lia-pentomino] ' + message);
}

function clearMarkerError(marker: HTMLElement): void {
  delete marker.dataset.pentominoError;
}

function occupiedNames(boardId: string, exceptMarkerId: string): Set<string> {
  const names = new Set<string>();
  Object.keys(pieceEntries()).forEach(function(markerId) {
    const entry = pieceEntries()[markerId];
    if (markerId === exceptMarkerId || entry.boardId !== boardId) return;
    entry.pieces.forEach(function(piece) {
      names.add(piece.getState().name);
    });
  });
  Object.keys(dockEntries()).forEach(function(markerId) {
    const entry = dockEntries()[markerId];
    if (markerId === exceptMarkerId || entry.boardId !== boardId) return;
    entry.pieces.forEach(function(piece) {
      names.add(piece.getState().name);
    });
  });
  return names;
}

function nextDockPieceName(
  boardId: string,
  type: PentominoType,
  reservedNames: Set<string>
): string {
  const names = occupiedNames(boardId, '');
  let index = 1;
  let name = '';

  do {
    name = type + '-Dock-' + String(index).padStart(2, '0');
    index += 1;
  } while (names.has(name) || reservedNames.has(name));

  reservedNames.add(name);
  return name;
}

function emitPieceChange(boardId: string, state: PentominoState): void {
  try {
    document.dispatchEvent(new CustomEvent('lia-pentomino-change', {
      detail: Object.assign({ boardId }, state)
    }));
  } catch (_error) {}
}

function emitPieceRemove(boardId: string, state: PentominoState): void {
  try {
    document.dispatchEvent(new CustomEvent('lia-pentomino-remove', {
      detail: Object.assign({ boardId }, state)
    }));
  } catch (_error) {}
}

function renderPieceMarker(marker: HTMLElement): boolean {
  const markerId = String(marker.id || '').trim();
  const boardId = String(marker.dataset.boardId || '').trim();
  const signature = String(marker.textContent || '').trim();

  if (!markerId || !boardId) {
    if (markerId) removePieceEntry(markerId);
    return false;
  }

  const board = registeredBoard(boardId);
  if (!board) {
    removePieceEntry(markerId);
    return false;
  }

  const current = pieceEntries()[markerId];
  if (
    current &&
    current.runtimeToken === runtimeToken &&
    current.marker === marker &&
    current.board === board &&
    current.boardId === boardId &&
    current.container === board.containerObj &&
    current.signature === signature &&
    current.pieces.every(function(piece) { return piece.isAttached(); })
  ) {
    clearMarkerError(marker);
    return true;
  }

  removePieceEntry(markerId);
  const parsed = parsePentominoSpecs(signature);
  if (parsed.errors.length) {
    setMarkerError(marker, formatErrors(parsed.errors));
    return true;
  }

  const namesInUse = occupiedNames(boardId, markerId);
  const conflict = parsed.configs.find(function(config) {
    return namesInUse.has(config.name);
  });
  if (conflict) {
    setMarkerError(
      marker,
      'Der Instanzname ' + conflict.name + ' ist auf Board ' + boardId +
      ' bereits vergeben.'
    );
    return true;
  }

  const pieces: PentominoPiece[] = [];
  try {
    parsed.configs.forEach(function(config) {
      pieces.push(createPentomino(board, config, {
        onChange: function(state) {
          emitPieceChange(boardId, state);
        }
      }));
    });

    pieceEntries()[markerId] = {
      markerId,
      boardId,
      runtimeToken,
      marker,
      board,
      container: board.containerObj as Node,
      signature,
      pieces,
      maskedNumbers: parsed.configs
        .map(function(config) { return config.maskedNumber; })
        .filter(function(value): value is number { return value !== null; })
    };
    clearMarkerError(marker);
    pieces.forEach(function(piece) {
      emitPieceChange(boardId, piece.getState());
    });
    return true;
  } catch (error) {
    pieces.forEach(function(piece) { piece.dispose(); });
    setMarkerError(
      marker,
      'Pentominos konnten nicht erzeugt werden: ' +
      String((error as Error)?.message || error)
    );
    return false;
  }
}

function renderDockMarker(marker: HTMLElement): boolean {
  const markerId = String(marker.id || '').trim();
  const boardId = String(marker.dataset.boardId || '').trim();
  const signature = String(marker.dataset.types || 'all').trim() || 'all';

  if (!markerId || !boardId) {
    if (markerId) removeDockEntry(markerId);
    return false;
  }

  const board = registeredBoard(boardId);
  if (!board) {
    removeDockEntry(markerId);
    return false;
  }

  const selection = parsePentominoDockTypes(signature);
  if (selection.errors.length) {
    removeDockEntry(markerId);
    setMarkerError(marker, selection.errors.join(' '));
    return true;
  }

  const current = dockEntries()[markerId];
  if (
    current &&
    current.runtimeToken === runtimeToken &&
    current.marker === marker &&
    current.board === board &&
    current.boardId === boardId &&
    current.signature === signature &&
    current.container === board.containerObj &&
    current.controller.isAttached() &&
    current.pieces.every(function(piece) { return piece.isAttached(); })
  ) {
    clearMarkerError(marker);
    return true;
  }

  removeDockEntry(markerId);
  const pieces: PentominoPiece[] = [];
  const reservedNames = new Set<string>();
  let controller: PentominoDockController;

  try {
    controller = createPentominoDock(
      marker,
      board,
      {
        types: selection.types,
        onAdd: function(request: PentominoDockRequest): string | null {
          const entry = dockEntries()[markerId];
          if (
            !runtimeIsCurrent() ||
            !entry ||
            entry.controller !== controller ||
            entry.board !== board
          ) {
            return null;
          }

          const config: PentominoConfig = {
            name: nextDockPieceName(boardId, request.type, reservedNames),
            type: request.type,
            x: request.x,
            y: request.y,
            rotation: request.rotation,
            fixed: false,
            maskedNumber: null,
            color: PENTOMINO_COLORS[request.type],
            opacity: DEFAULT_PENTOMINO_OPACITY
          };

          try {
            const piece = createPentomino(board, config, {
              onChange: function(state) {
                emitPieceChange(boardId, state);
              },
              onInteractionStart: function(_state, event) {
                controller.activatePiece(config.name, event);
              }
            });
            pieces.push(piece);
            clearMarkerError(marker);
            emitPieceChange(boardId, piece.getState());
            return config.name;
          } catch (error) {
            setMarkerError(
              marker,
              'Pentomino aus dem Inventar konnte nicht erzeugt werden: ' +
              String((error as Error)?.message || error)
            );
            return null;
          }
        },
        onSetFixed: function(name: string, fixed: boolean): boolean {
          const entry = dockEntries()[markerId];
          if (
            !runtimeIsCurrent() ||
            !entry ||
            entry.controller !== controller ||
            entry.board !== board
          ) {
            return false;
          }
          const piece = pieces.find(function(candidate) {
            return candidate.getState().name === name;
          });
          if (!piece) return false;

          try {
            if (!piece.setFixed(fixed)) {
              setMarkerError(
                marker,
                'Das Pentomino konnte nicht ' +
                (fixed ? 'fixiert' : 'entsperrt') + ' werden.'
              );
              return false;
            }
            clearMarkerError(marker);
            return piece.getState().fixed === fixed;
          } catch (error) {
            setMarkerError(
              marker,
              'Das Pentomino konnte nicht ' +
              (fixed ? 'fixiert' : 'entsperrt') + ' werden: ' +
              String((error as Error)?.message || error)
            );
            return false;
          }
        },
        onRemove: function(name: string): boolean {
          const entry = dockEntries()[markerId];
          if (
            !runtimeIsCurrent() ||
            !entry ||
            entry.controller !== controller ||
            entry.board !== board
          ) {
            return false;
          }
          const index = pieces.findIndex(function(piece) {
            return piece.getState().name === name;
          });
          if (index < 0) return false;

          const piece = pieces[index];
          try {
            const state = piece.getState();
            piece.dispose();
            pieces.splice(index, 1);
            clearMarkerError(marker);
            emitPieceRemove(boardId, state);
            return true;
          } catch (error) {
            setMarkerError(
              marker,
              'Pentomino aus dem Inventar konnte nicht gelöscht werden: ' +
              String((error as Error)?.message || error)
            );
            return false;
          }
        }
      }
    );

    dockEntries()[markerId] = {
      markerId,
      boardId,
      runtimeToken,
      marker,
      board,
      container: board.containerObj as Node,
      signature,
      controller,
      pieces
    };
    clearMarkerError(marker);
    return true;
  } catch (error) {
    pieces.forEach(function(piece) { piece.dispose(); });
    setMarkerError(
      marker,
      'Pentomino-Inventar konnte nicht erzeugt werden: ' +
      String((error as Error)?.message || error)
    );
    return false;
  }
}

function syncHundredChartMasks(): void {
  const maskedByBoard = new Map<string, Set<number>>();

  Object.keys(pieceEntries()).forEach(function(markerId) {
    const entry = pieceEntries()[markerId];
    let maskedNumbers = maskedByBoard.get(entry.boardId);
    if (!maskedNumbers) {
      maskedNumbers = new Set<number>();
      maskedByBoard.set(entry.boardId, maskedNumbers);
    }
    entry.maskedNumbers.forEach(function(value) {
      maskedNumbers!.add(value);
    });
  });

  const boardsToUpdate = new Set<BoardLike>();
  Object.keys(hundredChartEntries()).forEach(function(markerId) {
    const entry = hundredChartEntries()[markerId];
    const maskedNumbers = maskedByBoard.get(entry.boardId) || [];
    if (setHundredChartMaskedNumbers(entry.objects, maskedNumbers)) {
      boardsToUpdate.add(entry.board as BoardLike);
    }
  });

  boardsToUpdate.forEach(function(board) {
    if (board.isSuspendedUpdate === true) return;
    try {
      board.update?.();
    } catch (_error) {}
  });
}

function updateRetry(pending: boolean, hasMarkers: boolean): void {
  if (!runtimeIsCurrent()) return;

  const settling = hasMarkers && Date.now() < settleDeadline;
  if (!pending && !settling) {
    if (retryTimer) window.clearTimeout(retryTimer);
    retryTimer = 0;
    retryAttempts = 0;
    return;
  }

  if (retryTimer || retryAttempts >= MAX_RETRY_ATTEMPTS) return;
  retryTimer = window.setTimeout(function() {
    if (!runtimeIsCurrent()) return;
    retryTimer = 0;
    retryAttempts += 1;
    scheduleBootstrap(false);
  }, RETRY_DELAY_MS);
}

function markerIds(markers: HTMLElement[]): Set<string> {
  const ids = new Set<string>();
  markers.forEach(function(marker) {
    const markerId = String(marker.id || '').trim();
    if (markerId) ids.add(markerId);
  });
  return ids;
}

function removeInactiveEntries<T>(
  registry: Record<string, T>,
  activeMarkerIds: Set<string>,
  remove: (markerId: string) => void
): void {
  Object.keys(registry).forEach(function(markerId) {
    if (!activeMarkerIds.has(markerId)) remove(markerId);
  });
}

function bootstrapPentominos(): void {
  if (!runtimeIsCurrent()) return;

  const chartMarkers = Array.from(
    document.querySelectorAll<HTMLElement>(HUNDRED_MARKER_SELECTOR)
  );
  const configMarkers = Array.from(
    document.querySelectorAll<HTMLElement>(CONFIG_MARKER_SELECTOR)
  );
  const dockMarkers = Array.from(
    document.querySelectorAll<HTMLElement>(DOCK_MARKER_SELECTOR)
  );

  removeInactiveEntries(
    hundredChartEntries(),
    markerIds(chartMarkers),
    removeHundredChartEntry
  );
  removeInactiveEntries(
    pieceEntries(),
    markerIds(configMarkers),
    removePieceEntry
  );
  removeInactiveEntries(
    dockEntries(),
    markerIds(dockMarkers),
    removeDockEntry
  );

  let pending = false;
  chartMarkers.forEach(function(marker) {
    if (!renderHundredChartMarker(marker)) pending = true;
  });
  configMarkers.forEach(function(marker) {
    if (!renderPieceMarker(marker)) pending = true;
  });
  dockMarkers.forEach(function(marker) {
    if (!renderDockMarker(marker)) pending = true;
  });

  syncHundredChartMasks();

  updateRetry(
    pending,
    chartMarkers.length + configMarkers.length + dockMarkers.length > 0
  );
}

function scheduleBootstrap(resetRetries = true): void {
  if (!runtimeIsCurrent()) return;
  if (resetRetries) {
    retryAttempts = 0;
    settleDeadline = Date.now() + SETTLE_WINDOW_MS;
  }
  if (bootstrapFrame) return;

  const run = function(): void {
    if (!runtimeIsCurrent()) return;
    bootstrapFrame = 0;
    bootstrapPentominos();
  };

  if (typeof window.requestAnimationFrame === 'function') {
    bootstrapFrame = window.requestAnimationFrame(run);
  } else {
    bootstrapFrame = window.setTimeout(run, 0);
  }
}

function containsRelevantNode(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const element = node as Element;

  if (element.matches(RELEVANT_SELECTOR)) return true;
  return !!element.querySelector(RELEVANT_SELECTOR);
}

function hasRelevantClass(element: Element, classes: string[]): boolean {
  return classes.some(function(className) {
    return element.classList.contains(className);
  });
}

function attributeMutationIsRelevant(mutation: MutationRecord): boolean {
  const element = mutation.target as Element;
  const attributeName = mutation.attributeName || '';
  const relevantClasses = [
    HUNDRED_MARKER_CLASS,
    CONFIG_MARKER_CLASS,
    DOCK_MARKER_CLASS,
    BOARD_CLASS
  ];

  if (
    attributeName === 'data-board-id' ||
    attributeName === 'data-chart-kind' ||
    attributeName === 'data-types' ||
    attributeName === 'id'
  ) {
    return hasRelevantClass(element, relevantClasses);
  }

  if (attributeName === 'class') {
    const previousClasses = String(mutation.oldValue || '').split(/\s+/);
    return (
      hasRelevantClass(element, relevantClasses) ||
      relevantClasses.some(function(className) {
        return previousClasses.includes(className);
      })
    );
  }

  return false;
}

function mutationIsRelevant(mutation: MutationRecord): boolean {
  if (mutation.type === 'attributes') {
    return attributeMutationIsRelevant(mutation);
  }

  if (mutation.type === 'characterData') {
    const parent = mutation.target.parentElement;
    return !!parent && !!parent.closest(CONFIG_MARKER_SELECTOR);
  }

  if (mutation.target.nodeType === Node.ELEMENT_NODE) {
    const target = mutation.target as Element;

    if (
      target.closest(CONFIG_MARKER_SELECTOR) !== null ||
      target.closest(BOARD_SELECTOR) !== null
    ) {
      return true;
    }
  }

  const changed = Array.from(mutation.addedNodes)
    .concat(Array.from(mutation.removedNodes));
  return changed.some(containsRelevantNode);
}

function installObserver(): void {
  const observer = new MutationObserver(function(mutations) {
    if (!runtimeIsCurrent()) return;
    if (mutations.some(mutationIsRelevant)) scheduleBootstrap(true);
  });

  const root = document.body || document.documentElement;
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'data-board-id',
      'data-chart-kind',
      'data-types',
      'id',
      'class'
    ],
    attributeOldValue: true,
    characterData: true
  });
  window.__pentominoHundredChartObserver = observer;
}

function publicEntryIsCurrent(entry: PentominoConfigRenderEntry): boolean {
  const board = registeredBoard(entry.boardId);
  return (
    entry.runtimeToken === runtimeToken &&
    entry.marker.isConnected &&
    document.documentElement.contains(entry.marker) &&
    entry.marker.matches(CONFIG_MARKER_SELECTOR) &&
    String(entry.marker.id || '').trim() === entry.markerId &&
    String(entry.marker.dataset.boardId || '').trim() === entry.boardId &&
    String(entry.marker.textContent || '').trim() === entry.signature &&
    board === entry.board &&
    entry.container === entry.board.containerObj
  );
}

function publicDockEntryIsCurrent(entry: PentominoDockRenderEntry): boolean {
  const board = registeredBoard(entry.boardId);
  return (
    entry.runtimeToken === runtimeToken &&
    entry.marker.isConnected &&
    document.documentElement.contains(entry.marker) &&
    entry.marker.matches(DOCK_MARKER_SELECTOR) &&
    String(entry.marker.id || '').trim() === entry.markerId &&
    String(entry.marker.dataset.boardId || '').trim() === entry.boardId &&
    (String(entry.marker.dataset.types || 'all').trim() || 'all') ===
      entry.signature &&
    board === entry.board &&
    entry.container === entry.board.containerObj &&
    entry.controller.isAttached()
  );
}

function appendPublicStates(
  states: PentominoPublicState[],
  entry: {
    boardId: string;
    pieces: Array<{
      getState(): PentominoRuntimeState;
      isAttached(): boolean;
    }>;
  }
): void {
  entry.pieces.forEach(function(piece) {
    try {
      if (!piece.isAttached()) return;
      states.push(Object.assign({ boardId: entry.boardId }, piece.getState()));
    } catch (_error) {}
  });
}

function publicDockStates(
  boardId?: string,
  dockMarkerId?: string
): PentominoPublicState[] {
  const states: PentominoPublicState[] = [];
  const requestedBoardId = boardId === undefined
    ? undefined
    : String(boardId).trim();
  const requestedMarkerId = dockMarkerId === undefined
    ? undefined
    : String(dockMarkerId).trim();
  if (requestedBoardId === '' || requestedMarkerId === '') return states;

  Object.keys(dockEntries()).forEach(function(markerId) {
    const entry = dockEntries()[markerId];
    if (
      (requestedBoardId !== undefined && entry.boardId !== requestedBoardId) ||
      (requestedMarkerId !== undefined && entry.markerId !== requestedMarkerId) ||
      !publicDockEntryIsCurrent(entry)
    ) {
      return;
    }
    appendPublicStates(states, entry);
  });
  return states;
}

function publicStates(boardId?: string): PentominoPublicState[] {
  const states: PentominoPublicState[] = [];
  const requestedBoardId = boardId === undefined
    ? undefined
    : String(boardId).trim();
  if (requestedBoardId === '') return states;

  Object.keys(pieceEntries()).forEach(function(markerId) {
    const entry = pieceEntries()[markerId];
    if (
      (requestedBoardId !== undefined && entry.boardId !== requestedBoardId) ||
      !publicEntryIsCurrent(entry)
    ) {
      return;
    }
    appendPublicStates(states, entry);
  });
  states.push.apply(states, publicDockStates(requestedBoardId));
  return states;
}

function publicState(
  boardId: string,
  name: string
): PentominoPublicState | null {
  if (typeof boardId !== 'string' || typeof name !== 'string') return null;
  const requestedBoardId = boardId.trim();
  const requestedName = name.trim();
  if (!requestedBoardId || !requestedName) return null;

  return publicStates(requestedBoardId).find(function(state) {
    return state.name === requestedName;
  }) || null;
}

function publicCoverageSum(boardId: string, name: string): number | null {
  const state = publicState(boardId, name);
  return state
    ? hundredChartCoverageSum(
      state.coveredNumbers,
      state.cells.length,
      publicHundredChartKind(boardId)
    )
    : null;
}

function publicHundredChartKind(boardId: string): HundredChartKind {
  const board = registeredBoard(boardId);
  if (!board) return 'standard';

  const entries = Object.values(hundredChartEntries()).filter(function(entry) {
    return (
      entry.runtimeToken === runtimeToken &&
      entry.boardId === boardId &&
      entry.board === board &&
      entry.container === board.containerObj &&
      entry.marker.isConnected &&
      document.documentElement.contains(entry.marker) &&
      entry.marker.matches(HUNDRED_MARKER_SELECTOR) &&
      hundredChartIsAttached(board, entry.objects)
    );
  });

  return entries.length === 1 ? entries[0].chartKind : 'standard';
}

function strictQuizTarget(value: string | undefined): number | null {
  const raw = String(value || '').trim();
  if (!/^[+-]?\d+$/.test(raw)) return null;

  const target = Number(raw);
  return Number.isSafeInteger(target) ? target : null;
}

function publicQuizResult(quizMarkerId: string): boolean {
  if (typeof quizMarkerId !== 'string') return false;
  const requestedMarkerId = quizMarkerId.trim();
  if (!requestedMarkerId) return false;

  const quiz = document.getElementById(requestedMarkerId);
  if (
    !quiz ||
    !quiz.isConnected ||
    !document.documentElement.contains(quiz)
  ) {
    return false;
  }

  const boardId = String(quiz.dataset.boardId || '').trim();
  const target = strictQuizTarget(quiz.dataset.targetSum);
  const pieceMarkerId = String(quiz.dataset.pieceMarkerId || '').trim();
  const dockMarkerId = String(quiz.dataset.dockMarkerId || '').trim();
  const isPieceQuiz = quiz.classList.contains('lia-pentomino-quiz');
  const isDockQuiz = quiz.classList.contains('lia-pentomino-dock-quiz');
  const hasPieceMarker = pieceMarkerId !== '';
  const hasDockMarker = dockMarkerId !== '';

  if (
    !boardId ||
    target === null ||
    isPieceQuiz === isDockQuiz ||
    hasPieceMarker === hasDockMarker ||
    isPieceQuiz !== hasPieceMarker ||
    isDockQuiz !== hasDockMarker
  ) {
    return false;
  }

  const chartKind = publicHundredChartKind(boardId);

  if (isDockQuiz) {
    return publicDockStates(boardId, dockMarkerId).some(function(state) {
      return hundredChartCoverageSum(
        state.coveredNumbers,
        state.cells.length,
        chartKind
      ) === target;
    });
  }

  const entry = pieceEntries()[pieceMarkerId];
  if (
    !entry ||
    entry.boardId !== boardId ||
    entry.pieces.length !== 1 ||
    !publicEntryIsCurrent(entry)
  ) {
    return false;
  }

  try {
    const piece = entry.pieces[0];
    if (!piece.isAttached()) return false;
    const state = piece.getState();
    return hundredChartCoverageSum(
      state.coveredNumbers,
      state.cells.length,
      chartKind
    ) === target;
  } catch (_error) {
    return false;
  }
}

window.LiaPentomino = {
  checkQuiz: function(quizMarkerId: string) {
    return publicQuizResult(quizMarkerId);
  },
  getPieces: function(boardId?: string) {
    return publicStates(boardId);
  },
  getDockPieces: function(boardId?: string, dockMarkerId?: string) {
    return publicDockStates(boardId, dockMarkerId);
  },
  getPiece: function(boardId: string, name: string) {
    return publicState(boardId, name);
  },
  getCoverage: function(boardId: string, name: string) {
    const state = publicState(boardId, name);
    return state ? state.coveredNumbers.slice() : [];
  },
  getCoverageSum: function(boardId: string, name: string) {
    return publicCoverageSum(boardId, name);
  },
  coversSum: function(boardId: string, name: string, targetSum: number) {
    return (
      Number.isSafeInteger(targetSum) &&
      publicCoverageSum(boardId, name) === targetSum
    );
  },
  dockCoversSum: function(
    boardId: string,
    dockMarkerId: string,
    targetSum: number
  ) {
    const chartKind = publicHundredChartKind(boardId);
    return (
      Number.isSafeInteger(targetSum) &&
      publicDockStates(boardId, dockMarkerId).some(function(state) {
        return hundredChartCoverageSum(
          state.coveredNumbers,
          state.cells.length,
          chartKind
        ) === targetSum;
      })
    );
  }
};

window.__bootstrapPentominoHundredCharts = bootstrapPentominos;
window.__schedulePentominoHundredCharts = function() {
  scheduleBootstrap(true);
};

window.__pentominoHundredChartRuntimeReady = true;
installObserver();
scheduleBootstrap(true);
window.setTimeout(function() { scheduleBootstrap(false); }, 80);
window.setTimeout(function() { scheduleBootstrap(false); }, 220);
