import { useApiData } from '../hooks/useApiData';
import type { MeResponse } from '../types/api';

// 誰として見ているかの表示。
//
// この画面が返すのは**常に本人のデータ**（API 側の行スコープ）。
// 複数人が同じ URL を共有するため、「今どのアカウントで見ているか」が分からないと
// 数字が誰のものか判断できない。ロールは admin と member で運用が変わるので併記する。
//
// 取得に失敗しても画面は壊さない。表示を消すだけで、分析は独立して動く。

const ROLE_LABEL: Record<MeResponse['role'], string> = {
  admin: '管理者',
  member: 'メンバー',
};

export const Viewer = () => {
  const { data } = useApiData<MeResponse>('/me');
  if (!data) {
    return null;
  }
  return (
    <span className="viewer">
      <span className="viewer-name">{data.displayName}</span>
      <span className="viewer-role">{ROLE_LABEL[data.role]}</span>
    </span>
  );
};
