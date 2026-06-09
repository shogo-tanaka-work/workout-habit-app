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
    paddingBottom: 40,
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

  // 統計ストリップ（縦罫線区切りのラベル＋値）
  statStrip: {
    flexDirection: 'row',
    borderTopWidth: hairlineWidth,
    borderTopColor: colors.hairline,
  },
  statCell: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: hairlineWidth,
    borderRightColor: colors.hairline,
    gap: 2,
  },
  statCellLast: {
    borderRightWidth: 0,
  },
  statLabel: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '700',
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
    color: '#1f1408',
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
    gap: 2,
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
  pill: {
    borderColor: colors.hairlineStrong,
    borderWidth: hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
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
    marginTop: 2,
  },
  timerTime: {
    color: colors.textPrimary,
    fontSize: 26,
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
});
