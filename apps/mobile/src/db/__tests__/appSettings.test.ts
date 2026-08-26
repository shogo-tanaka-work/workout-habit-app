import { createFakeDatabase } from '../../test-support/fakeDatabase';
import { buildTimerState } from '../../test-support/factories';
import { DEFAULT_REST_PRESETS, REST_PRESET_LIMIT } from '../../types/domain';
import {
  loadRestTimer,
  saveRestTimer,
  setSyncPaused,
  toSyncSettings,
  toTimerSettings,
  upsertTimerSettings,
} from '../appSettings';

const row = (key: string, value: string) => ({ key, value });

describe('toTimerSettings', () => {
  it('未設定（初回起動）は音・振動とも有効', () => {
    expect(toTimerSettings([])).toEqual({
      soundEnabled: true,
      vibrationEnabled: true,
      restPresets: DEFAULT_REST_PRESETS,
    });
  });

  it("'0' のときだけ無効にする", () => {
    const settings = toTimerSettings([
      row('timer_sound_enabled', '0'),
      row('timer_vibration_enabled', '1'),
    ]);
    expect(settings.soundEnabled).toBe(false);
    expect(settings.vibrationEnabled).toBe(true);
  });

  it('共通タイマーを JSON から読む', () => {
    const settings = toTimerSettings([row('timer_rest_presets', '[60, 90]')]);
    expect(settings.restPresets).toEqual([60, 90]);
  });

  it('壊れた JSON は既定へ落とす', () => {
    expect(toTimerSettings([row('timer_rest_presets', '{壊れた')]).restPresets).toEqual(
      DEFAULT_REST_PRESETS,
    );
  });

  it('数値以外を捨て、空になったら既定へ落とす', () => {
    expect(toTimerSettings([row('timer_rest_presets', '["a", null]')]).restPresets).toEqual(
      DEFAULT_REST_PRESETS,
    );
  });

  it('負の値は 0 へ、小数は丸める', () => {
    expect(toTimerSettings([row('timer_rest_presets', '[-10, 90.4]')]).restPresets).toEqual([
      0, 90,
    ]);
  });

  it('上限を超えるぶんは捨てる', () => {
    const settings = toTimerSettings([row('timer_rest_presets', '[30,60,90,120,150]')]);
    expect(settings.restPresets).toHaveLength(REST_PRESET_LIMIT);
  });
});

describe('toSyncSettings', () => {
  it('未設定なら停止していない扱い', () => {
    expect(toSyncSettings([])).toMatchObject({ lastBackupAt: null, isPaused: false });
  });

  it('保存済みの接続先と最終バックアップを読む', () => {
    const settings = toSyncSettings([
      row('sync_api_url', 'https://example.test'),
      row('sync_last_backup_at', '2026-08-27T10:00:00.000Z'),
      row('sync_paused', '1'),
    ]);
    expect(settings).toEqual({
      apiUrl: 'https://example.test',
      lastBackupAt: '2026-08-27T10:00:00.000Z',
      isPaused: true,
    });
  });
});

describe('setSyncPaused', () => {
  it("'1' / '0' で保存する", async () => {
    const fake = createFakeDatabase();

    await setSyncPaused(fake.database, true);

    expect(fake.runs[0].params).toContain('sync_paused');
    expect(fake.runs[0].params).toContain('1');
  });
});

describe('休憩タイマーの保存と復元', () => {
  it('終了時刻を含む状態そのものを保存する', async () => {
    const fake = createFakeDatabase();
    const timer = buildTimerState({ endsAt: 1_700_000_000_000 });

    await saveRestTimer(fake.database, timer);

    expect(fake.runs[0].params).toContain(JSON.stringify(timer));
  });

  it('null を渡すと消す', async () => {
    const fake = createFakeDatabase();

    await saveRestTimer(fake.database, null);

    expect(fake.runs[0].sql).toContain('DELETE FROM app_settings');
  });

  it('保存された状態を読み戻す', async () => {
    const timer = buildTimerState({ endsAt: 1_700_000_000_000 });
    const fake = createFakeDatabase({ getFirst: () => ({ value: JSON.stringify(timer) }) });

    expect(await loadRestTimer(fake.database)).toEqual(timer);
  });

  it('保存が無ければ null', async () => {
    const fake = createFakeDatabase({ getFirst: () => null });
    expect(await loadRestTimer(fake.database)).toBeNull();
  });

  it('形が違えば無視する（古い形式が端末に残っていても壊れない）', async () => {
    const fake = createFakeDatabase({
      getFirst: () => ({ value: JSON.stringify({ workoutSetId: 'set-1' }) }),
    });
    expect(await loadRestTimer(fake.database)).toBeNull();
  });

  it('壊れた JSON でも起動を止めない', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = createFakeDatabase({ getFirst: () => ({ value: '{壊れた' }) });

    expect(await loadRestTimer(fake.database)).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('upsertTimerSettings', () => {
  it('音・振動・共通タイマーをまとめて保存する', async () => {
    const fake = createFakeDatabase();

    await upsertTimerSettings(fake.database, {
      soundEnabled: false,
      vibrationEnabled: true,
      restPresets: [60, 90],
    });

    expect(fake.runs).toHaveLength(3);
    expect(fake.runs[0].params).toContain('0');
    expect(fake.runs[1].params).toContain('1');
    expect(fake.runs[2].params).toContain('[60,90]');
  });

  it('上限を超える共通タイマーは切り詰めて保存する', async () => {
    const fake = createFakeDatabase();

    await upsertTimerSettings(fake.database, {
      soundEnabled: true,
      vibrationEnabled: true,
      restPresets: [30, 60, 90, 120],
    });

    expect(fake.runs[2].params).toContain('[30,60,90]');
  });
});
