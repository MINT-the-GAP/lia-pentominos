interface PentominoHundredChartEntry {
  markerId: string;
  boardId: string;
  chartKind: 'standard' | 'negative';
  runtimeToken: object;
  marker: HTMLElement;
  board: any;
  container: Node;
  objects: any[];
}

interface PentominoConfigRenderEntry {
  markerId: string;
  boardId: string;
  runtimeToken: object;
  marker: HTMLElement;
  board: any;
  container: Node;
  signature: string;
  maskedNumbers: number[];
  pieces: Array<{
    objects: any[];
    getState(): PentominoRuntimeState;
    setFixed(fixed: boolean): boolean;
    isAttached(): boolean;
    dispose(): void;
  }>;
}

interface PentominoDockRenderEntry {
  markerId: string;
  boardId: string;
  runtimeToken: object;
  marker: HTMLElement;
  board: any;
  container: Node;
  signature: string;
  controller: {
    element: HTMLElement;
    buttons: HTMLButtonElement[];
    toggleButton: HTMLButtonElement;
    panel: HTMLElement;
    placedItems: HTMLElement;
    activatePiece(name: string, event?: unknown): boolean;
    isAttached(): boolean;
    dispose(): void;
  };
  pieces: Array<{
    objects: any[];
    getState(): PentominoRuntimeState;
    setFixed(fixed: boolean): boolean;
    isAttached(): boolean;
    dispose(): void;
  }>;
}

interface PentominoRuntimeState {
  name: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  fixed: boolean;
  maskedNumber: number | null;
  width: number;
  height: number;
  color: string;
  opacity: number;
  cells: Array<[number, number]>;
  coveredNumbers: number[];
}

interface PentominoPublicState extends PentominoRuntimeState {
  boardId: string;
}

interface LiaPentominoApi {
  checkQuiz(quizMarkerId: string): boolean;
  getPieces(boardId?: string): PentominoPublicState[];
  getDockPieces(boardId?: string, dockMarkerId?: string): PentominoPublicState[];
  getPiece(boardId: string, name: string): PentominoPublicState | null;
  getCoverage(boardId: string, name: string): number[];
  getCoverageSum(boardId: string, name: string): number | null;
  coversSum(boardId: string, name: string, targetSum: number): boolean;
  dockCoversSum(
    boardId: string,
    dockMarkerId: string,
    targetSum: number
  ): boolean;
}

interface Window {
  __boards?: Record<string, any>;
  __pentominoHundredChartEntries?: Record<string, PentominoHundredChartEntry>;
  __pentominoPieceEntries?: Record<string, PentominoConfigRenderEntry>;
  __pentominoDockEntries?: Record<string, PentominoDockRenderEntry>;
  __pentominoHundredChartObserver?: MutationObserver;
  __pentominoHundredChartRuntimeReady?: boolean;
  __pentominoHundredChartRuntimeToken?: object;
  __bootstrapPentominoHundredCharts?: () => void;
  __schedulePentominoHundredCharts?: () => void;
  JXG?: {
    COORDS_BY_USER?: number;
  };
  LiaPentomino?: LiaPentominoApi;
}
