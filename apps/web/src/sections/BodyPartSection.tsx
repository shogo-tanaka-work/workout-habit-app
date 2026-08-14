import { useState } from 'react';

import { readCssColor, withAlpha } from '../components/chartTheme';
import { HorizontalStackedBars, type StackedBarRow } from '../components/HorizontalStackedBars';
import { Loadable } from '../components/Loadable';
import { Section } from '../components/Section';
import { useApiData } from '../hooks/useApiData';
import type { ToggleOption } from '../components/ToggleGroup';
import { ToggleGroup } from '../components/ToggleGroup';
import type { BodyPartTotal, BodyPartsResponse } from '../types/api';
import { bodyPartColorVariable } from '../utils/bodyParts';
import { formatDateKey } from '../utils/datetime';
import { formatVolume } from '../utils/number';

// 部位別ボリューム。/analytics/body-parts が返す期間合計（ボリューム降順）を、
// 種目ごとの積み上げ横バーで表示する。期間の合算・種目内訳の計算は API 側の責務。

const RANGE_OPTIONS: readonly ToggleOption<number>[] = [
  { value: 4, label: '4週' },
  { value: 12, label: '12週' },
  { value: 52, label: '52週' }, // API の weeks 上限（53）の範囲内
];

// 積み上げの濃淡。同じ部位の種目は部位色の不透明度を段階的に下げて区別する
// （ホバーで種目名が出る前提のため、色だけで完全に区別できなくてよい）。
const SEGMENT_ALPHA_STEP = 0.18;
const SEGMENT_ALPHA_MIN = 0.35;

const segmentAlphaAt = (segmentIndex: number): number =>
  Math.max(1 - segmentIndex * SEGMENT_ALPHA_STEP, SEGMENT_ALPHA_MIN);

/**
 * 部位1件を積み上げバーの1行へ整形する。種目内訳（exercises）が無い旧 API の
 * レスポンスでは、従来どおりアクセント単色の1セグメントへフォールバックする。
 */
const buildRow = (total: BodyPartTotal): StackedBarRow => {
  const baseColor = readCssColor(bodyPartColorVariable(total.bodyPartId));
  const segments =
    total.exercises && total.exercises.length > 0
      ? total.exercises.map((exercise, segmentIndex) => ({
          label: exercise.name,
          value: exercise.totalVolume,
          color: withAlpha(baseColor, segmentAlphaAt(segmentIndex)),
        }))
      : [{ label: total.name, value: total.totalVolume, color: readCssColor('--accent') }];
  return {
    key: total.bodyPartId,
    name: total.name,
    segments,
    summaryPrimary: formatVolume(total.totalVolume),
    summarySecondary: `${total.setCount}セット`,
  };
};

export const BodyPartSection = () => {
  const [rangeWeeks, setRangeWeeks] = useState(RANGE_OPTIONS[0].value);
  const todayKey = formatDateKey(new Date());
  const state = useApiData<BodyPartsResponse>(
    `/analytics/body-parts?weeks=${rangeWeeks}&today=${todayKey}`,
  );

  return (
    <Section
      title="部位別ボリューム"
      subtitle="期間内の 重量×回数 合計（積み上げは種目の内訳）"
      actions={
        <ToggleGroup options={RANGE_OPTIONS} selected={rangeWeeks} onSelect={setRangeWeeks} />
      }
    >
      <Loadable state={state}>
        {(response) => {
          if (response.bodyParts.length === 0) {
            return (
              <p className="chart-empty">
                この期間の記録がありません。期間を広げるか、アプリで記録を追加してください
              </p>
            );
          }
          return (
            <HorizontalStackedBars
              rows={response.bodyParts.map(buildRow)}
              formatValue={formatVolume}
            />
          );
        }}
      </Loadable>
    </Section>
  );
};
