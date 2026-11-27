import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());

// Initialize GoogleGenAI client if API key is provided
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Built-in expert fallback knowledge base for CMU JetBot
const FALLBACK_KNOWLEDGE: Record<string, string> = {
  lidar: `RPLIDAR là cảm biến quét laser 2D (ToF hoặc Triangulation) hoạt động bằng cách quay cụm diode laser và cảm biến quang 360 độ liên tục (thường 5 - 10 vòng/giây). Nó phát ra các xung laser và thu nhận ánh sáng phản xạ để tính toán chính xác khoảng cách và góc tới mọi chướng ngại vật xung quanh (phạm vi từ 0.15m đến 12m). Dữ liệu này được Jetson Nano nạp vào thuật toán SLAM (Gmapping / Cartographer) và Costmap trong ROS để lập bản đồ 2D và tự động né tránh vật cản.`,
  camera: `Camera CSI (sử dụng cảm biến Sony IMX219 8MP) kết nối qua giao tiếp MIPI-CSI 2 làn (2-lane MIPI) trực tiếp vào bộ vi xử lý tín hiệu hình ảnh phần cứng (ISP - Image Signal Processor) tích hợp trên NVIDIA Jetson Nano. Khác với camera USB bị nghẽn băng thông và tốn CPU giải nén, camera CSI truyền khung hình thô (raw YUV/RGB) thẳng vào bộ nhớ GPU qua Zero-Copy, cho phép chạy suy luận mạng nơ-ron (TensorRT / SSD-MobileNet / YOLO) với tốc độ khung hình cao (30 - 60 FPS) và độ trễ dưới 20ms.`,
  jetson: `NVIDIA Jetson Nano Developer Kit là bộ xử lý trung tâm (Brain) của JetBot. Trang bị CPU Quad-core ARM Cortex-A57 1.43 GHz và GPU 128-core NVIDIA Maxwell kiến trúc 472 GFLOPs FP16. Jetson Nano chạy hệ điều hành Ubuntu 18.04/20.04 với bộ phần mềm NVIDIA JetPack (CUDA, cuDNN, TensorRT), hỗ trợ mạnh mẽ việc huấn luyện và chạy suy luận AI nhận diện vật thể, bám vạch, điều khiển chuyển động và xử lý dữ liệu từ RPLIDAR.`,
  motor: `Hệ thống di chuyển của JetBot sử dụng cơ cấu truyền động vi sai (Differential Drive) gồm 2 động cơ DC giảm tốc điều khiển 2 bánh xe chủ động độc lập. Bằng cách điều khiển vận tốc quay v_L và v_R khác nhau:
- v_L = v_R > 0: Robot tiến thẳng.
- v_L = v_R < 0: Robot lùi thẳng.
- v_L > v_R: Robot rẽ phải.
- v_L < v_R: Robot rẽ trái.
- v_L = -v_R: Robot xoay tròn tại chỗ quanh tâm với bán kính rẽ bằng 0 (Zero Turn Radius), cực kỳ linh hoạt trong không gian hẹp.
Bánh xe xoay tự do (Caster wheel) đóng vai trò điểm tì thứ 3 hoặc 4 giúp robot giữ thăng bằng mà không cản trở chuyển động quay.`,
  driver: `Mạch điều khiển động cơ (Motor Driver) thường dựa trên IC cầu H kép (như TB6612FNG hoặc PCA9685 kết hợp L298N/DRV8833). Mạch nhận lệnh điều khiển vận tốc qua xung PWM và chiều quay qua I2C/GPIO từ Jetson Nano, sau đó đóng cắt dòng điện công suất cao (từ nguồn pin 7.4V - 12V) cung cấp cho cuộn dây động cơ DC. Mạch tích hợp diode dập xung ngược (flyback diodes) và bảo vệ quá nhiệt để tránh làm cháy cổng logic của Jetson Nano.`
};

// API: JetBot AI Assistant endpoint
app.post('/api/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Nội dung câu hỏi không hợp lệ.' });
  }

  const systemInstruction = `Bạn là Chuyên gia Kỹ thuật và Giảng viên môn Robot/AI (chương trình CMU Lớp 10A).
Nhiệm vụ của bạn là giải thích mạch lạc, chính xác và sư phạm về cấu tạo, chức năng linh kiện, phần mềm điều khiển của Robot JetBot (sử dụng NVIDIA Jetson Nano, RPLIDAR, Camera CSI, 2 Động cơ DC giảm tốc, 2 Bánh xe chủ động, Bánh xe tự do, Mạch điều khiển động cơ, Anten Wi-Fi và Khung gầm).
- Trình bày rõ ràng, sử dụng bullet point khi phân tích.
- Ngôn ngữ: Tiếng Việt chuẩn mực, thuật ngữ kỹ thuật rõ ràng.
- Gắn liền với thực tiễn lập trình ROS, OpenCV, AI và phần cứng thực tế.`;

  if (aiClient) {
    try {
      // Call with 5s timeout safeguard so server never hangs
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout')), 5000)
      );

      const geminiPromise = aiClient.models.generateContent({
        model: 'gemini-4-argon',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      const response: any = await Promise.race([geminiPromise, timeoutPromise]);

      return res.json({
        reply: response.text,
        model: 'gemini-4-argon (Thinking: HIGH)',
      });
    } catch (err: any) {
      console.warn('Gemini 4 Argon error, falling back to gemini-3.8-flash:', err.message);
      try {
        const timeoutPromise2 = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API fallback timeout')), 4000)
        );

        const fallbackPromise = aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction,
          },
        });

        const fallbackResponse: any = await Promise.race([fallbackPromise, timeoutPromise2]);
        return res.json({
          reply: fallbackResponse.text,
          model: 'gemini-3.8-flash',
        });
      } catch (secondErr: any) {
        console.error('Gemini API call failed or timed out:', secondErr.message);
      }
    }
  }

  // Smart local domain fallback if API key is not configured or network issues
  const lowerPrompt = prompt.toLowerCase();
  let bestMatch = '';
  if (lowerPrompt.includes('lidar') || lowerPrompt.includes('quét') || lowerPrompt.includes('slam')) {
    bestMatch = FALLBACK_KNOWLEDGE.lidar;
  } else if (lowerPrompt.includes('camera') || lowerPrompt.includes('csi') || lowerPrompt.includes('ảnh') || lowerPrompt.includes('opencv')) {
    bestMatch = FALLBACK_KNOWLEDGE.camera;
  } else if (lowerPrompt.includes('jetson') || lowerPrompt.includes('nano') || lowerPrompt.includes('xử lý') || lowerPrompt.includes('cpu') || lowerPrompt.includes('gpu')) {
    bestMatch = FALLBACK_KNOWLEDGE.jetson;
  } else if (lowerPrompt.includes('động cơ') || lowerPrompt.includes('bánh') || lowerPrompt.includes('di chuyển') || lowerPrompt.includes('vi sai') || lowerPrompt.includes('xoay')) {
    bestMatch = FALLBACK_KNOWLEDGE.motor;
  } else if (lowerPrompt.includes('mạch') || lowerPrompt.includes('driver') || lowerPrompt.includes('điều khiển động cơ') || lowerPrompt.includes('pwm')) {
    bestMatch = FALLBACK_KNOWLEDGE.driver;
  } else {
    bestMatch = `Robot JetBot trong chương trình CMU là nền tảng robot tự hành tiên tiến tích hợp:
1. **NVIDIA Jetson Nano**: Xử lý AI, chạy ROS, OpenCV và mô hình Deep Learning.
2. **RPLIDAR**: Quét laser 360 độ phục vụ định vị và lập bản đồ (2D SLAM), tránh chướng ngại vật.
3. **Camera CSI Sony IMX219**: Bắt hình ảnh tốc độ cao qua giao thức MIPI trực tiếp vào GPU để bám làn và nhận diện đối tượng.
4. **2 Động cơ DC + 2 Bánh xe chủ động**: Cơ cấu vi sai giúp tiến, lùi và xoay tại chỗ 360 độ linh hoạt.
5. **Bánh xe tự do (Caster Wheel)**: Giữ thăng bằng và giảm ma sát chuyển hướng.
6. **Mạch điều khiển động cơ**: Cầu H công suất cấp xung PWM điều chỉnh chính xác tốc độ động cơ.
7. **Anten Wi-Fi & Khung robot**: Kết nối mạng từ xa và bảo vệ các linh kiện vững chắc.`;
  }

  return res.json({
    reply: bestMatch,
    model: 'CMU JetBot Expert Knowledge Engine',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function startServer() {
  if (!isProd) {
    const vitePromise = (async () => {
      const { createServer: createViteServer } = await import('vite');
      return createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
    })();

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JetBot 3D Simulation server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
