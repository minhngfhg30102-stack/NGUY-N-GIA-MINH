import { RobotComponent } from '../types/robot';

export const JETBOT_COMPONENTS: RobotComponent[] = [
  {
    id: 'jetson-nano',
    name: 'NVIDIA Jetson Nano',
    englishName: 'AI Computer Board',
    category: 'processing',
    categoryLabel: 'Xử lý trung tâm',
    functionSummary: 'Bộ xử lý trung tâm, chạy hệ điều hành Linux/ROS, xử lý thuật toán AI và điều khiển toàn bộ robot',
    location: 'Tầng giữa khung robot (gắn trên bo mạch đệm và cọc đồng)',
    keySpecs: [
      { label: 'CPU', value: 'Quad-core ARM A57 @ 1.43 GHz' },
      { label: 'GPU', value: '128-core NVIDIA Maxwell (472 GFLOPs)' },
      { label: 'RAM', value: '4GB 64-bit LPDDR4 25.6 GB/s' },
      { label: 'Cổng kết nối', value: '4x USB 3.0, Gigabit Ethernet, HDMI, GPIO 40-pin' },
      { label: 'Điện áp', value: '5V - 4A qua Jack DC Barrel' }
    ],
    interfaceType: 'MIPI-CSI (Camera), UART/I2C (Driver), USB/PCIe (Wi-Fi, Lidar)',
    workingPrinciple: 'Tiếp nhận luồng dữ liệu từ Camera CSI và RPLIDAR, chạy mạng nơ-ron sâu (TensorRT) để phân tích hình ảnh và tính toán bản đồ SLAM, phát lệnh điều khiển động cơ qua bus I2C/PWM.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Thu nạp tín hiệu đầu vào (Sensor Input)',
        desc: 'Đọc luồng khung hình từ Camera CSI qua chuẩn MIPI-CSI trực tiếp vào bộ nhớ GPU (zero-copy) và nhận gói tin khoảng cách 360° từ RPLIDAR qua cổng USB Serial.'
      },
      {
        step: 2,
        title: 'Suy luận Trí tuệ nhân tạo (AI Inference)',
        desc: '128 nhân GPU Maxwell chạy mô hình mạng nơ-ron sâu (ResNet / MobileNet tối ưu hóa bằng TensorRT) để phát hiện vật cản, nhận diện vạch làn đường hoặc đọc biển báo.'
      },
      {
        step: 3,
        title: 'Thuật toán điều khiển & Định vị (Navigation)',
        desc: 'Nút điều khiển ROS/Python tính toán vận tốc tuyến tính (v) và vận tốc góc (w) cần thiết theo mô hình động học vi sai (Differential Drive).'
      },
      {
        step: 4,
        title: 'Phát lệnh chấp hành (Actuator Output)',
        desc: 'Gửi byte điều khiển qua bus I2C (địa chỉ 0x60) hoặc xung GPIO tới bo mạch công suất để trực tiếp quay 2 động cơ xe theo hướng mong muốn.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_2e3553b4.png',
    realPhotoCaption: 'Ảnh chụp thực tế NVIDIA Jetson Nano Developer Kit kèm hộp chính hãng: Thấy rõ khối tản nhiệt nhôm đen 4 rãnh, 4x USB 3.0 xanh dương, cổng mạng RJ45, HDMI/DisplayPort, giắc nguồn DC, Micro-USB và hàng chân GPIO 40-pin.',
    realGallery: [
      {
        url: '/assets/aistudio/image_2e3553b4.png',
        label: 'Bo mạch chính hãng',
        caption: 'NVIDIA Jetson Nano Developer Kit kèm hộp chính hãng: tản nhiệt nhôm đen, 4x USB 3.0 xanh dương, RJ45, HDMI và GPIO 40-pin.'
      },
      {
        url: '/assets/aistudio/image_a3d4a2ce.png',
        label: 'Lắp trên robot thật',
        caption: 'Ảnh chụp thực tế trên xe JetBot lớp 10A: Jetson Nano gắn ở tầng giữa cùng khối tản nhiệt đen, quạt 40mm và dàn cọc đồng M3.'
      },
      {
        url: '/assets/aistudio/3_37e20bc8.jpg',
        label: 'Cụm cổng kết nối',
        caption: 'Góc cận thực tế cụm 4 cổng USB 3.0 xanh dương, cổng mạng RJ45, cổng HDMI và nút BOOT/RESET trên Jetson Nano.'
      }
    ],
    realPhotoHighlights: [
      'Khối tản nhiệt nhôm đen nguyên khối nằm trên module SoM',
      '4 cổng USB 3.0 Type-A màu xanh dương tốc độ cao',
      'Cổng mạng Gigabit Ethernet RJ45, HDMI/DP và giắc nguồn DC 5V-4A',
      'Hàng chân GPIO 40-pin mạ vàng chạy dọc cạnh phải bo mạch'
    ],
    cmuRole: 'Cốt lõi bài học CMU 10A: Chạy bài tập bám làn đường (Line Follower), phân loại biển báo, né vật cản và điều khiển xe từ xa qua Jupyter Notebook.',
    meshGroup: 'jetsonNanoGroup',
    cameraPosition: [0.35, 0.45, 0.35],
    cameraTarget: [0, 0.16, 0],
    colorHex: '#10b981'
  },
  {
    id: 'rplidar',
    name: 'RPLIDAR',
    englishName: '360° Laser Range Scanner',
    category: 'sensor',
    categoryLabel: 'Cảm biến laser',
    functionSummary: 'Quét laser 360° đo khoảng cách và nhận diện môi trường xung quanh thời gian thực',
    location: 'Tầng trên cùng của robot (vị trí cao nhất, không bị che khuất)',
    keySpecs: [
      { label: 'Góc quét', value: '360 độ đa hướng' },
      { label: 'Tầm xa đo', value: '0.15m - 12m' },
      { label: 'Tần số quét', value: '5.5 Hz - 10 Hz' },
      { label: 'Tốc độ lấy mẫu', value: '8000 lần/giây' },
      { label: 'Độ phân giải góc', value: '<= 1 độ' }
    ],
    interfaceType: 'UART qua cổng USB / TTL Serial (Baudrate 115200)',
    workingPrinciple: 'Phát chùm tia laser hồng ngoại an toàn và thu nhận ánh sáng phản xạ bằng cảm biến quang, dùng nguyên lý tam giác đạc (Triangulation) để xác định tọa độ vật cản.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Phát xung laser & Xoay 360°',
        desc: 'Mô-tơ bước kéo đai curoa quay đầu cảm biến với tốc độ 10 vòng/giây (10 Hz). Đi-ốt phát chùm tia laser hồng ngoại bước sóng 785nm ra môi trường xung quanh.'
      },
      {
        step: 2,
        title: 'Thu nhận ánh sáng phản xạ',
        desc: 'Khi tia laser chạm vào bề mặt vật cản (tường, chướng ngại vật), ánh sáng tán xạ quay trở lại thấu kính thu hội tụ lên bề mặt cảm biến hình ảnh quang học (CCD/CMOS).'
      },
      {
        step: 3,
        title: 'Tính toán cự ly bằng tam giác đạc quang học',
        desc: 'Dựa trên vị trí điểm sáng rơi trên cảm biến và góc lệch quang học (Triangulation Principle), vi xử lý tích hợp tính ra cự ly chính xác từ 0.15m đến 12m.'
      },
      {
        step: 4,
        title: 'Truyền đám mây điểm 2D về máy tính',
        desc: 'Đóng gói dữ liệu (Góc quay Theta, Khoảng cách R, Chất lượng điểm) gửi liên tục qua USB Serial (115200 baud) tới thuật toán ROS Gmapping tạo bản đồ 2D thời gian thực.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_a8993eb5.png',
    realPhotoCaption: 'Ảnh thực tế bộ cảm biến SLAMTEC RPLIDAR A1 đầy đủ: Tháp quét laser 360° kèm cụm mô-tơ kéo đai curoa, mạch chuyển đổi USB-UART xanh lá, cáp nối 5 dây và hộp sản phẩm A1 RPLIDAR.',
    realGallery: [
      {
        url: '/assets/aistudio/image_a8993eb5.png',
        label: 'Bộ RPLIDAR A1',
        caption: 'Bộ cảm biến SLAMTEC RPLIDAR A1 đầy đủ: tháp quét 360°, mạch USB-UART xanh lá và dây nối 5 lõi.'
      },
      {
        url: '/assets/aistudio/image_8a45e6b8.png',
        label: 'Gắn đỉnh robot thật',
        caption: 'Ảnh thực tế cụm RPLIDAR A1 gắn trên đĩa tầng cao nhất của JetBot, không bị che khuất tầm quét 360°.'
      },
      {
        url: '/assets/aistudio/image_3a4f0581.png',
        label: 'Góc nhìn từ trên',
        caption: 'Góc nhìn từ trên xuống cụm tháp quét RPLIDAR A1 cùng phần đai truyền động trên khung nhôm xanh.'
      },
      {
        url: '/assets/aistudio/image_46fc7930.png',
        label: 'Góc nhìn ngang',
        caption: 'Toàn cảnh mặt trước/ngang cho thấy tháp laser RPLIDAR đặt cao vượt hẳn thân xe thật.'
      }
    ],
    realPhotoHighlights: [
      'Tháp trụ xoay 360° SLAMTEC phát tia laser hồng ngoại đo khoảng cách',
      'Puly và dây đai curoa nối liền với mô-tơ bước gắn ở phần tai bên',
      'Mạch chuyển đổi tín hiệu UART sang Micro-USB đi kèm',
      'Cáp dữ liệu 5 lõi có đầu giắc JST trắng hai đầu'
    ],
    cmuRole: 'Lập bản đồ không gian 2D (2D SLAM), định vị vị trí robot và phát hiện vật cản đa hướng trong bài toán tự hành thông minh.',
    meshGroup: 'rplidarGroup',
    cameraPosition: [0.3, 0.55, 0.3],
    cameraTarget: [0, 0.28, 0],
    colorHex: '#ef4444'
  },
  {
    id: 'lidar-belt-drive',
    name: 'Cụm Dây Đai Curoa & Động Cơ Bước RPLIDAR',
    englishName: 'LIDAR Timing Belt & Stepper Drive',
    category: 'sensor',
    categoryLabel: 'Cơ cấu truyền động Laser',
    functionSummary: 'Truyền lực kéo xoay liên tục 360 độ từ động cơ vi bước sang tháp quét quang học với độ êm tuyệt đối và không bị trượt bước',
    location: 'Nằm bên cạnh tháp quét RPLIDAR trên tấm đĩa đen tầng trên cùng (được khoanh đỏ trong ảnh thực tế)',
    keySpecs: [
      { label: 'Chủng loại dây', value: 'Dây đai răng cao su tổng hợp gia cường sợi thủy tinh' },
      { label: 'Động cơ dẫn động', value: 'Động cơ bước Micro-stepper DC không chổi than' },
      { label: 'Tốc độ quay chuẩn', value: '600 RPM (10 vòng/giây)' },
      { label: 'Độ rơ (Backlash)', value: 'Gần như bằng 0 (Zero-backlash transmission)' }
    ],
    interfaceType: 'Puly hợp kim nhôm răng cưa ép trục động cơ',
    workingPrinciple: 'Động cơ bước quay puly nhỏ, kéo dây đai răng bọc quanh vành răng ngoài của tháp lidar. Các răng ăn khớp ngăn hiện tượng trượt, đảm bảo góc quét quay đúng chu kỳ 100ms.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Cấp xung điều khiển cho động cơ vi bước',
        desc: 'Mạch điều tốc lidar trên bo cấp xung nhịp ổn định cho động cơ micro-stepper giúp trục xoay đạt tốc độ định mức 600 vòng/phút.'
      },
      {
        step: 2,
        title: 'Truyền động qua puly nhỏ trên trục động cơ',
        desc: 'Puly dẫn động bằng kim loại có gờ chặn hai bên giữ cho dây đai curoa không bị tuột ra ngoài khi xe chạy rung lắc.'
      },
      {
        step: 3,
        title: 'Dây đai răng ôm vòng tháp quang học',
        desc: 'Dây đai curoa cao su đàn hồi ôm chặt puly lớn ở chân tháp quang học, tạo chuyển động quay 360° tròn đều và không rung chấn.'
      },
      {
        step: 4,
        title: 'Đồng bộ hóa góc quét và phát xung laser',
        desc: 'Cảm biến quang điểm 0 (Opto-coupler zero-index) xác nhận vạch xuất phát mỗi vòng quay, đồng bộ góc quét 0° - 360° với tọa độ bản đồ robot.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_a8993eb5.png',
    realPhotoCaption: 'Ảnh thực tế cụm truyền động dây đai curoa trên RPLIDAR A1: Puly nhỏ gắn trục động cơ DC ở phần hông nối dây đai cao su đen vòng qua vành chân tháp quét 360°.',
    realGallery: [
      {
        url: '/assets/aistudio/image_8a45e6b8.png',
        label: 'Cận cảnh puly & đai',
        caption: 'Cận cảnh thực tế puly dẫn động nhỏ và dây đai curoa cao su đen ôm quanh chân đế tháp quét RPLIDAR.'
      },
      {
        url: '/assets/aistudio/2_45b1e6a7.jpg',
        label: 'Mô-tơ bước mặt sau',
        caption: 'Ảnh thực tế mô-tơ kéo đai vỏ bạc gắn ngay bên dưới cụm đế RPLIDAR ở phía sau robot.'
      },
      {
        url: '/assets/aistudio/image_3a4f0581.png',
        label: 'Nhìn thẳng từ trên',
        caption: 'Góc nhìn từ trên xuống thấy rõ sự đồng tâm giữa puly động cơ và vành tháp quang học.'
      },
      {
        url: '/assets/aistudio/image_a8993eb5.png',
        label: 'Bộ linh kiện rời',
        caption: 'Toàn bộ cụm đế RPLIDAR A1 kèm puly, dây đai và bo mạch chuyển đổi tín hiệu.'
      }
    ],
    realPhotoHighlights: [
      'Động cơ quay hình trụ nằm gọn bên dưới tai gắn của đế RPLIDAR A1',
      'Puly dẫn động màu đen có rãnh định hướng giữ đai curoa không trượt',
      'Dây đai curoa cao su đàn hồi ôm vòng chân đế tháp quang học',
      '4 chân trụ đứng cố định đế RPLIDAR lên tấm đĩa tầng trên'
    ],
    cmuRole: 'Bài học cơ khí chính xác: Điều khiển tốc độ quay cảm biến laser và triệt tiêu độ trôi góc quét trong hệ điều hành ROS.',
    meshGroup: 'lidarBeltGroup',
    cameraPosition: [0.18, 0.38, 0.12],
    cameraTarget: [0.03, 0.29, -0.01],
    colorHex: '#dc2626'
  },
  {
    id: 'camera-csi',
    name: 'Camera CSI',
    englishName: 'MIPI CSI Camera Module',
    category: 'sensor',
    categoryLabel: 'Thị giác máy tính',
    functionSummary: 'Thu nhận hình ảnh video góc rộng thời gian thực đưa thẳng vào GPU Jetson Nano với độ trễ siêu thấp',
    location: 'Mặt trước robot, gắn trên giá đỡ nhôm xanh vươn về phía trước',
    keySpecs: [
      { label: 'Cảm biến', value: 'Sony IMX219 (8 Megapixel)' },
      { label: 'Góc nhìn FOV', value: '160 độ siêu rộng (Fisheye lens)' },
      { label: 'Tốc độ khung hình', value: '1080p @ 30fps / 720p @ 60fps' },
      { label: 'Cáp kết nối', value: 'Cáp dẹt FFC 15-pin ribbon' }
    ],
    interfaceType: 'MIPI-CSI 2-lane (trực tiếp vào phần cứng ISP của Jetson)',
    workingPrinciple: 'Thu ánh sáng qua thấu kính quang học góc rộng, chuyển đổi thành tín hiệu số thô và truyền trực tiếp vào bộ nhớ GPU không tốn tài nguyên CPU (Zero-copy).',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Thu nhận ánh sáng qua ống kính mắt cá',
        desc: 'Ống kính góc rộng 160° bắt trọn toàn bộ quang cảnh mặt đường phía trước và hai bên mép sàn, điều chỉnh tiêu cự bằng vòng vặn ren quang học.'
      },
      {
        step: 2,
        title: 'Chuyển đổi photon sang ma trận điểm ảnh số',
        desc: 'Cảm biến Sony IMX219 CMOS với 8 triệu điểm ảnh chuyển đổi năng lượng ánh sáng thành các giá trị điện áp màu RGB theo định dạng Bayer thô.'
      },
      {
        step: 3,
        title: 'Truyền tín hiệu qua cáp dẹt MIPI-CSI',
        desc: 'Dữ liệu ảnh truyền qua cáp FFC 15 chân trên 2 đường truyền tốc độ cao (2-lane MIPI) trực tiếp vào bộ xử lý tín hiệu hình ảnh (ISP) của Jetson Nano.'
      },
      {
        step: 4,
        title: 'Xử lý thị giác thời gian thực trên GPU',
        desc: 'GPU Maxwell đọc trực tiếp bộ nhớ khung hình (Zero-Copy) để chạy thuật toán tìm điểm trọng tâm làn đường (Lane Centering) hoặc phân loại đối tượng.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_b673f966.png',
    realPhotoCaption: 'Ảnh thực tế module Camera IMX219 góc siêu rộng 160° FOV kèm nắp đậy ống kính: Thấy rõ bo mạch PCB đen, 4 lỗ bắt ốc mạ vàng, ngàm khóa cáp FFC 15 chân và thấu kính mắt cá.',
    realGallery: [
      {
        url: '/assets/aistudio/image_b673f966.png',
        label: 'Module Camera rời',
        caption: 'Module Camera Sony IMX219 160° FOV kèm nắp đậy ống kính, bo PCB đen và ngàm khóa cáp 15 chân.'
      },
      {
        url: '/assets/aistudio/image_f841a927.png',
        label: 'Gắn giá đỡ & cáp FFC',
        caption: 'Ảnh chụp thật trên xe: Camera gắn chặt vào giá đỡ nhôm xanh cùng sợi cáp dẹt FFC 15 chân in chữ xanh AWM 20706.'
      },
      {
        url: '/assets/aistudio/image_46fc7930.png',
        label: 'Vị trí mũi trước xe',
        caption: 'Góc nhìn tổng thể phía trước JetBot thật với ống kính mắt cá hướng thẳng về phía trước.'
      }
    ],
    realPhotoHighlights: [
      'Ống kính mắt cá góc siêu rộng 160° FOV kèm nắp bảo vệ thấu kính',
      'Cảm biến ảnh Sony IMX219 8MP gắn trên bo mạch vuông 25x24mm',
      'Đầu socket ZIF màu trắng/đen chuẩn MIPI-CSI 15 chân',
      '4 lỗ định vị mạ vàng ở 4 góc để bắt vào giá đỡ nhôm'
    ],
    cmuRole: 'Thực hiện nhận diện vạch kẻ đường, phát hiện người/vật cản và phân loại vật thể bằng mô hình thị giác máy tính OpenCV và AI MobileNet.',
    meshGroup: 'cameraCsiGroup',
    cameraPosition: [-0.14, 0.22, 0.38],
    cameraTarget: [-0.072, 0.09, 0.125],
    colorHex: '#3b82f6'
  },
  {
    id: 'oled-display',
    name: 'Màn hình OLED Mini 0.91" I2C',
    englishName: '0.91" I2C OLED Status Display',
    category: 'processing',
    categoryLabel: 'Hiển thị & Giám sát',
    functionSummary: 'Hiển thị tức thời địa chỉ IP mạng nội bộ, dung lượng pin còn lại, mức độ tải CPU/GPU và thông số vận hành của robot',
    location: 'Gắn trên bo mạch carrier tầng giữa, cạnh khe cắm GPIO 40 chân',
    keySpecs: [
      { label: 'Kích thước', value: '0.91 inch (128 x 32 điểm ảnh)' },
      { label: 'Chipset điều khiển', value: 'SSD1306 tích hợp' },
      { label: 'Giao thức giao tiếp', value: 'I2C Bus (địa chỉ 0x3C)' },
      { label: 'Màu sắc hiển thị', value: 'Điểm ảnh phát quang xanh lam / trắng sắc nét' },
      { label: 'Góc nhìn', value: 'Lên tới 160° không bị chói sáng' }
    ],
    interfaceType: 'I2C 4 chân (VCC 3.3V, GND, SDA chân 3, SCL chân 5)',
    workingPrinciple: 'Nhận dữ liệu hiển thị từ dịch vụ nền Python/ROS qua bus I2C. Các diode hữu cơ tự phát quang (OLED) giúp đọc rõ thông số ngay cả dưới ánh sáng mạnh ngoài trời mà không tốn pin.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Tiến trình nền JetBot đọc trạng thái hệ thống',
        desc: 'Script Python jetbot_stats.py liên tục truy vấn hệ điều hành Ubuntu: Đọc IP Wi-Fi từ eth0/wlan0, đọc mức dung lượng pin và nhiệt độ GPU.'
      },
      {
        step: 2,
        title: 'Đóng gói dữ liệu bitmap văn bản',
        desc: 'Thư viện đồ họa PIL/SSD1306 vẽ chuỗi ký tự IP (vd: 192.168.1.105) và thanh phần trăm pin thành mảng nhị phân 128x32 pixel.'
      },
      {
        step: 3,
        title: 'Truyền lệnh và dữ liệu qua bus I2C',
        desc: 'Jetson Nano phát các gói tin qua chân SDA (chân 3) với nhịp xung SCL (chân 5) tốc độ 400 kHz tới IC SSD1306.'
      },
      {
        step: 4,
        title: 'Quét sáng điểm ảnh OLED tức thì',
        desc: 'Màn hình tự phát quang sáng rõ, giúp học sinh kết nối ngay vào Jupyter Lab từ laptop mà không cần cắm cáp màn hình HDMI rườm rà.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_c720e6d3.png',
    realPhotoCaption: 'Ảnh thực tế module màn hình OLED 0.91" I2C (mặt trước và mặt sau trên lưới chia cm): Bo mạch xanh dương kích thước ~3.8 x 1.2 cm với 4 chân giao tiếp GND, VCC, SCL, SDA.',
    realGallery: [
      {
        url: '/assets/aistudio/image_c720e6d3.png',
        label: 'Module OLED 0.91"',
        caption: 'Mặt trước và mặt sau module OLED 0.91" I2C với 4 chân GND, VCC, SCL, SDA.'
      },
      {
        url: '/assets/aistudio/2_45b1e6a7.jpg',
        label: 'Gắn trên bo mở rộng',
        caption: 'Ảnh chụp thật phía sau robot: màn hình OLED 0.91" gắn trên bo mạch mở rộng ngay cạnh công tắc nguồn.'
      },
      {
        url: '/assets/aistudio/image_c14dba1a.png',
        label: 'Cận cảnh chân GPIO',
        caption: 'Góc chụp thật khu vực màn hình OLED và hàng chân cắm mở rộng I2C/GPIO 40-pin.'
      }
    ],
    realPhotoHighlights: [
      'Mặt kính hiển thị OLED 128x32 pixel kéo dài dọc theo bo mạch xanh',
      '4 lỗ hàn chân chuẩn I2C ký hiệu rõ GND, VCC, SCL, SDA',
      'Mặt sau tích hợp IC ổn áp 3.3V (U2) cùng dãy điện trở/tụ SMD',
      'Kích thước siêu gọn ~38mm x 12mm dễ gắn trực tiếp lên bo carrier'
    ],
    cmuRole: 'Công cụ hiển thị IP thực tế để học sinh kết nối máy tính lập trình JetBot từ xa qua trình duyệt mạng Wi-Fi.',
    meshGroup: 'oledDisplayGroup',
    cameraPosition: [-0.08, 0.24, 0.08],
    cameraTarget: [-0.048, 0.16, -0.005],
    colorHex: '#38bdf8'
  },
  {
    id: 'cooling-fan',
    name: 'Quạt Làm Mát Tản Nhiệt 40mm 5V PWM',
    englishName: '4010 Active PWM Cooling Fan',
    category: 'processing',
    categoryLabel: 'Hệ thống tản nhiệt',
    functionSummary: 'Làm mát cưỡng bức cho khối tản nhiệt nhôm Jetson Nano khi chạy mô hình học sâu AI nặng, chống sụt giảm xung nhịp do quá nhiệt',
    location: 'Bắt vít trực tiếp lên đỉnh khối nhôm tản nhiệt nguyên khối của Jetson Nano',
    keySpecs: [
      { label: 'Kích cỡ', value: '40 x 40 x 10 mm (chuẩn 4010)' },
      { label: 'Điện áp định mức', value: '5V DC' },
      { label: 'Tốc độ quay tối đa', value: '5000 RPM' },
      { label: 'Đầu nối dây', value: '4-pin pigtail (VCC, GND, Tốc độ TACH, Điều xung PWM)' },
      { label: 'Độ ồn vận hành', value: '< 25 dBA siêu êm' }
    ],
    interfaceType: 'Socket JST 4-pin cắm trên bo mạch Jetson Nano',
    workingPrinciple: 'Thuật toán quản lý nhiệt độ JetPack liên tục giám sát nhiệt độ GPU. Khi nhiệt độ vượt ngưỡng 50°C, xung PWM điều khiển quạt quay với tốc độ tương ứng, thổi luồng gió áp suất cao qua 4 tầng rãnh nhôm tản nhiệt.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Cảm biến nhiệt độ bán dẫn đo lõi GPU',
        desc: 'Cảm biến tích hợp trong chip Tegra X1 liên tục ghi nhận nhiệt độ 128 nhân Maxwell theo thời gian thực.'
      },
      {
        step: 2,
        title: 'Mạch điều khiển xuất xung PWM tự động',
        desc: 'Bộ điều khiển Linux pwm-fan tính toán chu kỳ xung từ 0% (quạt nghỉ) đến 100% (quay tối đa 5000 RPM khi suy luận mạng nơ-ron nặng).'
      },
      {
        step: 3,
        title: '7 cánh quạt khí động học hút gió mát',
        desc: 'Cánh quạt nghiêng góc 25 độ hút luồng khí mát từ môi trường bên trên nén qua cổ loa tròn (circular cowl).'
      },
      {
        step: 4,
        title: 'Thổi xuyên qua 4 tầng khe nhôm tản nhiệt',
        desc: 'Luồng gió quét thẳng vào các rãnh nhôm đen bên dưới, cuốn đi nhiệt lượng và giữ nhiệt độ máy luôn ổn định dưới 65°C.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_54f0f877.png',
    realPhotoCaption: 'Ảnh thực tế quạt tản nhiệt 40mm 5V PWM lắp trên khối nhôm Jetson Nano: Gắn bằng 4 ốc vít sáng ở 4 góc, bó dây điều tốc vàng-đỏ-đen vòng gọn cắm vào đầu nối PWM.',
    realGallery: [
      {
        url: '/assets/aistudio/image_54f0f877.png',
        label: 'Quạt gắn khối nhôm',
        caption: 'Quạt 40mm 5V PWM bắt vít trên khối nhôm tản nhiệt Jetson Nano cùng búi dây vàng-đỏ-đen.'
      },
      {
        url: '/assets/aistudio/image_a3d4a2ce.png',
        label: 'Trên thân JetBot thật',
        caption: 'Ảnh thực tế quạt tản nhiệt hoạt động giữa tầng bo Jetson Nano và tầng tấm đỡ RPLIDAR.'
      },
      {
        url: '/assets/aistudio/3_37e20bc8.jpg',
        label: 'Góc nhìn hông tầng giữa',
        caption: 'Khoảng không lưu thông gió của quạt 40mm giữa cụm tản nhiệt nhôm đen và đĩa đỡ phía trên.'
      }
    ],
    realPhotoHighlights: [
      'Khung quạt nhựa đen vuông 40x40x10mm gắn khít trên đỉnh tản nhiệt',
      '4 vít kim loại siết cố định trực tiếp vào rãnh nhôm đen',
      'Búi dây PWM (vàng, đỏ, đen) đi vòng nối vào giắc cắm trắng trên bo mạch',
      'Tăng lưu lượng gió làm mát tức thì khi GPU Jetson xử lý AI'
    ],
    cmuRole: 'Bảo vệ phần cứng: Giữ cho Jetson Nano duy trì hiệu năng xử lý AI tối đa liên tục trong suốt các giờ thi đấu chạy sa bàn.',
    meshGroup: 'coolingFanGroup',
    cameraPosition: [0.0, 0.32, 0.16],
    cameraTarget: [0.0, 0.20, 0.0],
    colorHex: '#0ea5e9'
  },
  {
    id: 'hardware-controls',
    name: 'Cụm Công Tắc Gạt ON/OFF, Nút Reset & Cổng Sạc',
    englishName: 'Power Switch, Reset & Debug Ports',
    category: 'power',
    categoryLabel: 'Bảng điều khiển vật lý',
    functionSummary: 'Cung cấp các thao tác điều khiển vật lý trực tiếp: Bật/tắt nguồn cách ly an toàn, khởi động lại cứng, chế độ nạp Boot/Recovery và nạp pin',
    location: 'Bố trí tại góc sau bên phải của bo mạch carrier tầng giữa',
    keySpecs: [
      { label: 'Công tắc nguồn', value: 'Công tắc trượt cơ khí 3 chân kim loại tiếp điểm 5A' },
      { label: 'Nút nhấn vật lý', value: '2 nút Tactile mini: RESET và RECOVERY/BOOT' },
      { label: 'Cổng giao tiếp debug', value: 'Cổng Micro-USB nạp chương trình và giám sát Serial' },
      { label: 'Đèn báo trạng thái', value: 'LED xanh lá nguồn (Power) & LED đỏ nạp pin' }
    ],
    interfaceType: 'Chân hàn SMD trên bo carrier mạch đệm',
    workingPrinciple: 'Công tắc cơ học trượt tiếp xúc lưỡi gà đồng ngắt dứt khoát 2 cực nguồn pin; nút Reset nối thẳng chân RST của Jetson kéo điện áp về 0V (GND) để kích hoạt khởi động lại tức thời khi hệ điều hành treo.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Đóng/ngắt nguồn bằng công tắc trượt',
        desc: 'Gạt công tắc sang ON: Tiếp điểm kim loại khép kín mạch dòng cao cấp nguồn từ khối pin vào mạch phân phối điện áp.'
      },
      {
        step: 2,
        title: 'Nút nhấn RESET khởi động lại nóng',
        desc: 'Khi bấm nút RESET, đường tín hiệu RST được kéo xuống GND, ép vi điều khiển và CPU khởi động lại tức thời mà không cần rút cáp nguồn.'
      },
      {
        step: 3,
        title: 'Nút BOOT kích hoạt chế độ Force Recovery',
        desc: 'Giữ nút BOOT trong lúc bật nguồn để đưa Jetson Nano vào chế độ nạp ROM/OS (Recovery Mode) qua cổng micro-USB từ máy tính lập trình.'
      },
      {
        step: 4,
        title: 'Đèn LED chỉ báo hoạt động tức thì',
        desc: 'Đèn LED xanh lá sáng rực báo hiệu nguồn 5V ổn định, đèn LED cam/đỏ báo trạng thái nạp sạc pin qua cổng USB.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_6b0960bb.png',
    realPhotoCaption: 'Sơ đồ thực tế bo mạch mở rộng Waveshare JetBot: Đánh số rõ công tắc trượt ON/OFF (⑨), giắc nguồn sạc DC 12.6V (⑧), khay pin 3 cell (⑩), khe OLED (⑦) và hàng chân cắm nhảy cầu I2C (⑫).',
    realGallery: [
      {
        url: '/assets/aistudio/image_6b0960bb.png',
        label: 'Sơ đồ chú thích bo mạch',
        caption: 'Sơ đồ Waveshare JetBot chỉ rõ công tắc trượt ON/OFF (⑨), cổng sạc DC 12.6V (⑧) và hàng chân cầu I2C (⑫).'
      },
      {
        url: '/assets/aistudio/2_45b1e6a7.jpg',
        label: 'Công tắc & cổng sạc thật',
        caption: 'Ảnh chụp thực tế mặt sau robot: công tắc gạt nguồn chính ON/OFF và giắc cắm sạc tròn DC.'
      },
      {
        url: '/assets/aistudio/image_8a45e6b8.png',
        label: 'Nút BOOT/RESET & Jumper',
        caption: 'Ảnh cận thực tế cụm nút nhấn vật lý, đèn báo trạng thái và cầu nối chọn chế độ trên bo mạch.'
      }
    ],
    realPhotoHighlights: [
      'Công tắc trượt nguồn chính ON/OFF (mục ⑨) gắn chắc ở mép dưới bo mạch',
      'Giắc cắm bộ sạc DC 12.6V (mục ⑧) bố trí cạnh góc trên phải',
      'Cụm hàng chân header chọn địa chỉ / giao tiếp I2C SDA-SCL (mục ⑫)',
      'Các IC quản lý nguồn, bảo vệ pin và chuyển mạch tích hợp sẵn trên PCB'
    ],
    cmuRole: 'Thao tác vận hành robot an toàn: Bật tắt xe nhanh chóng khi kết thúc lượt chạy thử và reset hệ thống khi xảy ra sự cố phần mềm.',
    meshGroup: 'hardwareControlsGroup',
    cameraPosition: [0.15, 0.28, -0.22],
    cameraTarget: [0.06, 0.16, -0.09],
    colorHex: '#f97316'
  },
  {
    id: 'dc-motors',
    name: '2 Động cơ DC giảm tốc',
    englishName: 'Geared DC Motors with Encoders',
    category: 'actuator',
    categoryLabel: 'Cơ cấu chấp hành',
    functionSummary: 'Cung cấp lực kéo mô-men xoắn mạnh mẽ và tốc độ quay ổn định tạo chuyển động cho robot',
    location: 'Mặt dưới gầm xe, bắt vít đối xứng hai bên khung gầm',
    keySpecs: [
      { label: 'Điện áp định mức', value: '6V - 12V DC' },
      { label: 'Tỷ số truyền hộp số', value: '1:48 hoặc 1:90 giảm tốc' },
      { label: 'Tốc độ quay', value: '100 - 240 vòng/phút' },
      { label: 'Mô-men xoắn', value: '0.8 - 1.5 kg.cm' },
      { label: 'Encoder', value: 'Encoder quang 2 kênh A/B đo xung' }
    ],
    interfaceType: 'Cầu đấu dây 2 cực cấp nguồn từ Mạch điều khiển động cơ',
    workingPrinciple: 'Sử dụng từ trường nam châm vĩnh cửu và cuộn dây rotor. Hộp số bánh răng cơ khí giảm tốc độ để tăng mô-men kéo đủ sức đẩy toàn bộ tải trọng của robot.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Nhận điện áp điều chế độ rộng xung (PWM)',
        desc: 'Mạch công suất cấp điện áp 6V - 12V qua 2 cực mô-tơ. Thay đổi chu kỳ xung (Duty Cycle) sẽ điều chỉnh tốc độ quay nhanh hoặc chậm.'
      },
      {
        step: 2,
        title: 'Tạo từ trường quay trong lõi Rotor',
        desc: 'Dòng điện chạy qua các cuộn dây đồng tạo lực từ tương tác với nam châm vĩnh cửu stato, làm quay trục động cơ ở tốc độ cao (hàng nghìn vòng/phút).'
      },
      {
        step: 3,
        title: 'Hộp số bánh răng tăng lực kéo (Gearbox)',
        desc: 'Bộ bánh răng giảm tốc cơ khí tỷ số 1:48 hạ tốc độ trục từ hàng nghìn vòng xuống ~200 vòng/phút nhưng tăng mô-men xoắn lên gấp gần 50 lần.'
      },
      {
        step: 4,
        title: 'Đo lường hồi tiếp qua đĩa Encoder',
        desc: 'Đĩa xung quang học gắn trên đuôi trục cắt qua cảm biến hồng ngoại, tạo các xung vuông A/B giúp Jetson Nano đo chính xác vận tốc và quãng đường xe đi.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_a07e123a.png',
    realPhotoCaption: 'Ảnh thực tế động cơ DC giảm tốc (TT Geared Motor): Gồm hộp số bánh răng màu vàng tăng mô-men xoắn, trục ra vát phẳng hai mặt và thân mô-tơ DC chổi than phía sau.',
    realGallery: [
      {
        url: '/assets/aistudio/image_a07e123a.png',
        label: 'Động cơ rời',
        caption: 'Động cơ DC giảm tốc với hộp số bánh răng và trục ra vát phẳng.'
      },
      {
        url: '/assets/aistudio/image_bbcc8481.png',
        label: 'Lắp dưới gầm xe thật',
        caption: 'Ảnh chụp thật mặt đáy gầm JetBot: 2 động cơ DC vỏ bạc gắn đối xứng cùng cụm dây encoder.'
      },
      {
        url: '/assets/aistudio/1794209545008_43132710148482215_g8908539602773141407_d4b315b01618f58c49674b604cd4ff17_8a55e730.jpg',
        label: 'Cận cảnh 2 mô-tơ & dây',
        caption: 'Ảnh cận thực tế hai động cơ DC giảm tốc dưới gầm xanh cùng đầu giắc kết nối và bánh xoay.'
      }
    ],
    realPhotoHighlights: [
      'Hộp giảm tốc bánh răng tỷ số 1:48 giúp tăng mạnh lực kéo bánh xe',
      'Trục cốt thép vát phẳng chống trượt khi lắp vào moay-ơ bánh xe',
      'Thân mô-tơ DC hình trụ bạc có ngàm giữ bằng nhựa trong suốt',
      'Nắp đuôi đen chứa chổi than và 2 tai đồng hàn dây nguồn'
    ],
    cmuRole: 'Thực hiện truyền động cơ học chính xác dựa trên phản hồi PID từ xung encoder gửi về bo điều khiển.',
    meshGroup: 'dcMotorsGroup',
    cameraPosition: [0.35, -0.15, 0.3],
    cameraTarget: [0, -0.04, 0],
    colorHex: '#f59e0b'
  },
  {
    id: 'drive-wheels',
    name: '2 Bánh xe chủ động',
    englishName: 'Differential Drive Wheels',
    category: 'actuator',
    categoryLabel: 'Hệ thống truyền động',
    functionSummary: 'Giúp robot tiến, lùi và đổi hướng linh hoạt thông qua nguyên lý dẫn động vi sai',
    location: 'Hai bên hông thân robot, trục gắn trực tiếp vào hộp số động cơ DC',
    keySpecs: [
      { label: 'Đường kính', value: '65 mm' },
      { label: 'Bề rộng lốp', value: '26 mm' },
      { label: 'Vành đĩa (Rim)', value: 'Hợp kim nhôm nan hoa màu xanh dương' },
      { label: 'Chất liệu lốp', value: 'Cao su đàn hồi, vân gai chống trượt' }
    ],
    interfaceType: 'Khớp nối trục vát chữ D (D-shaft coupler) lục giác',
    workingPrinciple: 'Khi hai bánh quay cùng chiều cùng tốc độ -> xe chạy thẳng. Khi quay tốc độ khác nhau -> xe rẽ. Khi quay ngược chiều nhau -> xe xoay tròn tại chỗ 360°.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Khóa trục bằng khớp đồng chữ D',
        desc: 'Trục động cơ vát phẳng mặt chữ D luồn vào lõi vành xe và siết chặt bằng ốc ren chìm lục giác, chống trượt mô-men khi khởi động nhanh.'
      },
      {
        step: 2,
        title: 'Bám dính mặt đường nhờ rãnh lốp cao su',
        desc: 'Vỏ lốp cao su mềm có các khối hoa lốp sâu tạo hệ số ma sát cao, triệt tiêu trượt dọc và trượt ngang khi tăng tốc hoặc phanh gấp.'
      },
      {
        step: 3,
        title: 'Điều khiển vận tốc vi sai độc lập',
        desc: 'Hai bánh xe được điều khiển độc lập: V_left và V_right. Khi V_left = V_right xe chạy thẳng; khi V_left > V_right xe rẽ phải mượt mà.'
      },
      {
        step: 4,
        title: 'Quay tròn 360° tại tâm xe (Zero-Radius Turn)',
        desc: 'Khi bánh trái quay tiến còn bánh phải quay lùi cùng tốc độ, tâm quay trùng với tâm khung xe, cho phép robot đổi hướng tức thì trong không gian hẹp.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_e807f003.png',
    realPhotoCaption: 'Ảnh thực tế bánh xe JetBot đường kính 65mm: Lốp cao su đen vân rãnh sâu chia đôi chống trượt kết hợp vành mâm 10 nan hoa kép màu xanh dương thể thao.',
    realGallery: [
      {
        url: '/assets/aistudio/image_e807f003.png',
        label: 'Bánh xe 65mm rời',
        caption: 'Bánh xe 65mm vành 10 nan hoa xanh dương kết hợp lốp cao su bám đường.'
      },
      {
        url: '/assets/aistudio/1793006044923_3623432520915601015_g8908539602773141407_eec5e2d594f8a3d825da581ef69c2939_e0977dd6.jpg',
        label: 'Macro vân lốp thực tế',
        caption: 'Ảnh chụp cận thực tế mặt gai lốp cao su rãnh mê cung sâu và mép vành nhôm xanh.'
      },
      {
        url: '/assets/aistudio/image_46fc7930.png',
        label: 'Lắp trên trục robot',
        caption: 'Góc nhìn mặt ngoài bánh xe khi đã gắn vào trục động cơ hai bên thân xe thật.'
      }
    ],
    realPhotoHighlights: [
      'Vân gai lốp cao su uốn lượn sâu với rãnh thoát bụi chính giữa',
      'Vành mâm 10 nan hoa chữ Y màu xanh dương nổi bật',
      'Lỗ trục trung tâm và vòng lỗ ốc gia công đồng tâm chính xác',
      'Độ đàn hồi cao giúp xe bám đường tốt trên nhiều loại mặt sàn'
    ],
    cmuRole: 'Bài tập điều khiển động học vi sai (Differential Drive Kinematics) và tính toán quãng đường xe đi (Odometry).',
    meshGroup: 'driveWheelsGroup',
    cameraPosition: [0.52, 0.14, 0.10],
    cameraTarget: [0.18, 0.075, 0],
    colorHex: '#06b6d4'
  },
  {
    id: 'caster-wheels',
    name: 'Bánh xe xoay tự do (Caster)',
    englishName: 'Omni Swivel Caster Wheels',
    category: 'actuator',
    categoryLabel: 'Giữ thăng bằng & Hướng',
    functionSummary: 'Tạo điểm tì thứ 3 và 4 giữ thăng bằng vững chắc, tự do xoay 360° hỗ trợ đổi hướng mượt mà',
    location: 'Gắn ở mặt đáy gầm xe tại vị trí đầu và đuôi robot',
    keySpecs: [
      { label: 'Góc tự do', value: 'Xoay 360 độ tự nhiên quanh trục đứng' },
      { label: 'Càng đỡ', value: 'Thép dập mạ Crom chống gỉ' },
      { label: 'Bánh lăn', value: 'Nylon / Cao su trắng đường kính 25mm' },
      { label: 'Ổ bi', value: 'Vòng bi thép chịu lực ma sát thấp' }
    ],
    interfaceType: 'Bắt vít trực tiếp vào mặt dưới tấm khung nhôm',
    workingPrinciple: 'Nhờ trục quay lệch tâm (offset caster axis), khi robot di chuyển theo bất kỳ phương nào, bánh xe tự căn chỉnh theo véc-tơ lực đẩy mà không gây cản trở ma sát.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Tạo điểm tì thăng bằng tĩnh học',
        desc: 'Cùng với 2 bánh xe chủ động, bánh caster tạo thành hệ chân đế tam giác (3 điểm tì), giữ trọng tâm robot luôn nằm trọn trong đa giác nâng đỡ.'
      },
      {
        step: 2,
        title: 'Trục lệch tâm tự lựa hướng (Trail Offset)',
        desc: 'Tâm tiếp xúc mặt sàn nằm thụt lùi so với trục xoay thẳng đứng. Lực ma sát đẩy bánh xe tự động ngoặt theo đúng hướng di chuyển của xe.'
      },
      {
        step: 3,
        title: 'Xoay 360° tự do không trợ lực',
        desc: 'Vòng bi thép tích hợp quanh cổ càng xoay triệt tiêu mô-men cản, cho phép xe rẽ ngoặt hoặc xoay tròn tại chỗ mà không bị rê hay bó cứng bánh.'
      },
      {
        step: 4,
        title: 'Chống chúi gầm khi thắng gấp',
        desc: 'Hấp thụ xung phản lực từ mặt đường khi xe tăng tốc đột ngột hoặc dừng phanh khẩn cấp, bảo vệ cảm biến camera không bị rung lắc.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_32106c30.png',
    realPhotoCaption: 'Ảnh thực tế bánh xe xoay tự do (Swivel Caster): Con lăn nylon trắng ngà lắp trên càng thép dập mạ kẽm chữ U, đế vuông 4 lỗ bắt vít tích hợp vòng bi xoay 360°.',
    realGallery: [
      {
        url: '/assets/aistudio/image_32106c30.png',
        label: 'Bánh caster rời',
        caption: 'Con lăn nylon trắng trên càng thép chữ U mạ kẽm và đế vuông 4 lỗ bắt vít.'
      },
      {
        url: '/assets/aistudio/image_bbcc8481.png',
        label: 'Cả 2 bánh dưới gầm',
        caption: 'Ảnh thật mặt đáy gầm xe: hai bánh caster trước và sau giữ thăng bằng cho thân robot.'
      },
      {
        url: '/assets/aistudio/1794209545157_43132710148482215_g8908539602773141407_f36e3a266647df439cb9b2cff63e62e5_11deefde.jpg',
        label: 'Góc gầm xe cận cảnh',
        caption: 'Cận cảnh thực tế hai bánh xe xoay tự do dưới mặt đáy hợp kim nhôm xanh.'
      },
      {
        url: '/assets/aistudio/image_f841a927.png',
        label: 'Càng caster mũi trước',
        caption: 'Nhìn từ phía trước thấy rõ càng thép mạ kẽm bánh caster ngay dưới giá đỡ Camera CSI.'
      }
    ],
    realPhotoHighlights: [
      'Con lăn nylon trắng đường kính ~25mm chịu mài mòn tốt, lăn êm',
      'Càng thép dập mạ crom/kẽm chữ U chắc chắn kèm trục tán cố định',
      'Đế thép vuông 4 lỗ bắt vít M3 trực tiếp lên khung đáy xe',
      'Cụm ổ bi xoay 360° giúp bánh tự lựa hướng mượt mà khi vào cua'
    ],
    cmuRole: 'Đảm bảo robot di chuyển ổn định trên mặt phẳng, không bị chúi đầu hay bốc đầu khi tăng tốc đột ngột.',
    meshGroup: 'casterWheelsGroup',
    cameraPosition: [0.28, 0.02, 0.42],
    cameraTarget: [0, 0.04, 0.14],
    colorHex: '#64748b'
  },
  {
    id: 'motor-driver',
    name: 'Mạch điều khiển động cơ',
    englishName: 'Motor Driver Shield / Board',
    category: 'processing',
    categoryLabel: 'Mạch công suất',
    functionSummary: 'Khuếch đại tín hiệu điều khiển logic từ Jetson Nano thành xung công suất PWM điều chỉnh tốc độ động cơ',
    location: 'Nằm ở tầng đệm, giữa khung đáy và bo mạch Jetson Nano',
    keySpecs: [
      { label: 'Chipset IC', value: 'Cầu H kép PCA9685 + TB6612FNG' },
      { label: 'Điện áp động cơ', value: 'VM = 6V - 12V' },
      { label: 'Dòng điện tối đa', value: '1.2A liên tục (3A đỉnh)' },
      { label: 'Phương thức', value: 'Điều xung PWM 12-bit tần số cao' },
      { label: 'Bảo vệ', value: 'Chống ngược cực nguồn, diode dập xung cảm kháng' }
    ],
    interfaceType: 'Giao tiếp bus I2C (SDA, SCL) hoặc chân GPIO PWM',
    workingPrinciple: 'Nhận lệnh phần mềm từ Jetson Nano qua I2C, giải mã thành tín hiệu đóng mở 4 transistor công suất (cầu H) để đảo chiều dòng điện và thay đổi điện áp hiệu dụng.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Nhận gói tin số qua bus I2C',
        desc: 'Jetson Nano gửi lệnh tốc độ dạng byte nhị phân qua 2 dây I2C (SDA và SCL, địa chỉ 0x60) đến IC mở rộng xung PCA9685.'
      },
      {
        step: 2,
        title: 'Tạo xung điều chế độ rộng (12-bit PWM)',
        desc: 'IC tạo chuỗi xung số tần số 1.6 kHz với 4096 mức phân giải độ rộng xung, giúp điều khiển tốc độ quay cực kỳ mịn màng và không bị giật cục.'
      },
      {
        step: 3,
        title: 'Đóng ngắt cầu H công suất (TB6612FNG)',
        desc: 'Mạch cầu H gồm 4 transistor MOSFET công suất điều khiển chiều dòng điện chạy qua cuộn dây mô-tơ: Đảo chiều chân = Đổi chiều quay tiến/lùi.'
      },
      {
        step: 4,
        title: 'Bảo vệ chống dòng cảm kháng ngược',
        desc: 'Diode kẹp Schottky nội dập tắt các xung điện áp cao sinh ra do hiện tượng tự cảm khi mô-tơ dừng đột ngột, ngăn chặn cháy nổ bo mạch Jetson.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_6b0960bb.png',
    realPhotoCaption: 'Ảnh sơ đồ bo mạch điều khiển động cơ & mở rộng Waveshare JetBot: Tích hợp IC cầu H kép điều khiển động cơ, mạch hạ áp, IC đo dòng INA219, khay 3 pin 18650 và khe cắm màn hình OLED.',
    realGallery: [
      {
        url: '/assets/aistudio/image_6b0960bb.png',
        label: 'Sơ đồ bo Waveshare',
        caption: 'Sơ đồ bo mạch mở rộng Waveshare JetBot tích hợp mạch điều khiển động cơ, ổn áp và khay pin.'
      },
      {
        url: '/assets/aistudio/image_8a45e6b8.png',
        label: 'Bo mạch gắn trên xe',
        caption: 'Ảnh thực tế bo mạch điều khiển lắp giữa khung đáy và Jetson Nano trên robot thật.'
      },
      {
        url: '/assets/aistudio/image_c14dba1a.png',
        label: 'Cận cảnh mặt sau bo',
        caption: 'Góc nhìn thật mặt sau bo điều khiển với hàng chân header, công tắc nguồn và màn hình OLED.'
      }
    ],
    realPhotoHighlights: [
      'Các IC điều khiển PWM, cầu H (③④⑤⑥) và cảm biến dòng điện INA219',
      'Khay 3 cell pin 18650 (⑩) tích hợp trực tiếp ngay trên mặt bo mạch',
      'Khe hiển thị màn hình OLED 0.91" (⑦) và đầu ra I2C (⑫)',
      'Logo Waveshare cùng hệ thống mạch bảo vệ sạc xả ổn định 5V/4A'
    ],
    cmuRole: 'Cầu nối điện toán giữa phần mềm thông minh (ROS/Python) và chuyển động vật lý của robot.',
    meshGroup: 'motorDriverGroup',
    cameraPosition: [0.3, 0.25, 0.3],
    cameraTarget: [0, 0.08, 0],
    colorHex: '#8b5cf6'
  },
  {
    id: 'wifi-antennas',
    name: 'Anten Wi-Fi kép',
    englishName: 'Dual High-Gain Wi-Fi Antennas',
    category: 'connectivity',
    categoryLabel: 'Kết nối mạng',
    functionSummary: 'Thu phát tín hiệu sóng Wi-Fi không dây băng tần kép cho phép truyền video và nhận lệnh điều khiển từ xa',
    location: 'Gắn trên hai cọc trụ kim loại phía sau robot, vểnh hình chữ V',
    keySpecs: [
      { label: 'Băng tần', value: 'Dual-band 2.4 GHz & 5.0 GHz' },
      { label: 'Độ lợi anten', value: '3 dBi - 5 dBi omni-directional' },
      { label: 'Chuẩn kết nối', value: 'Đầu ren SMA mạ vàng + cáp IPEX/u.FL' },
      { label: 'Card mạng', value: 'M.2 Intel Wireless-AC / Realtek' }
    ],
    interfaceType: 'Chuẩn SMA nối vào card M.2 Key-E trên Jetson Nano',
    workingPrinciple: 'Biến đổi tín hiệu điện cao tần từ card Wi-Fi thành sóng điện từ lan truyền trong không gian và ngược lại, đảm bảo kết nối IP thông suốt.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Truyền dẫn sóng cao tần từ card M.2',
        desc: 'Card Wi-Fi gắn trong khe M.2 dưới gầm bo Jetson tạo tín hiệu tần số vô tuyến RF (2.4GHz / 5GHz) dẫn qua cáp đồng trục siêu mảnh có đầu nối u.FL.'
      },
      {
        step: 2,
        title: 'Chuyển tiếp qua khớp ren SMA mạ vàng',
        desc: 'Cáp đồng trục kết nối ra đai ốc ren SMA mạ vàng bắt chặt vào thành khung, đảm bảo tiếp xúc không suy hao tín hiệu điện cao tần.'
      },
      {
        step: 3,
        title: 'Bức xạ sóng đa hướng (Omni-directional)',
        desc: 'Ăng-ten hình trụ cao su bức xạ sóng điện từ theo hình bánh donut (hình xuyến), phủ sóng đồng đều 360 độ xung quanh thân robot.'
      },
      {
        step: 4,
        title: 'Truyền video thời gian thực & điều khiển Web',
        desc: 'Cung cấp băng thông mạng lên tới 867 Mbps, truyền luồng video FPV từ Camera CSI về màn hình máy tính và nhận lệnh lái từ bàn phím với độ trễ <20ms.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_dbb9b589.png',
    realPhotoCaption: 'Ảnh thực tế bộ ăng-ten Wi-Fi 2.4G/5.8G 5dBi chuẩn SMA-J: Gồm cần ăng-ten gấp 90°, đầu nối đồng ren vàng SMA kèm cận cảnh lõi kim loại, và sợi cáp đồng trục mảnh nối vào card M.2.',
    realGallery: [
      {
        url: '/assets/aistudio/image_dbb9b589.png',
        label: 'Bộ anten SMA 5dBi',
        caption: 'Cần anten Wi-Fi băng tần kép 2.4G/5.8G kèm đầu ren SMA mạ vàng và dây cáp nối card M.2.'
      },
      {
        url: '/assets/aistudio/2_45b1e6a7.jpg',
        label: '2 anten dựng chữ V thật',
        caption: 'Ảnh chụp thật phía sau robot: hai cần anten Wi-Fi dựng đối xứng hai bên với đầu ốc đồng SMA.'
      },
      {
        url: '/assets/aistudio/image_c14dba1a.png',
        label: 'Dây đồng trục ra khung',
        caption: 'Cặp dây đồng trục đen đi từ card Wi-Fi ra đai ốc bắt anten trên khung nhôm xanh.'
      }
    ],
    realPhotoHighlights: [
      'Hỗ trợ băng tần kép 2.4GHz / 5.8GHz độ lợi 5dBi thu sóng mạnh',
      'Khớp xoay gập 90° giúp dựng đứng ăng-ten hình chữ V sau xe',
      'Đầu ren vặn chuẩn SMA-J mạ vàng gắn xuyên qua lỗ khung nhôm',
      'Cáp đồng trục siêu mảnh bấm sẵn đầu nối u.FL/IPEX vào card Wi-Fi'
    ],
    cmuRole: 'Cho phép học sinh truy cập Jupyter Lab trên Jetson Nano từ máy tính cá nhân qua Wi-Fi để viết mã và điều khiển JetBot không cần dây cắm.',
    meshGroup: 'wifiAntennasGroup',
    cameraPosition: [0.0, 0.4, -0.45],
    cameraTarget: [0, 0.2, -0.1],
    colorHex: '#ec4899'
  },
  {
    id: 'brass-standoffs',
    name: 'Hệ thống Cọc Đồng Lục Giác M3 & Đĩa Tầng Đỡ',
    englishName: 'M3 Brass Hex Standoffs & Staging Decks',
    category: 'structure',
    categoryLabel: 'Khung gầm & Liên kết',
    functionSummary: 'Định vị không gian 3 tầng xếp chồng theo phương đứng, phân tách cách điện và triệt tiêu rung chấn cơ học truyền từ bánh xe lên cụm quang học laser',
    location: 'Bố trí tại 4 góc liên kết tầng sàn đáy lên tầng bo mạch và tầng đỉnh đặt RPLIDAR',
    keySpecs: [
      { label: 'Quy cách cọc', value: 'Đồng thau lục giác ren M3 (Hex Brass Standoff)' },
      { label: 'Chiều cao tầng 1', value: '45 mm (vừa vặn chứa pin và động cơ)' },
      { label: 'Chiều cao tầng 2', value: '62 mm (chứa quạt tản nhiệt và bo Jetson)' },
      { label: 'Đặc tính cơ điện', value: 'Dẫn điện nối mass ESD, chống gỉ sét tuyệt đối' }
    ],
    interfaceType: 'Ốc vít nón ren chìm kim loại M3 bắt đối đầu',
    workingPrinciple: 'Các trụ đồng lục giác chịu lực nén cơ học cao, liên kết chặt chẽ các tầng bằng vít ren M3, triệt tiêu hiện tượng vặn xoắn cơ học khi robot quay gắt.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Định vị các tầng robot chính xác theo chiều đứng',
        desc: 'Các cọc đồng lục giác ren M3 tạo khoảng trống 45mm và 62mm giữa các đĩa nhôm, giúp luồn dây dẫn thông thoáng.'
      },
      {
        step: 2,
        title: 'Khóa chặt bằng vít nón chống tự nới lỏng',
        desc: 'Vít kim loại kết hợp vòng đệm răng cưa khóa chặt đĩa đỡ với đầu cọc đồng, không bị lỏng ốc khi xe di chuyển trên mặt sàn gồ ghề.'
      },
      {
        step: 3,
        title: 'Nối đất an toàn và triệt tiêu tĩnh điện (ESD)',
        desc: 'Chất liệu đồng thau tạo đường dẫn mass liên tục giữa các tầng nhôm, triệt tiêu phóng tĩnh điện có hại cho bo mạch điện tử.'
      },
      {
        step: 4,
        title: 'Hấp thụ rung động bảo vệ cảm biến quang học',
        desc: 'Khối lượng và độ cứng vững của dàn cọc đồng giúp dập tắt dao động tần số cao từ động cơ, giữ đầu quét Laser RPLIDAR luôn thăng bằng.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_adf97c05.png',
    realPhotoCaption: 'Ảnh thực tế bộ cọc đồng lục giác M3 kèm hộp chia ngăn: Đầy đủ các kích cỡ trụ đồng thau đực-cái, cái-cái (M3 nhiều chiều dài) đi kèm ốc vít và đai ốc thép không gỉ.',
    realGallery: [
      {
        url: '/assets/aistudio/image_adf97c05.png',
        label: 'Hộp cọc đồng M3',
        caption: 'Bộ cọc đồng lục giác M3 nhiều kích thước kèm ốc vít và đai ốc inox trong hộp chia ngăn.'
      },
      {
        url: '/assets/aistudio/image_a3d4a2ce.png',
        label: 'Dàn trụ đồng trên xe',
        caption: 'Ảnh chụp thực tế hệ thống cọc đồng M3 chống tầng nâng bo mạch Jetson Nano và tầng trên.'
      },
      {
        url: '/assets/aistudio/3_37e20bc8.jpg',
        label: 'Trụ nâng tầng RPLIDAR',
        caption: 'Các trụ đồng thau lục giác nâng đều đĩa đỡ RPLIDAR giữ khoảng thoáng cho quạt tản nhiệt.'
      }
    ],
    realPhotoHighlights: [
      'Hộp 10 ngăn phân loại gọn gàng cọc đồng, ốc vít và đai ốc M3',
      'Đủ các chiều dài trụ đồng lục giác đực-cái và cái-cái xếp theo bậc kích thước',
      'Chất liệu đồng thau chống oxy hóa, chịu nén tốt khi nâng 3 tầng khung',
      'Kèm ốc vít đầu chữ thập và đai ốc inox siết khóa chống lỏng khi xe chạy'
    ],
    cmuRole: 'Bài học kỹ thuật lắp ráp cơ khí: Rèn luyện tính cẩn thận, cân chỉnh lực siết và quản lý không gian linh kiện trong Robotics.',
    meshGroup: 'brassStandoffsGroup',
    cameraPosition: [0.32, 0.22, 0.26],
    cameraTarget: [0, 0.12, 0],
    colorHex: '#d97706'
  },
  {
    id: 'chassis-frame',
    name: 'Khung robot',
    englishName: 'Multi-tier Metal Chassis & Standoffs',
    category: 'structure',
    categoryLabel: 'Khung gầm cơ khí',
    functionSummary: 'Cố định, định vị không gian và bảo vệ an toàn cho toàn bộ linh kiện điện tử, động cơ và cảm biến',
    location: 'Bao gồm sàn đáy hình tròn khuyết và các tầng đỡ phụ nối bởi cọc đồng',
    keySpecs: [
      { label: 'Chất liệu', value: 'Hợp kim nhôm anot hóa (Anodized Aluminum) sơn xanh lá' },
      { label: 'Trụ liên kết', value: 'Cọc đồng lục giác ren M3 tiêu chuẩn' },
      { label: 'Kiến trúc', value: 'Đa tầng (3 tầng xếp chồng theo phương thẳng đứng)' },
      { label: 'Trọng lượng nhẹ', value: 'Chịu lực cao, tản nhiệt tốt' }
    ],
    interfaceType: 'Lỗ ốc bắt vít M2.5 / M3 định vị chính xác',
    workingPrinciple: 'Hấp thụ rung chấn từ mặt đường, giữ trọng tâm robot thấp và cân bằng, tạo lồng bảo vệ chống va đập trực tiếp vào bo mạch trung tâm.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Định hình kết cấu hình học tròn khuyết',
        desc: 'Tấm sàn đáy bằng hợp kim nhôm cắt CNC viền tròn giúp robot không bị vướng mắc vào các góc tường khi quay tròn, hai hốc khoét sâu chứa bánh xe.'
      },
      {
        step: 2,
        title: 'Phân tầng không gian theo phương đứng (3 Tầng)',
        desc: 'Tầng 1 chứa động cơ và pin -> Tầng 2 chứa mạch công suất và Jetson Nano -> Tầng 3 đặt cảm biến quét Laser RPLIDAR và Camera CSI.'
      },
      {
        step: 3,
        title: 'Liên kết vững chắc bằng cọc đồng lục giác M3',
        desc: 'Các trụ đồng lục giác chịu lực nén và uốn cao, liên kết chặt chẽ các tầng bằng vít ren M3, triệt tiêu hiện tượng vặn xoắn cơ học.'
      },
      {
        step: 4,
        title: 'Tản nhiệt thụ động & Chống oxy hóa bề mặt',
        desc: 'Lớp anot hóa (Anodizing) màu xanh lá tăng độ cứng bề mặt chống trầy xước, đồng thời toàn bộ mặt phẳng nhôm đóng vai trò tấm tản nhiệt phụ cho bo mạch.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_a410c530.png',
    realPhotoCaption: 'Ảnh thực tế tấm khung gầm hợp kim nhôm sơn xanh lá cắt CNC nhìn từ mặt đáy: Thấy rõ 2 hốc khoét bánh xe đối xứng, khe luồn dây động cơ ở giữa, 2 bánh caster và lỗ bắt ăng-ten phía sau.',
    realGallery: [
      {
        url: '/assets/aistudio/image_a410c530.png',
        label: 'Tấm khung CNC xanh lá',
        caption: 'Tấm khung gầm hợp kim nhôm sơn xanh lá cắt CNC với 2 hốc bánh xe và khe luồn dây.'
      },
      {
        url: '/assets/aistudio/image_3a4f0581.png',
        label: 'Nhìn từ trên xuống',
        caption: 'Toàn cảnh khung nhôm xanh lá tròn khuyết nhìn từ phía trên khi đã lắp hoàn chỉnh 3 tầng.'
      },
      {
        url: '/assets/aistudio/image_bbcc8481.png',
        label: 'Mặt đáy khung gầm thật',
        caption: 'Ảnh thực tế mặt dưới khung nhôm với các lỗ vít cố định 2 động cơ, 2 caster và bó dây gọn.'
      }
    ],
    realPhotoHighlights: [
      'Khung hợp kim nhôm tròn khuyết phủ xanh lá chống trầy xước',
      'Hai hốc khoét vuông hai bên ôm gọn bánh xe chủ động 65mm',
      'Khe chữ nhật trung tâm luồn gọn bó dây nguồn và encoder mô-tơ',
      'Hệ thống lỗ vít CNC gắn chuẩn xác 2 động cơ, 2 caster và cọc đồng'
    ],
    cmuRole: 'Thực hành kỹ năng lắp ráp cơ khí chính xác, quản lý dây dẫn (cable management) trong giáo trình Robotics CMU.',
    meshGroup: 'chassisGroup',
    cameraPosition: [0.4, 0.25, 0.4],
    cameraTarget: [0, 0.05, 0],
    colorHex: '#16a34a'
  },
  {
    id: 'battery-pack',
    name: 'Khối Pin & Nguồn',
    englishName: 'Dual Power System (Li-ion)',
    category: 'power',
    categoryLabel: 'Cung cấp năng lượng',
    functionSummary: 'Cung cấp nguồn điện độc lập, ổn định cho Jetson Nano (5V 4A) và mạch động cơ (7.4V/12V)',
    location: 'Đặt giữa tầng đáy và tầng giữa, hạ thấp trọng tâm xe',
    keySpecs: [
      { label: 'Nguồn logic', value: 'Power bank 5V 4A QuickCharge 3.0' },
      { label: 'Nguồn động cơ', value: 'Pack pin 2S/3S Li-ion 7.4V - 11.1V' },
      { label: 'Dung lượng', value: '5000 mAh - 10000 mAh' },
      { label: 'Thời gian chạy', value: '1.5 - 2.5 giờ liên tục' }
    ],
    interfaceType: 'Jack cắm DC 5.5x2.1mm + Cáp Type-C / USB-A',
    workingPrinciple: 'Tách biệt nguồn logic của máy tính Jetson Nano và nguồn động cơ để tránh hiện tượng sụt áp (brownout) khi động cơ đề pa hoặc đảo chiều đột ngột.',
    howItWorksSteps: [
      {
        step: 1,
        title: 'Tách biệt 2 nhánh nguồn độc lập (Dual Supply)',
        desc: 'Nhánh 1 cấp 5V ổn định cho Jetson Nano và các cảm biến; Nhánh 2 cấp nguồn trực tiếp 7.4V - 12V cho mạch công suất động cơ DC.'
      },
      {
        step: 2,
        title: 'Ngăn chặn sụt áp đột ngột (Anti-Brownout)',
        desc: 'Khi 2 động cơ khởi động đồng thời, dòng khởi động có thể vọt lên 3A làm tụt áp pin. Nhờ mạch cách ly, điện áp máy tính không bị tụt làm sập nguồn Jetson.'
      },
      {
        step: 3,
        title: 'Mạch bảo vệ thông minh BMS tích hợp',
        desc: 'Bảo vệ pack pin Li-ion chống sạc quá dòng (Over-current), xả quá cạn (Over-discharge) và cân bằng điện áp giữa các cell pin.'
      },
      {
        step: 4,
        title: 'Phân phối điện năng qua công tắc trượt',
        desc: 'Đóng/ngắt toàn bộ nguồn hệ thống bằng công tắc cơ học, có cầu chì tự phục hồi bảo vệ khi xảy ra chập mạch ngoài ý muốn.'
      }
    ],
    realPhotoUrl: '/assets/aistudio/image_ea68c70e.png',
    realPhotoCaption: 'Ảnh thực tế khối pin Li-ion 18650 bọc co nhiệt xanh dương kèm tem thông số kỹ thuật và chùm dây nguồn 3 màu (đỏ, vàng, đen) cấp điện áp ổn định cho robot.',
    realGallery: [
      {
        url: '/assets/aistudio/image_ea68c70e.png',
        label: 'Pack pin Li-ion 18650',
        caption: 'Khối pin Li-ion 18650 bọc co nhiệt xanh dương kèm mạch bảo vệ và bó dây nguồn 3 màu.'
      },
      {
        url: '/assets/aistudio/3_37e20bc8.jpg',
        label: 'Khay pin giữa thân xe',
        caption: 'Ảnh thực tế vị trí khay pin 3 cell lắp gọn giữa tầng đáy dưới bo mạch điều khiển.'
      },
      {
        url: '/assets/aistudio/image_a3d4a2ce.png',
        label: 'Cấp nguồn dưới Jetson',
        caption: 'Khối nguồn nằm sát tầng đáy giúp hạ thấp trọng tâm và cấp điện ổn định cho Jetson Nano.'
      }
    ],
    realPhotoHighlights: [
      'Tổ hợp các cell Li-ion 18650 ghép nối tiếp bọc màng co PVC xanh dương',
      'Tích hợp mạch BMS bảo vệ quá dòng, ngắn mạch và cân bằng cell bên trong',
      'Tem thông số kỹ thuật in rõ điện áp và dung lượng định mức',
      'Dây nguồn ra bọc vỏ silicon (đỏ/vàng/đen) dẫn dòng xả lớn an toàn'
    ],
    cmuRole: 'Bài học an toàn điện năng, quản lý pin Li-ion và tính toán công suất tiêu thụ của hệ thống robot tự hành.',
    meshGroup: 'batteryGroup',
    cameraPosition: [0.05, 0.14, -0.34],
    cameraTarget: [0, 0.048, -0.04],
    colorHex: '#eab308'
  }
];

export const CMU_LESSON_INFO = {
  title: 'NHIỆM VỤ MÔN CMU LỚP 10A: TẠO WEB MÔ PHỎNG JETBOT',
  objectives: [
    { step: 1, title: 'Thể hiện đầy đủ 15 linh kiện cấu tạo nên JetBot', desc: 'Mô hình 3D trực quan & ảnh thực tế: Jetson Nano, RPLIDAR, Cụm puly đai curoa, Camera CSI, Màn hình OLED mini, Quạt 40mm PWM, Động cơ, Bánh xe, Cọc đồng M3, Công tắc & Nút Reset, Driver, Khung gầm.' },
    { step: 2, title: 'Các chức năng cơ bản & Cách thức hoạt động', desc: 'Bảng phân tích kèm ảnh thực tế, thông số kỹ thuật và 4 bước hoạt động chi tiết cho từng linh kiện.' },
    { step: 3, title: 'Điều khiển di chuyển & Mô phỏng cảm biến', desc: 'Mô phỏng lái xe vi sai thực tế với quét RPLIDAR thời gian thực, góc nhìn FPV Camera CSI và né vật cản.' }
  ],
  systemArchitecture: {
    inputs: ['RPLIDAR & Đai truyền động (Quét 360° laser)', 'Camera CSI (Video HD 60fps)', 'Encoder quang (Tốc độ bánh xe)'],
    core: 'NVIDIA Jetson Nano + Quạt tản nhiệt 40mm PWM (ROS Node, OpenCV Vision, Deep Learning Inference)',
    display: 'Màn hình OLED 0.91" I2C (Hiển thị IP, Pin & Trạng thái CPU/GPU)',
    outputs: ['Mạch điều khiển động cơ -> 2 Động cơ DC & Bánh xe vi sai', 'Luồng dữ liệu Wi-Fi -> Web Dashboard / Jupyter']
  }
};
