export type ComponentCategory =
  | 'processing'
  | 'sensor'
  | 'actuator'
  | 'structure'
  | 'connectivity'
  | 'power';

export interface RealPhotoItem {
  url: string;
  label: string;
  caption?: string;
}

export interface RobotComponent {
  id: string;
  name: string;
  englishName: string;
  category: ComponentCategory;
  categoryLabel: string;
  functionSummary: string;
  location: string;
  keySpecs: { label: string; value: string }[];
  interfaceType: string;
  workingPrinciple: string;
  howItWorksSteps: { step: number; title: string; desc: string }[];
  realPhotoUrl: string;
  realPhotoCaption: string;
  realGallery?: RealPhotoItem[];
  realPhotoHighlights?: string[];
  cmuRole: string;
  meshGroup: string;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  colorHex: string;
}

export type DigMode = 'jetbot' | 'astronaut';
export type AstronautDigStatus = 'idle' | 'digging' | 'carrying' | 'ready-handoff';

export interface DriveState {
  isDriving: boolean;
  linearVelocity: number; // m/s
  angularVelocity: number; // rad/s
  steerAngle: number;
  leftWheelSpeed: number;
  rightWheelSpeed: number;
  heading: number; // degrees
  position: { x: number; z: number };
  nearestObstacleDistance: number; // meters
  obstacleDetected: boolean;
  nearestAlienDistance?: number;
  alienDetected?: boolean;
  aliensCount?: number;
  isCharging?: boolean;
  chargingBatteryLevel?: number;
  terrainElevation?: number;
  climbingAngle?: number;
  astronautFleeing?: boolean;
  astronautsCount?: number;
  canDig?: boolean;
  nearestDigSiteName?: string;
  astronautTaskStatus?: AstronautDigStatus;
  astronautTaskName?: string;
  astronautDistanceToBot?: number;
  astronautCanReceiveZ?: boolean;
  astronautWatering?: boolean;
  greenhouseAirlock?: {
    zone: 'outside' | 'ramp' | 'airlock' | 'garden';
    phaseLabel: string;
    statusColor: 'idle' | 'red' | 'amber' | 'green';
    progressPercent: number;
    outerDoorOpen: boolean;
    innerDoorOpen: boolean;
    dustPurged: boolean;
  };
}

export type ViewPreset = 'iso' | 'top' | 'front' | 'bottom' | 'side' | 'firstPerson';
export type RenderMode = 'realistic' | 'wireframe' | 'xray';
export type EnvironmentMap = 'cmu-arena' | 'mars-planet';

