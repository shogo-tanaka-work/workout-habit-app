import { useState } from 'react';

import { Loadable } from '../components/Loadable';
import { Section } from '../components/Section';
import { useApiData } from '../hooks/useApiData';
import type { BodyPartsResponse } from '../types/api';
import { formatDateKey } from '../utils/datetime';
import { formatVolume, safeDivide } from '../utils/number';

// 部位別ボリューム。/analytics/body-parts の週単位集計を期間で合算して横バー表示する。

const RANGE_CHOICES = [
  { label: '4週', weeks: 4 },
  { label: '12週', weeks: 12 },
  { label: '52週', weeks: 52 }, // API の weeks 上限（53）の範囲内
];

type BodyPartTotal = {
  bodyPartId: string;
  name: string;
  setCount: number;
  totalVolume: number;
};

const sumByBodyPart = (response: BodyPartsResponse): BodyPartTotal[] => {
  const totalByBodyPartId = new Map<string, BodyPartTotal>();
  for (const week of response.weeks) {
    for (const part of week.bodyParts) {
      const total = totalByBodyPartId.get(part.bodyPartId) ?? {
        bodyPartId: part.bodyPartId,
        name: part.name,
        setCount: 0,
        totalVolume: 0,
      };
      total.setCount += part.setCount;
      total.totalVolume += part.totalVolume;
      totalByBodyPartId.set(part.bodyPartId, total);
    }
  }
  return [...totalByBodyPartId.values()].sort((a, b) => b.totalVolume - a.totalVolume);
};

export const BodyPartSection = () => {
  const [rangeWeeks, setRangeWeeks] = useState(RANGE_CHOICES[0].weeks);
  const todayKey = formatDateKey(new Date());
  const state = useApiData<BodyPartsResponse>(
    `/analytics/body-parts?weeks=${rangeWeeks}&today=${todayKey}`,
  );

  return (
    <Section
      title="部位別ボリューム"
      subtitle="期間内の 重量×回数 合計"
      actions={
        <div className="toggle-group">
          {RANGE_CHOICES.map((choice) => (
            <button
              key={choice.weeks}
              type="button"
              className={choice.weeks === rangeWeeks ? 'toggle toggle-active' : 'toggle'}
              onClick={() => setRangeWeeks(choice.weeks)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      }
    >
      <Loadable state={state}>
        {(response) => {
          const totals = sumByBodyPart(response);
          const maxVolume = totals[0]?.totalVolume ?? 0;
          if (totals.length === 0) {
            return <p className="chart-empty">期間内の記録がありません</p>;
          }
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
