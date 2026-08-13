// 選択肢を横に並べて1つ選ばせるトグル。区画の右上（Section の actions）で使う。
//
// 同じ構造が4ファイル5か所に書かれていたため、キーボード操作や aria の対応を足すときに
// 直し漏れる状態だった。選択状態の見せ方はここだけが決める。

export type ToggleOption<T> = {
  value: T;
  label: string;
};

export const ToggleGroup = <T extends string | number>({
  options,
  selected,
  onSelect,
}: {
  options: readonly ToggleOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) => (
  <div className="toggle-group">
    {options.map((option) => {
      const isSelected = option.value === selected;
      return (
        <button
          key={option.value}
          type="button"
          className={isSelected ? 'toggle toggle-active' : 'toggle'}
          aria-pressed={isSelected}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
