# 予測配置型オンデマンド交通システム

**呼ぶ、その前に。**

移動需要を予測して車両を周辺へ配置し、外出が確定してから利用者に割り当てる。約30秒で中核体験を伝える、1画面のハッカソンMVPです。

## 起動

このフォルダーの **[index.html](index.html) をChromeまたはEdgeで開いてください**。ダブルクリック、またはブラウザーの「ファイルを開く」から起動できます。

- インストール、ビルド、APIキー、ネット接続は不要です。
- `index.html`、`styles.css`、`demo-data.js`、`demo-state.js`、`app.js` を同じフォルダーに置いてください。
- 再体験するにはページを再読み込みします。予測・配車・ログは保存されません。

静的サーバーでのプレビューも可能です。Pythonがある環境では、プロジェクトのフォルダーから `python -m http.server 8765 --bind 127.0.0.1` を実行し、[ローカルプレビュー](http://127.0.0.1:8765/)を開きます。終了はターミナルでCtrl+C。

## 体験の流れ

1. **AI予測を実行**：10:00の通院予定から、09:28の出発と移動確率82%を予測。車両が自宅周辺へ先回りします。山田さんへの割り当てはまだありません。
2. **外出を検知**：外出の兆候を疑似的に発生させ、確率を98%に更新。移動需要が確定します。
3. **配車確定**：近くのVehicle-03を山田さんに割り当て、到着後に「呼んでいない。でも、もう来ている。」を表示します。

ボタンを押すのはデモ操作者です。山田さん自身の予約・配車操作を表すものではありません。移動中と順序外の操作は無効です。キーボードのTabで操作へ移動し、EnterまたはSpaceで実行できます。

## 実装範囲

要件第33章のMust全項目に加え、第34章のShould（予約需要、需要スコア、8件の判断ログ、予測理由、車両アニメーション）を実装しています。

デモ状態は `INITIAL → PREDICTED → POSITIONING → CONFIRMED → ASSIGNED` の5つ。予測結果を300ms表示した後、自動で周辺配置を開始します。車両の移動は各1.6秒で、OSの「動きを減らす」設定にも対応します。

予約1.00と予測0.82の合計1.82は「予測配置時点の需要」です。現在の確率が98%になった後も集計時点を区別して保持します。ログの時計・ETAは固定のデモ値です。

実AI、カレンダー・地図・GPS連携、認証、データベース、予約/即時配車フォーム、複数車両最適化は対象外です。モード紹介は静的表示です。

## 検証

Node.js標準テストランナー（追加パッケージ不要）：

```powershell
node --test tests/demo-state.test.cjs
```

需要ステータスの境界値、5状態と未割り当て条件、不正順序・連打、全イベント経路、需要集計の保持を5件のテストで確認します。

ブラウザー検証には開発用のPlaywrightを使用します。アプリ自体には依存しません。この作業環境ではCodex同梱ランタイムを使い、次の手順を実行済みです。

```powershell
$env:NODE_PATH = 'C:\Users\fjmy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node tests/browser-smoke.cjs
$env:BROWSER_CHANNEL = 'msedge'
node tests/browser-smoke.cjs
```

別の環境では、利用可能なPlaywrightの配置に合わせて`NODE_PATH`を設定し、ChromeまたはEdgeを用意してください。結果JSONとスクリーンショットは `.steering/20260913-implement-demo/validation/` に生成されます。

詳細な確認結果・ブラウザーの版・未検証事項は[実装検証記録](docs/implementation-validation.md)を参照してください。会場端末での確認と初見の審査員役による理解確認は未実施です。

## 文書

- [要件定義書](docs/product-requirements.md)：Must・Should・対象外と受け入れ条件の基準。提供原文を保持。
- [機能設計書](docs/functional-design.md)：画面、5状態、3操作、データ契約。
- [アーキテクチャ](docs/architecture.md)：外部サービスに依存しない構成。
- [リポジトリ構造](docs/repository-structure.md)：ファイルの配置と責務。
- [開発ガイドライン](docs/development-guidelines.md)：変更時の規約と検証手順。
- [用語集](docs/glossary.md)：予測配置と確定配車、需要と車両状態の区別。
- [今回の作業記録](.steering/20260913-implement-demo/tasklist.md)：実装の判断と進捗。
