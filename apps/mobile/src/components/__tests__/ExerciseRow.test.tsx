import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildExercise } from '../../test-support/factories';
import { ExerciseRow } from '../ExerciseRow';

describe('ExerciseRow', () => {
  it('種目名と添え書きを出す', () => {
    render(<ExerciseRow exercise={buildExercise()} note="3 セット" onPress={jest.fn()} />);
    expect(screen.getByText('ベンチプレス')).toBeTruthy();
    expect(screen.getByText('3 セット')).toBeTruthy();
  });

  it('添え書きが無ければ出さない', () => {
    render(<ExerciseRow exercise={buildExercise()} onPress={jest.fn()} />);
    expect(screen.queryByText('3 セット')).toBeNull();
  });

  it('タップで onPress を呼ぶ', () => {
    const onPress = jest.fn();
    render(<ExerciseRow exercise={buildExercise()} onPress={onPress} />);
    fireEvent.press(screen.getByText('ベンチプレス'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
