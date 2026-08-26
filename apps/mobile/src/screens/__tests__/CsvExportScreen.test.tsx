import { fireEvent, render, screen } from '@testing-library/react-native';

import { periodStartIso } from '../../utils/datetime';
import { CsvExportScreen } from '../CsvExportScreen';

describe('CsvExportScreen', () => {
  it('既定はトレーニング記録の全期間', () => {
    const onExport = jest.fn();
    render(<CsvExportScreen onExport={onExport} />);

    expect(screen.getByText('最初の記録から今日までを出力します。')).toBeTruthy();
    fireEvent.press(screen.getByText('CSV出力'));

    expect(onExport).toHaveBeenCalledWith({ targets: ['workouts'], since: null });
  });

  it('ボディログも一緒に出せる', () => {
    const onExport = jest.fn();
    render(<CsvExportScreen onExport={onExport} />);

    fireEvent.press(screen.getByText('ボディログ'));
    fireEvent.press(screen.getByText('CSV出力'));

    expect(onExport).toHaveBeenCalledWith({
      targets: ['workouts', 'bodyLogs'],
      since: null,
    });
  });

  it('期間を選ぶと起点を渡す', () => {
    const onExport = jest.fn();
    render(<CsvExportScreen onExport={onExport} />);

    fireEvent.press(screen.getByText('3ヶ月'));
    fireEvent.press(screen.getByText('CSV出力'));

    expect(onExport).toHaveBeenCalledWith({
      targets: ['workouts'],
      since: periodStartIso(3),
    });
  });

  it('対象がゼロなら出力させず、理由を出す', () => {
    const onExport = jest.fn();
    render(<CsvExportScreen onExport={onExport} />);

    fireEvent.press(screen.getByText('トレーニング記録'));
    fireEvent.press(screen.getByText('CSV出力'));

    expect(onExport).not.toHaveBeenCalled();
    expect(screen.getByText('出力するデータを1つ以上選んでください。')).toBeTruthy();
  });
});
