import { StyleSheet } from 'react-native';

import { colors, fontSize, hairlineWidth, radius, spacing } from './theme';

// アプリ全体で共有する StyleSheet。
// 参考UI（30_research/参考画面）に合わせ、角丸カードの羅列ではなく
// ヘアライン罫線と表組みで構成するフラットなダークUIにする。
export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },

  // ヘッダー・タブ
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  appName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  headerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerBackText: {
    color: colors.accentText,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.accent,
  },
  tabText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  activeTabText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  stack: {
    gap: spacing.lg,
  },

  // ホームの上下分割（上はカレンダー固定、下だけスクロール）
  homeContent: {
    flex: 1,
    padding: spacing.md,
  },
  homeLayout: {
    flex: 1,
  },
  // カレンダーを詰めたときは下の週から隠れる。週単位でスナップさせて途中で切らない。
  homeCalendarPane: {
    flex: 1,
    overflow: 'hidden',
  },
  homeDetailScroll: {
    paddingBottom: spacing.xxl,
  },
  // 上下の配分を変えるグラバー。高さは HomeScreen の HANDLE_HEIGHT と揃える。
  dragHandle: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairlineStrong,
  },

  // タイポグラフィ
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  exerciseTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  panelText: {
    color: colors.textPrimary,
    // 本文サイズを明示する。未指定だと RN 既定の 14 になり、muted（sm）より小さく見える。
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  muted: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  faint: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
  },
  accentNote: {
    color: colors.accentText,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // セクション（罫線で囲うフラットな箱）
  section: {
    backgroundColor: colors.surface,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionHeaderText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  sectionBody: {
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // 種目行（履歴・種目管理。アクセント点＋種目名＋シェブロン）
  exerciseRow: {
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.hairline,
  },
  exerciseRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm,
  },
  exerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  exerciseRowName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  chevron: {
    color: colors.textFaint,
    fontSize: fontSize.lg,
    fontWeight: '400',
  },

  // 指標表示（主役の数値を1つ大きく＋従属指標を1行に）
  statSummary: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.hairline,
    gap: spacing.xxs,
  },
  statPrimaryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  statPrimaryValue: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statPrimaryUnit: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  statPrimaryLabel: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
  },
  statItemRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    marginTop: spacing.xs,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  statSeparator: {
    color: colors.textFaint,
    fontSize: fontSize.sm,
    paddingHorizontal: spacing.xs,
  },
  statItemLabel: {
    color: colors.textFaint,
    fontSize: fontSize.sm,
  },
  statItemValue: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // セット表（セット / 重量 / レップ数）
  setTable: {
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
  },
  setTableRow: {
    flexDirection: 'row',
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  setTableRowLast: {
    borderBottomWidth: 0,
  },
  setTableLabelCell: {
    width: 76,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRightWidth: hairlineWidth,
    borderRightColor: colors.hairline,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
  },
  setTableLabelText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  // RM 換算表のセル。列数ぶんを画面幅で割る。
  // setTableCell の固定幅（52px）だと 76 + 52×6 = 388px となり、端末幅からはみ出す。
  rmTableCell: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xxs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: hairlineWidth,
    borderRightColor: colors.hairline,
  },
  setTableCell: {
    width: 52,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: hairlineWidth,
    borderRightColor: colors.hairline,
  },
  setTableCellText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  setTableWarmupText: {
    color: colors.accentText,
  },

  // 推移グラフ
  chartCard: {
    backgroundColor: colors.surface,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
  },
  chartHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  chartTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  chartBody: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  chartCanvas: {
    height: 150,
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: hairlineWidth,
    backgroundColor: colors.hairline,
  },
  chartGridLabel: {
    position: 'absolute',
    left: 0,
    color: colors.textFaint,
    fontSize: fontSize.xs,
  },
  chartSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  chartDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  chartXLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartXLabelText: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
  },

  // ボタン
  primaryButton: {
    backgroundColor: colors.accent,
    minHeight: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    color: colors.onAccent,
    fontWeight: '800',
    fontSize: fontSize.md,
  },
  primaryButtonFlat: {
    backgroundColor: colors.accent,
    minHeight: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  secondaryButtonText: {
    color: colors.accentText,
    fontWeight: '700',
  },
  ghostButton: {
    minHeight: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  ghostButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  smallButton: {
    minHeight: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm + 2,
    borderWidth: hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  smallButtonText: {
    color: colors.accentText,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  dangerButton: {
    minHeight: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairlineWidth,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface,
  },
  dangerButtonText: {
    color: colors.danger,
    fontWeight: '700',
  },
  deleteButton: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  deleteButtonText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },

  // 種目選択チップ（記録画面の種目追加）
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  // セット入力（記録中）
  setEditor: {
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: spacing.sm + 2,
    gap: spacing.sm + 2,
  },
  completedSetTitle: {
    color: colors.accentText,
  },
  setTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  setActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // 記録中の1種目のセット表（セットを列に並べる。触るのは重量・回数・完了だけ）
  setLogRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.hairline,
  },
  setLogRowLast: {
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  setLogLabelCell: {
    width: 72,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRightWidth: hairlineWidth,
    borderRightColor: colors.hairline,
  },
  setLogLabelText: {
    color: colors.textFaint,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // 1セットぶんの列。4列までは画面幅に収まり、それ以上は横スクロールで逃がす。
  setLogCell: {
    width: 74,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    borderRightWidth: hairlineWidth,
    borderRightColor: colors.hairline,
  },
  setLogNumberText: {
    color: colors.accentText,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  setLogWarmupText: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
  },
  setLogInput: {
    flex: 1,
    minHeight: 52,
    padding: 0,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  setLogUnit: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    fontWeight: '600',
    paddingRight: spacing.xs,
  },
  setLogCheckText: {
    color: colors.textFaint,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  setLogCheckTextDone: {
    color: colors.accentText,
  },

  // シートの操作行（コピー・ウォームアップなど、1行1操作）
  sheetAction: {
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.hairline,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xxs,
  },
  sheetActionText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },

  // 種目選択の部位タブ（横スクロール）
  bodyPartTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm + 2,
  },
  bodyPartTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderColor: colors.hairlineStrong,
    borderWidth: hairlineWidth,
    borderRadius: radius.sm,
  },
  bodyPartTabText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  bodyPartTabDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // 記録中の種目名と、その下の集計・前回実績。
  // 種目選択の行と同じ大きさに揃え、汗をかいた状態でも読めるようにする。
  logExerciseName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  logExerciseSummary: {
    color: colors.textFaint,
    fontSize: fontSize.sm,
  },
  logNote: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    lineHeight: 22,
  },

  // 種目選択の行。ジムで見て押す前提で、名前を大きめに取る。
  exercisePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  exercisePickerName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },

  // 一段戻る導線（記録中の種目 → 種目選択）
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  backRowText: {
    color: colors.accentText,
    fontSize: fontSize.md,
    fontWeight: '700',
  },

  // キーボード上部のアクセサリ。decimal-pad にリターンキーが無いための「完了」だけを置く。
  keyboardAccessory: {
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceRaised,
    borderTopColor: colors.hairline,
    borderTopWidth: hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  keyboardAccessoryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  keyboardAccessoryText: {
    color: colors.accentText,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  pill: {
    borderColor: colors.hairlineStrong,
    borderWidth: hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  disabledPill: {
    opacity: 0.4,
  },
  // チェックボックス（CSV出力の対象選択など、複数選べる行）。
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: hairlineWidth,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkBoxMark: {
    color: colors.background,
    fontSize: fontSize.md,
    fontWeight: '800',
  },

  // プレート計算の結果行。ラックの前で数えるので、1枚ぶんを大きく1行に出す。
  plateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.hairline,
  },
  plateWeight: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  plateCount: {
    color: colors.accentText,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  plateTotal: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // 選択チップ（部位・休憩・期間など、モーダルや設定画面で選ぶもの）。
  // pill はタップ領域が小さく誤操作しやすいため、指で押す選択肢はこちらを使う。
  choiceChip: {
    minHeight: 44,
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: hairlineWidth,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceRaised,
  },
  choiceChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  choiceChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  // 幅いっぱいに広げる選択肢（アーカイブの切り替えなど）。
  choiceChipWide: {
    width: '100%',
  },

  activePill: {
    backgroundColor: colors.accentSurface,
    borderColor: colors.accent,
  },
  pillText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: fontSize.xs,
  },
  activePillText: {
    color: colors.accentText,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // inputGrid の中で横に並べる1枠。**幅は親のレイアウトの責務**なので numberField には持たせない
  // （持たせると、単独で置いたときも半分の幅になり数値が見切れる）。
  inputGridItem: {
    flexGrow: 1,
    flexBasis: '48%',
  },
  numberField: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderColor: colors.hairline,
    borderWidth: hairlineWidth,
    padding: spacing.sm + 1,
  },
  // 入力欄の見出し。xs だと何の入力欄か読み取れず、値だけが目に入る。
  inputLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  numberInput: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    minHeight: 44,
    flex: 1,
    padding: 0,
    textAlign: 'center',
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSurface,
    borderWidth: hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  stepButtonText: {
    color: colors.accentText,
    fontWeight: '800',
    fontSize: fontSize.md,
  },
  suffix: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  memoInput: {
    color: colors.textPrimary,
    minHeight: 42,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderColor: colors.hairline,
    borderWidth: hairlineWidth,
    paddingHorizontal: spacing.sm + 2,
    fontSize: fontSize.sm,
  },
  // 複数行の自由記述（トレーニング設定のメモ・フェーズの方針）。
  // memoInput は1行想定の高さなので、複数行だと入力中に見えている行が動く。
  noteInput: {
    color: colors.textPrimary,
    minHeight: 80,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderColor: colors.hairline,
    borderWidth: hairlineWidth,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    textAlignVertical: 'top',
  },
  textInput: {
    color: colors.textPrimary,
    // 他の入力欄（memoInput / noteInput）と同じサイズを明示する。
    // 未指定だと RN 既定の 14 になり、入力欄ごとに文字サイズが揃わない。
    fontSize: fontSize.sm,
    minHeight: 46,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderColor: colors.hairline,
    borderWidth: hairlineWidth,
    paddingHorizontal: spacing.md,
  },

  // 休憩タイマー
  timerBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm + 2,
  },
  timerFinished: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.surfaceRaised,
  },
  timerLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  timerTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: spacing.xxs,
  },
  timerTime: {
    color: colors.textPrimary,
    fontSize: fontSize.display,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timerActions: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  iconButton: {
    borderColor: colors.hairlineStrong,
    borderWidth: hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: fontSize.xs,
  },
  // ラベルと現在値を並べ、タップでピッカーを開く行。休憩秒数と実施日で共有する。
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairline,
    borderWidth: hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  settingRowValue: {
    color: colors.accentText,
    fontWeight: '700',
    fontSize: fontSize.lg,
  },
  settingRowLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },

  // モーダル
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 8, 5, 0.74)',
    justifyContent: 'flex-end',
  },
  // モーダル下部の操作列。確定操作を親指の届く右側へ寄せる。
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    borderColor: colors.hairline,
    borderWidth: hairlineWidth,
    padding: spacing.lg + 2,
    gap: spacing.md,
  },
  // 画面中央に出すポップアップ（休憩タイマーなど、その場で決める設定）。
  // 下から出るシートと違い、記録の文脈を隠しすぎない大きさに留める。
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 8, 5, 0.74)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  dialogCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.hairline,
    borderWidth: hairlineWidth,
    padding: spacing.lg + 2,
    gap: spacing.md,
  },

  // 共通タイマーのプリセット（最大3件）＋増減ボタン
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  presetChips: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  presetChip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: hairlineWidth,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceRaised,
  },
  presetChipActive: {
    backgroundColor: colors.accentSurface,
    borderColor: colors.accent,
  },
  presetChipText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  presetChipTextActive: {
    color: colors.accentText,
  },
  presetIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  presetIconButtonDisabled: {
    opacity: 0.35,
  },
  presetIconText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  picker: {
    flex: 1,
    color: colors.textPrimary,
  },
  pickerItem: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
  },
  pickerUnit: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: fontSize.md,
  },

  // 期間切り替えセグメント（種目詳細）
  segmentRow: {
    flexDirection: 'row',
    borderWidth: hairlineWidth,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: hairlineWidth,
    borderRightColor: colors.hairlineStrong,
  },
  segmentLast: {
    borderRightWidth: 0,
  },
  segmentActive: {
    backgroundColor: colors.accentSurface,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.accentText,
    fontWeight: '700',
  },

  // 月間カレンダー（ホーム）
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  calendarNavButton: {
    minWidth: 44,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavText: {
    color: colors.accentText,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  // 年月はタップで日付選択（離れた月へ一度で飛ぶ）。押せることを ▾ で示す。
  calendarTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  calendarTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  calendarTitleCaret: {
    color: colors.accentText,
    fontSize: fontSize.sm,
  },
  calendarWeekdayRow: {
    flexDirection: 'row',
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  calendarWeekdayText: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: spacing.xs + 2,
    color: colors.textFaint,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  calendarHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  calendarDayCell: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    borderRightWidth: hairlineWidth,
    borderRightColor: colors.hairline,
  },
  calendarDayCellLast: {
    borderRightWidth: 0,
  },
  calendarDaySelected: {
    backgroundColor: colors.accentSurface,
  },
  calendarDayText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
  },
  calendarSaturdayText: {
    color: colors.chartSecondary,
  },
  calendarSundayText: {
    color: colors.danger,
  },
  calendarTodayText: {
    color: colors.accentText,
    fontWeight: '700',
  },
  // 日セルのマーク列。マークが無い日も高さを確保して、セルの高さを揃える。
  calendarMarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: 15,
  },
  // 「部位色 × その日の種目数」のマーク。実績は塗り、予定だけの日は輪郭で描く。
  // 3つ並べても日セルの幅（画面幅 ÷ 7）に収まる大きさに留める。
  calendarMark: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMarkText: {
    color: colors.onAccent,
    fontSize: fontSize.xs,
    lineHeight: 15,
    fontWeight: '700',
  },
  calendarMarkOverflow: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },

  // 日付選択シートの月グリッド（罫線は引かず、余白と選択色だけで区切る）
  datePickerWeekRow: {
    flexDirection: 'row',
  },
  datePickerDayCell: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerDayCellSelected: {
    backgroundColor: colors.accentSurfaceStrong,
    borderRadius: radius.sm,
  },
  datePickerDayTextSelected: {
    color: colors.textPrimary,
    fontWeight: '700',
  },

  // 部位別ボリュームバー（ホーム）
  bodyPartRow: {
    gap: spacing.xs + 2,
  },
  bodyPartBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  bodyPartBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },

  // ホームの主操作ボタン（右下固定）。実際に画面手前へ浮くので影を許す。
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  fabText: {
    color: colors.onAccent,
    fontSize: fontSize.display,
    lineHeight: 30,
    fontWeight: '700',
  },
});
