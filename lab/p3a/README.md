# P3a：命令の核（Command Engine）の試作

`docs/rebuild/DATA_MODEL.md` 9節の「文書を変えるただ1つの道」を、**画面にも GitHub にも通信にも依らない部品**として作った物。
依存なし（素の ES modules。`src/` は Node の機能も使っていない）。捨ててよい試作で、本番にそのまま使うとは決めていない。

結果と、設計への提案は `RESULTS.md`。

## 試しの流し方（Node 22）

```
cd lab/p3a
node --test                      # 全部（前回は 111 個。今は 151 個・50秒ほど。乱数の試しは 4つの種 × 12000 手）
node --test test/selective.test.js   # 選んで取り消す（9.5節の表）だけ
P3A_FUZZ_STEPS=40000 P3A_FUZZ_SEEDS=9 node --test test/fuzz.test.js   # 乱数の試しを長く・別の種で
node tools/measure.js 200        # 「止まって聞く」の割合を測る（種 200 通り。何回流しても同じ数字）
node tools/run-trace.js          # traces/ の操作の記録を流して数える（P4 の記録は traces/README.md）
node tools/bench.js              # 速さの目安
```
インストールする物は無い（`npm install` は要らない）。

### 追加の測り（2026-11-28。結果は `RESULTS2.md`）

```
node --test                          # 全部（151 個・50秒ほど）
node --test test/units.test.js       # 部品ごとにまとめる取り消し（9.5節②③）・場合 1〜7・掛ける量
node tools/measure2.js 200           # 部品ごとの取り消しの測り（種 200 通り・30秒ほど。何回流しても同じ数字）
node tools/numcheck.js               # 数の検証（1/10000 の格子。20秒ほど）。最後の行が「突き合わせ用の印」
python3 tools/browser_check.py       # ブラウザ（Chromium）と Node で同じ結果かを突き合わせる（playwright が要る。ポート 8803 を一時的に使う）
```
- ブラウザで手で見るなら：`lab/p3a` を手元のサーバーで出して `tools/numcheck.html` を開く（外からは何も読みこまない・保存しない）。
- 部品ごとの取り消しの使い方：`planRevert(state, 戻す記録の id)` で計画（文書は変わらない）→ `revert` の命令を `{ type:'revert', mode:'units', targets, at, decisions?:{単位の id:'drop'}, ack?:{単位の id:[見た記録の番号…]} }` で送る。何も選ばなければ全部「残す」。
- 前の方式（`mode:'select'`。効果ごとに聞く）は、比べるために残してある。

## 入口（`src/index.js`）

| 関数 | すること |
|---|---|
| `createState(init)` | 最初の状態 `{ doc, log }` |
| `apply(state, cmd, { sender })`／`applyBatch(state, cmds, { sender })` | 当てる。**全部入るか、何も入らないか**。返す物：`{ status:'applied'｜'duplicate'｜'proposed'｜'rejected', state, applied?, reason?, outcomes? }` |
| `check(state, cmds, { sender })` | 当てずに、通るかだけ見る（選んで取り消す前の一覧も、これで先に出す）|
| `replay(init, entries)` | 記録（命令と送り主だけ）から文書を作り直す。検査を通らない命令は当てず、`skipped` に理由つきで返す |
| `toEntries(log)` | 記録を、共有する形（命令＋確かめられた送り主。効果は入れない）にする |
| 取り消し | `revert` という**命令**を `apply` に渡す：`{ type:'revert', targets:[命令の id…], decisions?, onAsk? }`。ふつうの取り消しは `makeUndo(log, 端末, 新しい id)`／`makeRedo` が作る |
| `aiRecordIds(log, 絞りこみ)` | AI 由来の記録（AI が当てた物・提案から採った物）の id |
| `checkInvariants(doc)` | 全体の決まり（破れていれば一覧）|
| `proposalStatus`・`retoken`・`danglingCues`・`analyzeExpr` | 提案が生きているか／語りのトークンの付け直し／宙に浮いた合図／式の検査 |

- `sender` は **呼び出す側が確かめた身元**（`{k:'human',device}` か `{k:'ai',agent}`）。命令の中の `actor` は名乗りで、権限には使わない。
- 核は、時計・乱数・通信・画面に触らない。元の状態を書きかえない（変える所だけ写した新しい状態を返す）。

## ファイル

```
src/
  engine.js      当てる手順（9.3節①〜⑦）・check・replay
  commands.js    命令の種類ごとの：形の版・形の検査・許しの分類・効果の作り方・古い版からの移し替え
  model.js       文書の最小の形・値（Value）の検査・番地・控え（Draft）・効果を当てる所（文書を変えるのはここだけ）
  policy.js      許しの検査（度合い・許可・固定）
  revert.js      選んで取り消す（9.5節）
  undo.js        ふつうの取り消し・やり直し（どの記録を戻すかを数える）
  invariants.js  全体の決まり（切れた参照・親子の輪・参照の輪・id の重なり）
  expr.js        式の小さな言葉の読み取りと上限
  log.js         記録（足すだけ）
  script.js      語りのトークン・宙に浮いた合図
  proposal.js    提案が生きているか
test/            node:test の試し（gen.js＝でたらめな命令を作る所、helpers.js＝小道具）
tools/           measure.js（聞く割合）・scenarios.js（操作の筋書き）・oracle.js（人の直しが残ったかを別のやり方で確かめる）・run-trace.js・bench.js
traces/          操作の記録の入口（adapter.js＝読みこむ変換は、ここ1か所）と見本
```

### 追加の測り その3（2026-11-28。結果は `RESULTS3.md`）

```
node --test                          # 全部（173 個・75秒ほど）
node --test test/scale.test.js       # 掛ける量の戻し方（revert の scale：divide／keep／rebuild）
node --test test/methods.test.js     # 部品ごとの取り消しの改善案（wide・split・node.adopt・rebaseWithout）
node tools/numcheck3.js              # 掛ける量・回す量の取り消しを、3つの方式（＋変種）で比べる（数だけの模型。30秒ほど）。最後の行が「突き合わせ用の印」
node tools/ordercheck.js             # 順番が違う時の結果を、核を通して表にする
python3 tools/browser_check.py --3   # numcheck3 を、ブラウザ（Chromium）と Node で突き合わせる（ポート 8803 を一時的に使う）
node tools/measure3.js 100           # 部品ごとの取り消しの4方式の比べ（種 100 通り・1分ほど。何回流しても同じ数字）
```
- 掛ける量の戻し方は、`revert` の命令に `scale:'divide'`（前のまま：割る。何も書かなければこれ）・`'keep'`（上に掛け算があれば残す）・`'rebuild'`（記録から組み立て直す）で選ぶ。**比べるための切り替えで、本番では1つに決める物**（すすめは `rebuild`。`RESULTS3.md` ③）。
- 部品ごとの取り消し（`mode:'units'`）に `wide:true`（同じ作業が同じ形に加えた変更も、足した点と一緒に残す）・`split:true`（足した点を1つずつに割る）。`planRevert(state, 戻す記録, { scale, wide, split })` でも同じ。
- `node.adopt`（引き取り。人だけ）：AI が足した部品を、人が自分の物として引き取る。文書の中身は変わらない。
- `tools/methods.js` の `rebaseWithout(state, 戻す記録)`：元を変えずに、「その AI の作業が無かった文書」を横に作って、残りの命令を当て直す。
