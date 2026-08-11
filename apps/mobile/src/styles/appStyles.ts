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

  // タイポグラフィ
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  pageTitle: {
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
  exerciseChip: {
    width: '48%',
    minHeight: 54,
    borderWidth: hairlineWidth,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  exerciseChipText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  exerciseChipSub: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
  },
  staticChip: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: hairlineWidth,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  staticChipText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: fontSize.sm,
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
  numberField: {
    width: '48%',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderColor: colors.hairline,
    borderWidth: hairlineWidth,
    padding: spacing.sm + 1,
  },
  inputLabel: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  numberInput: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    minHeight: 34,
    flex: 1,
    padding: 0,
    textAlign: 'center',
  },
  stepButton: {
    width: 30,
    height: 30,
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
    color: colors.textFaint,
    fontWeight: '600',
    fontSize: fontSize.xs,
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
  textInput: {
    color: colors.textPrimary,
    minHeight: 46,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderColor: colors.hairline,
    borderWidth: hairlineWidth,
    paddingHorizontal: spacing.md,
  },

  // 休憩タイマー
  timerButton: {
    backgroundColor: colors.accentSurface,
    minHeight: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  doneButton: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.hairlineStrong,
  },
  timerButtonText: {
    color: colors.accentText,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
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
  restRow: {
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
  restValue: {
    color: colors.accentText,
    fontWeight: '700',
    fontSize: fontSize.md,
  },

  // モーダル
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 8, 5, 0.74)',
    justifyContent: 'flex-end',
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

  // 月間カレンダー（履歴）
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
  calendarTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
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
  calendarDayCell: {
    flex: 1,
    minHeight: 46,
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
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  calendarDotPlaceholder: {
    width: 5,
    height: 5,
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
});
