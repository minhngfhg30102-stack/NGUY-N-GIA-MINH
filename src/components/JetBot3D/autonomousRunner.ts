export type CodeLanguage = 'python' | 'javascript' | 'cpp';

export interface SensorSnapshot {
  obstacleDist: number;
  alienDist: number;
  nearBoundary: boolean;
  headingDeg: number;
  posX: number;
  posZ: number;
  speedCms?: number;
}

export interface LogEntry {
  id: number;
  level: 'info' | 'warn' | 'danger' | 'success';
  text: string;
}

export interface AutonomousPreset {
  id: string;
  language: CodeLanguage;
  label: string;
  description: string;
  code: string;
}

export interface LanguageMeta {
  id: CodeLanguage;
  label: string;
  shortLabel: string;
  fileName: string;
  apiHint: string;
}

export const LANGUAGE_INFO: Record<CodeLanguage, LanguageMeta> = {
  python: {
    id: 'python',
    label: 'Python',
    shortLabel: 'Python',
    fileName: 'main.py',
    apiHint: 'print · def · for/while · robot.* · lidar · alien',
  },
  javascript: {
    id: 'javascript',
    label: 'JavaScript',
    shortLabel: 'JS',
    fileName: 'main.js',
    apiHint: 'console.log · async/await · sleep(ms) · robot.*',
  },
  cpp: {
    id: 'cpp',
    label: 'C++ / Arduino',
    shortLabel: 'C++',
    fileName: 'main.cpp',
    apiHint: 'setup()/loop()/main() · cout · Serial · delay(ms)',
  },
};

export interface RunnerHost {
  setMotors: (linearVelocity: number, angularVelocity: number) => void;
  stop: () => void;
  getSensors: () => SensorSnapshot;
  onLog: (level: LogEntry['level'], text: string) => void;
  onDangerProb?: (prob: number) => void;
}

/**
 * Computes simulated camera-based danger probability [0..1] from obstacle/boundary distance,
 * matching the safety classification concept in 01_tranh_vung_nguy_hiem_quy_trinh_day_du.ipynb.
 */
export function computeDangerProbability(sensors: SensorSnapshot): number {
  if (sensors.nearBoundary) {
    return 0.94;
  }
  const d = sensors.obstacleDist;
  if (d <= 0.45) return 0.96;
  if (d <= 0.65) return 0.78;
  if (d <= 0.90) return 0.58;
  if (d <= 1.20) return 0.30;
  return 0.08;
}

/**
 * Maps normalized JetBot Python SDK speed [-1..1] to simulation velocity (m/s)
 * so cautious notebook values like RUN_SPEED = 0.12 move visibly and smoothly.
 */
export function mapJetBotLinearSpeed(rawSpeed: number): number {
  if (!Number.isFinite(rawSpeed) || Math.abs(rawSpeed) < 1e-4) return 0;
  const clamped = Math.max(-1, Math.min(1, rawSpeed));
  const sign = Math.sign(clamped);
  const mag = Math.abs(clamped);
  return sign * Math.min(1.1, Math.max(0.22, mag * 1.45));
}

export function mapJetBotAngularSpeed(rawTurn: number): number {
  if (!Number.isFinite(rawTurn) || Math.abs(rawTurn) < 1e-4) return 0;
  const clamped = Math.max(-1, Math.min(1, rawTurn));
  const sign = Math.sign(clamped);
  const mag = Math.abs(clamped);
  return sign * Math.min(2.6, Math.max(0.85, mag * 2.4));
}

export const ALL_PRESETS: AutonomousPreset[] = [
  // ---------------- PYTHON PRESETS ----------------
  {
    id: 'danger-stop-notebook',
    language: 'python',
    label: 'Tránh vùng nguy hiểm (Chuẩn 3D + JetBot thật)',
    description: 'Chạy thẳng chậm và tự dừng khi phát hiện nguy hiểm 3 khung hình liên tiếp (tự dùng Camera CSI thật trên JetBot hoặc cảm biến 3D).',
    code: `# Chạy được trên CẢ Mô phỏng 3D và NVIDIA JetBot ngoài đời thực
from jetbot import Robot
import time

robot = Robot()

RUN_SPEED = 0.18
DANGER_THRESHOLD = 0.55
CONSECUTIVE_DANGER_FRAMES = 3
MODEL_PATH = "best_model.pth"  # Model phân loại blocked/free trên JetBot thật

# Kết nối Camera CSI + PyTorch khi chạy trên JetBot thật (trong mô phỏng 3D tự động chuyển sang cảm biến 3D)
real_camera = None
try:
    import torch
    import torchvision
    import torch.nn.functional as F
    from jetbot import Camera

    device = torch.device("cuda")
    model = torchvision.models.alexnet(pretrained=False)
    clf = model.classifier
    clf[6] = torch.nn.Linear(clf[6].in_features, 2)
    model.load_state_dict(torch.load(MODEL_PATH))
    model = model.to(device).eval()
    mean_t = 255.0 * torch.Tensor([0.485, 0.456, 0.406]).to(device).view(3, 1, 1)
    std_t = 255.0 * torch.Tensor([0.229, 0.224, 0.225]).to(device).view(3, 1, 1)
    real_camera = Camera.instance(width=224, height=224)
except Exception:
    real_camera = None

def doc_nguy_hiem():
    if real_camera is not None:
        img = torch.from_numpy(real_camera.value).permute(2, 0, 1).float().to(device)
        inp = ((img - mean_t) / std_t).unsqueeze(0)
        probs = F.softmax(model(inp), dim=1).flatten().detach()
        return float(probs[0])
    return danger_probability()

danger_frames = 0
print("Bắt đầu chạy tự động chậm, đang giám sát nguy hiểm...")

try:
    while True:
        probability = doc_nguy_hiem()
        if probability >= DANGER_THRESHOLD:
            danger_frames += 1
        else:
            danger_frames = 0

        if danger_frames >= CONSECUTIVE_DANGER_FRAMES:
            robot.stop()
            print("Phát hiện vị trí nguy hiểm ({:.0%}). JetBot đã dừng.".format(probability))
            break
        else:
            robot.forward(RUN_SPEED)

        time.sleep(0.08)
finally:
    robot.stop()`,
  },
  {
    id: 'obstacle-avoidance',
    language: 'python',
    label: 'Tự tránh vật cản & rẽ (Chuẩn 3D + JetBot thật)',
    description: 'Tự động đi thẳng, gặp vật cản sẽ lùi và rẽ tránh (tự dùng RPLIDAR + Camera thật trên JetBot hoặc cảm biến 3D).',
    code: `# Chạy được trên CẢ Mô phỏng 3D và NVIDIA JetBot ngoài đời thực
from jetbot import Robot
import time

robot = Robot()

CRUISE_SPEED = 0.35
TURN_SPEED = 0.55
SAFE_DIST_METERS = 0.75

# Tự động kết nối RPLIDAR USB (/dev/ttyUSB0) nếu đang chạy trên JetBot thật
real_lidar = None
try:
    from rplidar import RPLidar
    real_lidar = RPLidar("/dev/ttyUSB0")
except Exception:
    real_lidar = None

def doc_lidar():
    if real_lidar is not None:
        min_m = 10.0
        for scan in real_lidar.iter_scans():
            for pt in scan:
                angle = pt[1]
                dist_mm = pt[2]
                if dist_mm > 0 and (angle <= 35 or angle >= 325):
                    d_m = dist_mm / 1000.0
                    if d_m < min_m:
                        min_m = d_m
            break
        return min_m
    return lidar.distance()

def doc_nguy_hiem():
    try:
        return danger_probability()
    except Exception:
        return 0.0

print("Khởi động chế độ né vật cản tự động...")

try:
    while True:
        prob = doc_nguy_hiem()
        dist = doc_lidar()

        if prob >= 0.55 or dist < SAFE_DIST_METERS:
            print(f"Cảnh báo vật cản cách {dist:.2f}m -> lùi và rẽ tránh")
            robot.stop()
            time.sleep(0.15)
            robot.backward(0.25)
            time.sleep(0.45)
            robot.right(TURN_SPEED)
            time.sleep(0.65)
        else:
            robot.forward(CRUISE_SPEED)

        time.sleep(0.06)
finally:
    robot.stop()
    if real_lidar is not None:
        real_lidar.stop()
        real_lidar.disconnect()`,
  },
  {
    id: 'square-1m-real-jetbot',
    language: 'python',
    label: 'Hình vuông 1m × 1m (Chuẩn 3D + JetBot thật)',
    description: 'Chạy đúng hình vuông dài 1m × rộng 1m, dùng chuẩn `from jetbot import Robot` chạy được cả trên JetBot ngoài đời.',
    code: `# Code chuẩn cho cả Mô phỏng 3D và NVIDIA JetBot ngoài đời thực
# Quỹ đạo hình vuông cạnh 1m x 1m trên mặt phẳng (dài 1m, rộng 1m)
from jetbot import Robot
import time

robot = Robot()

# --- THÔNG SỐ HIỆU CHỈNH (Calibrate theo tốc độ thực) ---
# Trong mô phỏng 3D: 0.345 -> 0.50 m/s => 2.00s = 1.00m; 0.6545 -> 90°/s => 1.00s = 90°
# Ngoài đời (tùy pin & sàn gạch/thảm): chỉnh FORWARD_TIME (~2.2-2.6s) và TURN_TIME (~0.45-0.65s)
SIDE_METERS = 1.0
FORWARD_SPEED = 0.345   # Công suất đi thẳng (0.0 -> 1.0)
FORWARD_TIME = 2.00     # Thời gian đi hết 1.0 mét (giây)

TURN_SPEED = 0.6545     # Công suất quay tại chỗ (0.0 -> 1.0)
TURN_TIME = 1.00        # Thời gian quay vuông góc 90 độ (giây)
SETTLE_TIME = 0.25      # Dừng nghỉ triệt tiêu quán tính trước khi rẽ

print(f"Bắt đầu chạy hình vuông {SIDE_METERS}m x {SIDE_METERS}m...")

try:
    for canh in range(4):
        print(f"Cạnh {canh + 1}/4: Tiến thẳng {SIDE_METERS}m")
        robot.forward(FORWARD_SPEED)
        time.sleep(FORWARD_TIME)
        robot.stop()
        time.sleep(SETTLE_TIME)

        print(f"Góc {canh + 1}/4: Quay phải 90°")
        robot.right(TURN_SPEED)
        time.sleep(TURN_TIME)
        robot.stop()
        time.sleep(SETTLE_TIME)

    print("Hoàn thành quỹ đạo hình vuông 1m x 1m!")
finally:
    robot.stop()`,
  },
  {
    id: 'square-patrol',
    language: 'python',
    label: 'Tuần tra hình vuông có né nguy hiểm (3D + thật)',
    description: 'Chạy tuần tra hình vuông 4 cạnh (1m × 1m) có kiểm tra an toàn vật cản, tương thích JetBot thật.',
    code: `# Tuần tra hình vuông 4 cạnh có kiểm tra an toàn (chạy được cả 3D & JetBot thật)
from jetbot import Robot
import time

robot = Robot()

FORWARD_SPEED = 0.345
TURN_SPEED = 0.6545
TURN_TIME = 1.00  # Hiệu chỉnh ~0.50s khi chạy JetBot ngoài đời

def doc_nguy_hiem():
    try:
        return danger_probability()
    except Exception:
        return 0.0

print("Bắt đầu chạy quỹ đạo hình vuông...")

try:
    for step in range(4):
        print("Đang đi cạnh số", step + 1)
        for t in range(20):
            if doc_nguy_hiem() >= 0.65:
                print("Gặp nguy hiểm! Rẽ né sớm...")
                robot.left(TURN_SPEED)
                time.sleep(TURN_TIME * 0.5)
                break
            robot.forward(FORWARD_SPEED)
            time.sleep(0.1)

        robot.stop()
        time.sleep(0.2)
        robot.right(TURN_SPEED)
        time.sleep(TURN_TIME)
        robot.stop()
        time.sleep(0.2)

    print("Hoàn thành quỹ đạo tuần tra!")
finally:
    robot.stop()`,
  },
  {
    id: 'mars-alien-evade',
    language: 'python',
    label: 'Né Alien & vật cản (3D Sao Hỏa + LiDAR thật)',
    description: 'Theo dõi LiDAR & radar sinh vật trong 3D; khi đưa ra JetBot thật tự động chuyển sang né vật cản LiDAR an toàn.',
    code: `# Chạy được trên CẢ Mô phỏng Sao Hỏa 3D và JetBot gắn RPLIDAR ngoài đời thực
from jetbot import Robot
import time

robot = Robot()

real_lidar = None
try:
    from rplidar import RPLidar
    real_lidar = RPLidar("/dev/ttyUSB0")
except Exception:
    real_lidar = None

def doc_lidar():
    if real_lidar is not None:
        min_m = 10.0
        for scan in real_lidar.iter_scans():
            for pt in scan:
                if pt[2] > 0 and (pt[1] <= 35 or pt[1] >= 325):
                    d_m = pt[2] / 1000.0
                    if d_m < min_m:
                        min_m = d_m
            break
        return min_m
    return lidar.distance()

def doc_alien():
    try:
        return alien.distance()
    except Exception:
        return 99.0  # Ngoài đời không có Alien -> bỏ qua bước né Alien

def doc_nguy_hiem():
    try:
        return danger_probability()
    except Exception:
        return 0.0

print("Bật chế độ thám hiểm tự hành...")

try:
    while True:
        dist_obs = doc_lidar()
        dist_alien = doc_alien()

        if dist_alien < 1.35:
            print(f"Phát hiện Alien ở {dist_alien:.2f}m! Đổi hướng nhanh.")
            robot.left(0.75)
            time.sleep(0.65)
        elif dist_obs < 0.70 or doc_nguy_hiem() >= 0.55:
            print(f"Né vật cản tại {dist_obs:.2f}m")
            robot.right(0.6)
            time.sleep(0.55)
        else:
            robot.forward(0.42)

        time.sleep(0.06)
finally:
    robot.stop()
    if real_lidar is not None:
        real_lidar.stop()
        real_lidar.disconnect()`,
  },
  {
    id: 'python-algorithms',
    language: 'python',
    label: 'Python cơ bản: Fibonacci & Toán học',
    description: 'Chạy code thuật toán Python thuần túy (hàm đệ quy, danh sách, f-string) như IDE.',
    code: `# Viết & chạy code Python thuật toán tổng quát
import math

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

nums = []
for i in range(9):
    nums.append(fibonacci(i))

print("Dãy Fibonacci 9 số đầu:", nums)
print(f"Tổng = {sum(nums)} | Trung bình = {sum(nums) / len(nums):.2f}")
print(f"Chu vi bánh xe JetBot (d=6.5cm): {math.pi * 6.5:.2f} cm")`,
  },

  // ---------------- JAVASCRIPT PRESETS ----------------
  {
    id: 'js-obstacle-avoidance',
    language: 'javascript',
    label: 'JS: Tuần tra & Né vật cản',
    description: 'Điều khiển JetBot bằng JavaScript chuẩn (async/await, console.log, lidar.distance()).',
    code: `// Điều khiển JetBot tự động bằng JavaScript
const CRUISE = 0.36;
console.log("Khởi động chương trình JS tự hành...");

while (true) {
  const dist = lidar.distance();
  const prob = danger_probability();

  if (prob >= 0.55 || dist < 0.75) {
    console.warn(\`Vật cản cách \${dist.toFixed(2)}m! Lùi và rẽ phải.\`);
    robot.backward(0.25);
    await sleep(420);
    robot.right(0.6);
    await sleep(600);
  } else {
    robot.forward(CRUISE);
  }

  await sleep(70);
}`,
  },
  {
    id: 'js-telemetry-patrol',
    language: 'javascript',
    label: 'JS: Quét đa giác & Telemetry',
    description: 'Chạy theo các đoạn thẳng kết hợp đọc góc la bàn và khoảng cách cảm biến.',
    code: `// Quỹ đạo lục giác & in thông số Telemetry
console.log("Bắt đầu chạy quỹ đạo 6 cạnh...");

for (let edge = 1; edge <= 6; edge++) {
  console.log(\`Cạnh \${edge}/6 | Góc hướng: \${Math.round(telemetry.heading())}°\`);
  robot.forward(0.35);
  await sleep(650);

  if (lidar.distance() < 0.8) {
    console.warn("Phát hiện vật cản gần, chuyển hướng gấp!");
    robot.left(0.7);
    await sleep(500);
  } else {
    robot.right(0.55);
    await sleep(480);
  }
}

robot.stop();
console.log("Hoàn thành hành trình JS!");`,
  },
  {
    id: 'js-primes-sample',
    language: 'javascript',
    label: 'JS cơ bản: Số nguyên tố & Mảng',
    description: 'Thử nghiệm code thuật toán JavaScript thuần túy với console.log.',
    code: `// Chương trình JavaScript tổng quát
function isPrime(n) {
  if (n < 2) return false;
  for (let d = 2; d <= Math.sqrt(n); d++) {
    if (n % d === 0) return false;
  }
  return true;
}

const primes = [];
for (let i = 2; i <= 50; i++) {
  if (isPrime(i)) primes.push(i);
}

console.log("Các số nguyên tố <= 50:", primes.join(", "));
console.log("Tổng cộng:", primes.length, "số nguyên tố.");`,
  },

  // ---------------- C++ / ARDUINO PRESETS ----------------
  {
    id: 'cpp-arduino-avoidance',
    language: 'cpp',
    label: 'Arduino: setup() & loop() Né vật cản',
    description: 'Lập trình phong cách Arduino / C++ với setup(), loop(), delay(ms) và Serial.println().',
    code: `// Code C++ / Arduino điều khiển JetBot tự lái
const float SAFE_DIST = 0.78;

void setup() {
  Serial.println("Arduino JetBot Controller: READY");
}

void loop() {
  float dist = lidar.distance();
  float prob = danger_probability();

  if (dist < SAFE_DIST || prob >= 0.55) {
    Serial.println("Canh bao vat can -> Lui & Re trai");
    robot.stop();
    delay(150);
    robot.backward(0.26);
    delay(420);
    robot.left(0.60);
    delay(620);
  } else {
    robot.forward(0.35);
  }

  delay(70);
}`,
  },
  {
    id: 'cpp-square-patrol',
    language: 'cpp',
    label: 'Arduino: Tuần tra hình vuông',
    description: 'Sử dụng vòng lặp for C++ điều khiển robot đi 4 cạnh và dừng.',
    code: `// Chạy hình vuông bằng C++ / Arduino
int main() {
  cout << "Bat dau chay quy dao hinh vuong (C++)..." << endl;

  for (int i = 1; i <= 4; i++) {
    printf("Dang chay canh thu %d\\n", i);
    robot.forward(0.35);
    delay(850);
    robot.right(0.62);
    delay(720);
  }

  robot.stop();
  cout << "Hoan thanh!" << endl;
  return 0;
}`,
  },
  {
    id: 'cpp-algorithms',
    language: 'cpp',
    label: 'C++ cơ bản: Sắp xếp & Fibonacci',
    description: 'Viết và chạy thử thuật toán C++ (cout, printf, vector, vòng lặp).',
    code: `#include <iostream>
using namespace std;

int fib(int n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

int main() {
  int arr[] = {34, 7, 23, 32, 5, 62};
  int n = 6;

  for (int i = 0; i < n - 1; i++) {
    for (int j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        int tmp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = tmp;
      }
    }
  }

  cout << "Mang sau sap xep: ";
  for (int k = 0; k < n; k++) {
    printf("%d ", arr[k]);
  }
  cout << endl;
  cout << "Fibonacci(10) = " << fib(10) << endl;
  return 0;
}`,
  },
];

export const PRESETS_BY_LANGUAGE: Record<CodeLanguage, AutonomousPreset[]> = {
  python: ALL_PRESETS.filter((p) => p.language === 'python'),
  javascript: ALL_PRESETS.filter((p) => p.language === 'javascript'),
  cpp: ALL_PRESETS.filter((p) => p.language === 'cpp'),
};

// Backwards-compatible default export used by earlier components/tests
export const AUTONOMOUS_PRESETS: AutonomousPreset[] = PRESETS_BY_LANGUAGE.python;

// ---------------------------------------------------------------------------
// Safe Python-subset Tokenizer, Recursive-Descent Expression Parser & AST
// ---------------------------------------------------------------------------

type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'fstr'; raw: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'none' }
  | { kind: 'var'; name: string }
  | { kind: 'list'; items: Expr[] }
  | { kind: 'dict'; entries: { key: Expr; value: Expr }[] }
  | { kind: 'index'; object: Expr; index: Expr }
  | { kind: 'attr'; object: Expr; property: string }
  | { kind: 'unary'; op: string; expr: Expr }
  | { kind: 'binary'; op: string; left: Expr; right: Expr }
  | { kind: 'ternary'; cond: Expr; ifTrue: Expr; ifFalse: Expr }
  | { kind: 'call'; callee: Expr; args: Expr[]; kwargs?: Record<string, Expr> };

export type Stmt =
  | { kind: 'assign'; line: number; target: string; op: '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '//='; value: Expr }
  | { kind: 'assign_index'; line: number; target: Expr; index: Expr; op: '=' | '+=' | '-=' | '*='; value: Expr }
  | { kind: 'expr'; line: number; expr: Expr }
  | {
      kind: 'if';
      line: number;
      branches: { cond: Expr | null; body: Stmt[] }[];
    }
  | { kind: 'while'; line: number; cond: Expr; body: Stmt[] }
  | { kind: 'for_iter'; line: number; varName: string; iterable: Expr; body: Stmt[] }
  | { kind: 'def'; line: number; name: string; params: string[]; body: Stmt[] }
  | { kind: 'try'; line: number; tryBody: Stmt[]; exceptBody: Stmt[]; finallyBody: Stmt[] }
  | { kind: 'return'; line: number; value: Expr | null }
  | { kind: 'break'; line: number }
  | { kind: 'continue'; line: number }
  | { kind: 'pass'; line: number };

interface Token {
  type: 'num' | 'str' | 'fstr' | 'ident' | 'op' | 'punct' | 'eof';
  value: string;
}

function stripInlineComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : '';
    if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
    else if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    else if (ch === '#' && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }
  return line;
}

function tokenizeExpression(input: string, lineNo: number): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    // Python f-string f"..." or f'...'
    if ((ch === 'f' || ch === 'F') && (input[i + 1] === '"' || input[i + 1] === "'")) {
      const quote = input[i + 1];
      i += 2;
      let str = '';
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) {
          const esc = input[i + 1];
          i += 2;
          if (esc === 'n') str += '\n';
          else if (esc === 't') str += '\t';
          else str += esc;
          continue;
        }
        str += input[i];
        i++;
      }
      if (i >= input.length) {
        throw new Error(`Dòng ${lineNo}: Chuỗi f-string chưa đóng dấu nháy.`);
      }
      i++;
      tokens.push({ type: 'fstr', value: str });
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      let str = '';
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) {
          const esc = input[i + 1];
          i += 2;
          if (esc === 'n') str += '\n';
          else if (esc === 't') str += '\t';
          else str += esc;
          continue;
        }
        str += input[i];
        i++;
      }
      if (i >= input.length) {
        throw new Error(`Dòng ${lineNo}: Chuỗi ký tự chưa đóng dấu nháy.`);
      }
      i++;
      tokens.push({ type: 'str', value: str });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < input.length && /[0-9]/.test(input[i + 1]))) {
      let numStr = '';
      while (i < input.length && /[0-9.]/.test(input[i])) {
        numStr += input[i++];
      }
      tokens.push({ type: 'num', value: numStr });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        ident += input[i++];
      }
      tokens.push({ type: 'ident', value: ident });
      continue;
    }
    const three = input.slice(i, i + 3);
    if (three === '//=') {
      tokens.push({ type: 'op', value: three });
      i += 3;
      continue;
    }
    const two = input.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '**', '//'].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }
    if (['+', '-', '*', '/', '%', '<', '>', '='].includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (['(', ')', '[', ']', '{', '}', ',', '.', ':'].includes(ch)) {
      tokens.push({ type: 'punct', value: ch });
      i++;
      continue;
    }
    throw new Error(`Dòng ${lineNo}: Ký tự không hợp lệ "${ch}".`);
  }
  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

function parseExpression(input: string, lineNo: number): Expr {
  const tokens = tokenizeExpression(input, lineNo);
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseTernary(): Expr {
    const first = parseOr();
    if (peek().type === 'ident' && peek().value === 'if') {
      consume();
      const cond = parseOr();
      if (!(peek().type === 'ident' && peek().value === 'else')) {
        throw new Error(`Dòng ${lineNo}: Thiếu từ khóa "else" trong biểu thức điều kiện.`);
      }
      consume();
      const ifFalse = parseTernary();
      return { kind: 'ternary', cond, ifTrue: first, ifFalse };
    }
    return first;
  }

  function parseOr(): Expr {
    let left = parseAnd();
    while (peek().type === 'ident' && peek().value === 'or') {
      consume();
      left = { kind: 'binary', op: 'or', left, right: parseAnd() };
    }
    return left;
  }

  function parseAnd(): Expr {
    let left = parseNot();
    while (peek().type === 'ident' && peek().value === 'and') {
      consume();
      left = { kind: 'binary', op: 'and', left, right: parseNot() };
    }
    return left;
  }

  function parseNot(): Expr {
    if (peek().type === 'ident' && peek().value === 'not') {
      if (tokens[pos + 1]?.type === 'ident' && tokens[pos + 1]?.value === 'in') {
        return parseComparison();
      }
      consume();
      return { kind: 'unary', op: 'not', expr: parseNot() };
    }
    return parseComparison();
  }

  function parseComparison(): Expr {
    let left = parseAddSub();
    while (true) {
      if (peek().type === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(peek().value)) {
        const op = consume().value;
        left = { kind: 'binary', op, left, right: parseAddSub() };
      } else if (peek().type === 'ident' && peek().value === 'in') {
        consume();
        left = { kind: 'binary', op: 'in', left, right: parseAddSub() };
      } else if (
        peek().type === 'ident' &&
        peek().value === 'not' &&
        tokens[pos + 1]?.type === 'ident' &&
        tokens[pos + 1]?.value === 'in'
      ) {
        consume();
        consume();
        left = { kind: 'binary', op: 'not_in', left, right: parseAddSub() };
      } else if (
        peek().type === 'ident' &&
        peek().value === 'is' &&
        tokens[pos + 1]?.type === 'ident' &&
        tokens[pos + 1]?.value === 'not'
      ) {
        consume();
        consume();
        left = { kind: 'binary', op: 'is_not', left, right: parseAddSub() };
      } else if (peek().type === 'ident' && peek().value === 'is') {
        consume();
        left = { kind: 'binary', op: 'is', left, right: parseAddSub() };
      } else {
        break;
      }
    }
    return left;
  }

  function parseAddSub(): Expr {
    let left = parseMulDiv();
    while (peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      left = { kind: 'binary', op, left, right: parseMulDiv() };
    }
    return left;
  }

  function parseMulDiv(): Expr {
    let left = parseUnary();
    while (peek().type === 'op' && ['*', '/', '//', '%'].includes(peek().value)) {
      const op = consume().value;
      left = { kind: 'binary', op, left, right: parseUnary() };
    }
    return left;
  }

  function parseUnary(): Expr {
    if (peek().type === 'op' && (peek().value === '-' || peek().value === '+')) {
      const op = consume().value;
      return { kind: 'unary', op, expr: parseUnary() };
    }
    return parsePower();
  }

  function parsePower(): Expr {
    const left = parsePostfix();
    if (peek().type === 'op' && peek().value === '**') {
      consume();
      return { kind: 'binary', op: '**', left, right: parseUnary() };
    }
    return left;
  }

  function parsePostfix(): Expr {
    let expr = parsePrimary();
    while (true) {
      if (peek().type === 'punct' && peek().value === '.') {
        consume();
        const propTok = consume();
        if (propTok.type !== 'ident') {
          throw new Error(`Dòng ${lineNo}: Thiếu tên thuộc tính sau dấu "."`);
        }
        expr = { kind: 'attr', object: expr, property: propTok.value };
      } else if (peek().type === 'punct' && peek().value === '[') {
        consume();
        const idxExpr = parseTernary();
        const close = consume();
        if (close.type !== 'punct' || close.value !== ']') {
          throw new Error(`Dòng ${lineNo}: Thiếu dấu ngoặc vuông đóng "]"`);
        }
        expr = { kind: 'index', object: expr, index: idxExpr };
      } else if (peek().type === 'punct' && peek().value === '(') {
        consume();
        const args: Expr[] = [];
        const kwargs: Record<string, Expr> = {};
        if (!(peek().type === 'punct' && peek().value === ')')) {
          while (true) {
            if (
              tokens[pos]?.type === 'ident' &&
              tokens[pos + 1]?.type === 'op' &&
              tokens[pos + 1]?.value === '='
            ) {
              const kwName = consume().value;
              consume();
              kwargs[kwName] = parseTernary();
            } else {
              args.push(parseTernary());
            }
            if (peek().type === 'punct' && peek().value === ',') {
              consume();
              if (peek().type === 'punct' && peek().value === ')') break;
              continue;
            }
            break;
          }
        }
        const close = consume();
        if (close.type !== 'punct' || close.value !== ')') {
          throw new Error(`Dòng ${lineNo}: Thiếu dấu ngoặc đóng ")"`);
        }
        expr = { kind: 'call', callee: expr, args, kwargs };
      } else {
        break;
      }
    }
    return expr;
  }

  function parsePrimary(): Expr {
    const tok = consume();
    if (tok.type === 'num') {
      const n = Number(tok.value);
      if (Number.isNaN(n)) throw new Error(`Dòng ${lineNo}: Số không hợp lệ "${tok.value}"`);
      return { kind: 'num', value: n };
    }
    if (tok.type === 'str') return { kind: 'str', value: tok.value };
    if (tok.type === 'fstr') return { kind: 'fstr', raw: tok.value };
    if (tok.type === 'ident') {
      if (tok.value === 'True') return { kind: 'bool', value: true };
      if (tok.value === 'False') return { kind: 'bool', value: false };
      if (tok.value === 'None') return { kind: 'none' };
      return { kind: 'var', name: tok.value };
    }
    if (tok.type === 'punct' && tok.value === '[') {
      const items: Expr[] = [];
      if (!(peek().type === 'punct' && peek().value === ']')) {
        while (true) {
          items.push(parseTernary());
          if (peek().type === 'punct' && peek().value === ',') {
            consume();
            if (peek().type === 'punct' && peek().value === ']') break;
            continue;
          }
          break;
        }
      }
      const close = consume();
      if (close.type !== 'punct' || close.value !== ']') {
        throw new Error(`Dòng ${lineNo}: Thiếu dấu ngoặc vuông đóng "]"`);
      }
      return { kind: 'list', items };
    }
    if (tok.type === 'punct' && tok.value === '{') {
      const entries: { key: Expr; value: Expr }[] = [];
      if (!(peek().type === 'punct' && peek().value === '}')) {
        while (true) {
          const key = parseTernary();
          const colon = consume();
          if (colon.type !== 'punct' || colon.value !== ':') {
            throw new Error(`Dòng ${lineNo}: Thiếu dấu ":" trong từ điển (dict).`);
          }
          const value = parseTernary();
          entries.push({ key, value });
          if (peek().type === 'punct' && peek().value === ',') {
            consume();
            if (peek().type === 'punct' && peek().value === '}') break;
            continue;
          }
          break;
        }
      }
      const close = consume();
      if (close.type !== 'punct' || close.value !== '}') {
        throw new Error(`Dòng ${lineNo}: Thiếu dấu ngoặc nhọn đóng "}"`);
      }
      return { kind: 'dict', entries };
    }
    if (tok.type === 'punct' && tok.value === '(') {
      if (peek().type === 'punct' && peek().value === ')') {
        consume();
        return { kind: 'list', items: [] };
      }
      const first = parseTernary();
      if (peek().type === 'punct' && peek().value === ',') {
        const items: Expr[] = [first];
        while (peek().type === 'punct' && peek().value === ',') {
          consume();
          if (peek().type === 'punct' && peek().value === ')') break;
          items.push(parseTernary());
        }
        const close = consume();
        if (close.type !== 'punct' || close.value !== ')') {
          throw new Error(`Dòng ${lineNo}: Thiếu dấu ngoặc đóng ")"`);
        }
        return { kind: 'list', items };
      }
      const close = consume();
      if (close.type !== 'punct' || close.value !== ')') {
        throw new Error(`Dòng ${lineNo}: Thiếu dấu ngoặc đóng ")"`);
      }
      return first;
    }
    throw new Error(`Dòng ${lineNo}: Cú pháp biểu thức không hợp lệ gần "${tok.value || 'cuối dòng'}"`);
  }

  const expr = parseTernary();
  if (peek().type !== 'eof') {
    throw new Error(`Dòng ${lineNo}: Ký tự thừa không hiểu "${peek().value}"`);
  }
  return expr;
}

interface ParsedLine {
  lineNo: number;
  indent: number;
  text: string;
}

export function parsePythonProgram(source: string): Stmt[] {
  const rawLines = source.replace(/\r\n/g, '\n').split('\n');
  const lines: ParsedLine[] = [];

  for (let idx = 0; idx < rawLines.length; idx++) {
    const cleaned = stripInlineComment(rawLines[idx]);
    const trimmed = cleaned.trim();
    if (!trimmed) continue;
    const expanded = cleaned.replace(/\t/g, '    ');
    const indent = expanded.length - expanded.trimStart().length;
    lines.push({ lineNo: idx + 1, indent, text: trimmed });
  }

  let cursor = 0;

  function parseBlock(expectedMinIndent: number): Stmt[] {
    const stmts: Stmt[] = [];
    let blockIndent: number | null = null;

    while (cursor < lines.length) {
      const line = lines[cursor];
      if (line.indent < expectedMinIndent) break;

      if (blockIndent === null) {
        blockIndent = line.indent;
      } else if (line.indent < blockIndent) {
        break;
      } else if (line.indent > blockIndent) {
        throw new Error(`Dòng ${line.lineNo}: Thụt lề (indent) không khớp.`);
      }

      if (
        line.text.startsWith('elif ') ||
        line.text === 'else:' ||
        line.text === 'except:' ||
        line.text.startsWith('except ') ||
        line.text === 'finally:'
      ) {
        break;
      }

      cursor++;

      if (line.text === 'break') {
        stmts.push({ kind: 'break', line: line.lineNo });
      } else if (line.text === 'continue') {
        stmts.push({ kind: 'continue', line: line.lineNo });
      } else if (
        line.text === 'pass' ||
        line.text.startsWith('global ') ||
        line.text.startsWith('import ') ||
        line.text.startsWith('from ')
      ) {
        stmts.push({ kind: 'pass', line: line.lineNo });
      } else if (line.text === 'try:') {
        const tryBody = parseBlock(blockIndent + 1);
        let exceptBody: Stmt[] = [];
        let finallyBody: Stmt[] = [];
        while (cursor < lines.length && lines[cursor].indent === blockIndent) {
          const next = lines[cursor];
          if (next.text === 'except:' || (next.text.startsWith('except ') && next.text.endsWith(':'))) {
            cursor++;
            exceptBody = parseBlock(blockIndent + 1);
          } else if (next.text === 'finally:') {
            cursor++;
            finallyBody = parseBlock(blockIndent + 1);
            break;
          } else {
            break;
          }
        }
        stmts.push({ kind: 'try', line: line.lineNo, tryBody, exceptBody, finallyBody });
      } else if (line.text.startsWith('return')) {
        const rest = line.text.slice(6).trim();
        stmts.push({
          kind: 'return',
          line: line.lineNo,
          value: rest ? parseExpression(rest, line.lineNo) : null,
        });
      } else if (line.text.startsWith('if ') && line.text.endsWith(':')) {
        const condSrc = line.text.slice(3, -1).trim();
        const branches: { cond: Expr | null; body: Stmt[] }[] = [
          {
            cond: parseExpression(condSrc, line.lineNo),
            body: parseBlock(blockIndent + 1),
          },
        ];
        while (cursor < lines.length && lines[cursor].indent === blockIndent) {
          const next = lines[cursor];
          if (next.text.startsWith('elif ') && next.text.endsWith(':')) {
            cursor++;
            branches.push({
              cond: parseExpression(next.text.slice(5, -1).trim(), next.lineNo),
              body: parseBlock(blockIndent + 1),
            });
          } else if (next.text === 'else:') {
            cursor++;
            branches.push({
              cond: null,
              body: parseBlock(blockIndent + 1),
            });
            break;
          } else {
            break;
          }
        }
        stmts.push({ kind: 'if', line: line.lineNo, branches });
      } else if (line.text.startsWith('while ') && line.text.endsWith(':')) {
        const condSrc = line.text.slice(6, -1).trim();
        const body = parseBlock(blockIndent + 1);
        stmts.push({ kind: 'while', line: line.lineNo, cond: parseExpression(condSrc, line.lineNo), body });
      } else if (line.text.startsWith('for ') && line.text.endsWith(':')) {
        const match = /^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+(.+)\s*:$/.exec(line.text);
        if (!match) {
          throw new Error(`Dòng ${line.lineNo}: Cú pháp vòng lặp "for ... in ...:" không hợp lệ.`);
        }
        const varName = match[1];
        const iterExpr = parseExpression(match[2].trim(), line.lineNo);
        const body = parseBlock(blockIndent + 1);
        stmts.push({ kind: 'for_iter', line: line.lineNo, varName, iterable: iterExpr, body });
      } else if (line.text.startsWith('def ') && line.text.endsWith(':')) {
        const match = /^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*:$/.exec(line.text);
        if (!match) {
          throw new Error(`Dòng ${line.lineNo}: Cú pháp định nghĩa hàm def không hợp lệ.`);
        }
        const params = match[2]
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);
        const body = parseBlock(blockIndent + 1);
        stmts.push({ kind: 'def', line: line.lineNo, name: match[1], params, body });
      } else {
        const idxAssign = /^([a-zA-Z_][a-zA-Z0-9_]*)\[(.+)\]\s*(\+=|-=|\*=|=)\s*(.+)$/.exec(line.text);
        if (idxAssign) {
          stmts.push({
            kind: 'assign_index',
            line: line.lineNo,
            target: { kind: 'var', name: idxAssign[1] },
            index: parseExpression(idxAssign[2], line.lineNo),
            op: idxAssign[3] as '=' | '+=' | '-=' | '*=',
            value: parseExpression(idxAssign[4], line.lineNo),
          });
        } else {
          const assignMatch = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(\+=|-=|\*=|\/=|%=|\/\/=|=)\s*(.+)$/.exec(line.text);
          if (assignMatch) {
            stmts.push({
              kind: 'assign',
              line: line.lineNo,
              target: assignMatch[1],
              op: assignMatch[2] as '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '//=',
              value: parseExpression(assignMatch[3], line.lineNo),
            });
          } else {
            stmts.push({
              kind: 'expr',
              line: line.lineNo,
              expr: parseExpression(line.text, line.lineNo),
            });
          }
        }
      }
    }

    return stmts;
  }

  return parseBlock(0);
}

// ---------------------------------------------------------------------------
// Cooperative Async Script Execution Engine & Multi-Language Sandboxes
// ---------------------------------------------------------------------------

class BreakSignal {}
class ContinueSignal {}
class ReturnSignal {
  constructor(public readonly value: unknown) {}
}
class CancelledError extends Error {
  constructor() {
    super('Script stopped');
  }
}

function formatValueWithSpec(val: unknown, spec: string): string {
  const trimmed = spec.replace(/^:/, '');
  if (!trimmed) return formatPrintable(val);
  if (trimmed.endsWith('%')) {
    const decimals = Number(trimmed.slice(1, -1)) || 0;
    return `${(Number(val) * 100).toFixed(decimals)}%`;
  }
  if (trimmed.endsWith('f')) {
    const dotIdx = trimmed.indexOf('.');
    const decimals = dotIdx >= 0 ? Number(trimmed.slice(dotIdx + 1, -1)) : 2;
    return Number(val).toFixed(Number.isNaN(decimals) ? 2 : decimals);
  }
  if (trimmed.endsWith('d')) {
    return String(Math.trunc(Number(val)));
  }
  return formatPrintable(val);
}

function formatPythonString(template: string, args: unknown[]): string {
  let argIdx = 0;
  return template.replace(/\{([^}]*)\}/g, (_match, spec: string) => {
    const val = args[argIdx++];
    if (val === undefined) return '';
    return formatValueWithSpec(val, spec);
  });
}

function formatPrintf(fmt: string, args: unknown[]): string {
  let idx = 0;
  return fmt.replace(/%(\.\d+)?([dfs%])/g, (_m, prec: string | undefined, kind: string) => {
    if (kind === '%') return '%';
    const val = args[idx++];
    if (kind === 'd') return String(Math.trunc(Number(val ?? 0)));
    if (kind === 'f') {
      const dec = prec ? Number(prec.slice(1)) : 2;
      return Number(val ?? 0).toFixed(Number.isNaN(dec) ? 2 : dec);
    }
    return formatPrintable(val);
  });
}

function formatPrintable(val: unknown): string {
  if (val === null || val === undefined) return 'None';
  if (Array.isArray(val)) {
    return `[${val.map((v) => (typeof v === 'string' ? `'${v}'` : formatPrintable(v))).join(', ')}]`;
  }
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new CancelledError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new CancelledError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function makeRangeArray(args: number[]): number[] {
  const start = args.length >= 2 ? args[0] : 0;
  const stop = args.length >= 2 ? args[1] : (args[0] ?? 0);
  const step = args.length >= 3 ? args[2] : 1;
  if (step === 0) return [];
  const res: number[] = [];
  for (let v = start; step > 0 ? v < stop : v > stop; v += step) {
    res.push(v);
    if (res.length > 50_000) break;
  }
  return res;
}

export async function runAutonomousProgram(
  source: string,
  host: RunnerHost,
  signal: AbortSignal,
  options?: { tickMs?: number }
): Promise<void> {
  const ast = parsePythonProgram(source);
  const loopTickMs = options?.tickMs ?? 45;
  const env: Record<string, unknown> = {
    True: true,
    False: false,
    None: null,
  };
  const functions = new Map<string, { params: string[]; body: Stmt[] }>();
  let lastYieldAt = performance.now();

  const cooperativeYield = async (minWaitMs = 0) => {
    if (signal.aborted) throw new CancelledError();
    const now = performance.now();
    if (minWaitMs > 0 || now - lastYieldAt >= 18) {
      await sleepAbortable(minWaitMs, signal);
      lastYieldAt = performance.now();
    }
  };

  const evalFString = async (raw: string, localScope: Record<string, unknown>, lineNo = 1): Promise<string> => {
    let result = '';
    let i = 0;
    while (i < raw.length) {
      if (raw[i] === '{') {
        if (raw[i + 1] === '{') {
          result += '{';
          i += 2;
          continue;
        }
        let depth = 1;
        let j = i + 1;
        let inS = false;
        let inD = false;
        while (j < raw.length && depth > 0) {
          const c = raw[j];
          if (c === "'" && !inD) inS = !inS;
          else if (c === '"' && !inS) inD = !inD;
          else if (!inS && !inD) {
            if (c === '{') depth++;
            else if (c === '}') depth--;
          }
          j++;
        }
        if (depth !== 0) throw new Error(`Dòng ${lineNo}: Biểu thức f-string chưa đóng "}".`);
        const inner = raw.slice(i + 1, j - 1);
        // Split top-level format specifier after ':'
        let colonIdx = -1;
        let pDepth = 0;
        inS = false;
        inD = false;
        for (let k = 0; k < inner.length; k++) {
          const c = inner[k];
          if (c === "'" && !inD) inS = !inS;
          else if (c === '"' && !inS) inD = !inD;
          else if (!inS && !inD) {
            if (c === '(' || c === '[' || c === '{') pDepth++;
            else if (c === ')' || c === ']' || c === '}') pDepth--;
            else if (c === ':' && pDepth === 0) {
              colonIdx = k;
              break;
            }
          }
        }
        const exprSrc = colonIdx >= 0 ? inner.slice(0, colonIdx) : inner;
        const spec = colonIdx >= 0 ? inner.slice(colonIdx + 1) : '';
        const val = await evalExpr(parseExpression(exprSrc.trim(), lineNo), localScope);
        result += formatValueWithSpec(val, spec);
        i = j;
      } else if (raw[i] === '}' && raw[i + 1] === '}') {
        result += '}';
        i += 2;
      } else {
        result += raw[i];
        i++;
      }
    }
    return result;
  };

  const evalExpr = async (expr: Expr, localScope: Record<string, unknown>): Promise<unknown> => {
    if (signal.aborted) throw new CancelledError();

    switch (expr.kind) {
      case 'num':
      case 'str':
      case 'bool':
        return expr.value;
      case 'fstr':
        return evalFString(expr.raw, localScope);
      case 'none':
        return null;
      case 'list': {
        const items: unknown[] = [];
        for (const item of expr.items) items.push(await evalExpr(item, localScope));
        return items;
      }
      case 'dict': {
        const obj: Record<string, unknown> = {};
        for (const entry of expr.entries) {
          const k = String(await evalExpr(entry.key, localScope));
          obj[k] = await evalExpr(entry.value, localScope);
        }
        return obj;
      }
      case 'var': {
        if (expr.name in localScope) return localScope[expr.name];
        if (expr.name in env) return env[expr.name];
        if (['robot', 'time', 'lidar', 'alien', 'camera', 'math', 'random', 'telemetry'].includes(expr.name)) {
          return { __namespace: expr.name };
        }
        return 0;
      }
      case 'ternary': {
        const cond = await evalExpr(expr.cond, localScope);
        return cond ? evalExpr(expr.ifTrue, localScope) : evalExpr(expr.ifFalse, localScope);
      }
      case 'index': {
        const target = await evalExpr(expr.object, localScope);
        const idx = await evalExpr(expr.index, localScope);
        if (Array.isArray(target) || typeof target === 'string') {
          let i = Number(idx);
          if (i < 0) i += target.length;
          return target[i];
        }
        if (target && typeof target === 'object') {
          return (target as Record<string, unknown>)[String(idx)];
        }
        return undefined;
      }
      case 'unary': {
        const val = await evalExpr(expr.expr, localScope);
        if (expr.op === '-') return -Number(val);
        if (expr.op === '+') return +Number(val);
        if (expr.op === 'not') return !val;
        return val;
      }
      case 'binary': {
        if (expr.op === 'and') {
          const l = await evalExpr(expr.left, localScope);
          return l ? await evalExpr(expr.right, localScope) : l;
        }
        if (expr.op === 'or') {
          const l = await evalExpr(expr.left, localScope);
          return l ? l : await evalExpr(expr.right, localScope);
        }
        const l = await evalExpr(expr.left, localScope);
        const r = await evalExpr(expr.right, localScope);
        switch (expr.op) {
          case '+':
            if (Array.isArray(l) && Array.isArray(r)) return [...l, ...r];
            return typeof l === 'string' || typeof r === 'string'
              ? `${String(l)}${String(r)}`
              : Number(l) + Number(r);
          case '-':
            return Number(l) - Number(r);
          case '*':
            if (Array.isArray(l) && typeof r === 'number') {
              return Array.from({ length: Math.max(0, Math.trunc(r)) }, () => l).flat();
            }
            if (typeof l === 'string' && typeof r === 'number') {
              return l.repeat(Math.max(0, Math.trunc(r)));
            }
            return Number(l) * Number(r);
          case '/':
            return Number(r) === 0 ? 0 : Number(l) / Number(r);
          case '//':
            return Number(r) === 0 ? 0 : Math.floor(Number(l) / Number(r));
          case '%':
            return Number(r) === 0 ? 0 : Number(l) % Number(r);
          case '**':
            return Number(l) ** Number(r);
          case '<':
            return Number(l) < Number(r);
          case '<=':
            return Number(l) <= Number(r);
          case '>':
            return Number(l) > Number(r);
          case '>=':
            return Number(l) >= Number(r);
          case '==':
          case 'is':
            return l === r;
          case '!=':
          case 'is_not':
            return l !== r;
          case 'in':
            if (Array.isArray(r)) return r.includes(l);
            if (typeof r === 'string') return r.includes(String(l));
            if (r && typeof r === 'object') return String(l) in (r as Record<string, unknown>);
            return false;
          case 'not_in':
            if (Array.isArray(r)) return !r.includes(l);
            if (typeof r === 'string') return !r.includes(String(l));
            if (r && typeof r === 'object') return !(String(l) in (r as Record<string, unknown>));
            return true;
          default:
            return 0;
        }
      }
      case 'attr': {
        const obj = await evalExpr(expr.object, localScope);
        if (obj && typeof obj === 'object' && '__namespace' in obj) {
          const ns = (obj as { __namespace: string }).__namespace;
          if (ns === 'camera' && expr.property === 'value') {
            return host.getSensors();
          }
          if (ns === 'math' && expr.property === 'pi') return Math.PI;
          if (ns === 'math' && expr.property === 'e') return Math.E;
          return { __method: `${ns}.${expr.property}` };
        }
        if (typeof obj === 'string') {
          if (expr.property === 'format') return { __strFormat: obj };
          return { __boundStr: obj, method: expr.property };
        }
        if (Array.isArray(obj)) {
          return { __boundArr: obj, method: expr.property };
        }
        return undefined;
      }
      case 'call': {
        const args: unknown[] = [];
        for (const a of expr.args) {
          args.push(await evalExpr(a, localScope));
        }

        if (expr.callee.kind === 'var') {
          const fnName = expr.callee.name;
          if (fnName === 'print') {
            const sep = expr.kwargs?.sep ? String(await evalExpr(expr.kwargs.sep, localScope)) : ' ';
            const msg = args.map((v) => formatPrintable(v)).join(sep);
            const isDanger = /nguy hiểm|cảnh báo|dừng|alien|lỗi/i.test(msg);
            host.onLog(isDanger ? 'danger' : 'info', msg);
            return null;
          }
          if (fnName === 'danger_probability') {
            const sensors = host.getSensors();
            const prob = computeDangerProbability(sensors);
            host.onDangerProb?.(prob);
            return prob;
          }
          if (fnName === 'obstacle_distance') return host.getSensors().obstacleDist;
          if (fnName === 'alien_distance') return host.getSensors().alienDist;
          if (fnName === 'range') return makeRangeArray(args.map(Number));
          if (fnName === 'len') {
            const target = args[0];
            if (Array.isArray(target) || typeof target === 'string') return target.length;
            if (target && typeof target === 'object') return Object.keys(target).length;
            return 0;
          }
          if (fnName === 'sum') {
            const arr = Array.isArray(args[0]) ? args[0] : args;
            return arr.reduce<number>((acc, x) => acc + Number(x), 0);
          }
          if (fnName === 'sorted') {
            const arr = Array.isArray(args[0]) ? [...args[0]] : [];
            return arr.sort((a, b) => Number(a) - Number(b));
          }
          if (fnName === 'enumerate') {
            const arr = Array.isArray(args[0]) ? args[0] : [];
            return arr.map((val, idx) => [idx, val]);
          }
          if (fnName === 'list') {
            return Array.isArray(args[0]) ? [...args[0]] : [];
          }
          if (fnName === 'min') {
            const arr = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
            return Math.min(...arr.map(Number));
          }
          if (fnName === 'max') {
            const arr = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
            return Math.max(...arr.map(Number));
          }
          if (fnName === 'abs') return Math.abs(Number(args[0] ?? 0));
          if (fnName === 'round') {
            const val = Number(args[0] ?? 0);
            const digits = Number(args[1] ?? 0);
            const factor = 10 ** digits;
            return Math.round(val * factor) / factor;
          }
          if (fnName === 'int') return Math.trunc(Number(args[0] ?? 0));
          if (fnName === 'float') return Number(args[0] ?? 0);
          if (fnName === 'bool') return Boolean(args[0]);
          if (fnName === 'str') return formatPrintable(args[0] ?? '');
          if (fnName === 'Robot') return { __namespace: 'robot' };

          const userFn = functions.get(fnName);
          if (userFn) {
            await cooperativeYield(0);
            const fnScope: Record<string, unknown> = {};
            userFn.params.forEach((p, idx) => {
              fnScope[p] = args[idx];
            });
            try {
              await execStmts(userFn.body, fnScope);
            } catch (sig) {
              if (sig instanceof ReturnSignal) return sig.value;
              throw sig;
            }
            return null;
          }
          throw new Error(`Không nhận diện được hàm "${fnName}()"`);
        }

        const targetCallee = await evalExpr(expr.callee, localScope);
        if (targetCallee && typeof targetCallee === 'object') {
          if ('__strFormat' in targetCallee) {
            return formatPythonString((targetCallee as { __strFormat: string }).__strFormat, args);
          }
          if ('__boundStr' in targetCallee) {
            const { __boundStr: s, method } = targetCallee as { __boundStr: string; method: string };
            if (method === 'upper') return s.toUpperCase();
            if (method === 'lower') return s.toLowerCase();
            if (method === 'strip') return s.trim();
            if (method === 'split') return s.split(args[0] !== undefined ? String(args[0]) : /\s+/);
            if (method === 'join') {
              const items = Array.isArray(args[0]) ? args[0] : [];
              return items.map((x) => String(x)).join(s);
            }
            if (method === 'replace') return s.replaceAll(String(args[0] ?? ''), String(args[1] ?? ''));
          }
          if ('__boundArr' in targetCallee) {
            const { __boundArr: arr, method } = targetCallee as { __boundArr: unknown[]; method: string };
            if (method === 'append') {
              arr.push(args[0]);
              return null;
            }
            if (method === 'pop') return arr.pop();
            if (method === 'clear') {
              arr.length = 0;
              return null;
            }
            if (method === 'sort') {
              arr.sort((a, b) => Number(a) - Number(b));
              return null;
            }
          }
          if ('__method' in targetCallee) {
            const m = (targetCallee as { __method: string }).__method;
            if (m === 'robot.forward') {
              host.setMotors(mapJetBotLinearSpeed(Number(args[0] ?? 0.3)), 0);
              return null;
            }
            if (m === 'robot.backward') {
              host.setMotors(-mapJetBotLinearSpeed(Number(args[0] ?? 0.25)), 0);
              return null;
            }
            if (m === 'robot.left') {
              host.setMotors(0, mapJetBotAngularSpeed(Number(args[0] ?? 0.5)));
              return null;
            }
            if (m === 'robot.right') {
              host.setMotors(0, -mapJetBotAngularSpeed(Number(args[0] ?? 0.5)));
              return null;
            }
            if (m === 'robot.set_motors') {
              const l = Number(args[0] ?? 0);
              const r = Number(args[1] ?? 0);
              const linear = mapJetBotLinearSpeed((l + r) * 0.5);
              const angular = (r - l) * 2.2;
              host.setMotors(linear, angular);
              return null;
            }
            if (m === 'robot.stop') {
              host.stop();
              return null;
            }
            if (m === 'time.sleep') {
              const secs = Math.max(0.01, Math.min(30, Number(args[0] ?? 0.1)));
              await sleepAbortable(secs * 1000, signal);
              lastYieldAt = performance.now();
              return null;
            }
            if (m === 'time.time') return Date.now() / 1000;
            if (m === 'lidar.distance') return host.getSensors().obstacleDist;
            if (m === 'alien.distance') return host.getSensors().alienDist;
            if (m === 'telemetry.heading') return host.getSensors().headingDeg;
            if (m === 'telemetry.x') return host.getSensors().posX;
            if (m === 'telemetry.z') return host.getSensors().posZ;
            if (m === 'math.sin') return Math.sin(Number(args[0] ?? 0));
            if (m === 'math.cos') return Math.cos(Number(args[0] ?? 0));
            if (m === 'math.tan') return Math.tan(Number(args[0] ?? 0));
            if (m === 'math.sqrt') return Math.sqrt(Number(args[0] ?? 0));
            if (m === 'math.floor') return Math.floor(Number(args[0] ?? 0));
            if (m === 'math.ceil') return Math.ceil(Number(args[0] ?? 0));
            if (m === 'math.pow') return Math.pow(Number(args[0] ?? 0), Number(args[1] ?? 1));
            if (m === 'random.random') return Math.random();
            if (m === 'random.randint') {
              const lo = Math.ceil(Number(args[0] ?? 0));
              const hi = Math.floor(Number(args[1] ?? 1));
              return Math.floor(Math.random() * (hi - lo + 1)) + lo;
            }
            if (m === 'random.uniform') {
              const lo = Number(args[0] ?? 0);
              const hi = Number(args[1] ?? 1);
              return lo + Math.random() * (hi - lo);
            }
            if (m === 'random.choice') {
              const arr = Array.isArray(args[0]) ? args[0] : [];
              return arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
            }
          }
        }
        return null;
      }
    }
  };

  const execStmts = async (stmts: Stmt[], localScope: Record<string, unknown>): Promise<void> => {
    for (const stmt of stmts) {
      if (signal.aborted) throw new CancelledError();

      switch (stmt.kind) {
        case 'pass':
          break;
        case 'break':
          throw new BreakSignal();
        case 'continue':
          throw new ContinueSignal();
        case 'return': {
          const val = stmt.value ? await evalExpr(stmt.value, localScope) : null;
          throw new ReturnSignal(val);
        }
        case 'def':
          functions.set(stmt.name, { params: stmt.params, body: stmt.body });
          break;
        case 'assign': {
          const rhs = await evalExpr(stmt.value, localScope);
          const scopeTarget = stmt.target in localScope ? localScope : env;
          if (stmt.op === '=') {
            scopeTarget[stmt.target] = rhs;
          } else {
            const cur = Number(scopeTarget[stmt.target] ?? 0);
            if (stmt.op === '+=') scopeTarget[stmt.target] = cur + Number(rhs);
            else if (stmt.op === '-=') scopeTarget[stmt.target] = cur - Number(rhs);
            else if (stmt.op === '*=') scopeTarget[stmt.target] = cur * Number(rhs);
            else if (stmt.op === '/=') scopeTarget[stmt.target] = cur / Number(rhs);
            else if (stmt.op === '%=') scopeTarget[stmt.target] = cur % Number(rhs);
            else if (stmt.op === '//=') scopeTarget[stmt.target] = Math.floor(cur / Number(rhs));
          }
          break;
        }
        case 'assign_index': {
          const container = await evalExpr(stmt.target, localScope);
          const idx = await evalExpr(stmt.index, localScope);
          const rhs = await evalExpr(stmt.value, localScope);
          if (Array.isArray(container)) {
            const i = Number(idx);
            if (stmt.op === '=') container[i] = rhs;
            else if (stmt.op === '+=') container[i] = Number(container[i] ?? 0) + Number(rhs);
            else if (stmt.op === '-=') container[i] = Number(container[i] ?? 0) - Number(rhs);
            else if (stmt.op === '*=') container[i] = Number(container[i] ?? 0) * Number(rhs);
          } else if (container && typeof container === 'object') {
            (container as Record<string, unknown>)[String(idx)] = rhs;
          }
          break;
        }
        case 'expr':
          await evalExpr(stmt.expr, localScope);
          break;
        case 'if': {
          for (const branch of stmt.branches) {
            if (branch.cond === null) {
              await execStmts(branch.body, localScope);
              break;
            }
            const condVal = await evalExpr(branch.cond, localScope);
            if (condVal) {
              await execStmts(branch.body, localScope);
              break;
            }
          }
          break;
        }
        case 'while': {
          while (await evalExpr(stmt.cond, localScope)) {
            if (signal.aborted) throw new CancelledError();
            try {
              await execStmts(stmt.body, localScope);
            } catch (sig) {
              if (sig instanceof BreakSignal) break;
              if (sig instanceof ContinueSignal) {
                await cooperativeYield(loopTickMs);
                continue;
              }
              throw sig;
            }
            await cooperativeYield(loopTickMs);
          }
          break;
        }
        case 'for_iter': {
          const iterVal = await evalExpr(stmt.iterable, localScope);
          const items: unknown[] = Array.isArray(iterVal)
            ? iterVal
            : typeof iterVal === 'string'
            ? Array.from(iterVal)
            : iterVal && typeof iterVal === 'object'
            ? Object.keys(iterVal)
            : [];

          const targetScope = Object.keys(localScope).length > 0 ? localScope : env;
          for (const item of items) {
            if (signal.aborted) throw new CancelledError();
            targetScope[stmt.varName] = item;
            try {
              await execStmts(stmt.body, localScope);
            } catch (sig) {
              if (sig instanceof BreakSignal) break;
              if (sig instanceof ContinueSignal) continue;
              throw sig;
            }
            await cooperativeYield(0);
          }
          break;
        }
        case 'try': {
          try {
            await execStmts(stmt.tryBody, localScope);
          } catch (err) {
            if (
              err instanceof BreakSignal ||
              err instanceof ContinueSignal ||
              err instanceof ReturnSignal ||
              err instanceof CancelledError
            ) {
              throw err;
            }
            if (stmt.exceptBody.length > 0) {
              await execStmts(stmt.exceptBody, localScope);
            } else {
              throw err;
            }
          } finally {
            if (stmt.finallyBody.length > 0 && !signal.aborted) {
              await execStmts(stmt.finallyBody, localScope);
            }
          }
          break;
        }
      }
    }
  };

  try {
    await execStmts(ast, {});
  } catch (err) {
    if (!(err instanceof CancelledError)) {
      throw err;
    }
  } finally {
    host.stop();
  }
}

// ---------------------------------------------------------------------------
// JavaScript Sandbox Preprocessor & C++ / Arduino Transpiler
// ---------------------------------------------------------------------------

/**
 * Protects string literals and comments while transforming non-literal code,
 * preventing accidental rewrites inside `"..."`, `'...'`, `` `...` ``, or comments.
 */
function transformOutsideStringsAndComments(
  code: string,
  transformer: (segment: string) => string,
  preserveSlashComments = true
): string {
  const placeholders: string[] = [];
  const tokenRe = preserveSlashComments
    ? /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/g
    : /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g;

  const masked = code.replace(tokenRe, (match) => {
    if (!preserveSlashComments && (match.startsWith('//') || match.startsWith('/*'))) {
      return match.startsWith('/*') ? ' ' : '';
    }
    const key = `__STR_TOK_${placeholders.length}__`;
    placeholders.push(match);
    return key;
  });

  const transformed = transformer(masked);
  return transformed.replace(/__STR_TOK_(\d+)__/g, (_m, idx) => placeholders[Number(idx)] ?? '');
}

/**
 * Instruments JavaScript loops with cooperative cancellation ticks (`await __tick()`
 * in async scopes, `__syncTick()` inside synchronous helper functions) and allows
 * `sleep(...)` / `delay(...)` even when users omit `await`.
 */
function instrumentJavaScript(source: string): string {
  return transformOutsideStringsAndComments(source, (code) => {
    // Allow sleep(...) / delay(...) without explicit await inside top-level async body
    let out = code.replace(/(?<!await\s)\b(sleep|delay|time\.sleep)\s*\(/g, 'await $1(');

    // Track whether we are inside a non-async function declaration/expression
    let result = '';
    const scopeStack: { kind: 'syncFn' | 'asyncOrBlock'; depth: number }[] = [];
    let braceDepth = 0;

    for (let i = 0; i < out.length; i++) {
      // Detect function keyword or => starting a sync vs async block
      const slice = out.slice(i);
      const syncFnMatch = /^(?<!async\s)\bfunction\b/.exec(slice);
      if (syncFnMatch) {
        scopeStack.push({ kind: 'syncFn', depth: braceDepth });
      }

      const loopMatch = /^(?:while|for)\s*\([^)]*\)\s*\{|^do\s*\{/.exec(slice);
      if (loopMatch) {
        const matched = loopMatch[0];
        const inSyncFn = scopeStack.some((s) => s.kind === 'syncFn');
        const guard = inSyncFn ? ' __syncTick(); ' : ' await __tick(); ';
        result += matched + guard;
        braceDepth++;
        i += matched.length - 1;
        continue;
      }

      const ch = out[i];
      if (ch === '{') {
        braceDepth++;
      } else if (ch === '}') {
        braceDepth--;
        while (scopeStack.length > 0 && scopeStack[scopeStack.length - 1].depth >= braceDepth) {
          scopeStack.pop();
        }
      }
      result += ch;
    }

    return result;
  });
}

/**
 * Converts a practical robotics/competitive-programming subset of C / C++ / Arduino
 * into executable async JavaScript targeting the JetBot sandbox.
 */
export function transpileCppToJs(source: string): string {
  const transformed = transformOutsideStringsAndComments(
    source,
    (raw) => {
      let code = raw.replace(/\r\n/g, '\n');

      // Remove preprocessor directives & using namespace std
      code = code
        .replace(/^\s*#include\b[^\n]*$/gm, '')
        .replace(/^\s*using\s+namespace\s+\w+\s*;/gm, '')
        .replace(/^\s*#define\s+([a-zA-Z_]\w*)\s+([^\n]+)$/gm, 'const $1 = $2;');

      // Serial.println / Serial.print -> print
      code = code.replace(/\bSerial\.(?:println|print)\s*\(/g, 'print(');

      // printf(...) -> print(__printf(...))
      code = code.replace(/\bprintf\s*\(/g, 'print(__printf(');
      // Fix closing paren for printf -> we can wrap printf calls cleanly:
      // Actually easier: provide `printf` directly as a host function that logs!
      code = code.replace(/print\(__printf\(/g, 'printf(');

      // cout << a << b << endl; -> coutPrint(a, b);
      code = code.replace(/(?:std::)?cout\s*<<([^;]+);/g, (_m, exprChain: string) => {
        const parts = exprChain
          .split('<<')
          .map((p) => p.trim())
          .filter((p) => p && p !== 'endl' && p !== 'std::endl');
        return `coutPrint(${parts.join(', ')});`;
      });

      // std::vector<T> name = { ... } -> let name = [ ... ]
      code = code.replace(
        /\b(?:std::)?vector\s*<[^>]+>\s*([a-zA-Z_]\w*)\s*=\s*\{([^}]*)\}\s*;/g,
        'let $1 = [$2];'
      );
      code = code.replace(/\.push_back\s*\(/g, '.push(').replace(/\.size\s*\(\s*\)/g, '.length');

      // C-style typed arrays: int arr[] = {1, 2, 3}; -> let arr = [1, 2, 3];
      code = code.replace(
        /\b(?:const\s+)?(?:unsigned\s+)?(?:long\s+long|int|long|short|float|double|bool|char|string|String|auto|std::string)\s+([a-zA-Z_]\w*)\s*\[\s*\d*\s*\]\s*=\s*\{([^}]*)\}\s*;/g,
        'let $1 = [$2];'
      );

      // Function declarations: void setup() { / int fib(int n) { / int main() {
      code = code.replace(
        /\b(?:static\s+|inline\s+)?(?:void|int|long|float|double|bool|char|string|String|auto|std::string)\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/g,
        (_m, fnName: string, rawParams: string) => {
          const cleanParams = rawParams
            .split(',')
            .map((p) => p.trim())
            .filter((p) => p && p !== 'void')
            .map((p) => {
              const parts = p.split(/\s+/);
              return parts[parts.length - 1].replace(/^[*&]+/, '');
            })
            .join(', ');
          const isLifecycle = ['setup', 'loop', 'main'].includes(fnName);
          return `${isLifecycle ? 'async ' : ''}function ${fnName}(${cleanParams}) {`;
        }
      );

      // Variable declarations: const float X = 1; / int i = 0; / float d;
      code = code.replace(
        /\b(const\s+)?(?:unsigned\s+)?(?:long\s+long|int|long|short|float|double|bool|char|string|String|auto|std::string)\s+([a-zA-Z_]\w*)\s*(=|;|,|\))/g,
        (_m, isConst: string | undefined, varName: string, delim: string) =>
          `${isConst ? 'const ' : 'let '}${varName}${delim === '=' ? ' =' : delim}`
      );

      // C-style casts e.g. (float)x or (int)y -> Number(x)
      code = code.replace(/\(\s*(?:int|float|double|long|short)\s*\)/g, '');

      // Common Arduino/C++ math aliases
      code = code.replace(/\bM_PI\b/g, 'Math.PI').replace(/\bNULL\b/g, 'null');

      return code;
    },
    false
  );

  const hasSetup = /\bfunction\s+setup\s*\(/.test(transformed);
  const hasLoop = /\bfunction\s+loop\s*\(/.test(transformed);
  const hasMain = /\bfunction\s+main\s*\(/.test(transformed);

  let suffix = '';
  if (hasSetup || hasLoop) {
    if (hasSetup) suffix += '\nawait setup();';
    if (hasLoop) suffix += '\nwhile (!__isAborted()) { await loop(); await __tick(); }';
  } else if (hasMain) {
    suffix += '\nawait main();';
  }

  return `${transformed}\n${suffix}`;
}

async function runJsEngine(
  jsSource: string,
  host: RunnerHost,
  signal: AbortSignal
): Promise<void> {
  const instrumented = instrumentJavaScript(jsSource);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
    ...args: string[]
  ) => (...values: unknown[]) => Promise<unknown>;

  let lastYieldAt = performance.now();
  let syncSteps = 0;

  const __tick = async () => {
    if (signal.aborted) throw new CancelledError();
    syncSteps = 0;
    const now = performance.now();
    if (now - lastYieldAt >= 18) {
      await sleepAbortable(16, signal);
      lastYieldAt = performance.now();
    }
  };

  const __syncTick = () => {
    if (signal.aborted) throw new CancelledError();
    syncSteps++;
    if (syncSteps > 500_000) {
      throw new Error('Vòng lặp đồng bộ vượt quá 500.000 bước. Hãy thêm delay/sleep hoặc dùng vòng lặp async.');
    }
  };

  const sleep = async (ms = 100) => {
    const clamped = Math.max(10, Math.min(30_000, Number(ms) || 10));
    await sleepAbortable(clamped, signal);
    lastYieldAt = performance.now();
  };

  const formatArgs = (args: unknown[]) => args.map((v) => formatPrintable(v)).join(' ');

  const sandboxConsole = {
    log: (...args: unknown[]) => {
      const msg = formatArgs(args);
      const isDanger = /nguy hiểm|cảnh báo|dừng|alien|lỗi/i.test(msg);
      host.onLog(isDanger ? 'danger' : 'info', msg);
    },
    warn: (...args: unknown[]) => host.onLog('warn', formatArgs(args)),
    error: (...args: unknown[]) => host.onLog('danger', formatArgs(args)),
    info: (...args: unknown[]) => host.onLog('info', formatArgs(args)),
  };

  const sandboxRobot = {
    forward: (spd = 0.3) => host.setMotors(mapJetBotLinearSpeed(Number(spd)), 0),
    backward: (spd = 0.25) => host.setMotors(-mapJetBotLinearSpeed(Number(spd)), 0),
    left: (turn = 0.5) => host.setMotors(0, mapJetBotAngularSpeed(Number(turn))),
    right: (turn = 0.5) => host.setMotors(0, -mapJetBotAngularSpeed(Number(turn))),
    set_motors: (l = 0, r = 0) => {
      const linear = mapJetBotLinearSpeed((Number(l) + Number(r)) * 0.5);
      const angular = (Number(r) - Number(l)) * 2.2;
      host.setMotors(linear, angular);
    },
    setMotors: (l = 0, r = 0) => sandboxRobot.set_motors(l, r),
    stop: () => host.stop(),
  };

  const dangerProbFn = () => {
    const p = computeDangerProbability(host.getSensors());
    host.onDangerProb?.(p);
    return p;
  };

  const sandboxScope: Record<string, unknown> = {
    console: sandboxConsole,
    print: (...args: unknown[]) => sandboxConsole.log(...args),
    coutPrint: (...args: unknown[]) => {
      const msg = args.map((v) => formatPrintable(v)).join('');
      const isDanger = /nguy hiểm|cảnh báo|dừng|alien|lỗi/i.test(msg);
      host.onLog(isDanger ? 'danger' : 'info', msg);
    },
    printf: (fmt: string, ...args: unknown[]) => sandboxConsole.log(formatPrintf(String(fmt ?? ''), args)),
    robot: sandboxRobot,
    lidar: { distance: () => host.getSensors().obstacleDist },
    alien: { distance: () => host.getSensors().alienDist },
    telemetry: {
      heading: () => host.getSensors().headingDeg,
      x: () => host.getSensors().posX,
      z: () => host.getSensors().posZ,
    },
    time: {
      sleep: (secs = 0.1) => sleep(Number(secs) * 1000),
      time: () => Date.now() / 1000,
    },
    sleep,
    delay: sleep,
    danger_probability: dangerProbFn,
    dangerProbability: dangerProbFn,
    obstacle_distance: () => host.getSensors().obstacleDist,
    alien_distance: () => host.getSensors().alienDist,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    sqrt: Math.sqrt,
    abs: Math.abs,
    pow: Math.pow,
    min: Math.min,
    max: Math.max,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    __tick,
    __syncTick,
    __isAborted: () => signal.aborted,
    // Shadow browser globals so scripts run safely in sandboxed scope
    window: undefined,
    document: undefined,
    globalThis: undefined,
    fetch: undefined,
    XMLHttpRequest: undefined,
    localStorage: undefined,
    sessionStorage: undefined,
  };

  const paramNames = Object.keys(sandboxScope);
  const paramValues = Object.values(sandboxScope);

  let compiledFn: (...values: unknown[]) => Promise<unknown>;
  try {
    compiledFn = new AsyncFunction(...paramNames, `'use strict';\n${instrumented}`);
  } catch (syntaxErr) {
    const msg = syntaxErr instanceof Error ? syntaxErr.message : String(syntaxErr);
    throw new Error(`Lỗi cú pháp: ${msg}`);
  }

  try {
    await compiledFn(...paramValues);
  } catch (err) {
    if (!(err instanceof CancelledError)) {
      throw err;
    }
  } finally {
    host.stop();
  }
}

export async function runMultiLanguageProgram(
  language: CodeLanguage,
  source: string,
  host: RunnerHost,
  signal: AbortSignal,
  options?: { tickMs?: number }
): Promise<void> {
  if (language === 'python') {
    return runAutonomousProgram(source, host, signal, options);
  }
  if (language === 'javascript') {
    return runJsEngine(source, host, signal);
  }
  const jsFromCpp = transpileCppToJs(source);
  return runJsEngine(jsFromCpp, host, signal);
}
