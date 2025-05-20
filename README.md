# kawanago-jira-todo-app

## プロジェクト構成
以下のディレクトリ構成でアプリケーションを管理しています。
```plaintext
kawanago-jira-todo-app/
├── README.md      # プロジェクト概要と実装済み要件の記載
├── package.json
├── main.js        # Electron メインプロセス
├── preload.js     # レンダラープロセス向け API エクスポート
├── .env           # Jira 認証情報（APIトークン・ボードIDなど）
├── /renderer
│   ├── index.html
│   ├── renderer.js
│   └── style.css
└── /reports
    └── templates.js  # レポート出力用テンプレート
```

## プロジェクト概要
このアプリは、Electron を利用してデスクトップ上で ToDo 管理を行い、Jira と双方向でタスク連携を行うことを目的としています。

### メイン機能
- 日々の ToDo と完了済みタスク（Done）の管理
- 各タスクに対する Description（説明）と期限表示
- 新規 ToDo の追加（Description と期限を登録）
- `"Sprint取得"` ボタンで、ユーザーが調査して手動入力した Sprint ID を使ってタスクを表示
- アプリ内のタスクを Jira の Sprint に新規作成・ステータス更新
- `"ToDo"` と `"Backlog"` の 2 つの画面をボタンで切り替え（機能は同一）
- 始業時・終業時に上司用報告レポートを出力
- タブ内でのタスク追加機能
  - テキストボックスと「追加」ボタンを配置
  - Ctrl+Enter ショートカットでタスク追加可能
- タスクのドラッグ＆ドロップによる順序変更
  - 同じタブ内でタスクをドラッグして並び替え可能
- 始業時・終業時に上司用報告レポートを出力

## 実装済み要件
- プロジェクト構成の整備（Electron 主プロセス、Renderer、環境変数管理）
- Jira API 認証設定（Basic Auth: Email + API Token via `.env`）
- Agile API からの Sprint 自動取得（GET `/board/{boardId}/sprint?state=active`）
- 主な Jira エンドポイント実装  
  - スプリント内タスク取得（GET `/search?jql=sprint={sprintId}`）  
  - 課題ステータス更新（PUT `/issue/{issueId}/transitions`）  
  - 新規課題作成（POST `/issue`）  
- IPC 経由で Renderer⇔Main 間のデータ連携
- ToDo／Backlog ビュー切替ボタン UI
- ToDo のローカル保存（electron-store 連携）
- タブ内でのタスク追加（テキストボックス・追加ボタン、Ctrl+Enter ショートカット）
- タスク完了機能（チェックボックス＋取り消し線表示）
- タスクのドラッグ＆ドロップによる順序変更
- 完了タスク削除機能
- 始業報告: 未完了タスクをクリップボードへコピーし通知
- 終業報告: Jira 同期＋レポート生成

## 今後の実装予定
- UI フレームワーク導入（React + Tailwind など）
- レポートのフォーマット強化（PDF 生成、メール送信）
- 状態管理ライブラリの導入（Redux/Context）