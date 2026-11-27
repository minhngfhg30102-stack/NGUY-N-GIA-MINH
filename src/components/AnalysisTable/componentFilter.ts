import { ComponentCategory, RobotComponent } from '../../types/robot';

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  processing: 'Xử lý & Driver',
  sensor: 'Cảm biến (Lidar/Cam)',
  actuator: 'Động cơ & Bánh xe',
  structure: 'Khung gầm & Liên kết',
  connectivity: 'Kết nối mạng (Wi-Fi)',
  power: 'Nguồn & Pin',
};

const CATEGORY_SEARCH_ALIASES: Record<ComponentCategory, string> = {
  processing: 'xu ly trung tam bo mach dieu khien driver man hinh oled quat tan nhiet',
  sensor: 'cam bien sensor lidar laser camera thi giac may',
  actuator: 'dong co motor banh xe truyen dong co cau chap hanh caster',
  structure: 'khung gam co khi coc dong lien ket',
  connectivity: 'ket noi mang wifi anten khong day',
  power: 'nguon dien pin sac cong tac reset',
};

export function normalizeSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function filterComponents(
  components: RobotComponent[],
  searchQuery: string,
  selectedCategory: ComponentCategory | 'all'
): RobotComponent[] {
  const normalizedQuery = normalizeSearchText(searchQuery);
  const tokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];

  return components.filter((comp) => {
    if (selectedCategory !== 'all' && comp.category !== selectedCategory) {
      return false;
    }
    if (tokens.length === 0) return true;

    const specsText = comp.keySpecs.map((s) => `${s.label} ${s.value}`).join(' ');
    const stepsText = comp.howItWorksSteps
      .map((st) => `${st.title} ${st.desc}`)
      .join(' ');
    const corpus = normalizeSearchText(
      [
        comp.name,
        comp.englishName,
        comp.category,
        comp.categoryLabel,
        CATEGORY_LABELS[comp.category],
        CATEGORY_SEARCH_ALIASES[comp.category],
        comp.functionSummary,
        comp.location,
        comp.interfaceType,
        comp.workingPrinciple,
        comp.cmuRole,
        specsText,
        stepsText,
      ].join(' ')
    );

    return tokens.every((token) => corpus.includes(token));
  });
}

export function getComponentPhotos(comp: RobotComponent) {
  const gallery = comp.realGallery ?? [];
  const items =
    gallery.length > 0
      ? gallery
      : [
          {
            url: comp.realPhotoUrl,
            label: 'Ảnh linh kiện',
            caption: comp.realPhotoCaption,
          },
        ];

  // Keep primary realPhotoUrl first if somehow missing from realGallery, and deduplicate by URL
  const seen = new Set<string>();
  const ordered = [];
  if (comp.realPhotoUrl && !items.some((item) => item.url === comp.realPhotoUrl)) {
    ordered.push({
      url: comp.realPhotoUrl,
      label: 'Ảnh linh kiện rời',
      caption: comp.realPhotoCaption,
    });
    seen.add(comp.realPhotoUrl);
  }
  for (const item of items) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    ordered.push(item);
  }
  return ordered;
}
