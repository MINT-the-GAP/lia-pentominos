import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import vm from 'node:vm';

const PROJECT_ROOT = new URL('../', import.meta.url);
const CDN_PREFIX = '/gh/MINT-the-GAP/lia-pentominos@main/';
const CHART_SELECTOR = '.lia-pentomino-hundred-chart[data-board-id]';
const CONFIG_SELECTOR = '.lia-pentomino-config[data-board-id]';
const DOCK_SELECTOR = '.lia-pentomino-dock[data-board-id]';
const BOARD_SELECTOR = '.jxgbox';

function headerOf(markdown) {
  return markdown.match(/^<!--([\s\S]*?)-->/)?.[1] || '';
}

function valuesFor(header, key) {
  const pattern = new RegExp('^' + key + ':\\s*(\\S.*?)\\s*$', 'gmi');
  return Array.from(header.matchAll(pattern), match => match[1]);
}

function macroDefinition(header, name) {
  return header.match(
    new RegExp('(?:^|\\n)@' + name + '\\r?\\n([\\s\\S]*?)\\r?\\n@end')
  )?.[1] || '';
}

async function withDistributionServer(run) {
  const files = new Map([
    ['README.md', {
      body: await readFile(new URL('README.md', PROJECT_ROOT)),
      type: 'text/markdown; charset=utf-8'
    }],
    ['dist/index.js', {
      body: await readFile(new URL('dist/index.js', PROJECT_ROOT)),
      type: 'application/javascript; charset=utf-8'
    }],
    ['dist/index.js.map', {
      body: await readFile(new URL('dist/index.js.map', PROJECT_ROOT)),
      type: 'application/json; charset=utf-8'
    }]
  ]);

  const server = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    const relativePath = pathname.startsWith(CDN_PREFIX)
      ? pathname.slice(CDN_PREFIX.length)
      : '';
    const resource = files.get(relativePath);
    if (!resource || !['GET', 'HEAD'].includes(request.method || '')) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': resource.type,
      'Content-Length': resource.body.length
    });
    response.end(request.method === 'HEAD' ? undefined : resource.body);
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const origin = 'http://127.0.0.1:' + address.port;

  try {
    await run({
      origin,
      readmeUrl: origin + CDN_PREFIX + 'README.md',
      bundleUrl: origin + CDN_PREFIX + 'dist/index.js'
    });
  } finally {
    server.close();
    await once(server, 'close');
  }
}

function selectorClass(selector) {
  if (selector.includes('lia-pentomino-hundred-chart')) {
    return 'lia-pentomino-hundred-chart';
  }
  if (selector.includes('lia-pentomino-config')) {
    return 'lia-pentomino-config';
  }
  if (selector.includes('lia-pentomino-dock')) {
    return 'lia-pentomino-dock';
  }
  if (selector.includes('jxgbox')) return 'jxgbox';
  return '';
}

function marker(id, className, boardId, textContent = '') {
  const classes = new Set(className.split(/\s+/).filter(Boolean));
  const element = {
    nodeType: 1,
    id,
    className,
    dataset: { boardId },
    textContent,
    isConnected: true,
    parentElement: null,
    classList: {
      contains(value) { return classes.has(value); }
    },
    matches(selector) {
      return selector.split(',').some(part => {
        const requiredClass = selectorClass(part.trim());
        return requiredClass && classes.has(requiredClass) &&
          (!part.includes('[data-board-id]') || !!element.dataset.boardId);
      });
    },
    closest(selector) {
      return element.matches(selector) ? element : null;
    },
    querySelector() { return null; }
  };
  return element;
}

function domElement(tagName = 'div') {
  const element = {
    nodeType: 1,
    tagName: String(tagName).toUpperCase(),
    id: '',
    className: '',
    dataset: {},
    style: {},
    textContent: '',
    children: [],
    parentNode: null,
    parentElement: null,
    isConnected: true,
    hidden: false,
    attributes: new Map(),
    listeners: new Map(),
    capturedPointers: new Set(),
    get firstChild() { return element.children[0] || null; },
    classNames() {
      return String(element.className).split(/\s+/).filter(Boolean);
    },
    classList: {
      contains(value) { return element.classNames().includes(value); },
      add(value) {
        const names = new Set(element.classNames());
        names.add(value);
        element.className = Array.from(names).join(' ');
      },
      remove(value) {
        element.className = element.classNames()
          .filter(name => name !== value)
          .join(' ');
      },
      toggle(value, force) {
        const present = element.classNames().includes(value);
        const enabled = force === undefined ? !present : !!force;
        if (enabled) element.classList.add(value);
        else element.classList.remove(value);
        return enabled;
      }
    },
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = element;
      child.parentElement = element;
      child.isConnected = element.isConnected;
      element.children.push(child);
      return child;
    },
    removeChild(child) {
      element.children = element.children.filter(item => item !== child);
      child.parentNode = null;
      child.parentElement = null;
      child.isConnected = false;
      return child;
    },
    remove() {
      element.parentNode?.removeChild(element);
      element.isConnected = false;
    },
    setAttribute(name, value) {
      element.attributes.set(name, String(value));
    },
    getAttribute(name) {
      return element.attributes.get(name) ?? null;
    },
    removeAttribute(name) {
      element.attributes.delete(name);
    },
    matches(selector) {
      return selector.split(',').some(part => {
        const normalized = part.trim();
        const requiredClasses = Array.from(
          normalized.matchAll(/\.([A-Za-z0-9_-]+)/g),
          match => match[1]
        );
        if (!requiredClasses.every(name => element.classNames().includes(name))) {
          return false;
        }
        if (normalized.includes('[data-board-id]') && !element.dataset.boardId) {
          return false;
        }
        if (
          normalized.includes('[data-pentomino-type]') &&
          !element.dataset.pentominoType
        ) {
          return false;
        }
        if (requiredClasses.length) return true;
        return element.tagName.toLowerCase() === normalized.toLowerCase();
      });
    },
    closest(selector) {
      let current = element;
      while (current) {
        if (current.matches(selector)) return current;
        current = current.parentElement;
      }
      return null;
    },
    querySelectorAll(selector) {
      const found = [];
      const visit = current => {
        current.children.forEach(child => {
          if (child.matches(selector)) found.push(child);
          visit(child);
        });
      };
      visit(element);
      return found;
    },
    querySelector(selector) {
      return element.querySelectorAll(selector)[0] || null;
    },
    addEventListener(type, listener) {
      const listeners = element.listeners.get(type) || [];
      listeners.push(listener);
      element.listeners.set(type, listeners);
    },
    removeEventListener(type, listener) {
      element.listeners.set(
        type,
        (element.listeners.get(type) || []).filter(item => item !== listener)
      );
    },
    dispatch(type, init = {}) {
      const event = {
        type,
        pointerId: 1,
        button: 0,
        clientX: 0,
        clientY: 0,
        key: '',
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {},
      ...init
      };
      (element.listeners.get(type) || []).slice()
        .forEach(listener => listener(event));
      return event;
    },
    setPointerCapture(pointerId) {
      element.capturedPointers.add(pointerId);
    },
    releasePointerCapture(pointerId) {
      element.capturedPointers.delete(pointerId);
    }
  };
  return element;
}

function fakeBoard(containerObj) {
  let sequence = 0;
  let updates = 0;
  const calls = [];
  const removed = [];

  const board = {
    calls,
    removed,
    objects: {},
    containerObj,
    isSuspendedUpdate: false,
    get updates() { return updates; },
    getBoundingBox() { return [-0.15, 10.15, 10.15, -0.15]; },
    create(type, parents, attributes) {
      const handlers = new Map();
      const object = {
        id: 'object-' + (++sequence),
        board,
        type,
        parents,
        attributes,
        on(event, handler) { handlers.set(event, handler); },
        off(event, handler) {
          if (handlers.get(event) === handler) handlers.delete(event);
        },
        trigger(event, payload) { handlers.get(event)?.(payload); },
        setAttribute(nextAttributes) {
          Object.assign(object.attributes, nextAttributes);
          return object;
        }
      };

      if (type === 'point') {
        object._x = Number(parents[0]);
        object._y = Number(parents[1]);
        object.X = () => object._x;
        object.Y = () => object._y;
        object.setPositionDirectly = (_mode, coordinates) => {
          object._x = Number(coordinates[0]);
          object._y = Number(coordinates[1]);
        };
      }

      if (type === 'button') {
        const domAttributes = {};
        object.rendNodeButton = {
          setAttribute(name, value) { domAttributes[name] = value; },
          getAttribute(name) { return domAttributes[name]; }
        };
        object.click = () => parents[3]();
      }

      calls.push(object);
      board.objects[object.id] = object;
      return object;
    },
    removeObject(object) {
      removed.push(object);
      delete board.objects[object.id];
    },
    suspendUpdate() { board.isSuspendedUpdate = true; },
    unsuspendUpdate() {
      board.isSuspendedUpdate = false;
      updates += 1;
    },
    update() { updates += 1; }
  };

  return board;
}

function fakeRuntimePiece(name, type, coveredNumbers, attached = true) {
  const cellCount = Number(type.at(-1));
  return {
    objects: [],
    isAttached() { return attached; },
    setFixed() { return false; },
    dispose() {},
    getState() {
      return {
        name,
        type,
        x: 0,
        y: 0,
        rotation: 0,
        fixed: false,
        maskedNumber: null,
        width: cellCount,
        height: 1,
        color: '#000000',
        opacity: 0.58,
        cells: Array.from({ length: cellCount }, (_, index) => [index, 0]),
        coveredNumbers: coveredNumbers.slice()
      };
    }
  };
}

function runtimeEnvironment({
  registerBoard = true,
  movable = true,
  includeFixed = true,
  chartKind = 'standard',
  dock = false,
  dockTypes = 'all',
  emptyDock = false
} = {}) {
  const boardId = 'import-board';
  const composedRoot = {};
  const elements = new Map();
  const events = [];
  const warnings = [];
  const frames = [];
  const observers = [];
  const windowListeners = new Map();
  let frameId = 0;
  let timerId = 0;
  let fixedActive = includeFixed;
  let movableActive = movable;
  let dockActive = dock;

  const chartMarker = marker(
    'chart-marker',
    'lia-pentomino-hundred-chart',
    boardId
  );
  if (chartKind === 'negative') chartMarker.dataset.chartKind = chartKind;
  const fixedMarker = marker(
    'fixed-marker',
    'lia-pentomino-config',
    boardId,
    'name=T5-X;type=T5;numbers=[6,7,8,17,27=x];fixed=true'
  );
  const movableMarker = marker(
    'movable-marker',
    'lia-pentomino-config',
    boardId,
    'name=L5-Move;type=L5;numbers=[11,21,31,41,42]'
  );

  const dockMarker = domElement('aside');
  dockMarker.id = 'dock-marker';
  dockMarker.className = 'lia-pentomino-dock';
  dockMarker.dataset.boardId = boardId;
  dockMarker.dataset.types = dockTypes;
  dockMarker.getBoundingClientRect = () => ({
    left: 540,
    top: 0,
    right: 920,
    bottom: 520,
    width: 380,
    height: 520
  });
  const dockToggle = domElement('button');
  dockToggle.className =
    'lia-btn lia-btn--outline lia-pentomino-dock-toggle';
  dockToggle.setAttribute('aria-expanded', 'false');
  const dockToggleLabel = domElement('span');
  dockToggleLabel.className = 'lia-pentomino-dock-toggle-label';
  dockToggleLabel.textContent = 'Pentominos';
  const dockChevron = domElement('span');
  dockChevron.className = 'lia-pentomino-dock-chevron';
  dockChevron.textContent = '›';
  dockChevron.setAttribute('aria-hidden', 'true');
  dockToggle.appendChild(dockToggleLabel);
  dockToggle.appendChild(dockChevron);
  const dockPanel = domElement('div');
  dockPanel.id = 'dock-marker-panel';
  dockPanel.className = 'lia-pentomino-dock-panel';
  dockPanel.hidden = true;
  dockToggle.setAttribute('aria-controls', dockPanel.id);
  const dockItems = domElement('div');
  dockItems.className = 'lia-pentomino-dock-items';
  dockItems.setAttribute('role', 'group');
  dockItems.setAttribute('aria-label', 'Pentomino-Inventar');
  const dockPlaced = domElement('section');
  dockPlaced.className = 'lia-pentomino-dock-placed';
  dockPlaced.hidden = true;
  const dockPlacedTitle = domElement('strong');
  dockPlacedTitle.className = 'lia-pentomino-dock-placed-title';
  dockPlacedTitle.textContent = 'Pentominos im Feld';
  const dockPlacedItems = domElement('div');
  dockPlacedItems.className = 'lia-pentomino-dock-placed-items';
  dockPlacedItems.setAttribute('role', 'listbox');
  dockPlacedItems.setAttribute('aria-label', 'Pentominos im Feld');
  dockPlaced.appendChild(dockPlacedTitle);
  dockPlaced.appendChild(dockPlacedItems);
  dockPanel.appendChild(dockItems);
  dockPanel.appendChild(dockPlaced);
  if (!emptyDock) {
    dockMarker.appendChild(dockToggle);
    dockMarker.appendChild(dockPanel);
  }

  const documentElement = domElement('html');
  documentElement.id = 'document-root';
  documentElement.getRootNode = () => composedRoot;
  documentElement.contains = node => !!node && node.isConnected !== false;
  const body = domElement('body');
  body.id = 'body';
  body.getRootNode = () => composedRoot;
  const head = domElement('head');
  head.id = 'head';
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  let boardContainer;
  let board;
  const createRegisteredBoard = () => {
    boardContainer = marker(boardId, 'jxgbox', '', '');
    boardContainer.getRootNode = () => composedRoot;
    boardContainer.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 520,
      bottom: 520,
      width: 520,
      height: 520
    });
    elements.set(boardId, boardContainer);
    board = fakeBoard(boardContainer);
    return board;
  };
  createRegisteredBoard();

  [chartMarker, fixedMarker, movableMarker, dockMarker].forEach(element => {
    elements.set(element.id, element);
  });

  const findById = (root, id) => {
    if (!root) return null;
    if (root.id === id) return root;
    for (const child of root.children || []) {
      const found = findById(child, id);
      if (found) return found;
    }
    return null;
  };

  const document = {
    documentElement,
    body,
    head,
    querySelectorAll(selector) {
      if (selector === CHART_SELECTOR) return [chartMarker];
      if (selector === CONFIG_SELECTOR) {
        return [
          fixedActive ? fixedMarker : null,
          movableActive ? movableMarker : null
        ].filter(Boolean);
      }
      if (selector === DOCK_SELECTOR) return dockActive ? [dockMarker] : [];
      return [];
    },
    getElementById(id) {
      return elements.get(id) || findById(documentElement, id) || null;
    },
    createElement(tagName) {
      const element = domElement(tagName);
      element.isConnected = false;
      return element;
    },
    dispatchEvent(event) {
      events.push(event);
      return true;
    }
  };

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }
    observe() {}
    disconnect() { this.disconnected = true; }
  }

  class FakeCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  const sandbox = {
    console: {
      clear() {},
      log() {},
      error() {},
      warn(...values) { warnings.push(values.join(' ')); }
    },
    document,
    Node: { ELEMENT_NODE: 1 },
    MutationObserver: FakeMutationObserver,
    CustomEvent: FakeCustomEvent,
    JXG: { COORDS_BY_USER: 1 },
    requestAnimationFrame(callback) {
      frames.push(callback);
      return ++frameId;
    },
    setTimeout() { return ++timerId; },
    clearTimeout() {}
  };
  sandbox.addEventListener = (type, listener) => {
    const listeners = windowListeners.get(type) || [];
    listeners.push(listener);
    windowListeners.set(type, listeners);
  };
  sandbox.removeEventListener = (type, listener) => {
    windowListeners.set(
      type,
      (windowListeners.get(type) || []).filter(item => item !== listener)
    );
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.__boards = registerBoard ? { [boardId]: board } : {};

  return {
    boardId,
    sandbox,
    events,
    warnings,
    observers,
    dockMarker,
    dockToggle,
    dockPanel,
    dockItems,
    get board() { return board; },
    flushFrames() {
      let count = 0;
      while (frames.length) {
        if (++count > 20) throw new Error('requestAnimationFrame loop');
        frames.shift()();
      }
    },
    removeFixedMarker() {
      fixedActive = false;
      fixedMarker.isConnected = false;
    },
    removeDockMarker() {
      dockActive = false;
      dockMarker.isConnected = false;
    },
    dispatchWindow(type, init = {}) {
      const event = {
        type,
        pointerId: 1,
        button: 0,
        clientX: 0,
        clientY: 0,
        key: '',
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        ...init
      };
      (windowListeners.get(type) || []).slice()
        .forEach(listener => listener(event));
      return event;
    },
    windowListenerCount(type) {
      return (windowListeners.get(type) || []).length;
    },
    registerCurrentBoard() {
      sandbox.__boards[boardId] = board;
    },
    replaceBoard() {
      boardContainer.isConnected = false;
      const replacement = createRegisteredBoard();
      sandbox.__boards[boardId] = replacement;
      return replacement;
    },
    signalBoardMutation() {
      observers.at(-1)?.callback([{
        type: 'childList',
        target: documentElement,
        addedNodes: [boardContainer],
        removedNodes: []
      }]);
    }
  };
}

test('serves the template like jsDelivr and resolves its relative bundle', async () => {
  await withDistributionServer(async ({ origin, readmeUrl }) => {
    const consumer = `<!--
import: https://cdn.jsdelivr.net/gh/LiaTemplates/JSXGraph@main/README.md
import: https://cdn.jsdelivr.net/gh/MINT-the-GAP/lia-coordinate@Proposal/README.md
import: ${readmeUrl}
-->

# Importtest

@PentominoDockQuiz(65,\`<!-- data-solution-button="off" -->\`)
@PentominoDockQuizAuswahl(65,\`I2,T5\`,\`<!-- data-solution-button="off" -->\`)
@PentominoDockQuizIn(\`board\`,65,\`<!-- data-solution-button="off" -->\`)
@PentominoDockQuizAuswahlIn(\`board\`,65,\`I2,T5\`,\`<!-- data-solution-button="off" -->\`)
@PentominoIn(\`board\`,\`name=T5-Test;type=T5;numbers=[6,7,8,17,27]\`)
`;
    assert.equal(valuesFor(headerOf(consumer), 'import').length, 3);

    const readmeResponse = await fetch(readmeUrl);
    assert.equal(readmeResponse.status, 200);
    assert.match(readmeResponse.headers.get('content-type') || '', /^text\/markdown/);
    assert.equal(readmeResponse.headers.get('access-control-allow-origin'), '*');
    const readme = await readmeResponse.text();
    const header = headerOf(readme);
    assert.match(header, /@PentominoIn:/);
    assert.match(header, /@PentominoQuiz:/);
    assert.match(header, /@HunderterfeldN:/);
    assert.match(header, /@PentominoDock:/);
    assert.match(header, /@PentominoDockAuswahl:/);
    assert.match(header, /@PentominoDockIn:/);
    assert.match(header, /@PentominoDockAuswahlIn:/);
    assert.match(
      header,
      /@PentominoDockQuiz: @PentominoDockQuiz_\(@uid,@0,`all`,`@1`\)/
    );
    assert.match(
      header,
      /@PentominoDockQuizAuswahl: @PentominoDockQuiz_\(@uid,@0,`@1`,`@2`\)/
    );
    assert.match(
      header,
      /@PentominoDockQuizIn: @PentominoDockQuizIn_\(@uid,`@0`,@1,`all`,`@2`\)/
    );
    assert.match(
      header,
      /@PentominoDockQuizAuswahlIn: @PentominoDockQuizIn_\(@uid,`@0`,@1,`@2`,`@3`\)/
    );
    assert.match(header, /data-types="@2"/);
    const dockDefinition = header.match(
      /(?:^|\n)@PentominoDock_\r?\n([\s\S]*?)\r?\n@end/
    )?.[1] || '';
    const dockInDefinition = header.match(
      /(?:^|\n)@PentominoDockIn_\r?\n([\s\S]*?)\r?\n@end/
    )?.[1] || '';
    assert.match(dockDefinition, /class="lia-pentomino-workspace"/);
    assert.match(dockDefinition, /class="lia-pentomino-workspace-board"/);
    assert.match(dockDefinition, /class="lia-pentomino-workspace-sidebar"/);
    assert.match(dockInDefinition, /<aside\b/);
    assert.match(dockInDefinition, /class="lia-pentomino-dock"/);
    assert.match(dockInDefinition, /data-board-id="@1"/);
    assert.match(dockInDefinition, /data-types="@2"/);
    assert.doesNotMatch(
      dockInDefinition,
      /lia-pentomino-dock-(?:toggle|panel|items|placed|fix|delete|actions)/
    );
    assert.doesNotMatch(dockInDefinition, /lia-pentomino-dock-hint/);
    assert.doesNotMatch(dockInDefinition, /Form ins Feld ziehen oder antippen\./);
    assert.doesNotMatch(dockInDefinition, /<button\b|<details\b|<summary\b/i);
    const dockQuizCheckDefinition = macroDefinition(
      header,
      'PentominoDockQuizCheck_'
    );
    assert.match(
      dockQuizCheckDefinition,
      /data-board-id="@1"[\s\S]*data-target-sum="@2"[\s\S]*data-dock-marker-id="@3"/
    );
    assert.match(dockQuizCheckDefinition, /@4\r?\n\[\[!\]\]/);
    assert.match(
      dockQuizCheckDefinition,
      /window\.LiaPentomino\?\.checkQuiz\?\.\('pentomino-dock-quiz-@0'\) === true/
    );
    assert.doesNotMatch(header, /data-solution-button/);

    const pieceQuizDefinition = macroDefinition(header, 'PentominoQuizIn_');
    assert.match(
      pieceQuizDefinition,
      /window\.LiaPentomino\?\.checkQuiz\?\.\('pentomino-quiz-@0'\) === true/
    );
    const validatorScripts = Array.from(
      header.matchAll(/<script modify="false">([^<]+)<\/script>/g),
      match => match[1]
    );
    assert.equal(validatorScripts.length, 2);
    assert.ok(validatorScripts.every(script => script.length <= 120));
    assert.doesNotMatch(
      header,
      /Number\.isSafeInteger|document\.getElementById|nameMatch|api\.(?:coversSum|dockCoversSum)/
    );

    const [scriptReference] = valuesFor(header, 'script');
    assert.equal(scriptReference, './dist/index.js');
    const bundleUrl = new URL(scriptReference, readmeResponse.url);
    assert.equal(bundleUrl.pathname, CDN_PREFIX + 'dist/index.js');

    const bundleResponse = await fetch(bundleUrl);
    assert.equal(bundleResponse.status, 200);
    assert.match(
      bundleResponse.headers.get('content-type') || '',
      /^application\/javascript/
    );
    assert.equal(bundleResponse.headers.get('access-control-allow-origin'), '*');
    const bundle = await bundleResponse.text();
    assert.match(bundle, /__pentominoHundredChartRuntimeReady/);
    assert.match(bundle, /lia-pentomino-dock-items/);
    assert.doesNotMatch(bundle, /lia-pentomino-dock-(?:fix|delete|actions)/);
    assert.match(bundle, /lia-pentomino-workspace/);
    assert.match(bundle, /activatePiece/);
    assert.match(bundle, /is-return-target/);
    assert.match(bundle, /getDockPieces/);
    assert.match(bundle, /dockCoversSum/);
    assert.match(bundle, /checkQuiz/);
    assert.match(
      bundle,
      /\.lia-pentomino-workspace\{--pentomino-board-size:520px;display:grid/
    );
    assert.match(
      bundle,
      /grid-template-columns:var\(--pentomino-board-size\) minmax\(4\.4rem,35\.4rem\)/
    );
    assert.match(
      bundle,
      /max-width:calc\(var\(--pentomino-board-size\) \+ 36\.75rem\)/
    );
    assert.match(
      bundle,
      /\.lia-pentomino-workspace-board\{[^}]*width:var\(--pentomino-board-size\)[^}]*max-width:100%/
    );
    assert.match(bundle, /\.lia-pentomino-dock\{[^}]*display:flex/);
    assert.match(bundle, /\.lia-pentomino-dock\{[^}]*width:4\.4rem/);
    assert.match(
      bundle,
      /\.lia-pentomino-dock\{[^}]*height:var\(--pentomino-board-size,520px\)/
    );
    assert.match(
      bundle,
      /\.lia-pentomino-dock\.is-expanded\{width:min\(35\.4rem,100%\)\}/
    );
    assert.match(
      bundle,
      /\.lia-pentomino-dock-toggle\{[^}]*flex:0 0 4\.4rem/
    );
    assert.match(
      bundle,
      /\.lia-pentomino-dock-toggle\{[^}]*height:100%!important/
    );
    assert.match(
      bundle,
      /\.lia-pentomino-dock-toggle-label\{[^}]*writing-mode:vertical-rl/
    );
    assert.match(
      bundle,
      /\.lia-pentomino-dock-toggle-label\{[^}]*transform:rotate\(180deg\)/
    );
    assert.match(bundle, /\.lia-pentomino-dock-panel\{[^}]*flex:1 1 31rem/);
    assert.match(
      bundle,
      /\.lia-pentomino-dock-panel\{[^}]*height:var\(--pentomino-board-size,520px\)/
    );
    assert.match(
      bundle,
      /\.lia-pentomino-dock-panel\{[^}]*max-height:var\(--pentomino-board-size,520px\)/
    );
    assert.match(
      bundle,
      /\.lia-pentomino-dock-items\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/
    );
    assert.match(
      bundle,
      /\.lia-pentomino-dock-items\{[^}]*grid-auto-rows:6rem/
    );
    assert.match(bundle, /\.lia-pentomino-dock-item\{[^}]*height:6rem/);
    assert.doesNotThrow(() => new vm.Script(bundle));

    const mapResponse = await fetch(new URL('./index.js.map', bundleUrl));
    assert.equal(mapResponse.status, 200);
    assert.match(mapResponse.headers.get('content-type') || '', /^application\/json/);
    const sourceMap = await mapResponse.json();
    assert.equal(sourceMap.version, 3);
    assert.ok(sourceMap.sources.some(source => source.includes('src/index.ts')));

    const headResponse = await fetch(readmeUrl, { method: 'HEAD' });
    assert.equal(headResponse.status, 200);
    assert.equal(await headResponse.text(), '');
    const optionsResponse = await fetch(origin + CDN_PREFIX, { method: 'OPTIONS' });
    assert.equal(optionsResponse.status, 204);
    const traversalResponse = await fetch(
      origin + CDN_PREFIX + '%2e%2e/package.json'
    );
    assert.equal(traversalResponse.status, 404);
  });
});

test('executes the distributed bundle with an imported chart and two pieces', async () => {
  await withDistributionServer(async ({ bundleUrl }) => {
    const bundle = await (await fetch(bundleUrl)).text();
    const environment = runtimeEnvironment();
    const context = vm.createContext(environment.sandbox);
    new vm.Script(bundle, { filename: bundleUrl }).runInContext(context, {
      timeout: 5000
    });
    environment.flushFrames();

    const { board, boardId, sandbox } = environment;
    assert.equal(sandbox.__pentominoHundredChartRuntimeReady, true);
    assert.equal(board.calls.length, 220);
    assert.equal(board.calls.filter(call => call.type === 'text').length, 100);
    assert.equal(board.calls.filter(call => call.type === 'button').length, 1);
    assert.equal(Object.keys(board.objects).length, 220);

    const labels = board.calls.filter(call => call.type === 'text');
    assert.equal(labels[26].parents[2](), String.fromCodePoint(0x1d465));

    const fixed = sandbox.LiaPentomino.getPiece(boardId, 'T5-X');
    assert.equal(fixed.fixed, true);
    assert.equal(fixed.maskedNumber, 27);
    assert.deepEqual(Array.from(fixed.coveredNumbers), [6, 7, 8, 17, 27]);
    assert.equal(sandbox.LiaPentomino.getCoverageSum(boardId, 'T5-X'), 65);
    assert.equal(sandbox.LiaPentomino.coversSum(boardId, 'T5-X', 65), true);
    assert.equal(typeof sandbox.LiaPentomino.checkQuiz, 'function');

    const pieceQuiz = domElement('span');
    pieceQuiz.id = 'piece-quiz-marker';
    pieceQuiz.className = 'lia-pentomino-quiz';
    pieceQuiz.dataset.boardId = boardId;
    pieceQuiz.dataset.targetSum = '65';
    pieceQuiz.dataset.pieceMarkerId = 'fixed-marker';
    sandbox.document.body.appendChild(pieceQuiz);

    assert.equal(sandbox.LiaPentomino.checkQuiz(pieceQuiz.id), true);
    assert.equal(sandbox.LiaPentomino.checkQuiz('missing-quiz'), false);
    assert.equal(sandbox.LiaPentomino.checkQuiz(null), false);
    for (const rawTarget of [
      '',
      '65.0',
      '6e1',
      'NaN',
      '9007199254740992'
    ]) {
      pieceQuiz.dataset.targetSum = rawTarget;
      assert.equal(sandbox.LiaPentomino.checkQuiz(pieceQuiz.id), false, rawTarget);
    }
    pieceQuiz.dataset.targetSum = '+65';
    assert.equal(sandbox.LiaPentomino.checkQuiz(pieceQuiz.id), true);
    pieceQuiz.dataset.dockMarkerId = 'dock-marker';
    assert.equal(sandbox.LiaPentomino.checkQuiz(pieceQuiz.id), false);
    delete pieceQuiz.dataset.dockMarkerId;
    pieceQuiz.dataset.boardId = 'other-board';
    assert.equal(sandbox.LiaPentomino.checkQuiz(pieceQuiz.id), false);
    pieceQuiz.dataset.boardId = boardId;
    pieceQuiz.className = 'lia-pentomino-quiz lia-pentomino-dock-quiz';
    assert.equal(sandbox.LiaPentomino.checkQuiz(pieceQuiz.id), false);
    pieceQuiz.className = 'lia-pentomino-quiz';

    assert.equal(sandbox.LiaPentomino.getCoverageSum(boardId, 'L5-Move'), 146);
    const rotateButton = board.calls.find(call => call.type === 'button');
    assert.equal(sandbox.LiaPentomino.getPiece(boardId, 'L5-Move').rotation, 0);
    rotateButton.click();
    assert.equal(sandbox.LiaPentomino.getPiece(boardId, 'L5-Move').rotation, 90);

    const callCount = board.calls.length;
    sandbox.__bootstrapPentominoHundredCharts();
    assert.equal(board.calls.length, callCount);

    environment.removeFixedMarker();
    sandbox.__bootstrapPentominoHundredCharts();
    assert.equal(board.removed.length, 26);
    assert.equal(labels[26].parents[2](), '27');
    assert.equal(sandbox.LiaPentomino.getPiece(boardId, 'T5-X'), null);
    assert.equal(sandbox.LiaPentomino.checkQuiz(pieceQuiz.id), false);
    assert.equal(sandbox.LiaPentomino.getPieces(boardId).length, 1);
    assert.equal(environment.warnings.length, 0);
    assert.ok(environment.events.length >= 3);
  });
});

test('executes an imported negative hundred chart marker', async () => {
  await withDistributionServer(async ({ bundleUrl }) => {
    const bundle = await (await fetch(bundleUrl)).text();
    const environment = runtimeEnvironment({
      chartKind: 'negative',
      includeFixed: false,
      movable: false
    });
    const context = vm.createContext(environment.sandbox);
    new vm.Script(bundle, { filename: bundleUrl }).runInContext(context, {
      timeout: 5000
    });
    environment.flushFrames();

    const labels = environment.board.calls.filter(call => call.type === 'text');
    assert.equal(labels.length, 100);
    assert.equal(labels[0].parents[2](), '50');
    assert.equal(labels[50].parents[2](), '0');
    assert.equal(labels[99].parents[2](), '-49');
    assert.equal(
      environment.sandbox.__pentominoHundredChartEntries['chart-marker'].chartKind,
      'negative'
    );
  });
});

test('dock quiz runtime accepts one complete piece and isolates its dock', async () => {
  await withDistributionServer(async ({ bundleUrl }) => {
    const bundle = await (await fetch(bundleUrl)).text();
    const environment = runtimeEnvironment({
      dock: true,
      dockTypes: '[I2,T5]',
      includeFixed: true,
      movable: false
    });
    const context = vm.createContext(environment.sandbox);
    new vm.Script(bundle, { filename: bundleUrl }).runInContext(context, {
      timeout: 5000
    });
    environment.flushFrames();

    const { boardId, sandbox } = environment;
    const api = sandbox.LiaPentomino;
    const dockEntry = sandbox.__pentominoDockEntries['dock-marker'];
    assert.ok(dockEntry);
    assert.equal(typeof api.getDockPieces, 'function');
    assert.equal(typeof api.dockCoversSum, 'function');
    assert.equal(typeof api.checkQuiz, 'function');

    const dockQuiz = domElement('span');
    dockQuiz.id = 'dock-quiz-marker';
    dockQuiz.className = 'lia-pentomino-dock-quiz';
    dockQuiz.dataset.boardId = boardId;
    dockQuiz.dataset.targetSum = '65';
    dockQuiz.dataset.dockMarkerId = 'dock-marker';
    sandbox.document.body.appendChild(dockQuiz);

    assert.equal(api.coversSum(boardId, 'T5-X', 65), true);
    assert.deepEqual(
      Array.from(api.getDockPieces(boardId, 'dock-marker')),
      []
    );
    assert.equal(api.dockCoversSum(boardId, 'dock-marker', 65), false);
    assert.equal(api.checkQuiz(dockQuiz.id), false);

    dockEntry.pieces.push(
      fakeRuntimePiece('I2-Dock-01', 'I2', [1, 2]),
      fakeRuntimePiece('T5-Dock-Partial', 'T5', [6, 7, 8, 17])
    );
    assert.equal(api.dockCoversSum(boardId, 'dock-marker', 65), false);

    dockEntry.pieces.push(
      fakeRuntimePiece('T5-Dock-65', 'T5', [6, 7, 8, 17, 27]),
      fakeRuntimePiece('I2-Dock-190', 'I2', [90, 100])
    );
    assert.deepEqual(
      Array.from(
        api.getDockPieces(boardId, 'dock-marker'),
        state => state.name
      ),
      [
        'I2-Dock-01',
        'T5-Dock-Partial',
        'T5-Dock-65',
        'I2-Dock-190'
      ]
    );
    assert.equal(api.dockCoversSum(boardId, 'dock-marker', 65), true);
    assert.equal(api.dockCoversSum(boardId, 'dock-marker', 190), true);
    assert.equal(api.checkQuiz(dockQuiz.id), true);
    dockQuiz.dataset.targetSum = '190';
    assert.equal(api.checkQuiz(dockQuiz.id), true);
    dockQuiz.dataset.targetSum = '68';
    assert.equal(api.checkQuiz(dockQuiz.id), false);
    dockQuiz.dataset.targetSum = '65';
    dockQuiz.dataset.pieceMarkerId = 'fixed-marker';
    assert.equal(api.checkQuiz(dockQuiz.id), false);
    delete dockQuiz.dataset.pieceMarkerId;
    dockQuiz.dataset.dockMarkerId = 'missing-dock';
    assert.equal(api.checkQuiz(dockQuiz.id), false);
    dockQuiz.dataset.dockMarkerId = 'dock-marker';
    assert.equal(
      api.dockCoversSum(boardId, 'dock-marker', 68),
      false,
      '3 + 65 from two pieces must not be accepted'
    );
    assert.equal(
      api.dockCoversSum(boardId, 'dock-marker', 193),
      false,
      '3 + 190 from two pieces must not be accepted'
    );

    for (const invalidTarget of [
      65.5,
      Number.MAX_SAFE_INTEGER + 1,
      '65',
      NaN,
      Infinity
    ]) {
      assert.equal(
        api.dockCoversSum(boardId, 'dock-marker', invalidTarget),
        false
      );
    }
    assert.equal(api.dockCoversSum('other-board', 'dock-marker', 65), false);
    assert.equal(api.dockCoversSum(boardId, 'missing-dock', 65), false);

    dockEntry.pieces.splice(2, 1);
    assert.equal(api.dockCoversSum(boardId, 'dock-marker', 65), false);
    assert.equal(api.checkQuiz(dockQuiz.id), false);

    const otherMarker = marker(
      'other-dock-marker',
      'lia-pentomino-dock',
      boardId
    );
    otherMarker.dataset.types = '[T5]';
    sandbox.document.body.appendChild(otherMarker);
    sandbox.__pentominoDockEntries['other-dock-marker'] = {
      markerId: 'other-dock-marker',
      boardId,
      runtimeToken: dockEntry.runtimeToken,
      marker: otherMarker,
      board: dockEntry.board,
      container: dockEntry.container,
      signature: '[T5]',
      controller: { isAttached() { return true; } },
      pieces: [
        fakeRuntimePiece('T5-OtherDock-65', 'T5', [6, 7, 8, 17, 27])
      ]
    };

    assert.equal(api.dockCoversSum(boardId, 'dock-marker', 65), false);
    assert.equal(
      api.dockCoversSum(boardId, 'other-dock-marker', 65),
      true
    );
    assert.deepEqual(
      Array.from(
        api.getDockPieces(boardId, 'other-dock-marker'),
        state => state.name
      ),
      ['T5-OtherDock-65']
    );
  });
});

test('executes a filtered imported dock and removes pieces by return and Delete', async () => {
  await withDistributionServer(async ({ bundleUrl }) => {
    const bundle = await (await fetch(bundleUrl)).text();
    const environment = runtimeEnvironment({
      dock: true,
      dockTypes: '[I2,L3,T5]',
      includeFixed: false,
      movable: false,
      emptyDock: true
    });
    const context = vm.createContext(environment.sandbox);
    new vm.Script(bundle, { filename: bundleUrl }).runInContext(context, {
      timeout: 5000
    });
    environment.flushFrames();

    const entry = environment.sandbox.__pentominoDockEntries['dock-marker'];
    assert.ok(entry);
    const hydratedItems = entry.controller.panel.querySelector(
      '.lia-pentomino-dock-items'
    );
    assert.ok(hydratedItems);
    assert.equal(environment.dockMarker.tagName, 'ASIDE');
    assert.equal(entry.controller.element, environment.dockMarker);
    assert.ok(entry.controller.toggleButton.classList.contains('lia-btn'));
    assert.ok(entry.controller.toggleButton.classList.contains('lia-btn--outline'));
    assert.equal(
      entry.controller.toggleButton.getAttribute('aria-controls'),
      entry.controller.panel.id
    );
    assert.equal(
      entry.controller.toggleButton.querySelector(
        '.lia-pentomino-dock-toggle-label'
      ).textContent,
      'Pentominos'
    );
    assert.equal(
      entry.controller.toggleButton.querySelector(
        '.lia-pentomino-dock-chevron'
      ).textContent,
      '›'
    );
    assert.equal(entry.controller.toggleButton.getAttribute('aria-expanded'), 'false');
    assert.equal(entry.controller.panel.hidden, true);
    assert.equal(entry.controller.element.classList.contains('is-expanded'), false);
    assert.equal(entry.controller.panel.querySelector('.lia-pentomino-dock-hint'), null);
    entry.controller.toggleButton.dispatch('click');
    assert.equal(entry.controller.toggleButton.getAttribute('aria-expanded'), 'true');
    assert.equal(entry.controller.panel.hidden, false);
    assert.equal(entry.controller.element.classList.contains('is-expanded'), true);
    entry.controller.toggleButton.dispatch('click');
    assert.equal(entry.controller.toggleButton.getAttribute('aria-expanded'), 'false');
    assert.equal(entry.controller.panel.hidden, true);
    entry.controller.toggleButton.dispatch('click');
    assert.equal(entry.controller.toggleButton.getAttribute('aria-expanded'), 'true');
    assert.equal(entry.controller.panel.hidden, false);
    assert.deepEqual(
      Array.from(
        entry.controller.buttons,
        button => button.dataset.pentominoType
      ),
      ['I2', 'L3', 'T5']
    );
    assert.equal(hydratedItems.children.length, 3);
    assert.equal(environment.board.calls.length, 167);

    const tButton = entry.controller.buttons.find(
      button => button.dataset.pentominoType === 'T5'
    );
    assert.ok(tButton);

    const dropT5 = pointerId => {
      tButton.dispatch('pointerdown', {
        pointerId,
        clientX: 40,
        clientY: 600
      });
      assert.equal(environment.windowListenerCount('pointermove'), 1);
      environment.dispatchWindow('pointermove', {
        pointerId,
        clientX: 260,
        clientY: 260
      });
      environment.dispatchWindow('pointerup', {
        pointerId,
        clientX: 260,
        clientY: 260
      });
      assert.equal(environment.windowListenerCount('pointermove'), 0);
    };

    dropT5(31);
    dropT5(32);

    const states = environment.sandbox.LiaPentomino.getPieces(
      environment.boardId
    );
    assert.equal(states.length, 2);
    assert.deepEqual(
      Array.from(states, state => state.name),
      ['T5-Dock-01', 'T5-Dock-02']
    );
    states.forEach(state => {
      assert.equal(state.type, 'T5');
      assert.equal(state.fixed, false);
      assert.equal(state.rotation, 0);
      assert.equal(state.opacity, 0.58);
      assert.equal(state.coveredNumbers.length, 5);
    });
    assert.equal(
      environment.sandbox.LiaPentomino.getCoverage(
        environment.boardId,
        'T5-Dock-01'
      ).length,
      5
    );
    assert.equal(environment.board.calls.length, 221);
    assert.equal(environment.board.calls.filter(call => call.type === 'button').length, 2);
    assert.equal(entry.controller.placedItems.children.length, 2);
    assert.equal(entry.controller.placedItems.getAttribute('role'), 'listbox');
    entry.controller.placedItems.children.forEach(row => {
      assert.equal(row.getAttribute('role'), 'option');
      assert.equal(row.getAttribute('aria-selected'), 'false');
      assert.equal(row.querySelectorAll('button').length, 0);
      const preview = row.querySelector('.lia-pentomino-dock-preview');
      assert.equal(preview.style.width, '24px');
      assert.equal(preview.style.height, '24px');
      preview.querySelectorAll('.lia-pentomino-dock-cell').forEach(cell => {
        assert.equal(cell.style.width, '8px');
        assert.equal(cell.style.height, '8px');
      });
    });
    assert.equal(
      entry.controller.placedItems.querySelectorAll(
        '.lia-pentomino-dock-actions'
      ).length,
      0
    );
    assert.equal(
      entry.controller.placedItems.querySelectorAll(
        '.lia-pentomino-dock-fix'
      ).length,
      0
    );
    assert.equal(
      entry.controller.placedItems.querySelectorAll(
        '.lia-pentomino-dock-delete'
      ).length,
      0
    );
    const inventoryPreview = tButton.querySelector('.lia-pentomino-dock-preview');
    assert.equal(inventoryPreview.style.width, '36px');
    assert.equal(inventoryPreview.style.height, '36px');
    inventoryPreview.querySelectorAll('.lia-pentomino-dock-cell').forEach(cell => {
      assert.equal(cell.style.width, '12px');
      assert.equal(cell.style.height, '12px');
    });
    const firstCoverage = Array.from(
      environment.sandbox.LiaPentomino.getCoverage(
        environment.boardId,
        'T5-Dock-01'
      )
    );
    const activeRotationButtons = () => Object.values(
      environment.board.objects
    ).filter(object => object.type === 'button');
    assert.equal(activeRotationButtons().length, 2);
    const firstPiece = entry.pieces[0];
    const secondPiece = entry.pieces[1];
    firstPiece.polygons[0].trigger('down', {
      type: 'pointerdown',
      pointerId: 41,
      clientX: 260,
      clientY: 260
    });
    assert.equal(
      entry.controller.placedItems.children[0].getAttribute('aria-selected'),
      'true'
    );
    assert.equal(environment.windowListenerCount('pointermove'), 1);
    assert.equal(environment.windowListenerCount('pointerup'), 1);
    const blockedDelete = environment.dispatchWindow('keydown', {
      key: 'Delete'
    });
    assert.equal(blockedDelete.defaultPrevented, false);
    assert.equal(environment.sandbox.LiaPentomino.getPieces(environment.boardId).length, 2);
    environment.dispatchWindow('pointermove', {
      pointerId: 41,
      clientX: 600,
      clientY: 200
    });
    assert.equal(entry.controller.element.classList.contains('is-return-target'), true);
    environment.dispatchWindow('pointerup', {
      pointerId: 41,
      clientX: 600,
      clientY: 200
    });
    assert.equal(environment.sandbox.LiaPentomino.getPieces(environment.boardId).length, 2);
    await Promise.resolve();
    assert.deepEqual(
      Array.from(
        environment.sandbox.LiaPentomino.getPieces(environment.boardId),
        state => state.name
      ),
      ['T5-Dock-02']
    );
    assert.equal(entry.controller.placedItems.children.length, 1);
    assert.equal(environment.board.removed.length, 27);
    assert.equal(activeRotationButtons().length, 1);
    assert.deepEqual(
      Array.from(
        environment.sandbox.LiaPentomino.getCoverage(
          environment.boardId,
          'T5-Dock-01'
        )
      ),
      []
    );
    assert.equal(firstCoverage.length, 5);
    let removeEvents = environment.events.filter(
      event => event.type === 'lia-pentomino-remove'
    );
    assert.equal(
      removeEvents.filter(event => event.detail.name === 'T5-Dock-01').length,
      1
    );
    assert.equal(removeEvents[0].detail.boardId, environment.boardId);
    assert.equal(removeEvents[0].detail.type, 'T5');

    secondPiece.polygons[0].trigger('down', {
      type: 'pointerdown',
      pointerId: 42,
      clientX: 260,
      clientY: 260
    });
    environment.dispatchWindow('pointerup', {
      pointerId: 42,
      clientX: 260,
      clientY: 260
    });
    await Promise.resolve();
    assert.equal(environment.sandbox.LiaPentomino.getPieces(environment.boardId).length, 1);
    const deleteEvent = environment.dispatchWindow('keydown', { key: 'Delete' });
    assert.equal(deleteEvent.defaultPrevented, true);
    assert.equal(environment.sandbox.LiaPentomino.getPieces(environment.boardId).length, 0);
    assert.equal(entry.controller.placedItems.children.length, 0);
    assert.equal(entry.controller.placedItems.parentElement.hidden, true);
    assert.equal(environment.board.removed.length, 54);
    assert.equal(activeRotationButtons().length, 0);
    removeEvents = environment.events.filter(
      event => event.type === 'lia-pentomino-remove'
    );
    assert.equal(removeEvents.length, 2);
    assert.equal(
      removeEvents.filter(event => event.detail.name === 'T5-Dock-01').length,
      1
    );
    assert.equal(
      removeEvents.filter(event => event.detail.name === 'T5-Dock-02').length,
      1
    );

    const callCount = environment.board.calls.length;
    environment.sandbox.__bootstrapPentominoHundredCharts();
    assert.equal(environment.board.calls.length, callCount);
    assert.equal(hydratedItems.children.length, 3);
    assert.equal(entry.controller.placedItems.children.length, 0);

    environment.removeDockMarker();
    environment.sandbox.__bootstrapPentominoHundredCharts();
    assert.equal(
      environment.sandbox.LiaPentomino.getPieces(environment.boardId).length,
      0
    );
    assert.equal(environment.board.removed.length, 54);
    assert.equal(hydratedItems.children.length, 0);
    assert.equal(entry.controller.placedItems.children.length, 0);
    assert.equal(environment.warnings.length, 0);
    assert.ok(environment.events.length >= 4);
  });
});

test('waits for lia-coordinate and survives a board replacement', async () => {
  await withDistributionServer(async ({ bundleUrl }) => {
    const bundle = await (await fetch(bundleUrl)).text();
    const environment = runtimeEnvironment({ registerBoard: false, movable: false });
    const context = vm.createContext(environment.sandbox);
    const script = new vm.Script(bundle, { filename: bundleUrl });
    script.runInContext(context, { timeout: 5000 });
    environment.flushFrames();
    assert.equal(environment.board.calls.length, 0);

    environment.registerCurrentBoard();
    environment.signalBoardMutation();
    environment.flushFrames();
    const firstBoard = environment.board;
    assert.equal(firstBoard.calls.length, 193);
    assert.equal(
      environment.sandbox.LiaPentomino.getCoverageSum(
        environment.boardId,
        'T5-X'
      ),
      65
    );

    const replacement = environment.replaceBoard();
    environment.sandbox.__bootstrapPentominoHundredCharts();
    assert.equal(firstBoard.removed.length, 193);
    assert.equal(replacement.calls.length, 193);

    script.runInContext(context, { timeout: 5000 });
    environment.flushFrames();
    assert.equal(replacement.calls.length, 193);
    assert.equal(environment.warnings.length, 0);
  });
});
