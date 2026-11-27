import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_PRESETS,
  AUTONOMOUS_PRESETS,
  computeDangerProbability,
  mapJetBotLinearSpeed,
  parsePythonProgram,
  PRESETS_BY_LANGUAGE,
  runAutonomousProgram,
  runMultiLanguageProgram,
  SensorSnapshot,
  transpileCppToJs,
} from './autonomousRunner.ts';

function makeDummyHost(logs: string[], commands: string[] = [], obstacleDist = 2.0) {
  const sensors: SensorSnapshot = {
    obstacleDist,
    alienDist: 5.0,
    nearBoundary: false,
    headingDeg: 0,
    posX: 0,
    posZ: 0,
  };
  return {
    setMotors: (lin: number, ang: number) => {
      commands.push(lin > 0 ? 'FWD' : lin < 0 ? 'BWD' : ang !== 0 ? 'TURN' : 'IDLE');
    },
    stop: () => commands.push('STOP'),
    getSensors: () => ({ ...sensors }),
    onLog: (_lvl: 'info' | 'warn' | 'danger' | 'success', text: string) => logs.push(text),
  };
}

test('All sample presets parse cleanly without syntax errors', () => {
  assert.ok(AUTONOMOUS_PRESETS.length >= 3);
  for (const preset of AUTONOMOUS_PRESETS) {
    const ast = parsePythonProgram(preset.code);
    assert.ok(ast.length > 0, `Preset ${preset.id} produced empty AST`);
  }
  assert.ok(PRESETS_BY_LANGUAGE.javascript.length >= 3);
  assert.ok(PRESETS_BY_LANGUAGE.cpp.length >= 3);
});

test('Notebook danger avoidance preset drives forward then stops cleanly after 3 danger frames', async () => {
  const notebookPreset = AUTONOMOUS_PRESETS.find((p) => p.id === 'danger-stop-notebook');
  assert.ok(notebookPreset);

  let frame = 0;
  let lastLinear = 0;
  let stoppedCalled = 0;
  const logs: string[] = [];

  const sensors: SensorSnapshot = {
    obstacleDist: 2.0,
    alienDist: 5.0,
    nearBoundary: false,
    headingDeg: 0,
    posX: 0,
    posZ: 0,
  };

  const controller = new AbortController();

  await runAutonomousProgram(
    notebookPreset.code,
    {
      setMotors: (lin) => {
        lastLinear = lin;
        frame++;
        // On frame 4, simulate approaching a hazard closely
        if (frame >= 4) {
          sensors.obstacleDist = 0.4;
        }
      },
      stop: () => {
        stoppedCalled++;
        lastLinear = 0;
      },
      getSensors: () => ({ ...sensors }),
      onLog: (_lvl, text) => logs.push(text),
    },
    controller.signal,
    { tickMs: 5 }
  );

  assert.ok(frame >= 4, 'Should drive forward before hitting danger');
  assert.ok(stoppedCalled >= 1, 'Should stop when consecutive danger frames hit threshold');
  assert.equal(lastLinear, 0);
  assert.ok(logs.some((l) => l.includes('JetBot đã dừng') && l.includes('%')));
});

test('For-range loop executes exact motor sequence and stops', async () => {
  const code = `
for i in range(2):
    robot.forward(0.5)
    time.sleep(0.02)
    robot.right(0.5)
    time.sleep(0.02)
robot.stop()
print("Done", i + 1)
`;
  const commands: string[] = [];
  const logs: string[] = [];
  const controller = new AbortController();

  await runAutonomousProgram(
    code,
    {
      setMotors: (lin, ang) => {
        commands.push(lin > 0 ? 'FWD' : ang < 0 ? 'RIGHT' : 'OTHER');
      },
      stop: () => commands.push('STOP'),
      getSensors: () => ({
        obstacleDist: 2.0,
        alienDist: 5.0,
        nearBoundary: false,
        headingDeg: 0,
        posX: 0,
        posZ: 0,
      }),
      onLog: (_lvl, text) => logs.push(text),
    },
    controller.signal,
    { tickMs: 2 }
  );

  assert.deepEqual(commands, ['FWD', 'RIGHT', 'FWD', 'RIGHT', 'STOP', 'STOP']);
  assert.equal(logs[0], 'Done 2');
});

test('Python upgraded interpreter executes lists, recursion, math, and f-strings', async () => {
  const pyAlgo = ALL_PRESETS.find((p) => p.id === 'python-algorithms');
  assert.ok(pyAlgo);

  const logs: string[] = [];
  const controller = new AbortController();
  await runMultiLanguageProgram('python', pyAlgo.code, makeDummyHost(logs), controller.signal, { tickMs: 1 });

  assert.ok(logs.some((l) => l.includes('[0, 1, 1, 2, 3, 5, 8, 13, 21]')));
  assert.ok(logs.some((l) => l.includes('Tổng = 54')));
  assert.ok(logs.some((l) => l.includes('20.42 cm')));
});

test('JavaScript runner executes general code and JetBot async code safely', async () => {
  const jsPrimes = ALL_PRESETS.find((p) => p.id === 'js-primes-sample');
  assert.ok(jsPrimes);

  const logs: string[] = [];
  const controller = new AbortController();
  await runMultiLanguageProgram('javascript', jsPrimes.code, makeDummyHost(logs), controller.signal);

  assert.ok(logs.some((l) => l.includes('2, 3, 5, 7, 11')));
  assert.ok(logs.some((l) => l.includes('15')));

  // Infinite JS loop stops cleanly via AbortSignal
  const cmds: string[] = [];
  const abortCtrl = new AbortController();
  setTimeout(() => abortCtrl.abort(), 50);
  await runMultiLanguageProgram(
    'javascript',
    `while (true) { robot.forward(0.4); sleep(25); }`,
    makeDummyHost(logs, cmds),
    abortCtrl.signal
  );
  assert.ok(cmds.includes('FWD'));
  assert.equal(cmds[cmds.length - 1], 'STOP');
});

test('C++/Arduino transpiler and runner execute algorithms and setup/loop lifecycle', async () => {
  const cppAlgo = ALL_PRESETS.find((p) => p.id === 'cpp-algorithms');
  assert.ok(cppAlgo);

  const transpiled = transpileCppToJs(cppAlgo.code);
  assert.ok(transpiled.includes('await main()'));

  const logs: string[] = [];
  const controller = new AbortController();
  await runMultiLanguageProgram('cpp', cppAlgo.code, makeDummyHost(logs), controller.signal);

  assert.ok(logs.some((l) => l.includes('Fibonacci(10) = 55')));

  // Arduino setup() + loop() runs and stops on AbortSignal
  const arduinoLogs: string[] = [];
  const arduinoCmds: string[] = [];
  const arduinoAbort = new AbortController();
  setTimeout(() => arduinoAbort.abort(), 65);
  await runMultiLanguageProgram(
    'cpp',
    `
    void setup() { Serial.println("BOOT_OK"); }
    void loop() { robot.forward(0.35); delay(20); }
    `,
    makeDummyHost(arduinoLogs, arduinoCmds),
    arduinoAbort.signal
  );

  assert.ok(arduinoLogs.includes('BOOT_OK'));
  assert.ok(arduinoCmds.includes('FWD'));
  assert.equal(arduinoCmds[arduinoCmds.length - 1], 'STOP');
});

test('AbortSignal stops infinite loop cleanly and sets motors to zero', async () => {
  const code = `
while True:
    robot.forward(0.4)
    time.sleep(0.05)
`;
  let stopped = false;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 60);

  await runAutonomousProgram(
    code,
    {
      setMotors: () => {},
      stop: () => {
        stopped = true;
      },
      getSensors: () => ({
        obstacleDist: 2.0,
        alienDist: 5.0,
        nearBoundary: false,
        headingDeg: 0,
        posX: 0,
        posZ: 0,
      }),
      onLog: () => {},
    },
    controller.signal,
    { tickMs: 5 }
  );

  assert.equal(stopped, true);
});

test('Real-JetBot 1m x 1m square preset parses and runs Robot() sequence cleanly', async () => {
  const preset = AUTONOMOUS_PRESETS.find((p) => p.id === 'square-1m-real-jetbot');
  assert.ok(preset, 'Expected square-1m-real-jetbot preset');

  // Verify calibrated linear (0.345 -> ~0.50 m/s => 2s = 1.0m) & angular (0.6545 -> ~pi/2 rad/s => 1s = 90 deg)
  assert.ok(Math.abs(mapJetBotLinearSpeed(0.345) * 2.0 - 1.0) < 0.01);

  // Run fast scaled version (replacing sleep durations for quick unit test execution)
  const fastCode = preset.code
    .replace('FORWARD_TIME = 2.00', 'FORWARD_TIME = 0.02')
    .replace('TURN_TIME = 1.00', 'TURN_TIME = 0.02')
    .replace('SETTLE_TIME = 0.25', 'SETTLE_TIME = 0.01');

  const commands: string[] = [];
  const logs: string[] = [];
  const controller = new AbortController();

  await runAutonomousProgram(
    fastCode,
    makeDummyHost(logs, commands),
    controller.signal,
    { tickMs: 1 }
  );

  assert.equal(commands.filter((c) => c === 'FWD').length, 4);
  assert.equal(commands.filter((c) => c === 'TURN').length, 4);
  assert.ok(logs.some((l) => l.includes('Hoàn thành quỹ đạo hình vuông 1m x 1m!')));
});

test('Python interpreter supports try/except/finally, is/is not None, and all dual-compatible real-JetBot presets', async () => {
  const tryCode = `
from jetbot import Robot
robot = Robot()
x = None
try:
    bad = missing_real_hw_call()
except Exception:
    x = 42
finally:
    if x is not None:
        print("OK", x)
    robot.stop()
`;
  const logs: string[] = [];
  const cmds: string[] = [];
  await runAutonomousProgram(tryCode, makeDummyHost(logs, cmds), new AbortController().signal, { tickMs: 1 });
  assert.ok(logs.includes('OK 42'));
  assert.ok(cmds.includes('STOP'));

  for (const id of ['obstacle-avoidance', 'square-patrol', 'mars-alien-evade']) {
    const preset = AUTONOMOUS_PRESETS.find((p) => p.id === id);
    assert.ok(preset, `Missing preset ${id}`);
    const pLogs: string[] = [];
    const pCmds: string[] = [];
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 55);
    await runAutonomousProgram(preset.code, makeDummyHost(pLogs, pCmds), ctrl.signal, { tickMs: 5 });
    assert.ok(pCmds.includes('FWD'), `Expected ${id} to drive forward`);
    assert.equal(pCmds[pCmds.length - 1], 'STOP');
  }
});

test('computeDangerProbability and mapJetBotLinearSpeed stay bounded', () => {
  assert.ok(
    computeDangerProbability({
      obstacleDist: 0.35,
      alienDist: 4,
      nearBoundary: false,
      headingDeg: 0,
      posX: 0,
      posZ: 0,
    }) > 0.85
  );
  assert.ok(
    computeDangerProbability({
      obstacleDist: 2.5,
      alienDist: 4,
      nearBoundary: false,
      headingDeg: 0,
      posX: 0,
      posZ: 0,
    }) < 0.2
  );
  assert.ok(mapJetBotLinearSpeed(0.12) > 0.2);
  assert.equal(mapJetBotLinearSpeed(0), 0);
});

