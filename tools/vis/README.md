# 図解の部品集（tools/vis）

`scenes.make(spec, dur, out, repo)` に、部品の指定 `spec`（`{"t": 部品の名前, ...}`）を渡すと、`dur` 秒の 1280×720・30fps の mp4 を作る。
動きが先に終わったら、最後の絵で止めて `dur` 秒まで伸ばす。肉付けの各段の `scene` にこの `spec` を書いておくと、`tools/make_scenes.py` が全段の画面を作る。

| 部品 `t` | 使いどころ | 主な指定 |
|---|---|---|
| `photo` | 実物の写真にゆっくり寄る | `src`（Commons のページ URL か、データのリポジトリ内のパス）, `ticks`（true＝等間隔の目盛り／"fadeout"）, `text`, `text_at`, `zoom`, `fadein`, `fadeout`（秒：動画の終わりに黒へ） |
| ~~`bigtext`~~ | **使わない（文字だけの画面は禁止）** | `text`, `sub`, `flash`（"gauge8"＝最後に速度計を一瞬） |
| `map` | 世界地図で国を塗る → 写真へ。**`zoom` は 1 つの国だけに注目するときだけ**（いろいろな国を挙げる動画では寄らない） | `highlight`（国の ISO3 の並び）, `zoom`（true＝その国へ寄る）, `labels`（{ISO3: 文字}）, `pins`（[[経度,緯度,文字]]）, `photo`, `photo_at`, `photo_text` |
| `cards` | 札が並ぶ／落ちて一部だけ残る | `groups`（札の行の並び）, `keep`（残す札）, `keep_at`, `title` |
| `steps` | 箇条を一つずつ点灯 | `title`, `items` |
| `loop` | 原因と結果がぐるぐる回る輪 | `labels`（3つ） |
| `graph` | 2本の費用の線と分かれ目 | （今は舗装／未舗装の形だけ） |
| `circle` | 真上から見た円い砂の道 | `mode`："hand"（手で押す）／"slow"（轍だけ）／"fast"（速くすると波）／"mather"（手押し→モーター）／"2007"（回転台・周の数）／"speed"（速度計と道。車の時速8km） |
| `section` | 横から見た道の断面 | `mode`："force"（力のむら）／"bounce"（跳ねて押す）／"grow"（台数と波の育ち）／"arc"（速さと間隔）／"migrate"（波が進む）／"heavy"（軽い・重い）／"dilemma"（遅い・速い車）／"swap"（米粒・板）／"japan"（土が縮む・揺れる車） |

| `picto` | 絵（ピクト）を一つドンと出す／並べる | `items`（[{icon, label, x}]。x＝true でバツ）, `mode`："one"／"row", `cross`（並べたあと全部にバツ）。icon：truck・rain・brake・tread・spring・layers・grains・question・wheel・ground・speed |
| `person` | 人物の紹介（シルエット・名前・年） | `name`, `role`, `year`（実在の人の写真は使わない） |
| `dustcar` | 土ぼこりを上げて走る車（横から） | `text`, `close` |
| `ruler` | 断面の山と山にものさしを当てる | `mode`："one"（`text`＝"約30cm"）／"equal"（山ごとに目盛り→？） |
| ~~`year`~~ | **使わない（文字だけ）。年は `timeline` で絵と一緒に** | |

| `clip` | 記録映像・素材映像の一部 | `src`（動画のパス）, `start`（秒）, `speed`, `text`, `credit`（右下の出典） |
| `roads` | 道の割合・道のつくり | `mode`："share"（アメリカの形＋3本に1本が土の道）／"trunk"（太い舗装道路から土の道が枝分かれ）, `text` |
| `wave` | 波形が左から描かれ、山ごとに目盛り | `text` |
| `compare` | 写真を二枚並べて見比べる | `items`（[{src, label}]）, `eq` |
| `timeline` | 年表（年・絵・ひとこと） | `events`（[{year, label, icon}]）, `highlight` |
| `voices` | 人が並び、吹き出しに絵（いろいろな説・人の声） | `items`（[{icon, label}]）, `who`（"research"＝白衣） |
| `strip` | 車から部品が飛んでいき、車輪と砂だけ残る | `text` |
| `gauge` | 速度計（答えは「？ km/h」で伏せる） | |
| `html` | ブラウザ（Chrome）で描く場面。**アニメはなるべくこれで作る**。共通の道具は `html/lib.js`（空・丘・砂の地面・タイヤ・人が乗った車・本物っぽい速度計・揺れ・画像の読み込み・効果音）。ふちが滑らかで、影・ぼかし・粒が出せる。**新しい場面はなるべくこれで作る** | `page`（`tools/vis/html/<page>.html`）, ほかは場面ごと。いまあるページ：`turntable`（回転台・lower／updown）・`car`（rattle＝人が乗った車がガタガタ、画面も揺れる／dust＝着地した所だけ土ぼこり／hop＝車輪が浮く／suspect＝光が車から車輪と地面へ／points＝車輪・地面・速さを順に示す／section＝断面を車が進む）・`control`（ハンドルとブレーキが効かない）・`suspension`（車輪と車体をつなぐばね）・`soil`（山はふんわり谷は詰まる）・`mather`（円い溝の実験：intro／hand／build／speed）・`heavy`（重いトラックが消え車輪だけ残る）・`calendar`（年月がたつ）・`globe`（衛星写真の地図に寄る。`img`＝NASA Blue Marble）・`variations`（条件を変えても波）・`road`（timelapse＝ひとりでに波／grader＝削ってもまた戻る）・`magnify`（虫めがねで写真を調べる）・`trunk`（幹線道路だけ舗装）・`meter`（hidden／threshold）・`person`（絵の人物と名札）・`theories`（よくある説を同じ絵柄で：truck／rain／brake／tread／sort）・`car` の jproad（日本の道）・trunk（幹線道路から土の道へ）・strip（車体が消えて車輪と砂）・speedup（速くなると少しずつ波）・assemble（車輪→砂→速さで波）・`mather` の story（溝→砂→棒→車輪→回す→小さな波→装置→遅い→速い→波、を途切れない1場面で。times に9つの言葉）・`turntable` の grow（一か所から斜めの波が広がる・周回の数）／smooth（つやのある砂・左上に時計）・`road` の spread（波の範囲が広がる）／moving（岩の横を波が進む）・`section2`（断面で仕組みを見せる：slice／zoom／force／hop（times 1〜5＝浮く・落ちる・押す・飛ぶ・くぼみ）／bulldoze（昔の説をセピアで→times[1]で本当の動き）／replay（残像）／cars（times＝2つ目・3つ目の山）／grow／height／spacing／arcs／same／repose（times[1]＝崩れる）／dune／migrate（杭は動かない））・`aerial`（真上から：stream／speeds／mixed＝大きさも速さもばらばらの車）・`turntable` の speed（遅いと1時間たっても轍だけ→times[1]で速くすると数周で波→times[2]で跳ねる）・`section3`（第3章：three／below／heavy／springs／push2／updown／rice／plow／loop／twospeeds／advice／seesaw／crawl／delay／active／deflate。各モードの説明はページの先頭）・`road` の pave（アスファルトが敷かれていき、times[1]で巻き戻る）・`cost`（paved／dirt／cross＝費用の2本の線／area＝道を台所の床に切り分ける）・`gravel`（第4章：spots／brake／surge／dry／balance／regrade／skim／compress／seed／lab／bounce）・`doc`（本物の資料の紙面を机に置き、times[1] で寄って蛍光ペンで塗り（marks）、最後に focus（紙面の写真など）が画面いっぱいになって次の場面へ。次の場面に img を渡すと、その写真から溶けるようにつながる：gravel brake で使用）・`nature`（結び：river＝川の底の砂の波／feedback＝流れが形を変え、形が流れを曲げる／family＝川・砂丘・洗濯板の3段を同じ金の線がなぞる／recap＝ふり返りの断面1枚、times 1〜5／letter＝机の上の手紙／bicycle＝夕方の自転車／poet＝詩人の肖像（portrait に画像）と原稿用紙に縦書き、最後に原稿へ寄る／walker＝歩いたうしろに道ができる／life＝道の起伏が山と谷になり、通った道すじが金色に）・`person` の paper:true（共同研究のとき、人物の絵の代わりに論文の紙。名前は幅に合わせて小さくなる） |

`html` の場面の作り方：`<canvas id="c" width="1280" height="720">` に、`window.setup(params, dur)` と `window.render(t)`（t 秒の絵を描く）を書く。効果音は `window.SFX=[[秒,"thump"],…]`。`params.times` に `ats` の時刻が入る。

どの部品にも `punch`（見てほしい所へ「ぐいっ」と寄る）が効く：`[{"at": 秒, "x": 0〜1, "y": 0〜1, "z": 倍率(1.6〜2.4), "ring": true, "r": 丸の大きさ(0.05〜0.15), "text": "短い言葉"}]`。`z: 1` で全体へ戻る。x・y は 16:9 に切り抜いた画面の中の位置（写真なら `tools/vis/ph_grid.py` で 0.1 刻みの格子を重ねて見て決める）。寄るたびに短い効果音が入る。
写真（`photo`）は、ゆっくり寄るのをやめる。**`punch` は頻発させない**：寄って見たほうが分かりやすい所（小さくて見えない・どこを見ればいいか分からない）だけに使う。目安は数十秒に一度より少なく、ほとんどの写真は寄らずに `text` で言葉を一つ出すだけ。`punch` を付けた写真は 2 倍の細かさで切り出すので、寄ってもぼやけない。
`cam` は使わない（静止画がゆっくり動くのは不自然）。動きは部品の中のアニメで出す。
`seq`（部品の指定の並び）を渡すと、`dur` を等分して順につなぐ（長い一文の途中で画面を変えるとき）。

## カット（shots）— 画面を止めないための一番大事な決まり
- **カットの始まりは語りの言葉で決める**：`{"at": "メルボルン大学", ...}` と書くと、その言葉が話され始める瞬間に画面が切り替わる（最初のカットは at なし）。**語りに出てくる前に画面に出さない**。語りの順番どおりに画面を並べる
- カットの中で順に出したいもの（並ぶピクト・吹き出し・国・ピン）は `"ats": ["ばねで", "回った数"]` と書くと、その言葉の瞬間が `times`（カットの頭からの秒）として部品に渡る
- 仮の動画には左上に「場面 3-4」（3段目の4つ目のカット）が出る。直しはこの番号で言える。本番は `--final` で消す
- 効果音は部品が意味のある瞬間にだけ鳴らす（寄る＝whoosh、出てくる＝pop、ぶつかる・バツ＝thump、目盛り＝tick、土ぼこり＝puff）。切り替わりのたびには鳴らさない
- 肉付けの各段に `shots` を書く：`[{"n": 文の数, ...部品の指定}, ...]`。語りを文で区切り、前から `n` 文ずつに一つの部品を当てる。`render_draft.py` は文ごとの声の長さに合わせてその部品の動画を作る（`scene` よりこちらが優先）
- 目安：**一つの画面は 3〜6 秒**。一文が 8 秒を超えるなら `seq` で途中で変える。同じ部品が続くときも `cam` を変える
- 語りの名詞や数字が出たら、その絵や数字をポンと出す（「重いトラック」→ truck のピクト、「1963年」→ year）
- **待ち（`hold`）**：カットに `"hold": 1〜2` を書くと、そのカットの語りが終わったあと、語りを止めてアニメが終わるのを待つ（字幕も消える）。待つ間はアニメに音を付ける（`rattle`・`engine`・`motor` など長さのある音は `[秒,種類,長さ]`）
- **間（`beat`）**：カットに `"beat": 0.5〜0.8` を書くと、そのカットの頭で語りを止め、字幕も出さずに動きだけを見せる。ぐいっと寄る・大きく動くカットには付ける（`punch` の `at` は 0.15 くらいにして、間の中で寄る）。それ以外には付けない（不自然な間になる）
- **字幕**は自動で、語りの声の時刻に合わせて 7〜21 字くらいの塊で出る（読点と文節の切れ目で切る。1行だけ）。語りの文は、字幕の塊が自然に切れるよう、読点を適度に入れて書く

## 映像の材料
- **使ってよい映像のありか**：インターネットアーカイブの Prelinger コレクションなど（パブリックドメインの記録映像。`https://archive.org/advancedsearch.php` で探し、`/download/<id>/<id>_512kb.mp4` で取れる）／Mixkit（**「Mixkit Stock Video Free License」の物だけ**。「Restricted License」は収益化した動画に使えないので使わない。縦長の映像も多いので形を確かめる）
- 取ってきた映像はコマを並べて見て、使う秒を決める（`clip` の `start`）。出典は `credit` に書き、`p.video.credits` にも並べる

## 実写の材料（写真）— 図解だけにしない
- 動画 1 分あたり **写真 4 枚以上** を目安に集める（題材そのもの・場所・時代・道具・人の暮らし）。図解の合間に写真を挟み、写真には必ず `punch` で見どころへ寄る
- 集め方：Wikimedia Commons を検索（`list=search`, `srnamespace=6`）。続けて叩くと 429 になるので、間を空けて取る。ライセンスと作者（`extmetadata` の LicenseShortName・Artist）を必ず控え、動画の `credits` に並べる（概要欄に貼る）
- 実在の有名人の写真は使わない。建物・道具・風景・古い記録写真（パブリックドメイン）は使ってよい
- 写真が語りと違うもの（別の場所・別の時代）なら、画面にそれと分かる言葉を出すか、使わない

## 字幕
- `render_draft.py --subfont 番号`（1〜10）で見た目を選ぶ。フォントは `tools/setup_fonts.sh` で入れる（Google Fonts、SIL OFL）

## 決まり
- 画面の文字は大事な言葉と数字だけ。同じものを縦に並べない（作り手の直しから）
- 写真は `assets` のうち点検で「使う」になったものを使う。点検前のものを使ったら、動画の result に書く
- Wikimedia の写真はサムネイルの決まった幅（1920・1280・960・500）でしか取れない（`commons_img` が選ぶ）。続けて取ると 429 になるので、`fetch` は待って取り直す
- 題材ごとの新しい見せ方は、`section` の `mode` のように部品の中に足すか、新しい部品として足す。足したらこの表に一行書く
