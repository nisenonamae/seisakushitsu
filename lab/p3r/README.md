# P3r：記録から組み立て直す取り消し（独立した試作）

`lab/p3a`（命令の核）を写して、**掛ける量の取り消しを「記録から組み立て直す」だけにした**核と、その保存・読みこみ・立ち直り・だれの物かの情報を足した試作。
依存なし（素の ES modules。`src/` は Node の機能を使っていない）。画面も通信も無い。**捨ててよい試作で、どれも採用決定ではない。** 結果は `RESULTS.md`、指示は `BRIEF.md`。

## 流し方（Node 22。インストールする物は無い）

```
cd lab/p3r
node --test                          # 全部（182 個・1〜1.5 分。取り消し ⇄ やり直し 2 万回を含む）
node --test test/journal.test.js     # 保存して読みこむ・写し・途中で失敗した場合の立ち直り
node --test test/loop.test.js        # 取り消し・やり直しのくり返し（P3R_LOOPS=50000 で回数を変えられる）
node --test test/owner.test.js       # だれの物か・引き取り
node tools/cases.js 100              # 部品ごとの取り消しの暫定の仕様を、場合 1〜7 で通す（種 100 通り・10 秒）→ results/cases.txt
node tools/xcheck.js                 # 端末をまたいだ一致（Node だけ・10 秒）
python3 tools/browser_check.py       # 同じ確かめを Chromium でも流して突き合わせる（playwright が要る。ポート 8810 を一時的に使う）→ results/browser_check.txt
node --expose-gc tools/bench.js 100000 300 spread     # 速さと大きさ：記録の件数・部品の数・spread（ばらけた操作）か hot（1つの値の道に集中）
sh tools/bench_all.sh                # 全部の組（1 時間ほど。メモリ 7GB）→ results/bench.jsonl
node tools/bench_table.js            # results/bench.jsonl を表にする
```
- ブラウザで手で見るなら：`lab/p3r` を手元のサーバーで出して `tools/xcheck.html` を開く（外からは何も読みこまない・保存しない）。
- 一時ファイルは `/tmp/p3r/`。

## 入口（`src/index.js`。`lab/p3a` の入口に足した物だけ）

| 関数 | すること |
|---|---|
| `toJournal(log, {full})`・`journalLine` | 記録を、1行＝1まとまりの文字にする（印の鎖つき）。`full` で効果つき |
| `readJournal(text)`・`repairJournal` | 記録を読む。壊れた行・重なった行・抜けを見分けて、使える所までを返す／きれいに書き直す |
| `makeSnapshot`・`readSnapshot`・`snapshotFits` | 写しを作る・読む（切れた写し・壊れた写しは null）・この記録の上の写しか |
| `open(init, journal, [写し…], {verify, mode})` | 開く時の決まり：写しが使えれば使い、だめなら記録だけから作り直す |
| `loadReplay`・`loadTrusted`・`loadTail`・`loadIndexed`・`hydrate` | 読みこみ方4つと、古い記録の読み足し |
| `makeInbox(init)` | 行がばらばらの順で届いても、番号の順に当てる受け口 |
| `whoOf`・`ownerOf`・`creatorOf`・`makerOf`・`buildProvenance`・`originOf`・`bundles`・`ledger` | だれの物か（5つの情報）|
| `docHash`・`sha256`・`hash64` | 文書の印（SHA-256）・行の鎖の印 |
| 取り消し | `revert` の命令は前と同じ。**掛ける量は、いつも記録から組み立て直す**（`scale` の切り替えは無い）。`mode:'units'` は、同じ形への変更も一緒に残す（`wide:false` で前の形。比べるためだけ）|
| 引き取り | `{ type:'node.adopt', node }`（人だけ・AI の部品だけ）。効果は `own`＝帳簿だけ（文書の中身は変わらない）|
| 断りの札 | `needs-history` を足した：写しから始めた端末で、写しより前の記録が要る時 |

## ファイル

```
src/        lab/p3a/src（コミット c040126）を写して直した物 ＋ 新しく書いた hash.js・journal.js・owner.js
test/       lab/p3a/test を写した物（既定の変更に合わせて直した）＋ journal・loop・owner・cases の4つ
tools/      bench.js・bench_all.sh・bench_table.js（速さと大きさ）／cases.js（場合 1〜7）／xcheck.js・xcheck.html・browser_check.py（端末をまたいだ一致）／fuzz.js（でたらめな記録）
            scenarios.js・scenarios2.js・methods.js・provenance.js・oracle.js・numcheck3.js は lab/p3a/tools を写した物
results/    測りの生の出力
```
どのファイルを写して、どこを変えたかは `RESULTS.md` ①。
