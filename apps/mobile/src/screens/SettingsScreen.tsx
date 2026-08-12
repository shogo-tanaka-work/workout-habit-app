import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';

// 設定タブの入口。用途ごとに分けた行を並べるだけで、中身は各画面が持つ。
//
// 以前はタイマー設定・種目マスタ・プレート計算機・CSV・同期を1画面へ積んでいた。
// 目的の違う設定が同じ高さで並ぶと、探す手がかりが位置しか無くなる。
export type SettingsRoute = 'exercises' | 'timer' | 'plates' | 'sync' | 'csv';

type MenuItem = {
  route: SettingsRoute;
  label: string;
  description: string;
};

const SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'マスタ管理',
    items: [
      {
        route: 'exercises',
        label: 'トレーニング種目',
        description: '種目の追加・休憩・バー重量・アーカイブ',
      },
    ],
  },
  {
    title: 'ツール',
    items: [
      { route: 'plates', label: 'プレート計算機', description: 'バーに付けるプレートの内訳' },
    ],
  },
  {
    title: '設定',
    items: [
      { route: 'timer', label: 'タイマー', description: '休憩終了時の音と振動' },
      { route: 'sync', label: 'クラウド同期', description: 'ログイン・バックアップ・復元' },
    ],
  },
  {
    title: 'データ',
    items: [{ route: 'csv', label: 'CSV出力', description: '対象と期間を選んで書き出す' }],
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
              key={item.label}
              style={styles.exerciseRow}
              onPress={() => onOpen(item.route)}
            >
              <View style={styles.exercisePickerRow}>
                <View style={styles.flex}>
                  <Text style={styles.exercisePickerName}>{item.label}</Text>
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
