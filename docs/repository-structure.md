# リポジトリ構造

## 現在の全体像

2026-09-13に静的アプリと検証用スクリプトを追加。ビルド、バックエンド、実行時パッケージ、CIはない。

```text
ハッカソン/
├── index.html
├── styles.css
├── demo-data.js
├── demo-state.js
├── app.js
├── README.md
├── tests/
│   ├── demo-state.test.cjs
│   └── browser-smoke.cjs
├── docs/
│   ├── product-requirements.md
│   ├── functional-design.md
│   ├── architecture.md
│   ├── repository-structure.md
│   ├── development-guidelines.md
│   ├── implementation-validation.md
│   └── glossary.md
└── .steering/
    ├── 20260913-setup-project/tasklist.md
    └── 20260913-implement-demo/
        ├── tasklist.md
        └── validation/  # ブラウザーテストが生成する証拠
```

Gitの管理情報 `.git/` は省略。既存の要件原文と文書整備の記録は保持する。

## 配置と責務

- `index.html`：単一画面、インラインSVGの街・アイコン、3操作の構造。CSSと通常のスクリプトを依存順で読み込む。
- `styles.css`：デスクトップ・タブレット・スマートフォンの表示、状態と車両移動、動きを減らす設定への対応。
- `demo-data.js`：架空の予定・利用者・予約・予測の加点・車両・ログ・演出時間。変更を防ぐため固定データをfreezeする。
- `demo-state.js`：DOMを参照しない初期状態・需要判定・操作ガード・状態遷移。通常スクリプトとNode.jsの両方から使用できる。
- `app.js`：DOMの描画、イベント接続、タイマーと演出完了処理。無効な遷移から副作用を発生させない。
- `README.md`：起動と体験手順、実装範囲、テスト実行、文書への入口。
- `tests/demo-state.test.cjs`：Node.js標準テストランナーで境界・全イベント経路・割り当て条件・需要集計を検証。
- `tests/browser-smoke.cjs`：開発用Playwrightでオフラインのfile://起動、操作、再読み込み、演出、キーボード、複数画面幅を検証。実行時依存ではない。

## 文書と記録

`docs/product-requirements.md` がユーザー提供原文。要件の正本として保持し、仕様の説明は機能設計・アーキテクチャ・用語集へ記載する。`development-guidelines.md` は確認手順、`implementation-validation.md` は実際の実行結果。

`.steering/` は作業ごとの判断・進捗を保存する。`validation/chrome/` と `validation/msedge/` はテストが生成するスクリーンショットと結果JSONであり、アプリの実行には不要。同じテストを再実行すると更新される。

## 依存と配布

依存方向は `HTML → 固定データ → 状態処理 → UI処理`。固定データと状態処理からDOMを参照しない。表示文言を状態の判定に使用しない。

アプリを別のPCへ持ち込む際は、ルートのHTML・CSS・JavaScript計5ファイルを同じフォルダーに置く。外部アセット・APIキー・DB・保存データはない。`tests/` と文書を持ち込む必要はない。
