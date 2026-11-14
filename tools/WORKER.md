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
- `total` の目安：gather は 5（見せ方→中身→資料→素材→仕上げ）、visual_ideas は 3（案を考える→見本を描く→仕上げ）、visual_make は 作る数＋1、visual_fix は 2、script は 4（材料を読む→型紙→台本→仕上げ）、summary と script_fix は 2、pick は 4（集める→選ぶ→供給を測る→書く）
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
4. **使えそうな素材** `assets[]` を counts.assets 件（なければ 6 件）：題材の画面づくりに使える、自由に使ってよいとされている画像・地図・データ・映像。たとえば国や研究機関の公開データ、地理院タイル、Natural Earth、NASA などの公開画像、Wikimedia Commons の自由な使用が許された画像、著作権の切れた古い写真や絵。
   - 各要素：`{"title","url","source","license","terms_url","terms","credit","note"}`。`license` は書かれているライセンス名、`terms_url` は利用規約のページ、`terms` は規約の要点（出典の書き方、商用・加工・YouTube での利用がどう書かれているか）を一文で、`credit` は動画に載せる出典表記の例、`note` は動画のどこで使えそうか
   - 判断がつかないものは「要確認」と書く。最終の点検は作り手がする（作り手が `ok` を true / false にする）。`ok` は書かない
   - 実写や他人の作品で、自由な使用が明記されていないものは入れない
- related の各要素：`{"kind","title","url","channel","views","lang","why"}`（why は、なぜ参考になるかを一文）
- sources の各要素：`{"title","url","note"}`
- すでにある related・sources と同じ URL は足さない（もう一度頼まれたら、足りない分を追加する）
- `result` には「見せ方5本・中身4本・資料7件を集めました」のように書く

### 編集スタイル（script のときに使う）
- `styles[]` は過去の動画の編集スタイル（型紙）。`{"id","name","origin","kata"}`
- script の job には `styleMode` と `styleId` が入っている
  - `"そのまま"`：`styleId` のスタイルの kata をそのまま型紙にする。録画や見せ方の参考は型紙には使わない（中身の資料は使う）
  - `"混ぜる"`：`styleId` のスタイルを土台に、今回の録画・見せ方の参考から良い所を足す。何を足したかを型紙の最後に「今回足したこと」として書く
  - `"新しく"`：過去のスタイルは使わず、今回の録画・見せ方の参考だけから型紙を作る（参考が足りなければ tools/STYLE_DEFAULT.md の決まりで補い、補った所を明記する）
- どの場合も、出来た型紙は `projects[].kata` に書く（作り手が最後に「残す」を選ぶと styles に入る）

### visual_ideas（図解の案）
- 台本（projects の script）と型紙（kata）、作り手の希望（jobs の wish）を読み、台本の中で「動く図・地図の動き」で見せると分かりやすくなる場面について、`n` 個の案を考える
- 案ごとに、見本の静止画（1280×720 の PNG。いちばん見せ場になる瞬間を1枚）をプログラムで描き、データのリポジトリの `roadmap/apps/seisakushitsu/visuals/<projId>/<案のid>.png` に置く
- `projects[].visuals[]` に `{"id","idea"（一言の名前）,"desc"（何をどう動かすか、台本のどこで使うか、二文まで）,"preview"（PNG のパス）,"status":"提案","chosen":false,"updatedAt"}` を足す
- 型紙の色づかい・文字の決まりに合わせる。使う素材は assets のうち `ok` が true のものだけ

### visual_make（図解を作る）
- `jobs[].ids` の案を、それぞれ短い動画（1280×720、30fps、5〜15秒、H.264、1本 15MB 以内）として作る。作り方：Python（numpy・Pillow など）でコマを描き、ffmpeg でつなぐ。地図は Natural Earth・地理院タイルなど ok の素材だけを使い、画面の隅に出典を入れる
- `roadmap/apps/seisakushitsu/visuals/<projId>/<案のid>_v<版>.mp4` に置き、その visual の `clip` にパス、`ver` に版、`status` を `"できた"` にする。1本できるたびに push する（作り手は届いた順に見られる）

### visual_fix（図解の直し）
- `jobs[].visualId` の図解を `jobs[].notes` に従って直し、版を1つ上げた新しいファイルとして置き、`clip`・`ver` を更新し、`status` を `"できた"` にする

### script（台本づくり）
1. 題材（candidates の q と angle）、参考メモ（ideas の memo・時間・効く場所）、資料（materials の summary、なければ text）、調べた資料（projects の sources）、集めた参考（projects の related）を読む
2. 録画（recs の path）があれば ffmpeg でコマに分けて見る。録画がないときは、related の「見せ方」のサムネイルと、アプリのリポジトリの `tools/STYLE_DEFAULT.md`（標準の型紙）をもとにする（例：1秒に1枚、場面の変わり目も拾う）。画面の切り替わる間隔、地図の寄り方と動きの速さ、字幕の位置と大きさ、色、語りのテンポを読み取る
3. 上の「編集スタイル」の決まりに従って、型紙を `projects[].kata` に箇条書きで書く
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
