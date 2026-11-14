# 図解の部品集（tools/vis）

`scenes.make(spec, dur, out, repo)` に、部品の指定 `spec`（`{"t": 部品の名前, ...}`）を渡すと、`dur` 秒の 1280×720・30fps の mp4 を作る。
動きが先に終わったら、最後の絵で止めて `dur` 秒まで伸ばす。肉付けの各段の `scene` にこの `spec` を書いておくと、`tools/make_scenes.py` が全段の画面を作る。

| 部品 `t` | 使いどころ | 主な指定 |
|---|---|---|
| `photo` | 実物の写真にゆっくり寄る | `src`（Commons のページ URL か、データのリポジトリ内のパス）, `ticks`（true＝等間隔の目盛り／"fadeout"）, `text`, `text_at`, `zoom`, `fadein` |
| `bigtext` | 問い・大きな一言 | `text`, `sub`, `flash`（"gauge8"＝最後に速度計を一瞬） |
| `map` | 世界地図で国を塗る → 写真へ | `highlight`（国の ISO3 の並び）, `labels`（{ISO3: 文字}）, `photo`, `photo_at`, `photo_text` |
| `cards` | 札が並ぶ／落ちて一部だけ残る | `groups`（札の行の並び）, `keep`（残す札）, `keep_at`, `title` |
| `steps` | 箇条を一つずつ点灯 | `title`, `items` |
| `loop` | 原因と結果がぐるぐる回る輪 | `labels`（3つ） |
| `graph` | 2本の費用の線と分かれ目 | （今は舗装／未舗装の形だけ） |
| `circle` | 真上から見た円い砂の道 | `mode`："mather"（手押し→モーター）／"2007"（回転台・周の数）／"speed"（速度計と道。車の時速8km） |
| `section` | 横から見た道の断面 | `mode`："force"（力のむら）／"bounce"（跳ねて押す）／"grow"（台数と波の育ち）／"arc"（速さと間隔）／"migrate"（波が進む）／"heavy"（軽い・重い）／"dilemma"（遅い・速い車）／"swap"（米粒・板）／"japan"（土が縮む・揺れる車） |

## 決まり
- 画面の文字は大事な言葉と数字だけ。同じものを縦に並べない（作り手の直しから）
- 写真は `assets` のうち点検で「使う」になったものを使う。点検前のものを使ったら、動画の result に書く
- Wikimedia の写真はサムネイルの決まった幅（1920・1280・960・500）でしか取れない（`commons_img` が選ぶ）。続けて取ると 429 になるので、`fetch` は待って取り直す
- 題材ごとの新しい見せ方は、`section` の `mode` のように部品の中に足すか、新しい部品として足す。足したらこの表に一行書く
