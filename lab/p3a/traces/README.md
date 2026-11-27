# traces：操作の記録を流す入口

ここに置いた `*.json` を、`node tools/run-trace.js` が全部読み、核に流して、**AI の作業を選んで戻したら「戻した／上書き済み／聞く」が何件になるか**を数える。

読みこむ変換は `adapter.js` の1か所だけ。形が変わったら、ここだけ直す。

## 受ける形

### ① `p3a-steps`（この試作の素直な形）
```json
{ "format": "p3a-steps", "v": 1,
  "init": { "scenes": [{ "id": "s1" }], "stages": { "art": "ai", "motion": "ai" } },
  "steps": [
    { "by": "ai", "group": "job-1", "ops": [ { "type": "node.add", "node": { … } }, … ] },
    { "by": "human", "ops": [ { "type": "pt.nudge", "node": "A", "pt": "p1", "d": [3, 0] } ] },
    { "by": "human", "undo": true },
    { "by": "human", "proposal": "pr-1", "ops": [ … ] }
  ] }
```
- `by`＝だれが送ったか（確かめられた身元として渡す）。`group`＝ひとまとめ（AI の1回の作業・1回のドラッグ）。`proposal`＝AI の提案を人が採った物。
- `ops` の中身は、核の命令の中身（`src/commands.js`）そのまま。`base`（前提の版）は、流す時に「直前の版を見ていた」ことにして付ける。

### ② `lab-p4-log`（P4 の「操作の記録」v1）
P4 のメニュー「操作の記録を書き出す」の JSON をそのまま置く。②「AI の下組み＋人」の記録は、始めの文書（下組み）が要る：
```
node tools/run-trace.js traces/p4_操作の記録_s.json --start ../p4/ai/shitagumi.json
```
（JSON の中に `"start": {…lab-p4-doc…}` と書いてもよい。）下組みは「AI の1回の作業」として入り、それを戻したときの数が出る。

**P4 の記録のままでは直せない操作**（`run-trace` が「直せず」として数える。くわしくは RESULTS.md の③）：
複製・貼り付け・反転の写し（足した部品の中身が無い）／清書・図形→自由な形（あとの点の並びが無い）／大きさ・反転（掛け算の変形）／道を閉じる／表示の切りかえ。

## 見本
- `sample-steps.json`・`sample-p4-log.json`：**手で書いた見本**（本物の操作ではない）。入口が動くことを確かめるための物。
