import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { bodyPartColor } from '../styles/theme';
import type { BodyPart } from '../types/domain';

// 部位の選択。種目の新規登録と編集の両方で使う。
//
// Picker（ホイール）ではなくチップにしているのは、部位が5件程度で
// 全部を一度に見せられるため。開く操作を挟まずに選べる。
//
// 色ドットを付けるのは、記録・履歴の一覧が同じ色で部位を示しているため。
// 選ぶ場所と見る場所で手がかりが変わらないようにする。

export function BodyPartPicker({
  bodyParts,
  selectedId,
  onSelect,
  disabled,
}: {
  bodyParts: BodyPart[];
  selectedId: string;
  onSelect: (bodyPartId: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.chipWrap}>
      {bodyParts.map((bodyPart) => {
        const isSelected = bodyPart.id === selectedId;
        return (
          <Pressable
            key={bodyPart.id}
            style={[
              styles.choiceChip,
              isSelected && styles.activePill,
              disabled && styles.disabledPill,
            ]}
            disabled={disabled}
            onPress={() => onSelect(bodyPart.id)}
          >
            <View style={[styles.choiceChipDot, { backgroundColor: bodyPartColor(bodyPart.id) }]} />
            <Text style={[styles.choiceChipText, isSelected && styles.activePillText]}>
              {bodyPart.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
