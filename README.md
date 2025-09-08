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
- タブ内でのタスク追加機能
  - テキストボックスと「追加」ボタンを配置
  - Ctrl+Enter ショートカットでタスク追加可能
    - Ctrl+1+Enter で MustOne に追加
    - Ctrl+2+Enter で Medium に追加
    - Ctrl+3+Enter で Small に追加
- タスクのドラッグ＆ドロップによる順序変更
  - 同じタブ内でタスクをドラッグして並び替え可能
- タスク名編集
  - タスク名を ダブルクリック して直接編集可能
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
- ToDo セクション管理
  - 4つのセクション：
    1. マストワン（最大1件）
    1. 中（最大3件）
    1. 小（最大5件）
    1. その他（無制限）
  - 初期追加は「その他」へ
  - ドラッグ＆ドロップ でセクション間移動・同セクション内並び替え
  - 各セクションの容量を超える移動はブロックし通知
- Backlog セクション（従来どおり）
- ToDo のローカル保存（electron-store 連携）
- タブ内でのタスク追加（テキストボックス・追加ボタン、Ctrl+Enter / Ctrl+1+Enter / Ctrl+2+Enter / Ctrl+3+Enter ショートカット）
- タスク完了機能（チェックボックス＋取り消し線表示）
- タスクのドラッグ＆ドロップによる順序変更
- 完了タスク削除機能
- 始業報告:
  - 未完了タスクを <マストワン>, <中>, <小> の各セクションごとにテンプレート化
  - 該当タスクがないセクションはスキップ
  - その他セクションは含めない
- 終業報告:
  - <完了> と <継続> のセクションに分けてクリップボードにレポートをコピー
  - テンプレート
  - <完了>
  - 完了タスク1
  - 完了タスク2
  - <継続>
  - 未完了タスク1
  - 未完了タスク2
- ToDoとBacklogの移動ができる

## デザインコンセプト
- ニューモーフィズム
- メインカラー：青
- 強調用に青と相性の良い淡いグラデーションを使用

## UI配置
- Row1（上部）
  - ToDo ボタン（ToDo）
  - Backlog ボタン（Backlog）
  - 通知領域（エラー・完了メッセージ用）
- Row2
  - タスク追加テキストボックス（Placeholder: New Task）
  - 追加ボタン（Add）
- Row3
  - セクション：
    - MustOne（Max 1）
    - Medium – Max 3
    - Small – Max 5
    - Other（無制限）
  - エリア内スクロール可能
- Row4
  - Sprint取得ボタン（アイコン: 🗂️）
    - クリックで Sprint ID 入力欄表示（Placeholder: Your Sprint ID）
    - 「Add」でタスク取得
  - 完了タスク削除ボタン（アイコン: 🗑️）
- Row5
  - 始業報告ボタン（Start Work）
  - 就業報告ボタン（Finish Work）

## 今後の実装予定
- UI
  - ToDoとBacklogのタスクの幅を合わせる
  - Sprint ID入力ボタンをもう一度クリックすると隠れる
  - タスクの入力箇所の横幅調節
  - Notificationの表示改善
  - チェックボックスのCSSアップデート
- Jira連携機能
  - BacklogからEpicを作成することができる
  - BacklogからTaskを作成することができる
- 実績確認機能
  - ToDoAppで完了したToDoの実績を記録できる
    - Jira上で見られるのが良い
- タスクの詳細（Description/Label/親Epic etc.）
  - マストワンタスクのLabelをつけることができる
  - PJ名/Epic名のLabelをつけることができる ※優先度Low
- 状態管理ライブラリの導入（Redux/Context）
  - 微改善
    - ショートカットキーの充実