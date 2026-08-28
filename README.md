# ほしふる迷宮 — Starfall Labyrinth

星が降った夜、お城の地下にあらわれた迷宮。ランタンを手にした子どもの冒険者ルミが、どこまでも深く潜っていく——。

ブラウザで遊べる「不思議のダンジョン」系のターン制ローグライクです。ビルド・依存ライブラリなしの純 HTML / CSS / JavaScript（ES modules）で書かれています。

**▶ あそぶ: https://shinoda-yosuke.github.io/shinoda-yosuke/**

## 特徴

- 8 方向グリッド移動・ターン制（自分が動くと敵も動く）、毎回ランダム生成されるフロア
- エンドレス型: クリアはなく、最深階とスコアを競う。10 階ごとに環境（配色・出現する敵）が変わり、番人（ボス）が階段を守る
- 実（草）・ページ（巻物）・杖・矢・武器・盾のアイテム。拾う／使う／投げる／装備
- 踏むまで見えない罠（素振りで発見）、値札つきの店と激怒する店主、モンスターハウス
- 状態異常（ねむり・混乱・はやい・おそい）、ちからの増減
- 16px の自作ドット絵を Canvas に描画。おとぎ話風のオリジナルキャラクター
- 未探索の領域は星雲と流れ星が流れる「夢の宇宙」。魔法の光の粒、発光する階段、きらめくアイテム
- PC キーボード（矢印 / WASD / hjkl+yubn / テンキー、Shift でダッシュ）とスマホのタッチ操作に両対応
- 自動中断セーブ（localStorage）。ベスト記録と直近 10 回の履歴を保存

詳細な仕様は [docs/SPEC.md](docs/SPEC.md) を参照してください。

## ローカルで動かす

ES modules を使っているため `file://` では動きません。静的サーバーを起動してください。

```sh
python3 -m http.server 8000
# → http://localhost:8000/
```

## テスト

Node.js（v18 以上）で、フロア生成の検証と自動プレイのスモークテストを実行できます。ブラウザは不要です。

```sh
node tests/smoke.mjs            # 生成 400 フロア + ボット 40 ゲーム
node tests/smoke.mjs 100 6000 explore   # ゲーム数 / 最大手数 / モード(rush|explore)
```

## 構成

```
index.html          エントリ HTML
css/style.css       UI スタイル
js/main.js          アプリ本体（入力・進行・保存の結線）
js/core/            乱数・共通ユーティリティ
js/data/            モンスター・アイテム・罠・テーマの定義（データ駆動）
js/game/            ゲームロジック（生成・視界・戦闘・効果・AI・ターン・行動・状態）※DOM 非依存
js/render/          ドット絵データとレンダラ
js/ui/              DOM UI（HUD・ログ・メニュー・ダイアログ）
js/storage.js       localStorage（中断セーブ・記録）
tests/smoke.mjs     Node で動くスモークテスト
docs/SPEC.md        ゲーム仕様
```

## GitHub Pages

`main` ブランチのルートから配信しています（`.nojekyll` あり）。
