/**
 * 衝突解決（純粋関数）。  [担当: Sub C — SYNC]
 *
 * Last-write-wins を updated_at（UTC ISO 文字列の辞書順 = 時刻順）で判定する。
 * タイムスタンプが同値、または op が競合する場合の優先度は 削除 > 更新 > 作成。
 *
 * この関数は副作用を持たず、DBに触れない。index.ts の push 適用ロジックと
 * conflict.test.ts の双方から利用される。
 */

export type SyncOp = 'create' | 'update' | 'delete';

/** 衝突判定に必要な最小限の入力（テーブルや列には依存しない）。 */
export interface IncomingEvent {
  op: SyncOp;
  /** クライアントが主張する更新時刻（ISO文字列）。未指定なら常に「新しい」とみなす。 */
  updated_at?: string | null;
}

/** サーバ側の現行行の最小限の状態。存在しなければ undefined を渡す。 */
export interface ExistingRow {
  updated_at?: string | null;
  /** ソフトデリート済みなら ISO文字列。未削除なら null/undefined。 */
  deleted_at?: string | null;
}

export type Resolution = 'apply-create' | 'apply-update' | 'apply-delete' | 'skip';

/**
 * incoming イベントを existing（現行サーバ行 or undefined）に対して適用すべきか決める。
 *
 * ルール:
 *  - 行が存在しない:
 *      delete  → skip（消すものが無い）
 *      create/update → apply-create（新規作成として反映）
 *  - 行が存在する:
 *      delete  → 既に削除済みなら skip、そうでなければ apply-delete（削除は LWW で勝ちやすい）
 *      create/update:
 *         incoming.updated_at < existing.updated_at → skip（古いので捨てる）
 *         それ以外（新しい or 同値）→ apply-update（create が来ても update に畳む）
 *
 * 優先度（削除 > 更新 > 作成）はタイムスタンプ同値時に効く:
 *  - delete は同値でも勝つ（上の delete 分岐で常に apply-delete）。
 *  - create/update が同値の場合は反映する（>= 扱い）ことで最後の書き込みを採用。
 */
export function resolve(incoming: IncomingEvent, existing?: ExistingRow): Resolution {
  if (!existing) {
    if (incoming.op === 'delete') return 'skip';
    return 'apply-create';
  }

  if (incoming.op === 'delete') {
    return existing.deleted_at ? 'skip' : 'apply-delete';
  }

  // create / update に対する LWW 判定。
  if (isOlder(incoming.updated_at, existing.updated_at)) {
    return 'skip';
  }
  return 'apply-update';
}

/**
 * a が b より「古い」か。a が未指定なら新しい扱い(false)。b が未指定なら古くない(false)。
 * UTC ISO 文字列は辞書順が時刻順なので文字列比較で十分。
 */
function isOlder(a?: string | null, b?: string | null): boolean {
  if (a == null) return false;
  if (b == null) return false;
  return a < b;
}
