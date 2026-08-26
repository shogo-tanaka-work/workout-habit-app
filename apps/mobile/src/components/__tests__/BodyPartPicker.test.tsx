import { fireEvent, render, screen } from '@testing-library/react-native';

import { buildBodyPart } from '../../test-support/factories';
import { BodyPartPicker } from '../BodyPartPicker';

const bodyParts = [buildBodyPart(), buildBodyPart({ id: 'legs', name: '脚', orderIndex: 2 })];

describe('BodyPartPicker', () => {
  it('部位を選べる', () => {
    const onSelect = jest.fn();
    render(<BodyPartPicker bodyParts={bodyParts} selectedId="chest" onSelect={onSelect} />);

    fireEvent.press(screen.getByText('脚'));

    expect(onSelect).toHaveBeenCalledWith('legs');
  });

  it('無効のときは選ばせない', () => {
    const onSelect = jest.fn();
    render(<BodyPartPicker bodyParts={bodyParts} selectedId="chest" onSelect={onSelect} disabled />);

    fireEvent.press(screen.getByText('脚'));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
