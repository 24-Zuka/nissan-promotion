import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui.js';

interface State {
  failed: boolean;
}

export default class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // 顧客情報を含む可能性があるため、例外内容はログへ出さない。
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-[14px] bg-ink text-2xl font-bold text-on-ink">D</div>
        <h1 className="mt-5 text-xl font-semibold text-ink">画面を表示できませんでした</h1>
        <p className="mt-2 text-sm text-text2">入力済みのデータは端末に保持されています。画面を再読み込みしてください。</p>
        <Button onClick={() => window.location.reload()} className="mt-5">再読み込み</Button>
      </main>
    );
  }
}
