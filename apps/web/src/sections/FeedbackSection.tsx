import { Loadable } from '../components/Loadable';
import { Section } from '../components/Section';
import { useApiData } from '../hooks/useApiData';
import type { FeedbackResponse, WeeklyFeedback } from '../types/api';
import { formatDateKey, formatShortDate } from '../utils/datetime';

// AI フィードバック: Claude Code が計画立案時に書き込む週単位の振り返り（/feedback、新しい順）。
// アーカイブ形式で、最新週は展開表示、過去分は週見出しの折りたたみで残す。
//
// body はプレーンテキストとして描画する（React の自動エスケープに任せ、
// HTML として解釈しない）。改行は CSS の white-space: pre-wrap で保つ。

const FEEDBACK_MONTHS = 6;

const weekLabelOf = (feedback: WeeklyFeedback): string => `${formatShortDate(feedback.weekStart)} 週`;

export const FeedbackSection = () => {
  const todayKey = formatDateKey(new Date());
  const state = useApiData<FeedbackResponse>(
    `/feedback?months=${FEEDBACK_MONTHS}&today=${todayKey}`,
  );

  return (
    <Section title="AI フィードバック" subtitle={`直近${FEEDBACK_MONTHS}か月・週ごとの振り返り`}>
      <Loadable state={state}>
        {(response) => {
          const [latest, ...archived] = response.feedback;
          if (!latest) {
            return (
              <p className="status-text">
                まだフィードバックがありません。Claude Code の計画立案時に書き込まれます
              </p>
            );
          }
          return (
            <div>
              <article className="feedback-item">
                <h3 className="feedback-week">{weekLabelOf(latest)}</h3>
                <p className="feedback-body">{latest.body}</p>
              </article>
              {archived.map((feedback) => (
                <details key={feedback.weekStart} className="feedback-item">
                  <summary className="feedback-week">{weekLabelOf(feedback)}</summary>
                  <p className="feedback-body">{feedback.body}</p>
                </details>
              ))}
            </div>
          );
        }}
      </Loadable>
    </Section>
  );
};
