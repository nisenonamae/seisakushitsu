# 頼みごとの片づけ（Claude が毎時実行する手順）

制作室アプリの「頼みごと」（要約・題材探し・台本づくり・台本の直し）を片づける。
アプリのデータは private のリポジトリ `nisenonamae/notion-daily` の `roadmap/apps/seisakushitsu/data.json` にある（同じリポジトリのほかのファイルはほかのアプリのものなので、絶対に触らない）。録画は `roadmap/apps/seisakushitsu/refs/` の下。

## 0. 用意
- `nisenonamae/notion-daily`（データ）と `nisenonamae/seisakushitsu`（アプリと道具）を用意する。セッションになければ add_repo ツールで push 権限つきで追加してクローン、あれば git pull
- `roadmap/apps/seisakushitsu/data.json` がまだないとき（アプリの同期がまだ）は、何もせずに「データがまだありません」とだけ報告して終わる

## 1. 仕事があるか見る
- `roadmap/apps/seisakushitsu/data.json` を読み、`jobs` の中で `status` が `"待ち"` で `deleted` でないものを、`createdAt` の古い順に最大 5 件取る
- **1件もなければ、すぐに「仕事なし」とだけ報告して終わる**（何も書き込まない）

## 1.5 進み具合を知らせる（必ず）
作り手はアプリで進み具合を見ている。仕事に取りかかるとき・区切りごとに、データを書き換えて **その都度 commit して push** する。
- 取りかかるとき：その job の `status` を `"作業中"`、`progress` を `{"done":0,"total":N,"label":"今やっていること"}` にして push
- 区切りごと：`progress.done` を増やし、`label` を次の作業に書き換えて push。途中で集まった結果（related・sources など）も、その時点で書き込んでおく（作り手は途中の結果から見始められる）
- `total` の目安：gather は 4（見せ方→中身→資料→仕上げ）、script は 4（材料を読む→型紙→台本→仕上げ）、summary と script_fix は 2、pick は 4（集める→選ぶ→供給を測る→書く）
- 書き換えのたびに、その job の `updatedAt` も今の時刻（ミリ秒）にする

## 2. 仕事の種類ごとのやり方
JSON の中身はすべて ID でつながっている：`jobs[].projId` → `projects[].id`、`jobs[].matId` → `materials[].id`、`projects[].candId` → `candidates[].id`、`projects[].refs` → `ideas[].id`、`projects[].mats` → `materials[].id`、`projects[].recs[].path` → データのリポジトリの中の録画ファイル。

### summary（要約）
- `materials` の該当するものの `text`（動画の文字起こし）を、`size`（「3行で」「1分で読める量で」「見出しつきで詳しく」「数字と固有名詞を全部ぬき出して」）どおりに日本語で要約する
- 自分の言葉で言い換える。元の言い回しを長く写さない。数字・固有名詞・年は残し、「（動画内の主張）」と分かるようにする
- `summary` に書き、`status` を `"できた"` にする

### pick（題材探し）
- アプリのリポジトリの `tools/AUTO_PICK.md` の「数を指定されたとき」に従い、`n` 個の題材を `data/auto.json`（**アプリのリポジトリ**の方）に追加して push する

### gather（参考集め）
制作を始めたときに自動で入る。題材（candidates の q・angle・links）について、次の3つを集めて projects に書く。
**数は `jobs[].counts`（style＝見せ方、content＝中身、sources＝資料）に従う。** counts がなければ下の数。
1. **見せ方の参考** `related[]`（kind: "見せ方"）を 5〜8 本：同じか近い題材を、地図・アニメーション・シミュレーションで見せて伸びた動画。日本語・英語・中国語で YouTube を検索する（`tools/yt_common.py` の `search()` が使える。英語は `search(q,'en','US')`）。再生が多く、作りの質が高そうなもの（題名・チャンネル・サムネイルで判断。サムネイルは `https://i.ytimg.com/vi/<id>/hqdefault.jpg` で取れるので見てよい）
2. **中身の参考** `related[]`（kind: "中身"）を 3〜6 本：題材の中身を詳しく扱っている動画（言語は問わない）
3. **調べた資料** `sources[]` を 5〜10 件：公的機関・学術・百科事典など、事実を確かめられるウェブの資料。WebSearch と WebFetch で探す。`note` に、台本に使えそうな事実を自分の言葉で1〜2文（数字は出どころの通りに）
- related の各要素：`{"kind","title","url","channel","views","lang","why"}`（why は、なぜ参考になるかを一文）
- sources の各要素：`{"title","url","note"}`
- すでにある related・sources と同じ URL は足さない（もう一度頼まれたら、足りない分を追加する）
- `result` には「見せ方5本・中身4本・資料7件を集めました」のように書く

### script（台本づくり）
1. 題材（candidates の q と angle）、参考メモ（ideas の memo・時間・効く場所）、資料（materials の summary、なければ text）、調べた資料（projects の sources）、集めた参考（projects の related）を読む
2. 録画（recs の path）があれば ffmpeg でコマに分けて見る。録画がないときは、related の「見せ方」のサムネイルと、アプリのリポジトリの `tools/STYLE_DEFAULT.md`（標準の型紙）をもとにする（例：1秒に1枚、場面の変わり目も拾う）。画面の切り替わる間隔、地図の寄り方と動きの速さ、字幕の位置と大きさ、色、語りのテンポを読み取る
3. 読み取った作り方を `projects[].kata`（型紙）に、箇条書きで書く
4. 10分ほどの台本を `projects[].script` に書く。形：
   - 冒頭の問い（最初の15秒で問いと、答えの気配を見せる）→ ふつうの答え → 本当の答え → 意外な広がり → 結び
   - 段落ごとに【画面】（地図やアニメーションで何を見せるか）と【語り】を書く
   - 事実と数字には出どころ（資料の題名、または公的な資料の名前）を添える。確かめられないものは「要確認」と書く
   - 元の動画の構成や言い回しをなぞらない
5. `scriptVer` を 1 にし、`step` を 2（台本を確かめる）にする

### script_fix（台本の直し）
- `jobs[].notes`（作り手の直し）に従って `projects[].script` を直す。`scriptVer` を 1 増やす。直さなかった点があれば `jobs[].result` に一言書く

## 3. 書き込みの決まり
- 片づけた仕事は `status` を `"できた"`、`result` に一言（例：「台本 1版を届けました」）。できなかったら `status` を `"失敗"`、`error` に理由
- 書き換えた要素（jobs・materials・projects など）は、**必ず `updatedAt` を今の時刻（ミリ秒の数字。例：Python の `int(time.time()*1000)`）にする**（アプリはこれで新しい方を選んで合わせる）
- 書き換えるのは該当する要素だけ。ほかの要素や並びはそのまま残す。JSON は Python で読み書きし、`ensure_ascii=False` で保存する
- commit して push する。push が断られたら、pull し直して最新のファイルに同じ書き換えをもう一度当ててから push する（ファイルを丸ごと上書きしない）
- コミットの作者は `Claude <noreply@anthropic.com>`

## 4. 報告
片づけた仕事を一行ずつ、短く報告する。
