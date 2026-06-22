import { Button, Card } from './ui.js';

export default function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="px-6 py-10 text-center">
      <p className="text-sm font-semibold text-overdue">データを読み込めませんでした。</p>
      <p className="mt-1 text-xs text-text2">通信状態をご確認のうえ、もう一度お試しください。</p>
      <Button variant="outline" onClick={onRetry} className="mt-4 px-4 py-2 text-sm">
        再試行
      </Button>
    </Card>
  );
}
