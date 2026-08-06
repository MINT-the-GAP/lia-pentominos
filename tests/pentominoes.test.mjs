import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PENTOMINO_CELLS,
  PENTOMINO_COLORS,
  PENTOMINO_TYPES,
  coveredHundredChartNumbers,
  createPentomino,
  getAbsolutePentominoCells,
  getPentominoCells,
  hundredChartCoverageSum,
  normalizeRotation,
  parsePentominoSpecs
} from '../src/pentominoes.ts';

function cellKey(cell) {
  return cell[0] + ',' + cell[1];
}

function isEdgeConnected(cells) {
  const remaining = new Set(cells.map(cellKey));
  const queue = [cells[0]];
  remaining.delete(cellKey(cells[0]));

  while (queue.length) {
    const [x, y] = queue.shift();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const neighbor = x + dx + ',' + (y + dy);
      if (!remaining.has(neighbor)) return;
      remaining.delete(neighbor);
      queue.push([x + dx, y + dy]);
    });
  }

  return remaining.size === 0;
}

function canonicalFreeShape(cells) {
  const variants = [];
  for (const reflected of [false, true]) {
    for (let quarterTurn = 0; quarterTurn < 4; quarterTurn += 1) {
      const transformed = cells.map(([rawX, rawY]) => {
        let x = reflected ? -rawX : rawX;
        let y = rawY;
        for (let turn = 0; turn < quarterTurn; turn += 1) {
          [x, y] = [-y, x];
        }
        return [x, y];
      });
      const minimumX = Math.min(...transformed.map(cell => cell[0]));
      const minimumY = Math.min(...transformed.map(cell => cell[1]));
      variants.push(
        transformed
          .map(([x, y]) => [x - minimumX, y - minimumY])
          .sort((left, right) => left[1] - right[1] || left[0] - right[0])
          .map(cellKey)
          .join(';')
      );
    }
  }
  return variants.sort()[0];
}

function interactiveBoard() {
  let sequence = 0;
  let suspended = 0;
  let resumed = 0;
  let updates = 0;
  const calls = [];
  const coordinateModes = [];
  const removed = [];

  const board = {
    calls,
    coordinateModes,
    removed,
    objects: {},
    isSuspendedUpdate: false,
    containerObj: { isConnected: true },
    getBoundingBox() { return [-0.15, 10.15, 10.15, -0.15]; },
    get suspended() { return suspended; },
    get resumed() { return resumed; },
    get updates() { return updates; },
    create(type, parents, attributes) {
      const handlers = {};
      const object = {
        id: 'object-' + (++sequence),
        board,
        type,
        parents,
        attributes,
        on(event, handler) {
          handlers[event] = handlers[event] || [];
          handlers[event].push(handler);
          return object;
        },
        off(event, handler) {
          handlers[event] = (handlers[event] || []).filter(item => item !== handler);
          return object;
        },
        trigger(event, payload) {
          (handlers[event] || []).forEach(handler => handler(payload));
        },
        handlerCount(event) {
          return (handlers[event] || []).length;
        },
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
        object.setPositionDirectly = (_method, coordinates) => {
          coordinateModes.push(_method);
          object._x = Number(coordinates[0]);
          object._y = Number(coordinates[1]);
        };
      }

      if (type === 'button') {
        const domAttributes = {};
        object.rendNodeButton = {
          setAttribute(name, value) {
            domAttributes[name] = value;
          },
          getAttribute(name) {
            return domAttributes[name];
          }
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
    suspendUpdate() {
      suspended += 1;
      board.isSuspendedUpdate = true;
    },
    unsuspendUpdate() {
      resumed += 1;
      board.isSuspendedUpdate = false;
      updates += 1;
    },
    update() { updates += 1; }
  };

  return board;
}

test('catalog contains all twenty distinct, connected polyominoes from two to five cells', () => {
  assert.deepEqual(PENTOMINO_TYPES, [
    'I2',
    'I3', 'L3',
    'I4', 'O4', 'T4', 'L4', 'S4',
    'F5', 'I5', 'L5', 'P5', 'N5', 'T5',
    'U5', 'V5', 'W5', 'X5', 'Y5', 'Z5'
  ]);
  assert.equal(new Set(Object.values(PENTOMINO_COLORS)).size, 20);

  PENTOMINO_TYPES.forEach(type => {
    const cells = PENTOMINO_CELLS[type];
    const expectedCellCount = Number(type.at(-1));
    assert.equal(cells.length, expectedCellCount, type);
    assert.equal(new Set(cells.map(cellKey)).size, expectedCellCount, type);
    assert.equal(isEdgeConnected(cells), true, type);
  });
  assert.equal(
    new Set(PENTOMINO_TYPES.map(type => canonicalFreeShape(PENTOMINO_CELLS[type]))).size,
    20
  );
});

test('quarter turns stay normalized and preserve every cell', () => {
  PENTOMINO_TYPES.forEach(type => {
    [0, 90, 180, 270].forEach(rotation => {
      const cells = getPentominoCells(type, rotation);
      const expectedCellCount = Number(type.at(-1));
      assert.equal(cells.length, expectedCellCount);
      assert.equal(new Set(cells.map(cellKey)).size, expectedCellCount);
      assert.equal(Math.min(...cells.map(cell => cell[0])), 0);
      assert.equal(Math.min(...cells.map(cell => cell[1])), 0);
    });
    assert.deepEqual(getPentominoCells(type, 360), getPentominoCells(type, 0));
  });

  assert.equal(normalizeRotation(-90), 270);
  assert.equal(normalizeRotation(450), 90);
});

test('T5 at the reference position covers 6, 7, 8, 17 and 27', () => {
  const cells = getAbsolutePentominoCells('T5', 0, 5, 7);
  const numbers = coveredHundredChartNumbers(cells);
  assert.deepEqual(numbers, [6, 7, 8, 17, 27]);
  assert.equal(hundredChartCoverageSum(numbers), 65);
});

test('coverage sums support both chart kinds and reject wrong lengths or values', () => {
  assert.equal(hundredChartCoverageSum([6, 7], 2), 13);
  assert.equal(hundredChartCoverageSum([6, 7, 8], 3), 21);
  assert.equal(hundredChartCoverageSum([6, 7, 8, 17], 4), 38);
  assert.equal(hundredChartCoverageSum([16, 17, 18, 27, 37]), 115);
  assert.equal(hundredChartCoverageSum([68, 69], 2, 'negative'), -35);
  assert.equal(hundredChartCoverageSum([2, 3], 2, 'negative'), 97);
  assert.equal(
    hundredChartCoverageSum([6, 7, 8, 17, 27], 5, 'negative'),
    190
  );
  assert.equal(hundredChartCoverageSum([6, 7], 3), null);
  assert.equal(hundredChartCoverageSum([6, 7, 8], 2), null);
  assert.equal(hundredChartCoverageSum([16, 17, 18, 27]), null);
  assert.equal(hundredChartCoverageSum([16, 17, 18, 27, 101]), null);
  assert.equal(hundredChartCoverageSum([16, 17, 18, 27, 27]), null);
  assert.equal(hundredChartCoverageSum([68], 2, 'negative'), null);
});

test('parser accepts every cell count, case-insensitive names and number permutations', () => {
  const parsed = parsePentominoSpecs([
    'name=I2-small;type=i2;numbers=[7,6]',
    'name=I3-small;type=I3;numbers=[8,6,7]',
    'name=L3-small;type=l3;numbers=[17,6,16]',
    'name=O4-small;type=O4;numbers=[17,6,16,7]',
    'name=T4-fixed;type=t4;numbers=[17=x,8,6,7];fixed=true',
    'name=L4-small;type=L4;numbers=[27,6,26,16]',
    'name=S4-small;type=S4;numbers=[18,6,17,7]'
  ].join('\n'));

  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(
    parsed.configs.map(config => config.type),
    ['I2', 'I3', 'L3', 'O4', 'T4', 'L4', 'S4']
  );
  assert.deepEqual(
    parsed.configs.map(config => Number(config.type.at(-1))),
    parsed.configs.map(config =>
      coveredHundredChartNumbers(
        getAbsolutePentominoCells(
          config.type,
          config.rotation,
          config.x,
          config.y
        )
      ).length
    )
  );
  assert.equal(parsed.configs[4].fixed, true);
  assert.equal(parsed.configs[4].maskedNumber, 17);
});

test('parser infers a unique x for smaller shapes and enforces each type length', () => {
  const inferred = parsePentominoSpecs(
    'name=I3-gap;type=I3;numbers=[8,x,6]'
  );
  assert.deepEqual(inferred.errors, []);
  assert.equal(inferred.configs[0].maskedNumber, 7);

  const invalid = parsePentominoSpecs([
    'name=I2-short;type=I2;numbers=[6]',
    'name=L3-long;type=L3;numbers=[6,16,17,27]',
    'name=O4-short;type=O4;numbers=[6,7,16]',
    'name=T5-short-again;type=T5;numbers=[6,7,8,17]'
  ].join('\n'));
  assert.equal(invalid.configs.length, 0);
  assert.deepEqual(
    Array.from(
      new Set(
        invalid.errors
          .filter(error => /numbers muss [2345]/.test(error.message))
          .map(error => error.line)
      )
    ),
    [1, 2, 3, 4]
  );
});

test('parser derives placement from any numbers permutation and accepts batches', () => {
  const canonical = parsePentominoSpecs(
    'name=T5-canonical;type=T5;numbers=[6,7,8,17,27]'
  );
  const permuted = parsePentominoSpecs(
    'name=T5-permuted;type=T5;numbers=[27,6,17,8,7]'
  );

  assert.deepEqual(canonical.errors, []);
  assert.deepEqual(permuted.errors, []);
  assert.deepEqual(
    [canonical.configs[0].x, canonical.configs[0].y, canonical.configs[0].rotation],
    [permuted.configs[0].x, permuted.configs[0].y, permuted.configs[0].rotation]
  );
  assert.deepEqual(
    [permuted.configs[0].x, permuted.configs[0].y, permuted.configs[0].rotation],
    [5, 7, 0]
  );
  assert.equal(permuted.configs[0].fixed, false);
  assert.equal(permuted.configs[0].maskedNumber, null);
  assert.equal(permuted.configs[0].color, PENTOMINO_COLORS.T5);

  const parsed = parsePentominoSpecs([
    'name=T5-01;type=T5;numbers=[6,7,8,17,27]',
    'name=F5_02;type=F;numbers=[34,43,44,45,55];color=#ABCDEF;opacity=0.5'
  ].join('\n'));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.configs.length, 2);
  assert.equal(parsed.configs[1].type, 'F5');
  assert.equal(parsed.configs[1].rotation, 90);
  assert.equal(parsed.configs[1].color, '#abcdef');

  const flattenedByLiaScript = parsePentominoSpecs(
    'name=L5-01;type=L5;numbers=[11,21,31,41,42]' +
    'name=U5-01;type=U5;numbers=[15,17,25,26,27]' +
    'name=X5-01;type=X5;numbers=[59,68,69,70,79]'
  );
  assert.deepEqual(flattenedByLiaScript.errors, []);
  assert.deepEqual(
    flattenedByLiaScript.configs.map(config => config.name),
    ['L5-01', 'U5-01', 'X5-01']
  );

  const flattenedComments = parsePentominoSpecs(
    '# erster Hinweis' +
    'name=L5-comment;type=L5;numbers=[11,21,31,41,42]' +
    '# zweiter Hinweis' +
    'name=U5-comment;type=U5;numbers=[15,17,25,26,27];color=#ABCDEF'
  );
  assert.deepEqual(flattenedComments.errors, []);
  assert.deepEqual(
    flattenedComments.configs.map(config => config.name),
    ['L5-comment', 'U5-comment']
  );
  assert.equal(flattenedComments.configs[1].color, '#abcdef');
});

test('parser supports explicit N=x and a uniquely inferred bare x', () => {
  const explicit = parsePentominoSpecs(
    'name=T5-explicit;type=T5;numbers=[17,27=x,6,8,7];fixed=true'
  );
  assert.deepEqual(explicit.errors, []);
  assert.equal(explicit.configs[0].maskedNumber, 27);
  assert.equal(explicit.configs[0].fixed, true);
  assert.deepEqual(
    [explicit.configs[0].x, explicit.configs[0].y, explicit.configs[0].rotation],
    [5, 7, 0]
  );

  const inferred = parsePentominoSpecs(
    'name=T5-inferred;type=T5;numbers=[17,x,8,6,7]'
  );
  assert.deepEqual(inferred.errors, []);
  assert.equal(inferred.configs[0].maskedNumber, 27);
  assert.deepEqual(
    [inferred.configs[0].x, inferred.configs[0].y, inferred.configs[0].rotation],
    [5, 7, 0]
  );
});

test('parser rejects ambiguous, malformed and incompatible numbers specs', () => {
  const invalid = parsePentominoSpecs([
    'name=I5-ambiguous;type=I5;numbers=[2,3,4,5,x]',
    'name=T5-shape;type=T5;numbers=[1,2,3,4,5]',
    'name=T5-duplicate-fields;type=T5;numbers=[6,7,8,17,17]',
    'name=T5-multiple-masks;type=T5;numbers=[6=x,7=x,8,17,27]',
    'name=T5-short;type=T5;numbers=[6,7,8,17]',
    'name=T5-range;type=T5;numbers=[0,6,7,8,17]',
    'name=T5-fixed;type=T5;numbers=[6,7,8,17,27];fixed=locked',
    'name=S5-invalid;type=S5;numbers=[6,7,8,17,27]',
    'name=T5-legacy;type=T5;x=5;y=7'
  ].join('\n'));
  const messages = invalid.errors.map(error => error.message).join('\n');

  assert.equal(invalid.configs.length, 0);
  assert.match(messages, /nicht eindeutig/);
  assert.match(messages, /kein passendes T5/);
  assert.match(messages, /müssen verschieden sein/);
  assert.match(messages, /ein Feld als x markiert/);
  assert.match(messages, /numbers muss 5 verschiedene Felder beschreiben/);
  assert.match(messages, /zwischen 1 und 100/);
  assert.match(messages, /fixed muss true oder false/);
  assert.match(messages, /type muss/);
  assert.match(messages, /Unbekannte Option: x/);
  assert.match(messages, /Unbekannte Option: y/);

  const duplicateName = parsePentominoSpecs([
    'name=T5-01;type=T5;numbers=[6,7,8,17,27]',
    'name=T5-01;type=T5;numbers=[16,17,18,27,37]'
  ].join('\n'));
  assert.ok(duplicateName.errors.some(error => /mehrfach/.test(error.message)));

  const blankColor = parsePentominoSpecs(
    'name=T5-color;type=T5;numbers=[6,7,8,17,27];color='
  );
  assert.equal(blankColor.configs.length, 0);
  assert.ok(blankColor.errors.some(error => /color muss/.test(error.message)));
});

test('piece drags as one unit, snaps to the grid and rotates by 90 degrees', () => {
  const board = interactiveBoard();
  const changes = [];
  const interactionStarts = [];
  const config = parsePentominoSpecs(
    'name=T5-01;type=T5;numbers=[27,6,17,8,7]'
  ).configs[0];
  const piece = createPentomino(board, config, {
    onChange(state) {
      changes.push(state);
    },
    onInteractionStart(state, event) {
      interactionStarts.push({ state, event });
    }
  });

  assert.equal(piece.objects.length, 27);
  assert.equal(piece.polygons.length, 5);
  assert.equal(board.calls.filter(call => call.type === 'text').length, 0);
  assert.equal(board.calls.filter(call => call.type === 'button').length, 1);
  assert.ok(piece.polygons.every(polygon => polygon.attributes.name === ''));
  assert.equal(piece.isAttached(), true);
  assert.equal(piece.getState().fixed, false);
  assert.equal(piece.getState().maskedNumber, null);
  assert.deepEqual(piece.getState().coveredNumbers, [6, 7, 8, 17, 27]);
  assert.equal(
    piece.rotationButton.rendNodeButton.getAttribute('aria-label'),
    'Pentomino um 90 Grad im Uhrzeigersinn drehen'
  );
  assert.equal(
    piece.rotationButton.rendNodeButton.getAttribute('title'),
    'Pentomino um 90° drehen'
  );
  assert.equal(
    piece.rotationButton.rendNodeButton.getAttribute('type'),
    'button'
  );
  assert.equal(piece.rotationButton.attributes.anchorX, 'middle');
  assert.equal(piece.rotationButton.attributes.anchorY, 'middle');

  const buttonX = () => Number(piece.rotationButton.parents[0]());
  const buttonY = () => Number(piece.rotationButton.parents[1]());
  const initialState = piece.getState();
  assert.ok(buttonX() > initialState.x + initialState.width);
  assert.ok(buttonY() >= initialState.y);
  assert.ok(buttonY() <= initialState.y + initialState.height);

  piece.polygons.forEach(polygon => {
    assert.equal(polygon.attributes.rotatable, false);
    assert.equal(polygon.attributes.scalable, false);
    assert.equal(polygon.attributes.borders.layer, 7);
    assert.equal(polygon.handlerCount('down'), 1);
    assert.equal(polygon.handlerCount('drag'), 1);
    assert.equal(polygon.handlerCount('up'), 1);
  });

  const coincidentPolygon = piece.polygons[0];
  const activePolygon = piece.polygons[1];
  coincidentPolygon.trigger('up');
  assert.equal(changes.length, 0);
  assert.equal(interactionStarts.length, 0);

  const firstEvent = { pointerId: 1 };
  const secondEvent = { pointerId: 2 };
  coincidentPolygon.trigger('down', firstEvent);
  activePolygon.trigger('down', secondEvent);
  assert.equal(interactionStarts.length, 2);
  assert.deepEqual(interactionStarts[0].state, initialState);
  assert.deepEqual(interactionStarts[1].state, initialState);
  assert.equal(interactionStarts[0].event, firstEvent);
  assert.equal(interactionStarts[1].event, secondEvent);
  activePolygon.parents.forEach(point => {
    point.setPositionDirectly(1, [point.X() + 0.6, point.Y() - 0.4]);
  });
  activePolygon.trigger('drag');
  coincidentPolygon.trigger('up');
  activePolygon.trigger('up');
  coincidentPolygon.trigger('up');

  assert.equal(piece.getState().x, 6);
  assert.equal(piece.getState().y, 7);
  assert.ok(buttonX() > piece.getState().x + piece.getState().width);
  assert.equal(changes.length, 1);
  assert.equal(interactionStarts.length, 2);
  assert.deepEqual([...new Set(board.coordinateModes)], [1]);

  piece.rotationButton.click();
  assert.equal(piece.getState().rotation, 90);
  assert.equal(changes.length, 2);

  delete board.objects[piece.objects[4].id];
  assert.equal(piece.isAttached(), false);
  piece.dispose();
  assert.equal(board.removed.length, piece.objects.length);
  assert.equal(board.suspended, 2);
  assert.equal(board.resumed, 2);

  const updatesAfterDispose = board.updates;
  const changesAfterDispose = changes.length;
  activePolygon.trigger('drag');
  activePolygon.trigger('up');
  activePolygon.trigger('down', { pointerId: 3 });
  assert.equal(board.updates, updatesAfterDispose);
  assert.equal(changes.length, changesAfterDispose);
  assert.equal(interactionStarts.length, 2);
});

test('fixed piece has no button, interaction handlers or programmatic rotation', () => {
  const board = interactiveBoard();
  const changes = [];
  const interactionStarts = [];
  const config = parsePentominoSpecs(
    'name=T5-fixed;type=T5;numbers=[6,7,8,17,27=x];fixed=true'
  ).configs[0];
  const piece = createPentomino(board, config, {
    onChange(state) {
      changes.push(state);
    },
    onInteractionStart(state, event) {
      interactionStarts.push({ state, event });
    }
  });
  const initialState = piece.getState();
  const updatesAfterCreation = board.updates;

  assert.equal(initialState.fixed, true);
  assert.equal(initialState.maskedNumber, 27);
  assert.equal(piece.objects.length, 26);
  assert.equal(board.calls.filter(call => call.type === 'button').length, 0);
  assert.equal(piece.rotationButton == null, true);
  assert.ok(
    board.calls
      .filter(call => call.type === 'point')
      .every(point => point.attributes.fixed === true)
  );
  piece.polygons.forEach(polygon => {
    assert.equal(polygon.attributes.fixed, true);
    assert.equal(polygon.attributes.frozen, false);
    assert.equal(polygon.attributes.highlight, false);
    assert.equal(polygon.attributes.dragToTopOfLayer, false);
    assert.equal(polygon.attributes.vertices.fixed, true);
    assert.equal(polygon.handlerCount('down'), 0);
    assert.equal(polygon.handlerCount('drag'), 0);
    assert.equal(polygon.handlerCount('up'), 0);
  });

  const activePolygon = piece.polygons[0];
  activePolygon.parents.forEach(point => {
    point.setPositionDirectly(1, [point.X() + 0.6, point.Y() - 0.4]);
  });
  activePolygon.trigger('drag');
  activePolygon.trigger('up');
  activePolygon.trigger('down', { pointerId: 4 });
  piece.rotate();
  piece.snap();

  assert.deepEqual(piece.getState(), initialState);
  assert.equal(changes.length, 0);
  assert.equal(interactionStarts.length, 0);
  assert.equal(board.updates, updatesAfterCreation);
  piece.dispose();
});

test('piece fixes and unlocks at runtime without duplicating controls or handlers', () => {
  const board = interactiveBoard();
  const changes = [];
  const config = parsePentominoSpecs(
    'name=T5-runtime-lock;type=T5;numbers=[6,7,8,17,27]'
  ).configs[0];
  const piece = createPentomino(board, config, {
    onChange(state) {
      changes.push(state);
    }
  });
  const firstRotationButton = piece.rotationButton;
  const updatesAfterCreation = board.updates;

  assert.ok(firstRotationButton);
  assert.equal(piece.objects.length, 27);
  piece.polygons.forEach(polygon => {
    assert.equal(polygon.handlerCount('down'), 1);
    assert.equal(polygon.handlerCount('drag'), 1);
    assert.equal(polygon.handlerCount('up'), 1);
  });

  assert.equal(piece.setFixed(true), true);
  assert.equal(piece.getState().fixed, true);
  assert.equal(piece.rotationButton, null);
  assert.equal(piece.objects.length, 26);
  assert.equal(board.removed.includes(firstRotationButton), true);
  assert.equal(board.updates, updatesAfterCreation + 1);
  assert.deepEqual(changes.map(state => state.fixed), [true]);
  assert.ok(
    board.calls
      .filter(call => call.type === 'point')
      .every(point => point.attributes.fixed === true)
  );
  piece.polygons.forEach(polygon => {
    assert.equal(polygon.attributes.fixed, true);
    assert.equal(polygon.attributes.highlight, false);
    assert.equal(polygon.attributes.dragToTopOfLayer, false);
    assert.equal(polygon.attributes.vertices.fixed, true);
    assert.equal(polygon.handlerCount('down'), 0);
    assert.equal(polygon.handlerCount('drag'), 0);
    assert.equal(polygon.handlerCount('up'), 0);
  });

  const rotationWhileFixed = piece.getState().rotation;
  piece.rotate();
  assert.equal(piece.getState().rotation, rotationWhileFixed);
  assert.equal(changes.length, 1);

  assert.equal(piece.setFixed(true), true);
  assert.equal(board.updates, updatesAfterCreation + 1);
  assert.equal(changes.length, 1);
  assert.equal(board.removed.filter(object => object === firstRotationButton).length, 1);

  assert.equal(piece.setFixed(false), true);
  const secondRotationButton = piece.rotationButton;
  assert.ok(secondRotationButton);
  assert.notEqual(secondRotationButton, firstRotationButton);
  assert.equal(piece.getState().fixed, false);
  assert.equal(piece.objects.length, 27);
  assert.equal(board.updates, updatesAfterCreation + 2);
  assert.deepEqual(changes.map(state => state.fixed), [true, false]);
  assert.ok(
    board.calls
      .filter(call => call.type === 'point')
      .every(point => point.attributes.fixed === false)
  );
  piece.polygons.forEach(polygon => {
    assert.equal(polygon.attributes.fixed, false);
    assert.equal(polygon.attributes.highlight, true);
    assert.equal(polygon.attributes.dragToTopOfLayer, true);
    assert.equal(polygon.attributes.vertices.fixed, false);
    assert.equal(polygon.handlerCount('down'), 1);
    assert.equal(polygon.handlerCount('drag'), 1);
    assert.equal(polygon.handlerCount('up'), 1);
  });

  assert.equal(piece.setFixed(false), true);
  assert.equal(piece.rotationButton, secondRotationButton);
  assert.equal(board.calls.filter(call => call.type === 'button').length, 2);
  assert.equal(board.updates, updatesAfterCreation + 2);
  assert.equal(changes.length, 2);
  piece.polygons.forEach(polygon => {
    assert.equal(polygon.handlerCount('down'), 1);
    assert.equal(polygon.handlerCount('drag'), 1);
    assert.equal(polygon.handlerCount('up'), 1);
  });

  secondRotationButton.click();
  assert.equal(piece.getState().rotation, 90);
  assert.equal(changes.length, 3);
  assert.equal(changes.at(-1).fixed, false);

  piece.dispose();
  assert.equal(piece.setFixed(true), false);
});

test('rotation button follows the bounds and flips to the free side', () => {
  const board = interactiveBoard();
  const config = parsePentominoSpecs(
    'name=L5-edge;type=L5;numbers=[37,47,57,67,68]'
  ).configs[0];
  const piece = createPentomino(board, config);
  const buttonX = () => Number(piece.rotationButton.parents[0]());
  const buttonY = () => Number(piece.rotationButton.parents[1]());

  let state = piece.getState();
  assert.equal(state.width, 2);
  assert.ok(buttonX() > state.x + state.width);
  assert.ok(buttonY() >= state.y && buttonY() <= state.y + state.height);

  piece.rotate();
  state = piece.getState();
  assert.equal(state.rotation, 90);
  assert.equal(state.width, 4);
  assert.ok(buttonX() < state.x);
  assert.ok(buttonY() >= state.y && buttonY() <= state.y + state.height);

  piece.dispose();
});

test('simultaneous cell drags keep the piece rigid and emit after the last up', () => {
  const board = interactiveBoard();
  const changes = [];
  const config = parsePentominoSpecs(
    'name=U5-touch;type=U5;numbers=[81,83,91,92,93]'
  ).configs[0];
  const piece = createPentomino(board, config, {
    onChange(state) {
      changes.push(state);
    }
  });
  const first = piece.polygons[0];
  const second = piece.polygons[1];

  first.parents.forEach(point => {
    point.setPositionDirectly(1, [point.X() + 0.25, point.Y() + 0.1]);
  });
  first.trigger('drag');
  second.parents.forEach(point => {
    point.setPositionDirectly(1, [point.X() + 0.45, point.Y() - 0.1]);
  });
  second.trigger('drag');

  const inMotion = piece.getState();
  assert.ok(Math.abs(inMotion.x - 0.7) < 1e-12);
  assert.ok(Math.abs(inMotion.y) < 1e-12);
  assert.deepEqual(
    inMotion.cells.map(cell => [cell[0] - inMotion.x, cell[1] - inMotion.y]),
    getPentominoCells('U5', 0)
  );

  first.trigger('up');
  assert.equal(changes.length, 0);
  second.trigger('up');
  assert.equal(changes.length, 1);
  assert.equal(piece.getState().x, 1);
  assert.equal(piece.getState().y, 0);
  piece.dispose();
});
