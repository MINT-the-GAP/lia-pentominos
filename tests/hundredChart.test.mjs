import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  HUNDRED_CHART_SIZE,
  boardIsConnected,
  createHundredChart,
  hundredChartIsAttached,
  removeHundredChart,
  setHundredChartMaskedNumbers
} from '../src/hundredChart.ts';
import {
  coveredHundredChartNumbers,
  getAbsolutePentominoCells,
  getPentominoBounds,
  getPentominoCells,
  parsePentominoSpecs
} from '../src/pentominoes.ts';

function labelValue(label) {
  const value = label.parents[2];
  return typeof value === 'function' ? value() : value;
}

function fakeBoard() {
  const calls = [];
  const removed = [];
  let suspended = 0;
  let resumed = 0;
  let updates = 0;

  const board = {
    calls,
    removed,
    objects: {},
    isSuspendedUpdate: false,
    containerObj: { isConnected: true },
    get suspended() { return suspended; },
    get resumed() { return resumed; },
    get updates() { return updates; },
    create(type, parents, attributes) {
      const object = {
        id: 'fake-object-' + (calls.length + 1),
        board,
        type,
        parents,
        attributes
      };
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

test('draws a static 10 by 10 chart numbered from top-left to bottom-right', () => {
  const board = fakeBoard();
  const objects = createHundredChart(board);

  assert.equal(HUNDRED_CHART_SIZE, 10);
  assert.equal(board.calls.filter(call => call.type === 'polygon').length, 1);
  assert.equal(board.calls.filter(call => call.type === 'point').length, 44);
  assert.equal(board.calls.filter(call => call.type === 'segment').length, 22);
  assert.equal(board.calls.filter(call => call.type === 'text').length, 100);
  assert.equal(objects.length, 167);

  const labels = board.calls.filter(call => call.type === 'text');
  assert.deepEqual(labels[0].parents.slice(0, 2), [0.5, 9.5]);
  assert.deepEqual(labels[9].parents.slice(0, 2), [9.5, 9.5]);
  assert.deepEqual(labels[10].parents.slice(0, 2), [0.5, 8.5]);
  assert.deepEqual(labels[99].parents.slice(0, 2), [9.5, 0.5]);
  assert.equal(labelValue(labels[0]), '1');
  assert.equal(labelValue(labels[9]), '10');
  assert.equal(labelValue(labels[10]), '11');
  assert.equal(labelValue(labels[99]), '100');
  assert.ok(labels.every(label => label.attributes.fixed === true));
  assert.ok(labels.every(label => label.attributes.highlight === false));

  assert.equal(board.suspended, 1);
  assert.equal(board.resumed, 1);
  assert.equal(board.updates, 1);
});

test('draws the negative chart backwards from 50 to -49', () => {
  const board = fakeBoard();
  const objects = createHundredChart(board, 'negative');
  const labels = board.calls.filter(call => call.type === 'text');

  assert.equal(objects.length, 167);
  assert.equal(labels.length, 100);
  assert.equal(labelValue(labels[0]), '50');
  assert.equal(labelValue(labels[9]), '41');
  assert.equal(labelValue(labels[10]), '40');
  assert.equal(labelValue(labels[49]), '1');
  assert.equal(labelValue(labels[50]), '0');
  assert.equal(labelValue(labels[51]), '-1');
  assert.equal(labelValue(labels[90]), '-40');
  assert.equal(labelValue(labels[99]), '-49');
});

test('masks and restores labels dynamically without repeating unchanged updates', () => {
  const board = fakeBoard();
  const objects = createHundredChart(board);
  const labels = board.calls.filter(call => call.type === 'text');
  const mathematicalX = String.fromCodePoint(0x1d465);
  const updateIfChanged = values => {
    if (setHundredChartMaskedNumbers(objects, values)) board.update();
  };

  assert.equal(labelValue(labels[5]), '6');
  assert.equal(labelValue(labels[26]), '27');
  assert.equal(board.updates, 1);

  updateIfChanged([27, 6, 27, 0, 101]);
  assert.equal(labelValue(labels[5]), mathematicalX);
  assert.equal(labelValue(labels[26]), mathematicalX);
  assert.equal(labelValue(labels[6]), '7');
  assert.equal(board.updates, 2);

  updateIfChanged([6, 27]);
  updateIfChanged([27, 6, 6]);
  assert.equal(board.updates, 2);

  updateIfChanged([]);
  assert.equal(labelValue(labels[5]), '6');
  assert.equal(labelValue(labels[26]), '27');
  assert.equal(board.updates, 3);

  removeHundredChart(board, objects);
  assert.equal(setHundredChartMaskedNumbers(objects, [6]), false);
});

test('removes every managed object in reverse dependency order', () => {
  const board = fakeBoard();
  const objects = createHundredChart(board);

  removeHundredChart(board, objects);

  assert.equal(board.removed.length, objects.length);
  assert.equal(board.removed[0], objects.at(-1));
  assert.equal(board.removed.at(-1), objects[0]);
  assert.equal(board.suspended, 2);
  assert.equal(board.resumed, 2);
  assert.equal(board.updates, 2);
});

test('preserves an update suspension owned by lia-coordinate', () => {
  const board = fakeBoard();
  board.isSuspendedUpdate = true;

  const objects = createHundredChart(board);
  assert.equal(objects.length, 167);
  assert.equal(board.isSuspendedUpdate, true);
  assert.equal(board.suspended, 0);
  assert.equal(board.resumed, 0);
  assert.equal(board.updates, 0);

  removeHundredChart(board, objects);
  assert.equal(board.isSuspendedUpdate, true);
  assert.equal(board.suspended, 0);
  assert.equal(board.resumed, 0);
  assert.equal(board.updates, 0);
});

test('detects detached boards and chart objects removed during a rerender', () => {
  const board = fakeBoard();
  const root = {
    contains(node) {
      return node === board.containerObj;
    }
  };

  assert.equal(boardIsConnected(board, root), true);
  board.containerObj.isConnected = false;
  assert.equal(boardIsConnected(board, root), false);

  board.containerObj.isConnected = true;
  const objects = createHundredChart(board);
  assert.equal(hundredChartIsAttached(board, objects), true);
  assert.equal(hundredChartIsAttached(board, [{ board }]), true);

  delete board.objects[objects[20].id];
  assert.equal(hundredChartIsAttached(board, objects), false);
});

test('accepts a connected JSXGraph board inside a ShadowRoot', () => {
  const documentRoot = {};
  let lightDomContainsWasCalled = false;
  const container = {
    isConnected: true,
    getRootNode(options) {
      assert.deepEqual(options, { composed: true });
      return documentRoot;
    }
  };
  const root = {
    contains() {
      lightDomContainsWasCalled = true;
      return false;
    },
    getRootNode(options) {
      assert.deepEqual(options, { composed: true });
      return documentRoot;
    }
  };

  assert.equal(boardIsConnected({ containerObj: container }, root), true);
  assert.equal(lightDomContainsWasCalled, false);

  root.getRootNode = () => ({});
  assert.equal(boardIsConnected({ containerObj: container }, root), false);

  container.isConnected = false;
  assert.equal(boardIsConnected({ containerObj: container }, root), false);
});

test('README keeps the Proposal import, board flags and public chart and piece macros', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.match(
    readme,
    /cdn\.jsdelivr\.net\/gh\/MINT-the-GAP\/lia-coordinate@Proposal\/README\.md/
  );
  assert.doesNotMatch(
    readme,
    /raw\.githubusercontent\.com\/MINT-the-GAP\/lia-coordinate/
  );
  assert.match(readme, /@Koordinatensystem\(`/);
  assert.match(readme, /achsen=0;grid=0;border=0/);
  assert.match(readme, /@Hunderterfeld:/);
  assert.match(readme, /@HunderterfeldN:/);
  assert.match(readme, /@HunderterfeldIn:/);
  assert.match(readme, /@PentominoDock:/);
  assert.match(readme, /@PentominoDockAuswahl:/);
  assert.match(readme, /@PentominoDockIn:/);
  assert.match(readme, /@PentominoDockAuswahlIn:/);
  assert.match(readme, /@PentominoDockQuiz:/);
  assert.match(readme, /@PentominoDockQuizAuswahl:/);
  assert.match(readme, /@PentominoDockQuizIn:/);
  assert.match(readme, /@PentominoDockQuizAuswahlIn:/);
  assert.match(readme, /@PentominoIn:/);
  assert.match(readme, /@PentominosIn:/);
  assert.match(readme, /@PentominoQuiz:/);
  assert.match(readme, /@PentominoQuizIn:/);
  const header = readme.match(/^<!--([\s\S]*?)-->/)?.[1] || '';
  assert.match(header, /@PentominoDock: @PentominoDock_\(@uid,`all`\)/);
  assert.match(
    header,
    /@PentominoDockAuswahl: @PentominoDock_\(@uid,`@0`\)/
  );
  assert.match(
    header,
    /@PentominoDockIn: @PentominoDockIn_\(@uid,`@0`,`all`\)/
  );
  assert.match(
    header,
    /@PentominoDockAuswahlIn: @PentominoDockIn_\(@uid,`@0`,`@1`\)/
  );
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
  const headerLineCount = readme
    .slice(0, readme.indexOf('-->') + 3)
    .split(/\r?\n/)
    .length;
  assert.ok(headerLineCount <= 160, 'Header has ' + headerLineCount + ' lines');
  assert.ok(header.length <= 5000, 'Header has ' + header.length + ' characters');

  const boardShortcut = header.match(
    /(?:^|\n)@PentominoBoard_:\s+([^\r\n]+)/
  )?.[1] || '';
  const dockDefinition = header.match(
    /(?:^|\n)@PentominoDock_\r?\n([\s\S]*?)\r?\n@end/
  )?.[1] || '';
  const dockInDefinition = header.match(
    /(?:^|\n)@PentominoDockIn_\r?\n([\s\S]*?)\r?\n@end/
  )?.[1] || '';
  const dockQuizDefinition = header.match(
    /(?:^|\n)@PentominoDockQuiz_\r?\n([\s\S]*?)\r?\n@end/
  )?.[1] || '';
  const dockQuizInDefinition = header.match(
    /(?:^|\n)@PentominoDockQuizIn_\r?\n([\s\S]*?)\r?\n@end/
  )?.[1] || '';
  const dockQuizCheckDefinition = header.match(
    /(?:^|\n)@PentominoDockQuizCheck_\r?\n([\s\S]*?)\r?\n@end/
  )?.[1] || '';
  const pentominoQuizInDefinition = header.match(
    /(?:^|\n)@PentominoQuizIn_\r?\n([\s\S]*?)\r?\n@end/
  )?.[1] || '';
  assert.match(boardShortcut, /@Koordinatensystem\(`/);
  assert.match(
    boardShortcut,
    /width=520;id=@0;achsen=0;grid=0;border=0/
  );
  assert.match(header, /@PentominoBoard_\(pentomino-hunderterfeld-@0\)/);
  assert.match(header, /@PentominoBoard_\(pentomino-hunderterfeld-n-@0\)/);
  assert.match(header, /@PentominoBoard_\(pentomino-dock-board-@0\)/);
  assert.match(header, /@PentominoBoard_\(pentomino-dock-quiz-board-@0\)/);
  assert.match(header, /@PentominoBoard_\(pentomino-quiz-board-@0\)/);
  assert.match(dockDefinition, /class="lia-pentomino-workspace"/);
  assert.match(dockDefinition, /class="lia-pentomino-workspace-board"/);
  assert.match(dockDefinition, /class="lia-pentomino-workspace-sidebar"/);
  assert.match(dockInDefinition, /<aside\b/);
  assert.match(dockInDefinition, /class="lia-pentomino-dock"/);
  assert.match(dockInDefinition, /data-types="@2"/);
  assert.doesNotMatch(
    dockInDefinition,
    /lia-pentomino-dock-(?:toggle|panel|items|placed|fix|delete|actions)/
  );
  assert.doesNotMatch(dockInDefinition, /lia-pentomino-dock-hint/);
  assert.doesNotMatch(dockInDefinition, /Form ins Feld ziehen oder antippen\./);
  assert.doesNotMatch(dockInDefinition, /<button\b/i);
  assert.doesNotMatch(dockInDefinition, /<details\b/i);
  assert.doesNotMatch(dockInDefinition, /<summary\b/i);
  assert.match(
    dockQuizDefinition,
    /@PentominoBoard_\(pentomino-dock-quiz-board-@0\)/
  );
  assert.match(
    dockQuizDefinition,
    /@PentominoDockIn_\(@0,`pentomino-dock-quiz-board-@0`,`@2`\)/
  );
  assert.match(
    dockQuizDefinition,
    /@PentominoDockQuizCheck_\(@0,`pentomino-dock-quiz-board-@0`,@1,`pentomino-dock-@0`,`@3`\)/
  );
  assert.match(
    dockQuizInDefinition,
    /@PentominoDockIn_\(@0,`@1`,`@3`\)/
  );
  assert.match(
    dockQuizInDefinition,
    /@PentominoDockQuizCheck_\(@0,`@1`,@2,`pentomino-dock-@0`,`@4`\)/
  );
  assert.match(dockQuizCheckDefinition, /data-board-id="@1"/);
  assert.match(dockQuizCheckDefinition, /data-target-sum="@2"/);
  assert.match(
    dockQuizCheckDefinition,
    /data-dock-marker-id="@3"/
  );
  assert.match(
    dockQuizCheckDefinition,
    /<\/div>\r?\n\r?\n@4\r?\n\[\[!\]\]/
  );
  assert.doesNotMatch(dockQuizCheckDefinition, /data-solution-button/);
  assert.match(
    dockQuizCheckDefinition,
    /window\.LiaPentomino\?\.checkQuiz\?\.\('pentomino-dock-quiz-@0'\) === true/
  );
  assert.match(
    dockQuizCheckDefinition,
    /<script modify="false">[\s\S]*<\/script>\s*$/
  );
  assert.match(header, /@PentominoQuiz: @PentominoQuiz_\(@uid,@0,`@1`,`@2`\)/);
  assert.match(
    header,
    /@PentominoQuizIn: @PentominoQuizIn_\(@uid,`@0`,@1,`@2`,`@3`\)/
  );
  assert.match(
    pentominoQuizInDefinition,
    /<\/div>\r?\n\r?\n@4\r?\n\[\[!\]\]/
  );
  assert.doesNotMatch(pentominoQuizInDefinition, /data-solution-button/);
  assert.match(
    pentominoQuizInDefinition,
    /window\.LiaPentomino\?\.checkQuiz\?\.\('pentomino-quiz-@0'\) === true/
  );
  assert.match(
    pentominoQuizInDefinition,
    /<script modify="false">[\s\S]*<\/script>\s*$/
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
  assert.match(readme, /class="lia-pentomino-quiz"/);
  assert.match(readme, /\[\[!\]\]/);
  assert.match(header, /LiaPentomino\?\.checkQuiz/);
  assert.match(readme, /data-solution-button="off"/);
  const authoredSolutionExample = readme.match(
    /@PentominoQuiz\(45,`name=Lia503-I2;type=I2;numbers=\[1,2\]`,`<!-- data-solution-button="off" -->`\)\r?\n(\*{3,})\r?\n([\s\S]*?)\r?\n\1/
  );
  assert.ok(
    authoredSolutionExample,
    'README documents a solution block immediately after @PentominoQuiz'
  );
  assert.match(authoredSolutionExample[2], /22[\s\S]*23[\s\S]*45/);
  assert.match(readme, /class="lia-pentomino-config"/);
  assert.match(readme, /data-chart-kind="negative"/);
  assert.match(
    readme,
    /numbers=\[6,7,8,17,27=x\];fixed=true/
  );
  assert.match(readme, /id=pentomino-maskiert-fixiert-live/);
  assert.match(readme, /script:\s+\.\/dist\/index\.js/);
  assert.match(
    readme,
    /cdn\.jsdelivr\.net\/gh\/MINT-the-GAP\/lia-pentominos@main\/README\.md/
  );
  const body = readme.slice(readme.indexOf('-->') + 3);
  assert.match(body, /\n@PentominoDock\r?\n/);
  assert.match(
    body,
    /@PentominoDockAuswahl\(`[^`]*I2[^`]*L3[^`]*O4[^`]*T5[^`]*`\)/
  );
  assert.match(body, /@PentominoDockIn\(`pentomino-dock-in-demo-live`\)/);
  assert.match(body, /@PentominoDockAuswahlIn\(/);
  const dockQuizDocsStart = body.search(/## `@PentominoDockQuiz\(/);
  const pentominoQuizDocsStart = body.indexOf(
    '## `@PentominoQuiz(',
    dockQuizDocsStart + 1
  );
  assert.ok(dockQuizDocsStart >= 0, 'README documents @PentominoDockQuiz');
  assert.ok(
    pentominoQuizDocsStart > dockQuizDocsStart,
    'Dock quiz documentation precedes the existing configured-piece quiz'
  );
  const dockQuizDocs = body.slice(dockQuizDocsStart, pentominoQuizDocsStart);
  for (const macro of [
    '@PentominoDockQuiz',
    '@PentominoDockQuizAuswahl',
    '@PentominoDockQuizIn',
    '@PentominoDockQuizAuswahlIn'
  ]) {
    assert.match(dockQuizDocs, new RegExp(macro));
  }
  assert.match(
    dockQuizDocs,
    /@PentominoDockQuiz\(\d+,`<!-- data-solution-button="off" -->`\)/
  );
  assert.match(
    dockQuizDocs,
    /@PentominoDockQuizAuswahl\(\d+,`[^`]+`/
  );
  assert.match(dockQuizDocs, /mindestens\s+ein[\s\S]{0,100}(?:Stein|Polyomino)/i);
  assert.match(
    dockQuizDocs,
    /(?:nicht[\s\S]{0,80}(?:addiert|zusammengerechnet)|keine\s+Gesamtsumme)/i
  );
  assert.match(dockQuizDocs, /(?:genau\s+diesem|zugehörigen|eigenes)\s+Dock/i);
  assert.match(
    dockQuizDocs,
    /(?:Konfigurationsstein|vorgegebene[\s\S]{0,30}Steine|@PentominoIn)[\s\S]{0,100}(?:nicht|ignoriert)/i
  );
  assert.match(body, /LiaPentomino\.getDockPieces/);
  assert.match(body, /LiaPentomino\.dockCoversSum/);
  assert.match(body, /Reiter ist genauso hoch\s+wie das Hunderterfeld/);
  assert.match(body, /um 180° gedrehter Schriftzug/);
  assert.match(body, /4×5-Raster/);
  assert.match(body, /Fixier- und Löschknöpfe gibt es dort nicht\s+mehr/);
  assert.match(body, /zurück auf den sichtbaren\s+Reiter oder in das geöffnete Inventar/);
  assert.match(body, /\*\*Entf\*\* beziehungsweise \*\*Delete\*\*/);
  assert.match(
    body,
    /durch Zurückziehen ins Inventar oder\s+mit \*\*Entf\/Delete\*\* gelöscht/
  );
  assert.doesNotMatch(body, /Tasten \*\*Fixieren\*\* und \*\*×\*\*/);
  for (const type of [
    'I2', 'I3', 'L3', 'I4', 'O4', 'T4', 'L4', 'S4',
    'F5', 'I5', 'L5', 'P5', 'N5', 'T5',
    'U5', 'V5', 'W5', 'X5', 'Y5', 'Z5'
  ]) {
    assert.match(body, new RegExp('\\b' + type + '\\b'));
  }

  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  );
  const packageLock = JSON.parse(
    await readFile(new URL('../package-lock.json', import.meta.url), 'utf8')
  );
  assert.equal(packageJson.version, '1.0.1');
  assert.equal(packageLock.version, '1.0.1');
  assert.equal(packageLock.packages[''].version, '1.0.1');
  assert.match(header, /version: 1\.0\.0/);
});

test('README presents eight pentomino covering quizzes on one additional slide', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const start = readme.indexOf('## Acht Pentomino-Abdeckaufgaben');
  const end = readme.indexOf('\n## Entwicklung', start);

  assert.ok(start >= 0, 'README contains the example-task slide');
  assert.ok(end > start, 'example-task slide ends before development notes');

  const slide = readme.slice(start, end);
  assert.equal((slide.match(/^## /gm) || []).length, 1);
  assert.doesNotMatch(slide, /^### /gm);
  assert.equal((slide.match(/^\*\*Aufgabe [1-8] –/gm) || []).length, 8);
  for (let number = 1; number <= 8; number += 1) {
    assert.match(slide, new RegExp(`^\\*\\*Aufgabe ${number} –`, 'm'));
  }
  assert.equal(
    (slide.match(/^\s+\{\{\d+(?:-\d+)?\}\}$/gm) || []).length,
    8
  );

  const configuredCalls = Array.from(slide.matchAll(
    /^@PentominoQuiz\((\d+),`([^`]+)`,`<!-- data-solution-button="off" -->`\)$/gm
  )).map(match => ({ target: Number(match[1]), spec: match[2] }));
  const dockCalls = Array.from(slide.matchAll(
    /^@PentominoDockQuizAuswahl\((\d+),`([^`]+)`,`<!-- data-solution-button="off" -->`\)$/gm
  )).map(match => ({
    target: Number(match[1]),
    types: match[2].split(',')
  }));
  assert.equal(configuredCalls.length, 4);
  assert.equal(dockCalls.length, 4);
  assert.equal(configuredCalls.length + dockCalls.length, 8);
  assert.deepEqual(configuredCalls.map(call => call.target), [65, 143, 164, 225]);
  assert.deepEqual(dockCalls.map(call => call.target), [164, 115, 245, 490]);
  assert.doesNotMatch(slide, /^\s*(?:\[\[|\[\(|\[->)/gm);
  assert.doesNotMatch(slide, /@HunderterfeldN|@Koordinatensystem|@PentominoIn\(/);

  const pentominoTypes = [
    'F5', 'I5', 'L5', 'P5', 'N5', 'T5',
    'U5', 'V5', 'W5', 'X5', 'Y5', 'Z5'
  ];
  const hasTargetCoverage = (types, target) => types.some(type => {
    for (const rotation of [0, 90, 180, 270]) {
      const bounds = getPentominoBounds(getPentominoCells(type, rotation));
      for (let x = 0; x <= HUNDRED_CHART_SIZE - bounds.width; x += 1) {
        for (let y = 0; y <= HUNDRED_CHART_SIZE - bounds.height; y += 1) {
          const sum = coveredHundredChartNumbers(
            getAbsolutePentominoCells(type, rotation, x, y)
          ).reduce((total, number) => total + number, 0);
          if (sum === target) return true;
        }
      }
    }
    return false;
  });

  for (const call of configuredCalls) {
    const parsed = parsePentominoSpecs(call.spec);
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.configs.length, 1);
    assert.ok(pentominoTypes.includes(parsed.configs[0].type));
    assert.ok(hasTargetCoverage([parsed.configs[0].type], call.target));
  }
  for (const call of dockCalls) {
    assert.equal(new Set(call.types).size, call.types.length);
    assert.ok(call.types.every(type => pentominoTypes.includes(type)));
    assert.ok(hasTargetCoverage(call.types, call.target));
  }
  assert.deepEqual(
    dockCalls.at(-1).types,
    pentominoTypes
  );
});
