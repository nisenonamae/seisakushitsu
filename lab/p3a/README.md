# P3a：命令の核（Command Engine）の試作

`docs/rebuild/DATA_MODEL.md` 9節の「文書を変えるただ1つの道」を、**画面にも GitHub にも通信にも依らない部品**として作った物。
依存なし（素の ES modules。`src/` は Node の機能も使っていない）。捨ててよい試作で、本番にそのまま使うとは決めていない。

結果と、設計への提案は `RESULTS.md`。

## 試しの流し方（Node 22）

```
cd lab/p3a
node --test                      # 全部（111 個・45秒ほど。表示は 113。乱数の試しは 4つの種 × 12000 手）
node --test test/selective.test.js   # 選んで取り消す（9.5節の表）だけ
P3A_FUZZ_STEPS=40000 P3A_FUZZ_SEEDS=9 node --test test/fuzz.test.js   # 乱数の試しを長く・別の種で
node tools/measure.js 200        # 「止まって聞く」の割合を測る（種 200 通り。何回流しても同じ数字）
node tools/run-trace.js          # traces/ の操作の記録を流して数える（P4 の記録は traces/README.md）
node tools/bench.js              # 速さの目安
```
インストールする物は無い（`npm install` は要らない）。

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
