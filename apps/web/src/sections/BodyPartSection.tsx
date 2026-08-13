import { useState } from 'react';

import { Loadable } from '../components/Loadable';
import { Section } from '../components/Section';
import { useApiData } from '../hooks/useApiData';
import type { ToggleOption } from '../components/ToggleGroup';
import { ToggleGroup } from '../components/ToggleGroup';
import type { BodyPartsResponse } from '../types/api';
import { formatDateKey } from '../utils/datetime';
import { formatVolume, safeDivide } from '../utils/number';

// 部位別ボリューム。/analytics/body-parts が返す期間合計（ボリューム降順）を横バー表示する。
// 期間の合算は API 側の責務（集計をクライアントで再実装しない）。

const RANGE_OPTIONS: readonly ToggleOption<number>[] = [
  { value: 4, label: '4週' },
  { value: 12, label: '12週' },
  { value: 52, label: '52週' }, // API の weeks 上限（53）の範囲内
];

export const BodyPartSection = () => {
  const [rangeWeeks, setRangeWeeks] = useState(RANGE_OPTIONS[0].value);
  const todayKey = formatDateKey(new Date());
  const state = useApiData<BodyPartsResponse>(
    `/analytics/body-parts?weeks=${rangeWeeks}&today=${todayKey}`,
  );

  return (
    <Section
      title="部位別ボリューム"
      subtitle="期間内の 重量×回数 合計"
      actions={
        <ToggleGroup options={RANGE_OPTIONS} selected={rangeWeeks} onSelect={setRangeWeeks} />
      }
    >
      <Loadable state={state}>
        {(response) => {
          const totals = response.bodyParts;
          if (totals.length === 0) {
            return (
              <p className="chart-empty">
                この期間の記録がありません。期間を広げるか、アプリで記録を追加してください
              </p>
            );
          }
          // API がボリューム降順で返すので先頭が最大。バーの幅はこれを 100% とする。
          const maxVolume = totals[0].totalVolume;
          return (
            <ul className="hbar-list">
              {totals.map((total) => (
                <li key={total.bodyPartId} className="hbar-item">
                  <span className="hbar-name">{total.name}</span>
                  <div className="hbar-track">
                    <div
                      className="hbar-fill"
                      style={{ width: `${safeDivide(total.totalVolume, maxVolume) * 100}%` }}
                    />
                  </div>
                  <span className="hbar-value">
                    {formatVolume(total.totalVolume)}
                    <span className="hbar-sets">{total.setCount}セット</span>
                  </span>
                </li>
              ))}
            </ul>
          );
        }}
      </Loadable>
    </Section>
  );
};
