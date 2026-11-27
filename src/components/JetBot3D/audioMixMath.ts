import { EnvironmentMap } from '../../types/robot';

export interface AmbientAudioInput {
  isDriveMode: boolean;
  isMuted: boolean;
  environmentMap: EnvironmentMap;
  linearVelocity: number;
  angularVelocity: number;
  elapsedSeconds: number;
}

export interface AmbientAudioParams {
  active: boolean;
  windGain: number;
  windCutoffHz: number;
  marsRumbleGain: number;
  servoBuzzGain: number;
  servoWhirGain: number;
  servoBuzzFreqHz: number;
  servoWhirFreqHz: number;
  servoFilterHz: number;
  servoChatterRateHz: number;
}

export function computeAmbientAudioParams(input: AmbientAudioInput): AmbientAudioParams {
  if (!input.isDriveMode || input.isMuted) {
    return {
      active: false,
      windGain: 0,
      windCutoffHz: 220,
      marsRumbleGain: 0,
      servoBuzzGain: 0,
      servoWhirGain: 0,
      servoBuzzFreqHz: 90,
      servoWhirFreqHz: 120,
      servoFilterHz: 420,
      servoChatterRateHz: 22,
    };
  }

  const absLinear = Math.min(2.0, Math.abs(input.linearVelocity));
  const absAngular = Math.min(4.0, Math.abs(input.angularVelocity));
  const motionLoad = Math.min(1.5, absLinear * 0.9 + absAngular * 0.25);

  const isMars = input.environmentMap === 'mars-planet';

  // Strictly NO wind or storm ambience on Mars (only crisp mechanical servo & LIDAR audio)
  const windGain = isMars
    ? 0
    : 0.016 + Math.min(0.015, absLinear * 0.012);

  const windCutoffHz = isMars
    ? 220
    : 155 + absLinear * 70;

  const marsRumbleGain = isMars
    ? 0
    : 0.008;

  // Servo motor PWM "rè rè" buzz + geared motor & RPLIDAR rotor whir
  const servoBuzzGain = Math.min(0.068, 0.018 + absLinear * 0.038 + absAngular * 0.013);
  const servoWhirGain = Math.min(0.056, 0.010 + absLinear * 0.036 + absAngular * 0.012);

  const servoBuzzFreqHz = 86 + absLinear * 96 + absAngular * 24;
  const servoWhirFreqHz = 128 + absLinear * 205 + absAngular * 38;
  const servoFilterHz = 430 + motionLoad * 620;
  const servoChatterRateHz = 21 + absLinear * 14 + absAngular * 6;

  return {
    active: true,
    windGain,
    windCutoffHz,
    marsRumbleGain,
    servoBuzzGain,
    servoWhirGain,
    servoBuzzFreqHz,
    servoWhirFreqHz,
    servoFilterHz,
    servoChatterRateHz,
  };
}
