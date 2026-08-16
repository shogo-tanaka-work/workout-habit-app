// 推定1RM を画面に出す種目。
//
// **BIG3 だけ出す。** 換算表の裏付けがあるのは BIG3 で、それ以外は Epley 式の
// 一般論にすぎない。行動を変えない数字を分析の選択肢に並べない。
//
// API（`GET /analytics/*`）は全種目の推定1RM を返し続ける。Claude Code が計画を
// 立てる材料に使うため。出さないのは人が見る画面だけ。
//
// **apps/mobile/src/utils/oneRepMax.ts と同じ対象を保つ**（片方だけ変えない）。
const ONE_REP_MAX_EXERCISE_IDS = new Set(['bench-press', 'squat', 'deadlift']);

export const showsOneRepMax = (exerciseId: string): boolean =>
  ONE_REP_MAX_EXERCISE_IDS.has(exerciseId);
