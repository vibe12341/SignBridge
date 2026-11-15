/**
 * Lightweight frame-to-frame motion energy calculation and deterministic
 * phrase-boundary state machine for sign language Auto-Watch mode.
 */

export function computeFrameMotion(
  prevGray: Uint8ClampedArray | null,
  currGray: Uint8ClampedArray
): number {
  if (!prevGray || prevGray.length === 0 || prevGray.length !== currGray.length) {
    return 0;
  }
  let totalDiff = 0;
  for (let i = 0; i < currGray.length; i++) {
    totalDiff += Math.abs(currGray[i] - prevGray[i]);
  }
  // Normalize to [0, 1] where 255 is max per-pixel difference
  return Math.min(1, totalDiff / (currGray.length * 255));
}

export type MotionPhase = 'idle' | 'signing' | 'settling' | 'cooldown';

export interface MotionConfig {
  startThreshold: number;
  settleThreshold: number;
  settleDurationMs: number;
  cooldownDurationMs: number;
}

export const DEFAULT_MOTION_CONFIG: MotionConfig = {
  startThreshold: 0.035,
  settleThreshold: 0.02,
  settleDurationMs: 1100,
  cooldownDurationMs: 1800,
};

export interface MotionStepResult {
  phase: MotionPhase;
  shouldTriggerInterpret: boolean;
}

export class MotionPhraseStateMachine {
  private phase: MotionPhase = 'idle';
  private settleStartMs: number | null = null;
  private cooldownUntilMs = 0;
  private config: MotionConfig;

  constructor(config: Partial<MotionConfig> = {}) {
    this.config = { ...DEFAULT_MOTION_CONFIG, ...config };
  }

  public getPhase(): MotionPhase {
    return this.phase;
  }

  public reset(): void {
    this.phase = 'idle';
    this.settleStartMs = null;
    this.cooldownUntilMs = 0;
  }

  public updateConfig(partial: Partial<MotionConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  public step(motionEnergy: number, nowMs: number): MotionStepResult {
    if (this.phase === 'cooldown') {
      if (nowMs >= this.cooldownUntilMs) {
        this.phase = 'idle';
      } else {
        return { phase: this.phase, shouldTriggerInterpret: false };
      }
    }

    if (this.phase === 'idle') {
      if (motionEnergy >= this.config.startThreshold) {
        this.phase = 'signing';
        this.settleStartMs = null;
      }
      return { phase: this.phase, shouldTriggerInterpret: false };
    }

    if (this.phase === 'signing') {
      if (motionEnergy < this.config.settleThreshold) {
        this.phase = 'settling';
        this.settleStartMs = nowMs;
      }
      return { phase: this.phase, shouldTriggerInterpret: false };
    }

    if (this.phase === 'settling') {
      if (motionEnergy >= this.config.startThreshold) {
        // Signer resumed gesturing before phrase completed
        this.phase = 'signing';
        this.settleStartMs = null;
        return { phase: this.phase, shouldTriggerInterpret: false };
      }

      if (
        this.settleStartMs !== null &&
        nowMs - this.settleStartMs >= this.config.settleDurationMs
      ) {
        this.phase = 'cooldown';
        this.settleStartMs = null;
        this.cooldownUntilMs = nowMs + this.config.cooldownDurationMs;
        return { phase: this.phase, shouldTriggerInterpret: true };
      }
    }

    return { phase: this.phase, shouldTriggerInterpret: false };
  }
}
