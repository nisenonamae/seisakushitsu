# 頼みごとの片づけ（Claude が毎時実行する手順）

制作室アプリの「頼みごと」（要約・題材探し・台本づくり・台本の直し）を片づける。
アプリのデータは private のリポジトリ `nisenonamae/seisakushitsu-data` の `data/seisakushitsu.json` にある。

## 0. 用意
- `nisenonamae/seisakushitsu-data`（データ）と `nisenonamae/seisakushitsu`（アプリと道具）を用意する。セッションになければ add_repo ツールで push 権限つきで追加してクローン、あれば git pull
- データのリポジトリがまだない、または読めないときは、何もせずに「データのリポジトリがまだありません」とだけ報告して終わる

## 1. 仕事があるか見る
- `data/seisakushitsu.json` を読み、`jobs` の中で `status` が `"待ち"` で `deleted` でないものを、`createdAt` の古い順に最大 5 件取る
- **1件もなければ、すぐに「仕事なし」とだけ報告して終わる**（何も書き込まない）

## 2. 仕事の種類ごとのやり方
JSON の中身はすべて ID でつながっている：`jobs[].projId` → `projects[].id`、`jobs[].matId` → `materials[].id`、`projects[].candId` → `candidates[].id`、`projects[].refs` → `ideas[].id`、`projects[].mats` → `materials[].id`、`projects[].recs[].path` → データのリポジトリの中の録画ファイル。

### summary（要約）
- `materials` の該当するものの `text`（動画の文字起こし）を、`size`（「3行で」「1分で読める量で」「見出しつきで詳しく」「数字と固有名詞を全部ぬき出して」）どおりに日本語で要約する
- 自分の言葉で言い換える。元の言い回しを長く写さない。数字・固有名詞・年は残し、「（動画内の主張）」と分かるようにする
- `summary` に書き、`status` を `"できた"` にする

### pick（題材探し）
- アプリのリポジトリの `tools/AUTO_PICK.md` の「数を指定されたとき」に従い、`n` 個の題材を `data/auto.json`（**アプリのリポジトリ**の方）に追加して push する

### script（台本づくり）
1. 題材（candidates の q と angle）、参考メモ（ideas の memo・時間・効く場所）、資料（materials の summary、なければ text）を読む
2. 録画（recs の path）があれば ffmpeg でコマに分けて見る（例：1秒に1枚、場面の変わり目も拾う）。画面の切り替わる間隔、地図の寄り方と動きの速さ、字幕の位置と大きさ、色、語りのテンポを読み取る
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
