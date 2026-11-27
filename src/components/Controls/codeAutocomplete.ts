import { CodeLanguage } from '../JetBot3D/autonomousRunner';

export type CompletionKind = 'sdk' | 'sensor' | 'fn' | 'kw' | 'snip';

export interface CompletionItem {
  id: string;
  label: string;
  insertText: string;
  kind: CompletionKind;
  detail: string;
  languages: CodeLanguage[];
  memberOf?: string;
}

export interface CompletionContext {
  replaceStart: number;
  replaceEnd: number;
  query: string;
  objectPrefix: string | null;
}

export const AUTO_MEMBER_NAMESPACES = new Set([
  'robot',
  'lidar',
  'alien',
  'telemetry',
  'math',
  'time',
  'random',
  'Serial',
  'console',
  'Math',
]);

const KIND_PRIORITY: Record<CompletionKind, number> = {
  sdk: 0,
  sensor: 1,
  fn: 2,
  snip: 3,
  kw: 4,
};

export const COMPLETION_CATALOG: CompletionItem[] = [
  // =========================================================
  // JETBOT ROBOT SDK (member calls & top-level helpers)
  // =========================================================
  {
    id: 'member-robot-forward',
    label: 'forward',
    insertText: 'forward($0)',
    kind: 'sdk',
    detail: 'forward(speed=0.45, duration_ms=500) · Tiến thẳng',
    languages: ['python', 'javascript', 'cpp'],
    memberOf: 'robot',
  },
  {
    id: 'member-robot-backward',
    label: 'backward',
    insertText: 'backward($0)',
    kind: 'sdk',
    detail: 'backward(speed=0.35, duration_ms=400) · Lùi lại',
    languages: ['python', 'javascript', 'cpp'],
    memberOf: 'robot',
  },
  {
    id: 'member-robot-left',
    label: 'left',
    insertText: 'left($0)',
    kind: 'sdk',
    detail: 'left(speed=0.55, duration_ms=400) · Rẽ trái',
    languages: ['python', 'javascript', 'cpp'],
    memberOf: 'robot',
  },
  {
    id: 'member-robot-right',
    label: 'right',
    insertText: 'right($0)',
    kind: 'sdk',
    detail: 'right(speed=0.55, duration_ms=400) · Rẽ phải',
    languages: ['python', 'javascript', 'cpp'],
    memberOf: 'robot',
  },
  {
    id: 'member-robot-set-motors',
    label: 'set_motors',
    insertText: 'set_motors($0)',
    kind: 'sdk',
    detail: 'set_motors(left, right, duration_ms) · Điều chỉnh 2 bánh',
    languages: ['python', 'javascript', 'cpp'],
    memberOf: 'robot',
  },
  {
    id: 'member-robot-stop',
    label: 'stop',
    insertText: 'stop()',
    kind: 'sdk',
    detail: 'Dừng khẩn cấp cả 2 động cơ',
    languages: ['python', 'javascript', 'cpp'],
    memberOf: 'robot',
  },
  {
    id: 'member-lidar-distance',
    label: 'distance',
    insertText: 'distance()',
    kind: 'sensor',
    detail: 'Khoảng cách vật cản gần nhất (mét)',
    languages: ['python', 'javascript', 'cpp'],
    memberOf: 'lidar',
  },
  {
    id: 'member-alien-distance',
    label: 'distance',
    insertText: 'distance()',
    kind: 'sensor',
    detail: 'Khoảng cách tới Alien gần nhất (mét)',
    languages: ['python', 'javascript', 'cpp'],
    memberOf: 'alien',
  },
  {
    id: 'member-telemetry-heading',
    label: 'heading',
    insertText: 'heading()',
    kind: 'sensor',
    detail: 'Góc hướng hiện tại của JetBot (độ)',
    languages: ['python', 'javascript', 'cpp'],
    memberOf: 'telemetry',
  },
  {
    id: 'member-telemetry-x',
    label: 'x',
    insertText: 'x()',
    kind: 'sensor',
    detail: 'Tọa độ X hiện tại trên sa bàn (m)',
    languages: ['python', 'javascript', 'cpp'],
    memberOf: 'telemetry',
  },
  {
    id: 'member-telemetry-z',
    label: 'z',
    insertText: 'z()',
    kind: 'sensor',
    detail: 'Tọa độ Z hiện tại trên sa bàn (m)',
    languages: ['python', 'javascript', 'cpp'],
    memberOf: 'telemetry',
  },

  // Top-level JetBot SDK completions
  {
    id: 'sdk-robot-forward',
    label: 'robot.forward',
    insertText: 'robot.forward($0)',
    kind: 'sdk',
    detail: 'Chạy thẳng (tốc độ 0..1, ms)',
    languages: ['python', 'javascript', 'cpp'],
  },
  {
    id: 'sdk-robot-backward',
    label: 'robot.backward',
    insertText: 'robot.backward($0)',
    kind: 'sdk',
    detail: 'Lùi về sau (tốc độ 0..1, ms)',
    languages: ['python', 'javascript', 'cpp'],
  },
  {
    id: 'sdk-robot-left',
    label: 'robot.left',
    insertText: 'robot.left($0)',
    kind: 'sdk',
    detail: 'Xoay trái tránh chướng ngại vật',
    languages: ['python', 'javascript', 'cpp'],
  },
  {
    id: 'sdk-robot-right',
    label: 'robot.right',
    insertText: 'robot.right($0)',
    kind: 'sdk',
    detail: 'Xoay phải chuyển hướng',
    languages: ['python', 'javascript', 'cpp'],
  },
  {
    id: 'sdk-robot-set-motors',
    label: 'robot.set_motors',
    insertText: 'robot.set_motors($0)',
    kind: 'sdk',
    detail: 'Điều khiển độc lập bánh trái/phải',
    languages: ['python', 'javascript', 'cpp'],
  },
  {
    id: 'sdk-robot-stop',
    label: 'robot.stop',
    insertText: 'robot.stop()',
    kind: 'sdk',
    detail: 'Dừng toàn bộ chuyển động JetBot',
    languages: ['python', 'javascript', 'cpp'],
  },
  {
    id: 'sensor-danger-prob',
    label: 'danger_probability',
    insertText: 'danger_probability()',
    kind: 'sensor',
    detail: 'Xác suất vùng nguy hiểm (0.0 -> 1.0)',
    languages: ['python', 'javascript', 'cpp'],
  },
  {
    id: 'sensor-lidar-dist',
    label: 'lidar.distance',
    insertText: 'lidar.distance()',
    kind: 'sensor',
    detail: 'Khoảng cách vật cản phía trước (m)',
    languages: ['python', 'javascript', 'cpp'],
  },
  {
    id: 'sensor-alien-dist',
    label: 'alien.distance',
    insertText: 'alien.distance()',
    kind: 'sensor',
    detail: 'Khoảng cách tới Alien gần nhất (m)',
    languages: ['python', 'javascript', 'cpp'],
  },
  {
    id: 'sensor-telemetry-heading',
    label: 'telemetry.heading',
    insertText: 'telemetry.heading()',
    kind: 'sensor',
    detail: 'Đọc góc hướng la bàn của JetBot',
    languages: ['python', 'javascript', 'cpp'],
  },

  // =========================================================
  // PYTHON COMPLETIONS
  // =========================================================
  {
    id: 'py-print',
    label: 'print',
    insertText: 'print($0)',
    kind: 'fn',
    detail: 'In giá trị ra Terminal Output',
    languages: ['python'],
  },
  {
    id: 'py-range',
    label: 'range',
    insertText: 'range($0)',
    kind: 'fn',
    detail: 'range(start, stop, step) · Dãy số lặp',
    languages: ['python'],
  },
  {
    id: 'py-len',
    label: 'len',
    insertText: 'len($0)',
    kind: 'fn',
    detail: 'Độ dài danh sách / chuỗi',
    languages: ['python'],
  },
  {
    id: 'py-sleep',
    label: 'time.sleep',
    insertText: 'time.sleep($0)',
    kind: 'fn',
    detail: 'Tạm dừng thực thi (giây)',
    languages: ['python'],
  },
  {
    id: 'py-time-member-sleep',
    label: 'sleep',
    insertText: 'sleep($0)',
    kind: 'fn',
    detail: 'sleep(seconds) · Chờ theo giây',
    languages: ['python'],
    memberOf: 'time',
  },
  {
    id: 'py-def-snip',
    label: 'def',
    insertText: 'def $0():\n    ',
    kind: 'snip',
    detail: 'Định nghĩa hàm Python mới',
    languages: ['python'],
  },
  {
    id: 'py-for-snip',
    label: 'for',
    insertText: 'for i in range($0):\n    ',
    kind: 'snip',
    detail: 'Vòng lặp for i in range(...)',
    languages: ['python'],
  },
  {
    id: 'py-while-snip',
    label: 'while',
    insertText: 'while $0:\n    ',
    kind: 'snip',
    detail: 'Vòng lặp điều kiện while',
    languages: ['python'],
  },
  {
    id: 'py-if-snip',
    label: 'if',
    insertText: 'if $0:\n    ',
    kind: 'snip',
    detail: 'Câu điều kiện if ...:',
    languages: ['python'],
  },
  {
    id: 'py-elif-snip',
    label: 'elif',
    insertText: 'elif $0:\n    ',
    kind: 'kw',
    detail: 'Nhánh điều kiện phụ elif',
    languages: ['python'],
  },
  {
    id: 'py-avoid-snip',
    label: 'tranh_vat_can',
    insertText: 'if danger_probability() > 0.55:\n    robot.left(0.55, 420)\nelse:\n    robot.forward(0.45, 500)$0',
    kind: 'snip',
    detail: 'Mẫu logic tránh vùng nguy hiểm JetBot',
    languages: ['python'],
  },
  {
    id: 'py-math-sqrt',
    label: 'sqrt',
    insertText: 'sqrt($0)',
    kind: 'fn',
    detail: 'Căn bậc hai',
    languages: ['python'],
    memberOf: 'math',
  },
  {
    id: 'py-math-sin',
    label: 'sin',
    insertText: 'sin($0)',
    kind: 'fn',
    detail: 'Hàm lượng giác sin(rad)',
    languages: ['python'],
    memberOf: 'math',
  },
  {
    id: 'py-math-pi',
    label: 'pi',
    insertText: 'pi',
    kind: 'fn',
    detail: 'Hằng số Pi (~3.14159)',
    languages: ['python'],
    memberOf: 'math',
  },
  {
    id: 'py-random-randint',
    label: 'randint',
    insertText: 'randint($0)',
    kind: 'fn',
    detail: 'randint(a, b) · Số nguyên ngẫu nhiên',
    languages: ['python'],
    memberOf: 'random',
  },

  // =========================================================
  // JAVASCRIPT COMPLETIONS
  // =========================================================
  {
    id: 'js-console-log',
    label: 'console.log',
    insertText: 'console.log($0);',
    kind: 'fn',
    detail: 'In log ra Terminal Output',
    languages: ['javascript'],
  },
  {
    id: 'js-member-console-log',
    label: 'log',
    insertText: 'log($0);',
    kind: 'fn',
    detail: 'In dữ liệu ra Terminal Output',
    languages: ['javascript'],
    memberOf: 'console',
  },
  {
    id: 'js-sleep',
    label: 'sleep',
    insertText: 'await sleep($0);',
    kind: 'fn',
    detail: 'Chờ theo milli-giây (ms)',
    languages: ['javascript'],
  },
  {
    id: 'js-const',
    label: 'const',
    insertText: 'const $0 = ',
    kind: 'kw',
    detail: 'Khai báo hằng số bất biến',
    languages: ['javascript'],
  },
  {
    id: 'js-let',
    label: 'let',
    insertText: 'let $0 = ',
    kind: 'kw',
    detail: 'Khai báo biến cục bộ',
    languages: ['javascript'],
  },
  {
    id: 'js-fn-snip',
    label: 'function',
    insertText: 'async function $0() {\n    \n}',
    kind: 'snip',
    detail: 'Khai báo hàm async mới',
    languages: ['javascript'],
  },
  {
    id: 'js-for-snip',
    label: 'for',
    insertText: 'for (let i = 0; i < $0; i++) {\n    \n}',
    kind: 'snip',
    detail: 'Vòng lặp for chuẩn JS',
    languages: ['javascript'],
  },
  {
    id: 'js-if-snip',
    label: 'if',
    insertText: 'if ($0) {\n    \n}',
    kind: 'snip',
    detail: 'Khối điều kiện if (...) { ... }',
    languages: ['javascript'],
  },
  {
    id: 'js-math-random',
    label: 'random',
    insertText: 'random()',
    kind: 'fn',
    detail: 'Số thực ngẫu nhiên [0, 1)',
    languages: ['javascript'],
    memberOf: 'Math',
  },
  {
    id: 'js-math-floor',
    label: 'floor',
    insertText: 'floor($0)',
    kind: 'fn',
    detail: 'Làm tròn xuống số nguyên',
    languages: ['javascript'],
    memberOf: 'Math',
  },

  // =========================================================
  // C++ / ARDUINO COMPLETIONS
  // =========================================================
  {
    id: 'cpp-serial-println',
    label: 'Serial.println',
    insertText: 'Serial.println($0);',
    kind: 'fn',
    detail: 'In một dòng ra Terminal Output',
    languages: ['cpp'],
  },
  {
    id: 'cpp-serial-print',
    label: 'Serial.print',
    insertText: 'Serial.print($0);',
    kind: 'fn',
    detail: 'In liên tiếp không xuống dòng',
    languages: ['cpp'],
  },
  {
    id: 'cpp-member-serial-println',
    label: 'println',
    insertText: 'println($0);',
    kind: 'fn',
    detail: 'Xuất dữ liệu kèm xuống dòng',
    languages: ['cpp'],
    memberOf: 'Serial',
  },
  {
    id: 'cpp-member-serial-print',
    label: 'print',
    insertText: 'print($0);',
    kind: 'fn',
    detail: 'Xuất dữ liệu ra Serial Monitor',
    languages: ['cpp'],
    memberOf: 'Serial',
  },
  {
    id: 'cpp-cout',
    label: 'cout',
    insertText: 'cout << $0 << endl;',
    kind: 'fn',
    detail: 'Xuất luồng chuẩn C++ iostream',
    languages: ['cpp'],
  },
  {
    id: 'cpp-printf',
    label: 'printf',
    insertText: 'printf("$0\\n");',
    kind: 'fn',
    detail: 'In định dạng kiểu C',
    languages: ['cpp'],
  },
  {
    id: 'cpp-delay',
    label: 'delay',
    insertText: 'delay($0);',
    kind: 'fn',
    detail: 'Tạm dừng thực thi (ms)',
    languages: ['cpp'],
  },
  {
    id: 'cpp-setup-snip',
    label: 'void setup',
    insertText: 'void setup() {\n    $0\n}',
    kind: 'snip',
    detail: 'Hàm khởi tạo Arduino setup()',
    languages: ['cpp'],
  },
  {
    id: 'cpp-loop-snip',
    label: 'void loop',
    insertText: 'void loop() {\n    $0\n}',
    kind: 'snip',
    detail: 'Vòng lặp điều khiển Arduino loop()',
    languages: ['cpp'],
  },
  {
    id: 'cpp-main-snip',
    label: 'int main',
    insertText: 'int main() {\n    $0\n    return 0;\n}',
    kind: 'snip',
    detail: 'Hàm chính chương trình C++',
    languages: ['cpp'],
  },
  {
    id: 'cpp-for-snip',
    label: 'for',
    insertText: 'for (int i = 0; i < $0; i++) {\n    \n}',
    kind: 'snip',
    detail: 'Vòng lặp for C++',
    languages: ['cpp'],
  },
  {
    id: 'cpp-if-snip',
    label: 'if',
    insertText: 'if ($0) {\n    \n}',
    kind: 'snip',
    detail: 'Câu điều kiện if (...) { ... }',
    languages: ['cpp'],
  },
];

export function extractCompletionContext(code: string, cursorPos: number): CompletionContext {
  const safeCursor = Math.max(0, Math.min(cursorPos, code.length));
  const before = code.slice(0, safeCursor);
  const tokenMatch = /([a-zA-Z_][a-zA-Z0-9_.]*)$/.exec(before);

  if (!tokenMatch) {
    return {
      replaceStart: safeCursor,
      replaceEnd: safeCursor,
      query: '',
      objectPrefix: null,
    };
  }

  const token = tokenMatch[1];
  const tokenStart = safeCursor - token.length;
  const lastDotIdx = token.lastIndexOf('.');

  if (lastDotIdx !== -1) {
    const objectPrefix = token.slice(0, lastDotIdx);
    const memberQuery = token.slice(lastDotIdx + 1);
    return {
      replaceStart: tokenStart + lastDotIdx + 1,
      replaceEnd: safeCursor,
      query: memberQuery,
      objectPrefix,
    };
  }

  return {
    replaceStart: tokenStart,
    replaceEnd: safeCursor,
    query: token,
    objectPrefix: null,
  };
}

export function getCompletionsForContext(
  language: CodeLanguage,
  ctx: CompletionContext
): CompletionItem[] {
  const q = ctx.query.toLowerCase();

  const pool = COMPLETION_CATALOG.filter((item) => {
    if (!item.languages.includes(language)) return false;
    if (ctx.objectPrefix !== null) {
      return item.memberOf === ctx.objectPrefix;
    }
    return !item.memberOf;
  });

  const scored: { item: CompletionItem; score: number }[] = [];
  for (const item of pool) {
    const labelLower = item.label.toLowerCase();
    if (!q) {
      scored.push({ item, score: KIND_PRIORITY[item.kind] });
      continue;
    }
    if (labelLower.startsWith(q)) {
      scored.push({ item, score: KIND_PRIORITY[item.kind] });
    } else if (labelLower.includes(`.${q}`) || labelLower.includes(`_${q}`)) {
      scored.push({ item, score: 10 + KIND_PRIORITY[item.kind] });
    } else if (labelLower.includes(q)) {
      scored.push({ item, score: 20 + KIND_PRIORITY[item.kind] });
    }
  }

  scored.sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label));
  return scored.map((entry) => entry.item);
}

export function applyCompletion(
  code: string,
  ctx: CompletionContext,
  item: CompletionItem
): { nextCode: string; nextCursorPos: number } {
  const lineStart = code.lastIndexOf('\n', Math.max(0, ctx.replaceStart - 1)) + 1;
  const currentLineBeforeReplace = code.slice(lineStart, ctx.replaceStart);
  const indentMatch = /^\s*/.exec(currentLineBeforeReplace);
  const baseIndent = indentMatch ? indentMatch[0] : '';

  const indentedInsert = item.insertText.includes('\n')
    ? item.insertText.replace(/\n/g, `\n${baseIndent}`)
    : item.insertText;

  const markerIdx = indentedInsert.indexOf('$0');
  const cleanInsert =
    markerIdx !== -1 ? indentedInsert.replace('$0', '') : indentedInsert;
  const nextCursorPos =
    markerIdx !== -1
      ? ctx.replaceStart + markerIdx
      : ctx.replaceStart + cleanInsert.length;

  const nextCode =
    code.slice(0, ctx.replaceStart) + cleanInsert + code.slice(ctx.replaceEnd);

  return { nextCode, nextCursorPos };
}

export function toggleLineComments(
  code: string,
  selStart: number,
  selEnd: number,
  language: CodeLanguage
): { nextCode: string; nextSelStart: number; nextSelEnd: number } {
  const prefix = language === 'python' ? '#' : '//';
  const safeStart = Math.max(0, Math.min(selStart, code.length));
  const safeEnd = Math.max(safeStart, Math.min(selEnd, code.length));

  const blockStart = code.lastIndexOf('\n', safeStart - 1) + 1;
  let blockEnd = code.indexOf('\n', safeEnd);
  if (blockEnd === -1) blockEnd = code.length;

  // If selection ends cleanly at start of a new line (and isn't collapsed), don't include that trailing line
  if (safeEnd > safeStart && code[safeEnd - 1] === '\n') {
    blockEnd = safeEnd - 1;
  }

  const lines = code.slice(blockStart, blockEnd).split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  const allCommented =
    nonEmptyLines.length > 0 &&
    nonEmptyLines.every((l) => l.trimStart().startsWith(prefix));

  let deltaFirstLine = 0;
  let totalDelta = 0;

  const transformed = lines.map((line, idx) => {
    if (allCommented) {
      const leadMatch = /^(\s*)/.exec(line);
      const lead = leadMatch ? leadMatch[1] : '';
      const rest = line.slice(lead.length);
      if (rest.startsWith(`${prefix} `)) {
        const removed = prefix.length + 1;
        if (idx === 0) deltaFirstLine = -removed;
        totalDelta -= removed;
        return lead + rest.slice(removed);
      }
      if (rest.startsWith(prefix)) {
        const removed = prefix.length;
        if (idx === 0) deltaFirstLine = -removed;
        totalDelta -= removed;
        return lead + rest.slice(removed);
      }
      return line;
    } else {
      const added = prefix.length + 1;
      if (idx === 0) deltaFirstLine = added;
      totalDelta += added;
      return `${prefix} ${line}`;
    }
  });

  const nextCode =
    code.slice(0, blockStart) + transformed.join('\n') + code.slice(blockEnd);

  const nextSelStart = Math.max(blockStart, safeStart + deltaFirstLine);
  const nextSelEnd = Math.max(nextSelStart, safeEnd + totalDelta);

  return { nextCode, nextSelStart, nextSelEnd };
}
