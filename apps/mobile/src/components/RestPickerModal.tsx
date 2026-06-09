import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';

export function RestPickerModal({
  value,
  onConfirm,
  onCancel,
}: {
  value: number;
  onConfirm: (seconds: number) => void;
  onCancel: () => void;
}) {
  const [minutes, setMinutes] = useState(Math.floor(value / 60));
  const [seconds, setSeconds] = useState(Math.round((value % 60) / 5) * 5);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.sectionTitle}>休憩タイマー</Text>
          <Text style={styles.muted}>セット完了後に使う休憩時間です。</Text>
          <View style={styles.pickerRow}>
            <Picker
              selectedValue={minutes}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              onValueChange={(next) => setMinutes(Number(next))}
            >
              {Array.from({ length: 16 }, (_, index) => index).map((minute) => (
                <Picker.Item
                  key={minute}
                  label={`${minute}`}
                  value={minute}
                  color={colors.textPrimary}
                />
              ))}
            </Picker>
            <Text style={styles.pickerUnit}>分</Text>
            <Picker
              selectedValue={seconds}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              onValueChange={(next) => setSeconds(Number(next))}
            >
              {Array.from({ length: 12 }, (_, index) => index * 5).map((second) => (
                <Picker.Item
                  key={second}
                  label={`${second.toString().padStart(2, '0')}`}
                  value={second}
                  color={colors.textPrimary}
                />
              ))}
            </Picker>
            <Text style={styles.pickerUnit}>秒</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.ghostButton} onPress={onCancel}>
              <Text style={styles.ghostButtonText}>キャンセル</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButtonFlat}
              onPress={() => onConfirm(minutes * 60 + seconds)}
            >
              <Text style={styles.primaryButtonText}>決定</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
