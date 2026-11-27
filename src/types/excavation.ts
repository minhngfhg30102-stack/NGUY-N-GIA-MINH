export type ComponentTier = 'red' | 'purple' | 'blue' | 'green' | 'gray';

export interface ExcavationComponent {
  id: string;
  name: string;
  englishName: string;
  tier: ComponentTier;
  tierLabel: string;
  tierColorHex: string;
  borderColorClass: string;
  glowColorClass: string;
  bgTierClass: string;
  textTierClass: string;
  importanceScore: number; // 0 - 100
  importanceLabel: string;
  importanceReason: string;
  functionSummary: string;
  location: string;
  keySpecs: { label: string; value: string }[];
  realPhotoUrl?: string;
  cmuRole: string;
  dropWeight: number; // probability weight
  dropRatePercent: number; // percentage (e.g. 2.0%)
}

export interface InventoryItem extends ExcavationComponent {
  count: number;
  firstFoundAt: number;
  foundLocationName: string;
}

export interface DigSiteInfo {
  id: string;
  name: string;
  center: { x: number; z: number };
  radius: number;
  description: string;
}
