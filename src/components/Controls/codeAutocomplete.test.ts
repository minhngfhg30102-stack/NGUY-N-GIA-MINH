import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCompletion,
  extractCompletionContext,
  getCompletionsForContext,
  toggleLineComments,
} from './codeAutocomplete';

describe('codeAutocomplete utilities', () => {
  it('extracts top-level identifier prefix and dot-member context accurately', () => {
    const ctxTop = extractCompletionContext('  rob', 5);
    assert.equal(ctxTop.objectPrefix, null);
    assert.equal(ctxTop.query, 'rob');
    assert.equal(ctxTop.replaceStart, 2);
    assert.equal(ctxTop.replaceEnd, 5);

    const ctxDotEmpty = extractCompletionContext('robot.', 6);
    assert.equal(ctxDotEmpty.objectPrefix, 'robot');
    assert.equal(ctxDotEmpty.query, '');
    assert.equal(ctxDotEmpty.replaceStart, 6);

    const ctxDotPrefix = extractCompletionContext('robot.for', 9);
    assert.equal(ctxDotPrefix.objectPrefix, 'robot');
    assert.equal(ctxDotPrefix.query, 'for');
    assert.equal(ctxDotPrefix.replaceStart, 6);
    assert.equal(ctxDotPrefix.replaceEnd, 9);
  });

  it('returns language-specific completions and member suggestions', () => {
    const pyRobotMembers = getCompletionsForContext('python', {
      replaceStart: 6,
      replaceEnd: 6,
      query: '',
      objectPrefix: 'robot',
    });
    assert.ok(pyRobotMembers.some((i) => i.label === 'forward'));
    assert.ok(pyRobotMembers.some((i) => i.label === 'stop'));

    const cppSerialMembers = getCompletionsForContext('cpp', {
      replaceStart: 7,
      replaceEnd: 9,
      query: 'pr',
      objectPrefix: 'Serial',
    });
    assert.deepEqual(
      cppSerialMembers.map((i) => i.label),
      ['print', 'println']
    );

    const pyTop = getCompletionsForContext('python', {
      replaceStart: 0,
      replaceEnd: 3,
      query: 'pri',
      objectPrefix: null,
    });
    assert.ok(pyTop.some((i) => i.label === 'print'));
    assert.ok(!pyTop.some((i) => i.label === 'Serial.println'));
  });

  it('applies completion with $0 cursor placement and preserves indentation', () => {
    const code = '    for';
    const ctx = extractCompletionContext(code, code.length);
    const items = getCompletionsForContext('python', ctx);
    const forItem = items.find((i) => i.label === 'for')!;
    const applied = applyCompletion(code, ctx, forItem);

    assert.equal(applied.nextCode, '    for i in range():\n        ');
    // Cursor should land inside range(|)
    const expectedPos = '    for i in range('.length;
    assert.equal(applied.nextCursorPos, expectedPos);
  });

  it('toggles # comments in Python and // comments in JavaScript/C++', () => {
    const pyCode = 'robot.forward(0.5, 400)\nrobot.stop()';
    const commented = toggleLineComments(pyCode, 0, pyCode.length, 'python');
    assert.equal(commented.nextCode, '# robot.forward(0.5, 400)\n# robot.stop()');

    const uncommented = toggleLineComments(
      commented.nextCode,
      0,
      commented.nextCode.length,
      'python'
    );
    assert.equal(uncommented.nextCode, pyCode);

    const jsCode = '  robot.left(0.4, 300);';
    const jsCommented = toggleLineComments(jsCode, 4, 4, 'javascript');
    assert.equal(jsCommented.nextCode, '//   robot.left(0.4, 300);');
    const jsUncommented = toggleLineComments(jsCommented.nextCode, 4, 4, 'javascript');
    assert.equal(jsUncommented.nextCode, jsCode);
  });
});
