import assert from 'node:assert/strict';
import test from 'node:test';

import {
  boardCoordinatesFromPointer,
  createPentominoDock,
  parsePentominoDockTypes,
  pentominoDockPlacement
} from '../src/dock.ts';
import {
  DEFAULT_PENTOMINO_OPACITY,
  PENTOMINO_TYPES
} from '../src/pentominoes.ts';

class FakeElement {
  constructor(tagName = 'div') {
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.id = '';
    this.className = '';
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.children = [];
    this.parentNode = null;
    this.parentElement = null;
    this.isConnected = true;
    this.hidden = false;
    this.attributes = new Map();
    this.listeners = new Map();
    this.capturedPointers = new Set();
    this.classList = {
      contains: value => this.classNames().includes(value),
      add: value => {
        const names = new Set(this.classNames());
        names.add(value);
        this.className = Array.from(names).join(' ');
      },
      remove: value => {
        this.className = this.classNames()
          .filter(name => name !== value)
          .join(' ');
      },
      toggle: (value, force) => {
        const present = this.classNames().includes(value);
        const enabled = force === undefined ? !present : !!force;
        if (enabled) this.classList.add(value);
        else this.classList.remove(value);
        return enabled;
      }
    };
  }

  classNames() {
    return String(this.className).split(/\s+/).filter(Boolean);
  }

  get firstChild() {
    return this.children[0] || null;
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    child.parentElement = this;
    child.isConnected = this.isConnected;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter(item => item !== child);
    child.parentNode = null;
    child.parentElement = null;
    child.isConnected = false;
    return child;
  }

  remove() {
    this.parentNode?.removeChild(this);
    this.isConnected = false;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  matches(selector) {
    if (selector.startsWith('.')) {
      return this.classNames().includes(selector.slice(1));
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = element => {
      element.children.forEach(child => {
        if (child.matches(selector)) found.push(child);
        visit(child);
      });
    };
    visit(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) || []).filter(item => item !== listener)
    );
  }

  listenerCount(type) {
    return (this.listeners.get(type) || []).length;
  }

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
    (this.listeners.get(type) || []).slice().forEach(listener => listener(event));
    return event;
  }

  setPointerCapture(pointerId) {
    this.capturedPointers.add(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.capturedPointers.delete(pointerId);
  }
}

function fakeWindow() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const registered = listeners.get(type) || [];
      registered.push(listener);
      listeners.set(type, registered);
    },
    removeEventListener(type, listener) {
      listeners.set(
        type,
        (listeners.get(type) || []).filter(item => item !== listener)
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
        ...init
      };
      (listeners.get(type) || []).slice().forEach(listener => listener(event));
      return event;
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    }
  };
}

function fakeDocument() {
  const documentElement = new FakeElement('html');
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  const byId = (root, id) => {
    if (root.id === id) return root;
    for (const child of root.children) {
      const found = byId(child, id);
      if (found) return found;
    }
    return null;
  };

  return {
    documentElement,
    head,
    body,
    createElement(tagName) { return new FakeElement(tagName); },
    getElementById(id) { return byId(documentElement, id); }
  };
}

test('maps browser pointers through JSXGraph coordinates and a linear fallback', () => {
  let jsxCalls = 0;
  const container = {
    getBoundingClientRect() {
      return { left: 100, top: 50, right: 500, bottom: 450, width: 400, height: 400 };
    }
  };
  const board = {
    containerObj: container,
    getBoundingBox() { return [-0.15, 10.15, 10.15, -0.15]; },
    getUsrCoordsOfMouse() {
      jsxCalls += 1;
      return [3.25, 6.75];
    }
  };

  assert.deepEqual(
    boardCoordinatesFromPointer(board, { clientX: 250, clientY: 300 }),
    [3.25, 6.75]
  );
  assert.equal(jsxCalls, 1);
  assert.equal(
    boardCoordinatesFromPointer(board, { clientX: 99, clientY: 300 }),
    null
  );
  assert.equal(jsxCalls, 1);

  delete board.getUsrCoordsOfMouse;
  const center = boardCoordinatesFromPointer(board, { clientX: 300, clientY: 250 });
  assert.ok(Math.abs(center[0] - 5) < 1e-12);
  assert.ok(Math.abs(center[1] - 5) < 1e-12);
});

test('places every catalog type fully inside the hundred chart', () => {
  assert.equal(DEFAULT_PENTOMINO_OPACITY, 0.58);

  PENTOMINO_TYPES.forEach(type => {
    const placement = pentominoDockPlacement(type, -20, 30);
    const expectedCellCount = Number(type.at(-1));
    assert.equal(placement.type, type);
    assert.equal(placement.rotation, 0);
    assert.equal(placement.cells.length, expectedCellCount);
    assert.equal(placement.numbers.length, expectedCellCount);
    assert.equal(new Set(placement.numbers).size, expectedCellCount);
    placement.cells.forEach(([x, y]) => {
      assert.ok(Number.isInteger(x) && x >= 0 && x < 10);
      assert.ok(Number.isInteger(y) && y >= 0 && y < 10);
    });
  });

  assert.deepEqual(
    pentominoDockPlacement('T5', 5, 5).numbers,
    [45, 46, 47, 56, 66]
  );
  assert.equal(pentominoDockPlacement('T5', Number.NaN, 5), null);
});

test('parses ordered, case-insensitive and deduplicated Dock type filters', () => {
  for (const all of [undefined, '', 'all', 'ALL']) {
    assert.deepEqual(parsePentominoDockTypes(all), {
      types: PENTOMINO_TYPES,
      errors: []
    });
  }

  assert.deepEqual(parsePentominoDockTypes('[t5,i2,T5,l3,I2]'), {
    types: ['T5', 'I2', 'L3'],
    errors: []
  });
  assert.deepEqual(parsePentominoDockTypes('`[i2; L3 t4]`'), {
    types: ['I2', 'L3', 'T4'],
    errors: []
  });
  assert.deepEqual(parsePentominoDockTypes('[t,I2]'), {
    types: ['T5', 'I2'],
    errors: []
  });

  for (const invalid of ['[]', '[I2,L3', 'I2,L3]', '[I2,Q4]']) {
    const parsed = parsePentominoDockTypes(invalid);
    assert.equal(parsed.errors.length, 1, invalid);
    if (invalid !== '[I2,Q4]') assert.deepEqual(parsed.types, []);
  }
  assert.deepEqual(parsePentominoDockTypes('[I2,Q4]').types, ['I2']);
});

test('renders an accessible Lia sidebar and removes selected Dock pieces', async () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const document = fakeDocument();
  const window = fakeWindow();
  globalThis.document = document;
  globalThis.window = window;

  try {
    const marker = new FakeElement('aside');
    marker.id = 'dock-test';
    marker.className = 'lia-pentomino-dock';
    marker.getBoundingClientRect = () => ({
      left: 540,
      top: 0,
      right: 900,
      bottom: 520,
      width: 360,
      height: 520
    });
    document.body.appendChild(marker);

    const boardContainer = new FakeElement('div');
    boardContainer.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 520,
      bottom: 520,
      width: 520,
      height: 520
    });
    const board = {
      containerObj: boardContainer,
      getBoundingBox() { return [-0.15, 10.15, 10.15, -0.15]; }
    };
    const requests = [];
    const removedNames = [];
    let fixedRequests = 0;
    const controller = createPentominoDock(marker, board, {
      onAdd(request) {
        requests.push(request);
        return request.type + '-' + requests.length;
      },
      onSetFixed() {
        fixedRequests += 1;
        return true;
      },
      onRemove(name) {
        removedNames.push(name);
        return true;
      }
    });
    const items = controller.panel.querySelector('.lia-pentomino-dock-items');

    assert.equal(controller.element, marker);
    assert.ok(items);
    assert.equal(marker.tagName, 'ASIDE');
    assert.equal(marker.querySelectorAll('details').length, 0);
    assert.equal(marker.querySelectorAll('summary').length, 0);
    assert.ok(controller.toggleButton.classList.contains('lia-btn'));
    assert.ok(controller.toggleButton.classList.contains('lia-btn--outline'));
    assert.equal(
      controller.toggleButton.getAttribute('aria-controls'),
      controller.panel.id
    );
    assert.equal(
      controller.toggleButton.querySelector(
        '.lia-pentomino-dock-toggle-label'
      ).textContent,
      'Pentominos'
    );
    assert.equal(
      controller.toggleButton.querySelector(
        '.lia-pentomino-dock-chevron'
      ).textContent,
      '›'
    );
    assert.equal(controller.toggleButton.getAttribute('aria-expanded'), 'false');
    assert.match(controller.toggleButton.getAttribute('aria-label'), /nach rechts/);
    assert.equal(controller.panel.hidden, true);
    assert.equal(marker.classList.contains('is-expanded'), false);
    controller.toggleButton.dispatch('click');
    assert.equal(controller.toggleButton.getAttribute('aria-expanded'), 'true');
    assert.equal(controller.panel.hidden, false);
    assert.equal(marker.classList.contains('is-expanded'), true);
    controller.toggleButton.dispatch('click');
    assert.equal(controller.toggleButton.getAttribute('aria-expanded'), 'false');
    assert.equal(controller.panel.hidden, true);
    controller.toggleButton.dispatch('click');
    assert.equal(controller.toggleButton.getAttribute('aria-expanded'), 'true');
    assert.equal(controller.panel.hidden, false);
    assert.equal(items.parentElement, controller.panel);
    assert.deepEqual(marker.children.slice(0, 2), [
      controller.toggleButton,
      controller.panel
    ]);
    assert.equal(marker.querySelector('.lia-pentomino-dock-hint'), null);

    const css = document.getElementById('lia-pentomino-dock-styles').textContent;
    assert.match(
      css,
      /\.lia-pentomino-workspace\{--pentomino-board-size:520px;display:flex/
    );
    assert.match(
      css,
      /flex-wrap:wrap/
    );
    assert.match(
      css,
      /max-width:calc\(var\(--pentomino-board-size\) \+ 36\.75rem\)/
    );
    assert.match(
      css,
      /\.lia-pentomino-workspace-board\{[^}]*width:var\(--pentomino-board-size\)/
    );
    assert.match(
      css,
      /\.lia-pentomino-workspace-board\{[^}]*max-width:100%/
    );
    assert.doesNotMatch(
      css,
      /\.lia-pentomino-workspace-board\{[^}]*max-width:32\.5rem/
    );
    assert.match(css, /\.lia-pentomino-dock\{[^}]*display:flex/);
    assert.match(css, /\.lia-pentomino-dock\{[^}]*align-items:stretch/);
    assert.match(css, /\.lia-pentomino-dock\{[^}]*width:4\.4rem/);
    assert.match(
      css,
      /\.lia-pentomino-dock\{[^}]*height:var\(--pentomino-board-size,520px\)/
    );
    assert.match(
      css,
      /\.lia-pentomino-dock\{[^}]*max-height:var\(--pentomino-board-size,520px\)/
    );
    assert.match(
      css,
      /\.lia-pentomino-dock\.is-expanded\{width:min\(35\.4rem,100%\)\}/
    );
    assert.match(css, /\.lia-pentomino-dock-toggle\{[^}]*flex:0 0 4\.4rem/);
    assert.match(css, /\.lia-pentomino-dock-toggle\{[^}]*flex-direction:column/);
    assert.match(css, /\.lia-pentomino-dock-toggle\{[^}]*width:4\.4rem!important/);
    assert.match(css, /\.lia-pentomino-dock-toggle\{[^}]*height:100%!important/);
    assert.match(
      css,
      /\.lia-pentomino-dock-toggle-label\{[^}]*writing-mode:vertical-rl/
    );
    assert.match(
      css,
      /\.lia-pentomino-dock-toggle-label\{[^}]*text-orientation:mixed/
    );
    assert.match(
      css,
      /\.lia-pentomino-dock-toggle-label\{[^}]*transform:rotate\(180deg\)/
    );
    assert.match(
      css,
      /\.lia-pentomino-dock\.is-expanded \.lia-pentomino-dock-toggle\{[^}]*border-right-color:transparent/
    );
    assert.match(css, /\.lia-pentomino-dock-panel\{[^}]*flex:1 1 31rem/);
    assert.match(
      css,
      /\.lia-pentomino-dock-panel\{[^}]*height:var\(--pentomino-board-size,520px\)/
    );
    assert.match(
      css,
      /\.lia-pentomino-dock-panel\{[^}]*max-height:var\(--pentomino-board-size,520px\)/
    );
    assert.match(css, /\.lia-pentomino-dock-panel\{[^}]*overflow-y:auto/);
    assert.match(
      css,
      /\.lia-pentomino-dock-items\{[^}]*grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,max\(6\.4rem,64px\)\),1fr\)\)/
    );
    assert.match(css, /\.lia-pentomino-dock-items\{[^}]*grid-auto-rows:6rem/);
    assert.match(css, /\.lia-pentomino-dock-item\{[^}]*height:6rem/);
    assert.match(css, /\.lia-pentomino-dock-item\{[^}]*touch-action:pan-y/);
    assert.match(css, /\.lia-pentomino-dock\.is-return-target/);
    assert.doesNotMatch(css, /lia-pentomino-dock-(?:fix|delete|actions)/);
    assert.doesNotMatch(css, /@media\(max-width:/);
    assert.match(css, /\.lia-pentomino-dock-panel\[hidden\]/);
    assert.match(css, /rgb\(var\(--color-highlight/);

    assert.equal(controller.buttons.length, 20);
    assert.deepEqual(
      controller.buttons.map(button => button.dataset.pentominoType),
      PENTOMINO_TYPES
    );
    controller.buttons.forEach(button => {
      assert.equal(button.textContent, '');
      const cells = button.querySelectorAll('.lia-pentomino-dock-cell');
      assert.equal(cells.length, Number(button.dataset.pentominoType.at(-1)));
      cells.forEach(cell => {
        assert.equal(cell.style.width, '12px');
        assert.equal(cell.style.height, '12px');
      });
      assert.match(button.getAttribute('aria-label'), /ins Hunderterfeld ziehen/);
    });
    const i5Preview = controller.buttons[PENTOMINO_TYPES.indexOf('I5')]
      .querySelector('.lia-pentomino-dock-preview');
    assert.equal(i5Preview.style.width, '60px');
    assert.equal(i5Preview.style.height, '12px');
    const t5Preview = controller.buttons[PENTOMINO_TYPES.indexOf('T5')]
      .querySelector('.lia-pentomino-dock-preview');
    assert.equal(t5Preview.style.width, '36px');
    assert.equal(t5Preview.style.height, '36px');

    const tButton = controller.buttons[PENTOMINO_TYPES.indexOf('T5')];
    tButton.dispatch('pointerdown', { pointerId: 7, clientX: 40, clientY: 600 });
    assert.equal(window.listenerCount('pointermove'), 1);
    assert.equal(document.body.querySelectorAll('.lia-pentomino-dock-ghost').length, 1);
    window.dispatch('pointermove', { pointerId: 7, clientX: 260, clientY: 260 });
    window.dispatch('pointerup', { pointerId: 7, clientX: 260, clientY: 260 });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].type, 'T5');
    assert.equal(controller.placedItems.children.length, 1);
    assert.equal(document.body.querySelectorAll('.lia-pentomino-dock-ghost').length, 0);
    assert.equal(window.listenerCount('pointermove'), 0);

    tButton.dispatch('click');
    assert.equal(requests.length, 1);
    tButton.dispatch('click');
    assert.equal(requests.length, 2);
    assert.equal(requests[1].type, 'T5');
    assert.equal(controller.placedItems.children.length, 2);

    const placed = marker.querySelector('.lia-pentomino-dock-placed');
    assert.equal(placed.hidden, false);
    assert.equal(controller.placedItems.getAttribute('role'), 'listbox');
    assert.equal(
      controller.placedItems.getAttribute('aria-label'),
      'Pentominos im Feld'
    );
    controller.placedItems.children.forEach(row => {
      assert.equal(row.getAttribute('role'), 'option');
      assert.equal(row.getAttribute('aria-selected'), 'false');
      assert.equal(row.tabIndex, 0);
      assert.equal(row.querySelectorAll('button').length, 0);
      row.querySelectorAll('.lia-pentomino-dock-cell').forEach(cell => {
        assert.equal(cell.style.width, '8px');
        assert.equal(cell.style.height, '8px');
      });
    });
    assert.equal(
      controller.placedItems.querySelectorAll('.lia-pentomino-dock-actions').length,
      0
    );
    assert.equal(
      controller.placedItems.querySelectorAll('.lia-pentomino-dock-fix').length,
      0
    );
    assert.equal(
      controller.placedItems.querySelectorAll('.lia-pentomino-dock-delete').length,
      0
    );
    assert.equal(fixedRequests, 0);
    assert.equal(controller.activatePiece('unknown-name'), false);

    assert.equal(controller.activatePiece('T5-1', {
      type: 'mousedown',
      clientX: 260,
      clientY: 260
    }), true);
    assert.equal(window.listenerCount('mousemove'), 1);
    assert.equal(window.listenerCount('mouseup'), 1);
    window.dispatch('mousemove', { clientX: 600, clientY: 200 });
    assert.equal(marker.classList.contains('is-return-target'), true);
    window.dispatch('mouseup', { clientX: 260, clientY: 260 });
    await Promise.resolve();
    assert.deepEqual(removedNames, []);
    assert.equal(marker.classList.contains('is-return-target'), false);
    assert.equal(window.listenerCount('mousemove'), 0);
    assert.equal(window.listenerCount('mouseup'), 0);

    assert.equal(controller.activatePiece('T5-1', {
      type: 'touchstart',
      touches: [{ identifier: 61, clientX: 260, clientY: 260 }]
    }), true);
    assert.equal(window.listenerCount('touchmove'), 1);
    assert.equal(window.listenerCount('touchend'), 1);
    window.dispatch('touchmove', {
      clientX: Number.NaN,
      clientY: Number.NaN,
      pointerId: Number.NaN,
      touches: [{ identifier: 61, clientX: 600, clientY: 200 }]
    });
    assert.equal(marker.classList.contains('is-return-target'), true);
    window.dispatch('touchcancel', {
      clientX: Number.NaN,
      clientY: Number.NaN,
      pointerId: Number.NaN,
      changedTouches: [{ identifier: 61, clientX: 260, clientY: 260 }]
    });
    assert.deepEqual(removedNames, []);
    assert.equal(marker.classList.contains('is-return-target'), false);
    assert.equal(window.listenerCount('touchmove'), 0);
    assert.equal(window.listenerCount('touchend'), 0);

    const firstRow = controller.placedItems.children[0];
    assert.equal(controller.activatePiece('T5-1', {
      type: 'pointerdown',
      pointerId: 71,
      clientX: 260,
      clientY: 260
    }), true);
    assert.equal(firstRow.getAttribute('aria-selected'), 'true');
    assert.equal(firstRow.classList.contains('is-selected'), true);
    assert.equal(window.listenerCount('pointermove'), 1);
    assert.equal(window.listenerCount('pointerup'), 1);
    const activeDelete = window.dispatch('keydown', { key: 'Delete' });
    assert.equal(activeDelete.defaultPrevented, false);
    assert.deepEqual(removedNames, []);
    window.dispatch('pointermove', {
      pointerId: 71,
      clientX: 600,
      clientY: 200
    });
    assert.equal(marker.classList.contains('is-return-target'), true);
    window.dispatch('pointerup', {
      pointerId: 71,
      clientX: 600,
      clientY: 200
    });
    assert.deepEqual(removedNames, []);
    await Promise.resolve();
    assert.deepEqual(removedNames, ['T5-1']);
    assert.equal(controller.placedItems.children.length, 1);
    assert.equal(placed.hidden, false);
    assert.equal(marker.classList.contains('is-return-target'), false);
    assert.equal(window.listenerCount('pointermove'), 0);
    assert.equal(window.listenerCount('pointerup'), 0);
    window.dispatch('pointerup', {
      pointerId: 71,
      clientX: 600,
      clientY: 200
    });
    await Promise.resolve();
    assert.deepEqual(removedNames, ['T5-1']);

    const remainingRow = controller.placedItems.children[0];
    remainingRow.dispatch('focus');
    assert.equal(remainingRow.getAttribute('aria-selected'), 'true');
    const editableDelete = window.dispatch('keydown', {
      key: 'Delete',
      target: new FakeElement('input')
    });
    assert.equal(editableDelete.defaultPrevented, false);
    ['altKey', 'ctrlKey', 'metaKey'].forEach(modifier => {
      const event = window.dispatch('keydown', {
        key: 'Delete',
        [modifier]: true
      });
      assert.equal(event.defaultPrevented, false);
    });
    assert.deepEqual(removedNames, ['T5-1']);
    const deleteEvent = window.dispatch('keydown', { key: 'Delete' });
    assert.equal(deleteEvent.defaultPrevented, true);
    assert.deepEqual(removedNames, ['T5-1', 'T5-2']);
    assert.equal(controller.placedItems.children.length, 0);
    assert.equal(placed.hidden, true);
    assert.equal(fixedRequests, 0);

    const fButton = controller.buttons[0];
    fButton.dispatch('pointerdown', { pointerId: 8, clientX: 40, clientY: 600 });
    window.dispatch('pointermove', { pointerId: 8, clientX: 700, clientY: 700 });
    window.dispatch('pointerup', { pointerId: 8, clientX: 700, clientY: 700 });
    assert.equal(requests.length, 2);

    const expandedBeforeDispose = controller.toggleButton.getAttribute(
      'aria-expanded'
    );
    controller.dispose();
    controller.dispose();
    assert.equal(items.children.length, 0);
    assert.equal(controller.placedItems.children.length, 0);
    assert.equal(controller.isAttached(), false);
    assert.equal(window.listenerCount('pointermove'), 0);
    assert.equal(controller.toggleButton.listenerCount('click'), 0);
    controller.toggleButton.dispatch('click');
    assert.equal(
      controller.toggleButton.getAttribute('aria-expanded'),
      expandedBeforeDispose
    );
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

test('renders only the configured named Dock types in authored order', () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const document = fakeDocument();
  const window = fakeWindow();
  globalThis.document = document;
  globalThis.window = window;

  try {
    const marker = new FakeElement('aside');
    const items = new FakeElement('div');
    items.className = 'lia-pentomino-dock-items';
    marker.appendChild(items);
    document.body.appendChild(marker);
    const boardContainer = new FakeElement('div');
    boardContainer.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 520,
      bottom: 520,
      width: 520,
      height: 520
    });
    const requests = [];
    const controller = createPentominoDock(
      marker,
      {
        containerObj: boardContainer,
        getBoundingBox() { return [-0.15, 10.15, 10.15, -0.15]; }
      },
      {
        types: parsePentominoDockTypes('[T5,I2,L3,O4]').types,
        onAdd(request) {
          requests.push(request);
          return request.type + '-filtered-' + requests.length;
        },
        onSetFixed() { return true; },
        onRemove() { return true; }
      }
    );

    assert.deepEqual(
      controller.buttons.map(button => button.dataset.pentominoType),
      ['T5', 'I2', 'L3', 'O4']
    );
    controller.buttons[1].dispatch('click');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].type, 'I2');
    assert.equal(requests[0].cells.length, 2);
    assert.equal(requests[0].numbers.length, 2);
    assert.equal(controller.placedItems.children.length, 1);
    controller.dispose();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});
