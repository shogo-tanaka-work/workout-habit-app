import type { TrainingPhase } from '../../types/domain';
import {
  DEFAULT_TRAINING_GOAL,
  DEFAULT_TRAINING_PHASE,
  findCurrentPhase,
  goalLabelOf,
  phaseLabelOf,
  TRAINING_GOAL_OPTIONS,
  TRAINING_PHASE_OPTIONS,
} from '../trainingProfile';

const buildPhase = (overrides: Partial<TrainingPhase> = {}): TrainingPhase => ({
  id: 'phase-1',
  phase: 'cut',
  startedOn: '2026-07-08',
  endedOn: null,
  note: '',
  ...overrides,
});

describe('goalLabelOf / phaseLabelOf', () => {
  it('契約値を日本語ラベルにする', () => {
    expect(goalLabelOf('hypertrophy')).toBe('筋肥大');
    expect(phaseLabelOf('lean_bulk')).toBe('リーンバルク');
  });

  it('契約外の値でも空欄にしない（サーバが値を増やしても画面が壊れない）', () => {
    expect(goalLabelOf('unknown-goal')).toBe('未設定');
    expect(phaseLabelOf('unknown-phase')).toBe('フェーズ');
  });
});

describe('選択肢', () => {
  it('表示順を固定する', () => {
    expect(TRAINING_GOAL_OPTIONS.map((option) => option.value)).toEqual([
      'strength',
      'hypertrophy',
      'endurance',
      'general',
    ]);
    expect(TRAINING_PHASE_OPTIONS.map((option) => option.value)).toEqual([
      'cut',
      'lean_bulk',
      'bulk',
      'maintain',
      'break',
    ]);
  });

  it('既定値は選択肢に含まれる', () => {
    expect(TRAINING_GOAL_OPTIONS.some((option) => option.value === DEFAULT_TRAINING_GOAL)).toBe(
      true,
    );
    expect(TRAINING_PHASE_OPTIONS.some((option) => option.value === DEFAULT_TRAINING_PHASE)).toBe(
      true,
    );
  });
});

describe('findCurrentPhase', () => {
  it('進行中のうち開始日が最大のものを返す', () => {
    const current = findCurrentPhase([
      buildPhase({ id: 'old', startedOn: '2026-01-01' }),
      buildPhase({ id: 'new', startedOn: '2026-07-08' }),
    ]);
    expect(current?.id).toBe('new');
  });

  it('終了済みは選ばない', () => {
    const current = findCurrentPhase([
      buildPhase({ id: 'ended', startedOn: '2026-08-01', endedOn: '2026-08-20' }),
      buildPhase({ id: 'running', startedOn: '2026-07-08' }),
    ]);
    expect(current?.id).toBe('running');
  });

  it('進行中が無ければ null', () => {
    expect(findCurrentPhase([buildPhase({ endedOn: '2026-08-20' })])).toBeNull();
    expect(findCurrentPhase([])).toBeNull();
  });
});
