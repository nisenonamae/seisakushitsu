# データの形（DATA_MODEL）

2026-11-27 改訂2。**案**。名前や細部は試作（P3・P4）で変わりうる。書き方は TypeScript 風だが、言語を決めたわけではない。

**改訂2で変えたこと**：①値（Value）を種類の札つきにした ②式を小さな専用の言葉にし、上限を決めた ③語りの合図（Cue）を、文字列でなく変わらない番号（トークン id）で指す形にした ④点・鍵にも変わらない id を付けた ⑤部品ごとに版の番号（rev）を持たせた ⑥命令（Command）を種類ごとの型にし、検査・前提・取り消し・重複・版・ひとまとめの適用を決めた ⑦AI の変更だけを取り消す方法を決めた。

## 1. 決まりごと

1. **id で指す**：部品・場面・素材だけでなく、**点・鍵・色の止め・語りのトークン**も id を持つ。並び順（何番め）では指さない。← 改訂2。並び順で指すと、人と AI が同じ形の別の点を直しただけで、ぶつかったり、取り消しで別の点が動いたりする。
2. **元を残す**：清書・合成・変形は、元のデータの上に「加工」として重ねる。
3. **どの値も動かせる**：数・色・点の位置は、すべて「値」（3節）で持つ。
4. **時刻は秒**。絵の合図は、できるだけ語りのトークンに結ぶ（6節）。
5. **版の番号が2種類**：ファイルの形の版 `v`（古い形は読みこむときに移し替える）と、部品ごとの中身の版 `rev`（変わるたびに1つ増える）。
6. **小分け**：1つの大きなファイルにしない。
7. **乱数は種で**：同じデータなら同じ絵。
8. **端末の時計を信じない**：順番は時計でなく、数えた番号で決める（9.6節）。← 今の制作室で、端末の時計が約2分ずれて書き込みが消えた事故があったため。

## 2. 置き方（ファイル）

```
projects/<制作id>/
  project.json            表紙：題・工程の状態・度合い・許可・固定・場面の並び
  script.json             語り（行とトークン）
  scenes/<場面id>.json     場面の写し（記録から作り直せる。読みこみを速くするための物）
  audio.json              音の置き方
  log/<端末id>/<番号>.jsonl 命令の記録。**端末ごとに別のファイル**。足すだけ・書きかえない
  proposals/<id>.json     AI の提案（まだ採っていない変更）
library/
  assets/<素材id>.json  palettes.json  motions/<id>.json  rules.json  refs/…
  fonts/…                 字の形のファイル（描く側は、必ずここの字を使う）
media/…                   画像・音・動画
```

- **記録が正本、写しは控え**。`scenes/*.json` は記録を順に当てた結果で、壊れたり古かったりしたら記録から作り直す。写しには「どの番号まで当てたか」と中身のハッシュを書く。
- 記録を端末ごとに分けるのは、2台が同じファイルを同時に書くことを無くすため。ぶつかりは「ファイルの上書き」ではなく「同じ部品への命令」として、中身で見つける（9.6節）。

## 3. 値（動かせる値）

```ts
type Value<T> =
  | { k:'static', v: T }                                   // 固定の値
  | { k:'keys',   keys: Key<T>[] }                         // キーフレーム
  | { k:'expr',   src: string, base?: Value<T> }           // 式（base があれば、その値に式を重ねる）
  | { k:'ref',    to: Ref }                                // ほかの値・色の名前を指す

type Key<T> = { id: KeyId, t: Time, v: T, ease?: Ease, hold?: boolean }
type Time   = { k:'sec', s: number } | { k:'cue', cue: Cue }
type Ease   = { k:'preset', name:'linear'|'in'|'out'|'inout' } | { k:'bezier', p:[number,number,number,number] }
type Ref    = { k:'prop', node: NodeId, path: PropPath } | { k:'palette', name: string } | { k:'control', asset: AssetId, id: string }
```

- 必ず `k` の札で種類を見分ける（中身の形から当てない）。保存するときに `{k:'static'}` を省く近道は、**読み書きの所だけ**に置く。核の中ではいつもこの形。
- `PropPath` は決まった名前の並び（例 `xf.pos`・`fill.color`・`geo.round`）。自由な文字列ではない。

### 式（小さな専用の言葉）

ふつうの JavaScript は実行しない。次だけを読める、小さな言葉にする。

| 使える物 | 中身 |
|---|---|
| 数・足し引き掛け割り・比べる・`a ? b : c` | |
| 決まった関数 | `sin cos abs min max clamp lerp floor`／`noise(seed,x)`／`loop(t,長さ)`／`wiggle(seed,速さ,幅)`／`spring(目標,固さ,減り)`／`follow(ref,遅れ)` |
| 変数 | `time`（場面の秒）・`index`（並べて増やした何番めか）・`value`（base の値）|
| ほかの値 | `ref("部品id.道")`。式の中の参照は、読みこむときに `Ref` に解いて持つ |

**できないこと**：くり返し・自分で関数を作る・文字列・時計・乱数（`noise` は種で決まる）・ファイルや画面に触る。

**上限**（越えたら、その命令を断る）：
- 式の大きさ：節 200個まで・深さ 16 まで。
- 参照の輪を作らない：命令を当てる前に、参照のつながりを調べ、輪ができるなら断る（9.3節の「全体の決まり」）。
- 時間をさかのぼる参照（`follow`）の重なりは 4段まで。
- 1コマあたりの計算の量に上限。越えたら、その値は「直前の正しい値」にして、点検で**必須の不合格**にする（QUALITY_STANDARDS.md）。数でない結果（NaN・無限）も同じ。

上の数字は初めの置き値（要調整）。

## 4. 絵（ベクター）

```ts
type Node = {
  id: NodeId, rev: number
  name: string
  kind: 'group'|'shape'|'line'|'instance'|'image'|'text'|'clone'|'camera'|'bone'
  parent?: NodeId, order: Rank            // Rank＝あいだに挟める順番の印（動かした物だけ付け替える）
  xf: { pos: Value<Vec2>, rot: Value<number>, scale: Value<Vec2>, pivot: Vec2 }
  opacity?: Value<number>, visible?: Value<boolean>
  blend?: 'normal'|'multiply'|'screen'|'add'
  mask?: NodeId, depth?: number
  tags?: string[], stage?: 0|1|2|3|4|5|6
  intent?: Intent[]                       // 表現の意図の札（例：意図した静止）。点検の警告を、理由つきで通す
  meta?: { src?: string, note?: string }
}
type Intent = { what:'still'|'empty'|'dense'|'reuse'|'linear'|'other', why:string, by:ActorId, at:Seq }
```
- だれが作ったか・直したかは、部品には書かない（記録から分かる。9節）。

### 形
```ts
type Shape = Node & { kind:'shape', geo: Geo, ops?: PathOp[], fill?: Paint, stroke?: Stroke }
type Geo =
  | { t:'path', pts: Pt[], closed: boolean }
  | { t:'ellipse', size: Value<Vec2> }
  | { t:'rect', size: Value<Vec2>, round: Value<number> }
  | { t:'capsule', len: Value<number>, w: Value<number> }
  | { t:'poly', n: number, r: Value<number>, round: Value<number> }
  | { t:'bool', op:'add'|'sub'|'and', of: NodeId[] }
type Pt = { id: PtId, p: Value<Vec2>, in?: Value<Vec2>, out?: Value<Vec2>, corner?: boolean }
type Stroke = { paint: Paint, w: Value<number>, cap:'round'|'butt', join:'round'|'miter', taper?: [number,number] }
type Paint  = { k:'color', c: Value<Color> } | { k:'grad', g:'linear'|'radial', stops: Stop[], from: Vec2, to: Vec2 }
type Stop   = { id: StopId, at: number, c: Value<Color> }
type Color  = { k:'hex', v:string } | { k:'palette', name:string }
type PathOp = { id: OpId } & ( {t:'trim',from:Value<number>,to:Value<number>} | {t:'round',r:Value<number>}
            | {t:'offset',d:Value<number>} | {t:'wobble',amp:Value<number>,freq:number,seed:number} | {t:'mirror',axis:'x'|'y'} )
```
- 点は1つずつ id と値を持つ（形を動かす＝点の `p` に鍵を打つ）。取っ手は任意で、無ければ自動（今の `HND` の式）。
- **字**（`kind:'text'`）は、`library/fonts/` の字だけを使う。題やサムネなど、どの環境でも1画素も変えたくない字は、書き出す前に輪郭（形）に変えられるようにする（SYSTEM_ARCHITECTURE.md 4節）。

### ひな形と写し・並べて増やす
```ts
type Instance = Node & { kind:'instance', of: AssetId|SceneId, variant?: string,
  overrides?: { target: NodeId, path: PropPath, value: Value<any> }[],
  time?: { offset: Value<number>, speed?: number, loop?: boolean } }
type Clone = Node & { kind:'clone', of: AssetId, layout: Layout,
  vary: { pos?:number, rot?:number, scale?:Vec2, hue?:number, time?:number, seed:number } }
```

## 5. リグ
```ts
type Rig = {
  bones: NodeId[]
  ik?: { id:string, chain: NodeId[], target: NodeId, bend: 1|-1 }[]
  binds: { node: NodeId, bone: NodeId }[]
  controls: { id:string, name:string, drives: { node:NodeId, path:PropPath, map:[number,number] }[] }[]
  swaps?: { id:string, name:string, options: { id:string, name:string, show: NodeId[] }[] }[]
  poses?: { id:string, name:string, values: { node:NodeId, path:PropPath, v:any }[] }[]
}
```
- 最初は「親子＋付け根＋差し替え＋つまみ」だけ。骨と IK は次の段階。

## 6. 時間と語り

```ts
type Script = { v:number, lines: Line[] }
type Line   = { id: LineId, rev:number, chapter:string, text:string, tokens: Token[], voice?: {…} }
type Token  = { id: TokenId, text:string, t0?:number, t1?:number }   // t0・t1 は声を作ったあとに自動で入る
type Cue    = { token: TokenId, edge:'start'|'end', offset?: number }
```

- **合図は、文字列でなくトークンの id で指す。** ← 改訂2。前の案（行と言葉の文字列）だと、同じ言葉が2回出る行・語りを書きかえた行で、どこを指すかがあいまいになる（今の `ats` も言葉の文字列なので、同じ弱みを持つ）。
- トークンは、語りの行を声の区切り（今の道具が VOICEVOX から取っている区切りと時刻）に分けた物。
- **語りを直したとき**：前の行と新しい行を比べ、変わっていないトークンは同じ id のまま残す。新しい言葉には新しい id。消えたトークンを指していた合図は「宙に浮いた合図」になる。**勝手に近くへ付け替えない**。点検で必須の不合格にし、「近くのこのトークンに付け替えますか」と候補を出す。
- 画面では、合図を「言葉＋何回め」で見せる（id は見せない）。
- 秒で直接書くこともできる（語りのない所）。

**まだ決めていない**：トークンの細かさ（文節か、もっと細かくか）。大きく書きかえたときに、どこまで同じ id を残せるか（P3 で、実際の語りの直しを使って確かめる）。

## 7. 場面
```ts
type Scene = { v:number, id:SceneId, seq: Seq /* どこまで当てたか */, hash:string,
  name:string, size:[1920,1080], fps:60|30, dur: { k:'sec', s:number } | { k:'cues', from:Cue, to:Cue },
  nodes: { [id:string]: Node }, root: NodeId[], camera?: NodeId,
  markers?: { id:string, t:Time, name:string }[], stage: 0|1|2|3|4|5|6, status:'draft'|'review'|'ok' }
```

## 8. 表紙：度合い・許可・固定

3つは別の物として持つ（AUTOMATION_DESIGN.md）。どれも命令で変え、記録に残る。

```ts
type Project = { v:number, id:string, title:string,
  stages: { [工程:string]: { mode: Mode, status:'todo'|'doing'|'review'|'ok' } },
  sceneModes?: { scene:SceneId, stage:string, mode:Mode }[],     // 場面ごとの上書き
  perms: Perms,                                                 // AI に許すこと
  locks: Lock[],                                                // 固定
  scenes: { id:SceneId, chapter:string, order:Rank }[], palette:string }
type Mode  = 'human'|'collab'|'ai'
type Lock  = { id:string, target: Target, level:'frozen'|'ask', by:ActorId, at:Seq, why?:string }
type Target = { scene?:SceneId, node?:NodeId, path?:PropPath } | { line: LineId } | { asset: AssetId }
```

## 9. 命令（Command Engine）

文書を変える道は、これ1つ。**画面から切り離した、単独で動く部品**として作る（画面なしで試せる）。

### 9.1 外から渡す物（命令）と、中で残す物（記録）

```ts
type Command = {
  id: CmdId                     // 送る側が作る、世界で1つの番号。重複を見分ける鍵
  v: number                     // この種類の命令の形の版
  actor: { k:'human', device:DeviceId } | { k:'ai', agent:string, task:TaskId }
  group?: GroupId               // ひとまとめに当てる・取り消す単位（1回のドラッグ・AI の1つの作業）
  proposal?: ProposalId         // 提案から採った物なら
  base: { [target:string]: number }   // 前提：この命令が見ていた、相手の rev
  body: CommandBody             // 種類ごとの中身（9.2節）
}
type Applied = {                // 核が当てたあとに記録へ書く物
  cmd: Command
  seq: Seq                      // 核が付ける順番（{ n:数えた番号, device }）
  effects: Effect[]             // 実際に変わった所。取り消しの元
  revs: { target:string, from:number, to:number }[]
  policy: { mode:Mode, perms:string, locks:string[] }   // 当てた時の度合い・許可・固定（あとで確かめ直せるように）
}
type Effect =
  | { k:'set',    at: PropAddr, before:any, after:any }                 // 値を置きかえた
  | { k:'delta',  at: PropAddr, d:number[] }                            // 数を足した（動かす・回す・伸ばす）
  | { k:'insert', at: ListAddr, item:any, after?: string }              // 並びに足した（点・鍵・部品）
  | { k:'remove', at: ListAddr, item:any, after?: string }              // 並びから外した（中身は残す）
  | { k:'move',   node: NodeId, from:{parent?:NodeId,order:Rank}, to:{parent?:NodeId,order:Rank} }
```

- **取り消しに要る情報（`effects`）は、核が当てる時に自分で作る。** 送る側（とくに AI）が書いた「取り消し方」は信じない。← 改訂2。前の案の `undo:any` をやめた。
- `before` を持つのは「置きかえ」だけ。「足した量」「足した物」「外した物」は、それ自体が逆向きにできる。

### 9.2 命令の種類（型で決める）

`CommandBody` は、`type` の札で見分ける決まった一覧。一覧にない命令は存在しない。引数は種類ごとに形が決まっていて、当てる前に必ず検査する（形・範囲・id が実在するか）。

| まとまり | 種類（例） | 効果の型 |
|---|---|---|
| 部品 | `node.add` `node.remove` `node.move`（親・順番）`node.rename` | insert / remove / move / set |
| 値 | `prop.set`（道と値）`prop.nudge`（数を足す）`prop.kind`（固定↔鍵↔式↔参照）| set / delta |
| 形の点 | `pt.add` `pt.remove` `pt.nudge` `pt.handle` `pt.corner` | insert / remove / delta / set |
| 鍵 | `key.add` `key.remove` `key.retime` `key.value` `key.ease` | insert / remove / set |
| 形の加工・色の止め | `op.add` `op.remove` `stop.add` `stop.remove` | insert / remove |
| 写し | `override.set` `override.clear` | set |
| 語り | `line.add` `line.remove` `line.edit`（トークンの対応つき）`cue.attach` | insert / remove / set |
| 表紙 | `mode.set` `perms.set` `lock.add` `lock.remove` `status.set` `intent.add` `intent.remove` | set / insert / remove |
| 提案 | `proposal.accept`（どの命令を採るか）`proposal.reject` | （中の命令を当てる）|
| 取り消し | `revert`（どの記録を、どの方針で戻すか。9.5節）| （逆向きの効果）|

- 動かす・回す・伸ばすは「足す量」（`nudge`）で持つ。← 「AI が右へ 10、そのあと人が上へ 5」のとき、AI の分だけを戻しても人の分が残るようにするため。
- 種類ごとに `v`（形の版）を持つ。形を変えたら版を上げ、古い記録は読む時に新しい形へ移す。記録そのものは書きかえない。

### 9.3 当て方（1つの決まった手順）

```
受け取る
 ① 重複か：同じ id を当てた記録があれば、何もせず、前と同じ結果を返す
 ② 形の検査：種類・版・引数
 ③ 許しの検査：だれが・度合い・許可・固定（AUTOMATION_DESIGN.md 3節）
 ④ 前提の検査：base の rev が今と合うか。合わなければ、ぶつかる所があるかを道ごとに見る（9.6節）
 ⑤ 控えの上で当てる（group は全部まとめて）
 ⑥ 全体の決まりの検査：切れた参照・親子の輪・式の参照の輪・上限
 ⑦ どれか1つでもだめなら、何も変えずに断る（理由の札つき）。全部よければ、控えを本物にし、rev を上げ、記録に足す
```

- **ひとまとめに当てる**：1つの命令も、group も、「全部入る」か「何も入らない」かのどちらか。途中まで入った状態は外から見えない。
- 断るときは理由の札を返す（`duplicate`・`invalid`・`forbidden`・`locked`・`stale`・`conflict`・`breaks-invariant`）。画面も AI も、同じ札を受け取る。
- 核は「文書＋命令 → 新しい文書＋記録」か「断り」を返すだけの計算。画面・通信・時計に触らない。

### 9.4 ふつうの取り消し

直前の自分の操作を戻す（Ctrl+Z）。その記録の `effects` を逆向きにした `revert` を足す。記録は消さない。取り消しの取り消しも同じ仕組み。

### 9.5 選んで取り消す（AI の変更だけを戻す）

**問題**：AI が部品 A を変え、そのあと人が同じ A を直した。ここで AI の変更だけを戻したい。履歴を巻き戻すと、人の直しも消える。

**やり方**：戻したい記録の効果を1つずつ見て、**その後に何が起きたかで分ける**。巻き戻しはしない。

| 効果 | その後 | すること |
|---|---|---|
| 置きかえ（set） | だれも同じ所を変えていない | `before` に戻す |
| 置きかえ（set） | 人が同じ所をさらに置きかえた | **何もしない**（AI の値はもう残っていない）。「上書き済み」と報告 |
| 足した量（delta） | 人も足している | AI の分だけ引く。人の分は残る |
| 足した物（insert：点・鍵・部品） | だれも触っていない | 外す |
| 足した物（insert） | 人がそれを直した・それに子を付けた・それを参照した | **止まって聞く**：①残す ②人の直しごと外す（何が一緒に消えるかを全部見せる）|
| 外した物（remove） | — | 戻す（中身は記録に残っている）。親が無くなっていたら、止まって聞く |
| 親・順番の移動（move） | 人がさらに移した | 何もしない（上書き済み）|
| 親・順番の移動（move） | そのまま | 元の親・順番へ。元の親が無ければ、止まって聞く |

- 「同じ所」は、**値の道の単位**で見る（部品の単位ではない）。AI が色を変え、人が位置を変えたなら、ぶつからない。
- 戻したあとに 9.3節⑥ の検査を通す。通らなければ（例：戻すと式の参照先が無くなる）、当てずに「止まって聞く」。
- **人の直しを黙って壊すことは、どの場合もしない。** 迷う場合は聞く。
- 結果は `revert` の命令として記録に残り、それ自体を取り消せる。
- まとめて戻すとき（AI の1回の作業）は、効果ごとに「戻した・上書き済み・聞く」の一覧を先に見せる。

**これで足りない場合（分かっている限界）**
- 人の直しが AI の形を前提にしている場合（AI が円を長丸に変え、人がその長さを直した）。値としてはぶつからないが、意味としては依りかかっている。→ 種類を変える命令（`prop.kind`・図形の種類）は「足した物」と同じ扱いにして、依りかかる直しがあれば聞く。
- 式・参照・写しを通した間接の依りかかり。→ ⑥の検査で見つかる物は止める。見つからない物（見た目だけの依りかかり）は防げない。戻す前と後の絵を並べて見せることで補う。
- どこまで自動で解けるかは、P3 で実際の操作の並びを使って確かめる。

### 9.6 順番・版・ぶつかり

- **順番**：端末ごとに数える番号と端末 id の組（`seq`）で、どの端末でも同じ並びになるようにする。時計は使わない。
- **前提**：命令は、見ていた相手の `rev`（`base`）を運ぶ。当てる時に今の `rev` と違えば、あいだに入った記録の効果と**道ごとに**比べる。
  - 道が重ならない → そのまま当てる（別の部品・同じ部品の別の値）。
  - 同じ道への「足す量」どうし → 両方当てる。
  - 同じ道への「置きかえ」どうし・足した物と外した物の食い違い → **ぶつかり**。先の物を生かし、後の物は当てずに「ぶつかった変更」として残す（消さない）。画面で「こちらを採る」を選べる。
- 最初から、もっと複雑な自動の合わせ方（CRDT など）は入れない。まず「安全に見つけて、聞く」。

### 9.7 提案
```ts
type Proposal = { id:ProposalId, by:{agent:string, task:TaskId}, stage:string, title:string, why:string,
  commands: Command[],
  reads: { target:string, rev:number, paths?:PropPath[] }[]   // 提案が依りかかっている物（変える相手＋判断に使った物）
  preview?: string[], checks?: CheckResult[],
  status:'open'|'accepted'|'partly'|'rejected'|'stale' }
```
- 提案が今も生きているかは、**`reads` に書いた物が変わったかどうか**だけで決める（制作全体のハッシュでは決めない）。関係のない所を人が直しても、提案は無効にならない（AUTOMATION_DESIGN.md 6節）。

## 10. 今のデータからの移し方

| 今 | 新しい形 | 移し方 |
|---|---|---|
| 部品のパック（`pts`・`color`・`z`・`parent`・`joint`・`line`・`folder`・`hide`）| 素材の `Node` | 機械で移せる。点に id を振る。`z` → `order`、`joint` → `pivot`、`line` → `kind:'line'`、`folder` → `group` |
| 場面の指定 `{"t":"html",…,"ats":[言葉]}` | そのまま残す。新しい場面は `{"t":"doc","scene":id}` | 移さない |
| `flesh.blocks[].narr` | `script.lines`（トークンに分ける）| 機械で移せる |
| `rules`・`points`・指摘帳 | `library/rules.json` ほか | そのまま |
| `arts`（ラスター）| `kind:'image'` | 下敷き・質感として |
| `jobs` | 作業の札と提案 | 並べて動かし、少しずつ |

## 11. まだ決めていないこと
- 形の合成を、元を残す加工として持つか、結果に焼くか。
- 骨で形を曲げる所まで要るか。
- 命令の細かさ（1回のドラッグを何個にまとめるか）と、記録の大きさ・読みこみの速さ。
- 9.5節の「止まって聞く」が、実際にどのくらいの頻度で起きるか（多すぎれば使い物にならない）。
- トークンの細かさと、語りを直したときの id の残し方（6節）。
- 3節の上限の数字。
