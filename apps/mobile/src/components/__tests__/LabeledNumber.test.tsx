import { fireEvent, render, screen } from '@testing-library/react-native';

import { LabeledNumber } from '../LabeledNumber';

describe('LabeledNumber', () => {
  it('ラベル・値・単位を出す', () => {
    render(<LabeledNumber label="体重" value={70.5} suffix="kg" onChange={jest.fn()} />);
    expect(screen.getByText('体重')).toBeTruthy();
    expect(screen.getByDisplayValue('70.5')).toBeTruthy();
    expect(screen.getByText('kg')).toBeTruthy();
  });

  it('入力を確定したときだけ保存する', () => {
    const onChange = jest.fn();
    render(<LabeledNumber label="体重" value={70} suffix="kg" onChange={onChange} />);

    const input = screen.getByDisplayValue('70');
    fireEvent.changeText(input, '71.5');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent(input, 'endEditing');
    expect(onChange).toHaveBeenCalledWith(71.5);
  });

  it('読めない値は元の値へ戻す', () => {
    const onChange = jest.fn();
    render(<LabeledNumber label="体重" value={70} suffix="kg" onChange={onChange} />);

    const input = screen.getByDisplayValue('70');
    fireEvent.changeText(input, '--');
    fireEvent(input, 'endEditing');

    expect(onChange).toHaveBeenCalledWith(70);
  });

  it('kg の刻みは 2.5', () => {
    const onChange = jest.fn();
    render(<LabeledNumber label="重量" value={60} suffix="kg" onChange={onChange} />);

    fireEvent.press(screen.getByText('+'));

    expect(onChange).toHaveBeenCalledWith(62.5);
  });

  it('kg 以外の刻みは 1', () => {
    const onChange = jest.fn();
    render(<LabeledNumber label="回数" value={10} suffix="回" onChange={onChange} />);

    fireEvent.press(screen.getByText('+'));

    expect(onChange).toHaveBeenCalledWith(11);
  });

  it('刻みを指定できる', () => {
    const onChange = jest.fn();
    render(
      <LabeledNumber label="体重" value={70} suffix="kg" step={0.5} onChange={onChange} />,
    );

    fireEvent.press(screen.getByText('+'));

    expect(onChange).toHaveBeenCalledWith(70.5);
  });

  it('マイナス方向でも 0 より下げない', () => {
    const onChange = jest.fn();
    render(<LabeledNumber label="重量" value={1} suffix="kg" onChange={onChange} />);

    fireEvent.press(screen.getByText('-'));

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('ステッパーの結果を入力欄へ反映する', () => {
    render(<LabeledNumber label="重量" value={60} suffix="kg" onChange={jest.fn()} />);

    fireEvent.press(screen.getByText('+'));

    expect(screen.getByDisplayValue('62.5')).toBeTruthy();
  });
});
