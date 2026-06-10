import { useState } from 'react';

import { bodyPartVolumes } from '../data/analytics';
import type { Dataset } from '../types/domain';
import { Section } from '../components/Section';
import { dateKeyDaysAgo } from '../utils/datetime';
import { formatVolume, safeDivide } from '../utils/number';

// 部位別ボリューム（期間切り替え付きの横バー）。

type BodyPartSectionProps = {
  dataset: Dataset;
};

const RANGE_CHOICES = [
  { label: '4週', days: 28 },
  { label: '12週', days: 84 },
  { label: '全期間', days: 36500 },
];

export const BodyPartSection = ({ dataset }: BodyPartSectionProps) => {
  const [rangeDays, setRangeDays] = useState(RANGE_CHOICES[0].days);

  const volumes = bodyPartVolumes(dataset, dateKeyDaysAgo(rangeDays));
  const maxVolume = volumes[0]?.totalVolume ?? 0;

  return (
    <Section
      title="部位別ボリューム"
      subtitle="期間内の 重量×回数 合計（ウォームアップ含む）"
      actions={
        <div className="toggle-group">
          {RANGE_CHOICES.map((choice) => (
            <button
              key={choice.days}
              type="button"
              className={choice.days === rangeDays ? 'toggle toggle-active' : 'toggle'}
              onClick={() => setRangeDays(choice.days)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      }
    >
      {volumes.length === 0 ? (
        <p className="chart-empty">期間内の記録がありません</p>
      ) : (
        <ul className="hbar-list">
          {volumes.map((volume) => (
            <li key={volume.bodyPartId} className="hbar-item">
              <span className="hbar-name">{volume.name}</span>
              <div className="hbar-track">
                <div
                  className="hbar-fill"
                  style={{ width: `${safeDivide(volume.totalVolume, maxVolume) * 100}%` }}
                />
              </div>
              <span className="hbar-value">
                {formatVolume(volume.totalVolume)}
                <span className="hbar-sets">{volume.setCount}セット</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};
