import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';

// 設定タブの入口。用途ごとに分けた行を並べるだけで、中身は各画面が持つ。
//
// 以前はタイマー設定・種目マスタ・プレート計算機・CSV・同期を1画面へ積んでいた。
// 目的の違う設定が同じ高さで並ぶと、探す手がかりが位置しか無くなる。
export type SettingsRoute = 'exercises' | 'timer' | 'plates' | 'sync' | 'csv' | 'training';

type MenuItem = {
  route: SettingsRoute;
  /** 行の下に出す補足。表示名は SETTINGS_TITLES から引く。 */
  description: string;
};

/**
 * サブ画面の表示名。**メニュー行とヘッダーで同じ名前を使う。**
 * 別々に持っていたため、片方だけ変えると行とヘッダーで名前が食い違う状態だった。
 */
export const SETTINGS_TITLES: Record<SettingsRoute, string> = {
  exercises: 'トレーニング種目',
  plates: 'プレート計算機',
  timer: 'タイマー',
  training: 'トレーニング設定',
  sync: 'クラウド同期',
  csv: 'CSV出力',
};

const SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'マスタ管理',
    items: [
      {
        route: 'exercises',
        description: '種目の追加・休憩・バー重量・アーカイブ',
      },
    ],
  },
  {
    title: 'ツール',
    items: [{ route: 'plates', description: 'バーに付けるプレートの内訳' }],
  },
  {
    title: '設定',
    items: [
      { route: 'timer', description: '休憩終了時の音と振動' },
      { route: 'training', description: '目的・身長・メモと、今のフェーズ' },
      { route: 'sync', description: 'ログイン・バックアップ・復元' },
    ],
  },
  {
    title: 'データ',
    items: [{ route: 'csv', description: '対象と期間を選んで書き出す' }],
  },
];

export function SettingsScreen({ onOpen }: { onOpen: (route: SettingsRoute) => void }) {
  return (
    <View style={styles.stack}>
      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
          {section.items.map((item) => (
            <Pressable
              key={item.route}
              style={styles.exerciseRow}
              onPress={() => onOpen(item.route)}
            >
              <View style={styles.exercisePickerRow}>
                <View style={styles.flex}>
                  <Text style={styles.exercisePickerName}>{SETTINGS_TITLES[item.route]}</Text>
                  <Text style={styles.faint}>{item.description}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
