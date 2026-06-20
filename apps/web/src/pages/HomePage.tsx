/**
 * ホーム（今日やること）。  [担当: Sub D — UI / 仕様3.1]
 * - api.listTasks({status:'open'}) を取得し、shared の compareHomeTasks / bucketFor で
 *   期限切れ(赤)→今日(橙)→近日(青) に分類。各バケット内はランクA優先・期限昇順。
 * - ワンタップ完了: api.completeTask(id)（楽観更新 → invalidate）。
 * - 下部 or ヘッダに 顧客一覧/設定 への導線。
 */
export default function HomePage() {
  return <div className="p-6">HomePage — [Sub D 実装予定]</div>;
}
