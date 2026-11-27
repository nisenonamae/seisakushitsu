# データの形（DATA_MODEL）

2026-11-27 改訂4。**案**。名前や細部は試作で変わりうる。書き方は TypeScript 風だが、言語を決めたわけではない。

**改訂2で変えたこと**：①値（Value）を種類の札つきにした ②式を小さな専用の言葉にし、上限を決めた ③語りの合図（Cue）を、文字列でなく変わらない番号（トークン id）で指す形にした ④点・鍵にも変わらない id を付けた ⑤部品ごとに版の番号（rev）を持たせた ⑥命令（Command）を種類ごとの型にし、検査・前提・取り消し・重複・版・ひとまとめの適用を決めた ⑦AI の変更だけを取り消す方法を決めた。

**改訂4で変えたこと（P3a の試作の結果を反映。もとは `lab/p3a/RESULTS.md`）**：①数を格子に乗せ、丸め方を決めた（3節）②変形を当てる順番を決めた（4節）③命令を足した：図形の種類・清書（`geo.set`）、道を閉じる（`geo.close`）、塗り・線の有り無し（`paint.set`）、見せる・隠す（`node.show`）、伸ばす・反転（`prop.scale`）、複製（`node.dup`）④命令の種類から工程・許可の区分を核が決める表を置いた（9.2節）⑤当てる手順の順番と、4つの結果を書き直した（9.3節）⑥選んで取り消すとき、効果ごとでなく**部品ごと・作業ごとにまとめて1つの画面で見せ、既定は「残す」**にした。表に行を足した（9.5節）⑦効果の形に、後ろの隣・掛けた量・種類の印を足した（9.1節）⑧版の数字を部品の外に持つ（1節・7節）⑨行の本文はトークンから作る（6節）。

## 1. 決まりごと

1. **id で指す**：部品・場面・素材だけでなく、**点・鍵・色の止め・語りのトークン**も id を持つ。並び順（何番め）では指さない。← 改訂2。並び順で指すと、人と AI が同じ形の別の点を直しただけで、ぶつかったり、取り消しで別の点が動いたりする。
2. **元を残す**：清書・合成・変形は、元のデータの上に「加工」として重ねる。
3. **どの値も動かせる**：数・色・点の位置は、すべて「値」（3節）で持つ。
4. **時刻は秒**。絵の合図は、できるだけ語りのトークンに結ぶ（6節）。
5. **版の番号が2種類**：ファイルの形の版 `v`（古い形は読みこむときに移し替える）と、部品ごとの中身の版 `rev`（変わるたびに1つ増える）。`rev` の数字は、部品の中ではなく場面の表（`Scene.revs`）に持ち、**外した部品の数字も消さない**（改訂4）。
6. **小分け**：1つの大きなファイルにしない。
7. **乱数は種で**：同じデータなら同じ絵。
8. **端末の時計を信じない**：順番は時計でなく、数えた番号で決める（9.6節）。← 今の制作室で、端末の時計が約2分ずれて書き込みが消えた事故があったため。
9. **数は格子に乗せる**：位置・角度・比・秒は、決まった細かさの格子の上の数として持つ（3節「数の決まり」）。← 改訂4。小数のままだと「足して、引く」で元に戻らない。

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

### 数の決まり（改訂4）

- **格子**：位置・長さ（画素）、角度（度）、比（伸ばし・不透明度）、秒は、どれも **1/10000 の格子**に乗せる。色は 8 ビット（0〜255）の整数。格子の細かさは置き値（要調整）。
- **丸めるのは核**：命令を受け取った所（9.3節②）で、送られた数を格子に丸める。送る側が丸めていなくてもよいが、記録に残るのは丸めたあとの数。
- **丸め方**：いちばん近い格子へ。ちょうど半分のときは、**0 から遠い方**へ。言語の既定の丸め（JavaScript の `Math.round` は、半分を正の方へ丸める）には任せず、核の中に1つだけ書く。
- **計算は格子の整数で行う**：足す・引くは、格子の数（整数）どうしで行うので、ぴったり逆向きにできる。掛ける・割るは、結果を格子に丸める。だから「掛けた量」の効果は `before`・`after` を持ち、そのまま戻すときはぴったり戻す（9.1節・9.5節の行 6）。
- **角度は巻き戻さない**：370 度は 370 のまま持つ（1回転と少し、の意味を残す）。
- **見せる時の計算（補間・式・描画）は格子に乗せない**。格子は、文書に保存する値だけの決まり。
- ブラウザと Node で同じ結果になることを、P3b の前に確かめる【未】。

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
- 式の大きさ：節 200個まで・深さ 16 まで。深さは、同じ強さの演算の並び（`a+b+c+…`）を1つの節として数える（改訂4。2つずつの木で数えると、17 項で上限に当たる）。
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
- `rev` は読むときの写しで、本物は場面の表（`Scene.revs`）にある（1節の5）。
- **変形を当てる順番（改訂4）**：部品の中の点 p は、`pos + 回す(rot)·伸ばす(scale)·(p − pivot)` の順で画面の位置になる（付け根 `pivot` を原点にして、伸ばす → 回す → 動かす）。親があれば、その結果に親の変形を同じ順で重ねる。反転は `scale` の負の値。

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
- 図形の種類を変える・自由な形に変える・清書は、`geo` を丸ごと置きかえる命令 `geo.set`。点の id は、命令が運ぶ対応表で引きつぐ（対応の無い点は新しい id）。道を閉じる・開くは `geo.close`。塗り・線を付ける・外すは `paint.set`（9.2節）。
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
type Line   = { id: LineId, rev:number, chapter:string, tokens: Token[], voice?: {…} }   // 本文は tokens をつなげた物。別には持たない（改訂4）
type Token  = { id: TokenId, text:string, t0?:number, t1?:number }   // t0・t1 は声を作ったあとに自動で入る
type Cue    = { token: TokenId, edge:'start'|'end', offset?: number }
```

- 行の本文は、トークンの `text` をつなげて作る。← 改訂4。本文とトークンを両方持つと、取り消しの途中で食い違う（P3a）。
- **合図は、文字列でなくトークンの id で指す。** ← 改訂2。前の案（行と言葉の文字列）だと、同じ言葉が2回出る行・語りを書きかえた行で、どこを指すかがあいまいになる（今の `ats` も言葉の文字列なので、同じ弱みを持つ）。
- トークンは、語りの行を声の区切り（今の道具が VOICEVOX から取っている区切りと時刻）に分けた物。
- **語りを直したとき**：前の行と新しい行を比べ、変わっていないトークンは同じ id のまま残す。新しい言葉には新しい id。消えたトークンを指していた合図は「宙に浮いた合図」になる。**勝手に近くへ付け替えない**。点検で必須の不合格にし、「近くのこのトークンに付け替えますか」と候補を出す。
- 画面では、合図を「言葉＋何回め」で見せる（id は見せない）。
- 秒で直接書くこともできる（語りのない所）。

**まだ決めていない**：トークンの細かさ（文節か、もっと細かくか）。大きく書きかえたときに、どこまで同じ id を残せるか（P3 で、実際の語りの直しを使って確かめる）。

## 7. 場面
```ts
type Scene = { v:number, id:SceneId, seq: Seq /* どこまで当てたか */, hash:string,
  revs: { [target:string]: number },   // 部品・行ごとの版。外した物の数字も残す（改訂4）
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
  actor: { k:'human', device:DeviceId } | { k:'ai', agent:string, task:TaskId }   // 名乗り。権限はここからは決めない（下）
  group?: GroupId               // ひとまとめに当てる・取り消す単位（1回のドラッグ・AI の1つの作業）
  proposal?: ProposalId         // 提案から採った物なら
  base: { [target:string]: number }   // 前提：この命令が見ていた、相手の rev。**触る物の分は必ず書く**
  body: CommandBody             // 種類ごとの中身（9.2節）
}
type Sender = { k:'human', device:DeviceId } | { k:'ai', agent:string, task:TaskId }
// 核を呼ぶ側が渡す「確かめられた送り主」。命令の中の actor（名乗り）とは別物。
// 権限は Sender からだけ決める。actor が Sender と食い違う命令は forbidden で断る。
// Sender をどう確かめるか（端末の署名）は SYSTEM_ARCHITECTURE.md 5b節（承認待ち・P3b）。

type Result =                   // 核が返す物は、この4つのどれか
  | { status:'applied',  entry: Applied }
  | { status:'proposed', why:'collab'|'lock-ask'|'previous-stage'|'remove'|'perm-propose'|'human-touched' }   // 文書は変わらない。提案に回す
  | { status:'duplicate', entry: Applied }                 // もう当てた命令。前と同じ結果を返す
  | { status:'rejected', why:'invalid'|'forbidden'|'locked'|'stale'|'conflict'|'breaks-invariant'|'duplicate', detail:string }

type Applied = {                // 核が当てたあとに記録へ書く物
  cmd: Command
  sender: Sender                // 当てた時に確かめられていた送り主
  seq: Seq                      // 核が付ける順番
  effects: Effect[]             // 実際に変わった所。取り消しの元
  revs: { target:string, from:number, to:number }[]
  policy: { mode:Mode, perms:string, locks:string[], stage:string, area:string }   // 当てた時の度合い・許可・固定と、核が決めた工程・区分（9.2節の表）
}
type Effect =
  | { k:'set',    at: PropAddr, before:any, after:any, kind?: true }    // 値を置きかえた。kind＝種類ごと変えた（固定↔鍵、図形の種類、清書）
  | { k:'delta',  at: PropAddr, d:number[] }                            // 数を足した（動かす・回す）
  | { k:'mul',    at: PropAddr, f:number[], before:number[], after:number[] }   // 数を掛けた（伸ばす・反転）
  | { k:'insert', at: ListAddr, item:any, after?: string, next?: string }      // 並びに足した（点・鍵・部品）
  | { k:'remove', at: ListAddr, item:any, after?: string, next?: string, rev?: number }   // 並びから外した（中身と版は残す）
  | { k:'move',   node: NodeId, from:{parent?:NodeId,order:Rank}, to:{parent?:NodeId,order:Rank} }

type PropAddr = { scene:SceneId, node:NodeId, path:PropPath, pt?:PtId, key?:KeyId, stop?:StopId, op?:OpId }   // 点・鍵は id でたどる。何番めかでは指さない
type ListAddr = { scene:SceneId, node?:NodeId, list:'nodes'|'pts'|'keys'|'ops'|'stops'|'lines'|'locks'|'intent', path?:PropPath }
```

- **取り消しに要る情報（`effects`）は、核が当てる時に自分で作る。** 送る側（とくに AI）が書いた「取り消し方」は信じない。
- `before` を持つのは「置きかえ」と「掛けた」。「足した量」「足した物」「外した物」は、それ自体が逆向きにできる。**これが成り立つのは、数を格子に乗せているから**（3節「数の決まり」）。
- `insert`・`remove` は、前の隣（`after`）と後ろの隣（`next`）の両方を持つ。← 改訂4（P3a）。前の隣だけだと、その隣が消えていたときに戻す位置が決まらない。両方とも無ければ、並びの最後に戻す。
- 外した物の版（`rev`）も残す。版の数字は部品の外の表（`Scene.revs`）に持ち、外した物の数字も消さない。← 改訂4。消すと、古い前提の命令を見分けられない。

### 9.2 命令の種類（型で決める）

`CommandBody` は、`type` の札で見分ける決まった一覧。一覧にない命令は存在しない。引数は種類ごとに形が決まっていて、当てる前に必ず検査する（形・範囲・id が実在するか）。

| まとまり | 種類 | 効果の型 | 区分（核が決める）|
|---|---|---|---|
| 部品 | `node.add`（中身ごと。子・点・鍵を含んでよい。貼り付けもこれ）| insert | 作る |
| 部品 | `node.dup`（複製・反転の写し。新しい id の対応表を命令が運ぶ）| insert | 作る |
| 部品 | `node.remove` | remove | 消す |
| 部品 | `node.move`（親・順番）`node.rename` `node.show`（見せる・隠す）| move / set | 相手の部品の区分（下）|
| 値 | `prop.set`（道と値）`prop.nudge`（数を足す）`prop.scale`（数を掛ける）| set / delta / mul | 道で決まる（下）|
| 値 | `prop.kind`（固定↔鍵↔式↔参照）| set（kind）| 動き |
| 形 | `geo.set`（図形の種類を変える・自由な形に変える・清書。形ごと置きかえる）| set（kind）| 絵の形 |
| 形 | `geo.close`（道を閉じる・開く）| set | 絵の形 |
| 形の点 | `pt.add` `pt.remove` `pt.nudge` `pt.handle` `pt.corner` | insert / remove / delta / set | 絵の形 |
| 塗りと線 | `paint.set`（塗り・線を付ける・外す・種類を変える）| set | 色 |
| 鍵 | `key.add` `key.remove` `key.retime` `key.value` `key.ease` | insert / remove / set | 動き |
| 形の加工・色の止め | `op.add` `op.remove` `stop.add` `stop.remove` | insert / remove | 絵の形／色 |
| 写し | `override.set` `override.clear` | set | 上書きする道で決まる |
| 語り | `line.add` `line.remove` `line.edit`（トークンの対応つき）| insert / remove / set | 語り |
| 語り | `cue.attach`（合図をトークンに結ぶ）| set | 動き |
| 表紙 | `mode.set` `perms.set` `lock.add` `lock.remove` `status.set` | set / insert / remove | **人だけ** |
| 表紙 | `intent.add` `intent.remove`（警告を意図ありで通す札）| insert / remove | 通す札 |
| 提案 | `proposal.accept`（どの命令を採るか）`proposal.reject` | （中の命令を当てる）| **人だけ** |
| 取り消し | `revert`（どの記録を、どう戻すか。9.5節）| （逆向きの効果）| 戻す相手の記録の区分 |

**区分の決め方（改訂4）**：命令がどの工程・どの許可の区分に当たるかは、**命令の種類と、相手の部品・道から、核が決める**。命令には書かせない。← 書かせると、AI が「度合いが AI の工程の命令です」と名乗れてしまう（P3a）。

| 相手 | 区分（許可 `write.〜`）| 工程 |
|---|---|---|
| 部品の種類が `camera` | カメラ | カメラ |
| 部品の種類が `bone`、道が `xf.pivot`・リグ（5節）の中身 | リグ | リグ |
| 道が `fill.*`・`stroke.paint.*`・色の止め・`opacity`・`blend` | 色 | 絵 |
| 道が `geo.*`・点・`stroke.w`・`stroke.cap`・`stroke.join`・形の加工・`xf.*`・`visible`・`mask`・親と順番・名前 | 絵の形 | 絵 |
| 上のどれでも、**値の種類が鍵・式になっている所**、または鍵・合図・種類を変える命令 | 動き | 動き |
| 語りの行 | 語り | 語り |

- 1つの命令が2つの区分にまたがるとき（例：色に鍵を打つ）は、**両方の許可が要る**（厳しい方に合わせる）。
- 点を消す（`pt.remove`）・鍵を消す（`key.remove`）は「消す」ではなく、それぞれ「絵の形」「動き」。許可の `remove` は、部品・場面・素材・語りの行を消すことを指す。
- AUTOMATION_DESIGN.md 3節・4節の検査は、この表で決まった区分を使う。

**動かす・回す・伸ばす**
- 動かす（`xf.pos`）・回す（`xf.rot`）・点を動かす（`pt.nudge`）は「足す量」（`prop.nudge`）。← 「AI が右へ 10、そのあと人が上へ 5」のとき、AI の分だけを戻しても人の分が残る。
- **伸ばす・反転は「掛ける量」（`prop.scale`）**。← 改訂4（P3a）。伸ばすは掛け算なので、足す量には乗らない。反転は −1 を掛ける。
  - 中心を決めて伸ばす・反転するときは、`xf.scale` に掛ける命令と、`xf.pos` に足す命令を、同じ group で送る。
  - 部品の伸ばしは `xf.scale` を変える。点の位置には焼かない。**点に焼く**（伸ばした結果を点の座標にする）のは `geo.set` で、種類を変える扱い（9.5節）。
  - 0 を掛ける命令は断る（逆向きにできない）。
- 鍵のある値には、足す・掛ける命令は使えない（`invalid`）。鍵ごとに `key.value`（置きかえ）で変える。したがって、AI が変えた鍵を人が変えれば「上書き済み」になる（9.5節）。鍵のある値を全体にずらす操作は、まだ設計していない【未】。

**複製（`node.dup`）**：新しい部品・点・鍵の id は、送る側が対応表（元の id → 新しい id）として命令に入れる。核は元の中身を写し、id を付け替え、`insert` の効果に**写した中身の全部**を残す。← 記録だけから作り直せるようにするため（P4 の操作の記録には中身が無く、流せなかった）。

- 種類ごとに `v`（形の版）を持つ。形を変えたら版を上げ、古い記録は読む時に新しい形へ移す。記録そのものは書きかえない。

### 9.3 当て方（1つの決まった手順）

```
受け取る（命令 ＋ 呼ぶ側が渡す「確かめられた送り主」）
 ① 重複か：同じ id を**当てた**記録があれば、何もせず、前と同じ結果を返す（duplicate）。
            同じ id で中身が違えば断る。断られた命令・提案に回った命令は覚えない（もう一度来たら、もう一度検査する）
 ② 形の検査：種類・版・引数。数を格子に丸める（3節）。名乗り（actor）が送り主と合うか
 ③ 許しの検査（前半）：効果を見なくても決まる物。人だけの命令・度合いが Human・許可が不可
 ④ 前提の検査：触る物の rev が base に書いてあるか（無ければ stale）。今と違えば、道ごとにぶつかりを見る（9.6節）
 ⑤ 控えの上で当て、効果を作る（group は全部まとめて、書かれた順に）
 ⑥ 許しの検査（後半）：効果を見て決まる物。固定に当たるか・前の段の物か・消すか・人が触った所か
 ⑦ 全体の決まりの検査：切れた参照・親子の輪・式の参照の輪・上限
 ⑧ ③⑥で「提案に回す」なら、何も変えずに proposed を返す。
    どれか1つでもだめなら、何も変えずに断る（理由の札つき）。
    全部よければ、控えを本物にし、rev を上げ、記録に足す
```

- **ひとまとめに当てる**：1つの命令も、group も、「全部入る」か「何も入らない」かのどちらか。途中まで入った状態は外から見えない。group の中の命令は、group の始めの版から、その時点の版までを前提にできる。
- **効果を作ってから固定を見る**（改訂4）：固定や「前の段の物か」は、命令が実際にどこを変えるかが分からないと判定できない。控えの上で当てるので、断るときも文書は変わらない。
- 結果は4つ（9.1節 `Result`）：当たった・提案に回した・重複・断った。提案に回る命令も、②④⑦の検査は受ける（当たらないと分かっている提案を作らない）。
- 断るときは理由の札を返す（`invalid`・`forbidden`・`locked`・`stale`・`conflict`・`breaks-invariant`・`duplicate`〔同じ id で中身違い〕）。画面も AI も、同じ札を受け取る。
- **当てる順番**：group の中は書かれた順。取り消しは逆の順（新しい効果から）。複数の記録を戻すときは、新しい記録から。
- ⑦は、命令が触った物から届く範囲だけを調べる（触った部品・その親子・それを指す参照）。← 試作は毎回、文書の全部を調べていた（部品 300 で1命令 1.8 ms）。範囲をしぼっても同じ答えになることは、全部を調べる版と突き合わせて試す。
- 核は「文書＋命令＋送り主 → 結果」を返すだけの計算。画面・通信・時計・乱数に触らない。

### 9.4 ふつうの取り消し

直前の自分の操作を戻す（Ctrl+Z）。その記録の `effects` を逆向きにした `revert` を足す。記録は消さない。取り消しの取り消し（やり直し）も同じ仕組み。直前の操作のあとに何も起きていないので、9.5節の表では「そのまま」の行だけを通り、聞くことは無い。

- 打ち消し合った組（直して、取り消した）は、9.5節の「その後に起きたこと」に数えない。やり直したら、また数える。

### 9.5 選んで取り消す（AI の変更だけを戻す）

**問題**：AI が部品 A を変え、そのあと人が同じ A を直した。ここで AI の変更だけを戻したい。履歴を巻き戻すと、人の直しも消える。

**やり方**：3つの層に分ける。①効果ごとに判定する（核）②判定を「決める単位」にまとめる（核）③人には、戻す操作1回につき1つの画面で見せる。巻き戻しはしない。

#### ① 効果ごとの判定

戻したい記録の効果を1つずつ見て、**その後に何が起きたか**で分ける。

| # | 効果 | その後 | すること |
|---|---|---|---|
| 1 | 置きかえ（set） | だれも同じ所を変えていない | `before` に戻す |
| 2 | 置きかえ（set） | 同じ所をさらに置きかえた | **何もしない**（AI の値はもう残っていない）。「上書き済み」|
| 3 | 置きかえ（set） | 同じ所に足した・掛けた | **残す**（単位にまとめて知らせる）。← AI の置いた値を足場にした直しなので、差し引きの答えを核が決めない |
| 4 | 足した量（delta） | 同じ所に足している | AI の分だけ引く。その後の分は残る |
| 5 | 足した量（delta） | 同じ所を置きかえた | 何もしない（上書き済み）|
| 6 | 掛けた量（mul） | そのまま | `before` に戻す（ぴったり戻る）|
| 7 | 掛けた量（mul） | 同じ所に掛けている | AI の分だけ割る（格子に丸める。誤差は格子の半分まで）|
| 8 | 掛けた量（mul） | 同じ所を置きかえた | 何もしない（上書き済み）|
| 9 | 足した量・掛けた量 | その値の種類を変えた（固定 → 鍵 など）| **残す**（単位にまとめて知らせる）|
| 10 | 足した物（insert：点・鍵・部品） | だれも触っていない | 外す |
| 11 | 足した物（insert） | それを直した・それに子を付けた・それを参照した | **残す**（単位にまとめて知らせる。人が選べば、直しごと外せる）|
| 12 | 外した物（remove） | 入れ物がそのままある | 戻す（中身と版は記録に残っている）|
| 13 | 外した物（remove） | 入れ物が無い・置きかわった（親が消えた、鍵をやめて固定にした など）| **残す**（戻せないと知らせる）|
| 14 | 親・順番の移動（move） | さらに移した | 何もしない（上書き済み）|
| 15 | 親・順番の移動（move） | そのまま | 元の親・順番へ。元の親が無い・輪になるなら、残す |
| 16 | 種類を変えた（set の kind：図形の種類・清書・固定↔鍵） | そのまま | `before` に戻す |
| 17 | 種類を変えた（set の kind） | 変えたあとの中身を直した（清書のあとの点を動かした など）| **残す**（単位にまとめて知らせる）|
| 18 | どれでも | 相手が固定 frozen | 変えない。「固定されている」と知らせる（人が固定を外してから、やり直す）|
| 19 | どれでも | もう戻してある | 何もしない |

- 行 1・2・4・10・11・12・14・15 は改訂2のまま。ほかは改訂4で足した（P3a が決め打ちにした6つと、掛ける量・種類の変更）。
- 「同じ所」は、**値の道の単位**で見る（部品の単位ではない）。AI が色を変え、人が位置を変えたなら、ぶつからない。
- **「その後に起きたこと」に数える物**：戻す記録の集まりに入っていない、あとの記録の全部。**人の物も、ほかの AI の作業の物も数える**（ほかの AI の作業を黙って壊すこともしない）。
- **数えない物（取り消しの鎖）**：直して、その直しを自分で取り消した物は、打ち消し合ったとして数えない。やり直したら、また数える。← 数えると、聞く回数が増えるうえ、人が元へ戻しただけの値を「人が決めた値」と取り違える（P3a）。
- 戻したあとに 9.3節⑦ の検査を通す。通らない効果（例：外すと、人の作った部品の参照先が無くなる）は「残す」に回す。

#### ② 決める単位にまとめる

①で「残す」になった効果を、効果ごとに聞くと数が多すぎる（P3a の筋書きでは、効果の 18.5%。下組みを丸ごと戻すと 60〜85%）。**部品ごとにまとめ、戻す操作1回を1つの画面にする。**

| 単位の種類 | まとめ方 | 人に見せる文 |
|---|---|---|
| **AI が足した部品** | その部品と、その中の点・鍵・加工の効果の全部を1つに | 「この部品は AI が足し、あなたが N か所直しています」|
| **今ある部品に AI が足した点・鍵** | 部品ごと・並びごと（点、または1つの値の鍵）に1つ | 「この部品に AI が足した点 N 個のうち、M 個をあなたが直しています」|
| **種類を変えた・戻せない** | 部品ごとに1つ | 「AI が形を清書し、あなたがそのあと点を直しています」「戻す先（親）がもうありません」|
| **固定されている** | 部品ごとに1つ（選べない）| 「固定されているので、変えていません」|
| **ほかの AI の作業が上に乗っている** | 作業ごとに1つ | 「あとの AI の作業 T も、ここを直しています。一緒に戻しますか」|

**単位の中は割らない**（一貫性の決まり）
- AI が足した部品を「残す」なら、その部品に対する同じ作業の効果は**全部そのまま**にする（色だけ AI の途中の値に戻る、のような中途半端を作らない）。「外す」なら全部外す。
- 1つの形の点は、同じ作業が足した分を**全部残すか、全部外すか**。一部だけ外すと、人も AI も作っていない形になる。
- 入れ物（group）は、AI が足した物でも、中に残る部品が1つでもあれば残す。空になったら外す。
- 今ある部品の、ほかの値（色・位置など）の効果は、単位に入れない。①の表のとおり、道ごとに別々に決まる。

```ts
type RevertPlan = {
  of: Seq[]                      // 戻す記録（AI の1回の作業、または選んだ記録）
  at: Seq                        // この計画を計算した時点
  auto: { reverted:number, superseded:number, subtracted:number }   // 聞かずに済む分。画面では数だけ見せ、開けば中身を見られる
  units: Unit[]                  // 人が決められる単位
}
type Unit = {
  id: string, node: NodeId, name: string
  why: 'ai-added-part'|'ai-added-items'|'kind-changed'|'cannot-restore'|'breaks-invariant'|'frozen'|'later-ai'
  effects: { seq:Seq, i:number }[]            // この単位に入る、戻す側の効果
  later: { sender: Sender, seq: Seq, what: string }[]   // 「外す」を選ぶと一緒に失われる、あとの直しの全部
  choices: ('keep'|'drop')[]                  // frozen・cannot-restore は keep だけ
}
```

#### ③ 戻す操作（2段）と、安全の決まり

```
1. 計画を作る（plan）：文書を変えない計算。RevertPlan と、戻す前・戻したあとの絵を返す
2. 画面が1つだけ見せる：
     「N 個は戻せます。M 個の部品は、あなたの直しがあるので残します」＋前と後の絵
     ［この内容で戻す］（既定）　［部品ごとに選ぶ］　［やめる］
3. 命令 revert を送る：{ of, at, decisions?: { [unit]: 'drop' }, ack?: { [unit]: Seq[] } }
4. 核は、当てる時に計画を自分で作り直し、送られた内容と突き合わせる
```

1. **既定は「残す」**。決める単位は、何も選ばなければ全部残る。つまり、**戻す操作そのものは止まらない**：戻せる分を戻し、残した物を一覧で知らせる。「止まって聞く」を「残して知らせる」に変えた。失われる物が無いので、確認を減らしても安全は下がらない。
2. **「外す」は、人が、単位ごとに、失われる直しを見たうえで選ぶ**。命令には、見た直しの一覧（`ack`）を入れる。核は当てる時に計画を作り直し、**`ack` に無い直しが増えていたら断る**（`stale`。計画を作り直して、もう一度見せる）。← 画面を見ている間に入った直しを、知らないまま壊さないため。
3. **「外す」を選べるのは、確かめられた送り主が人のときだけ**。AI の `revert` は、既定（全部残す）でしか出せない。AI が戻せるのは AI の記録だけで、人の記録を戻す命令は断る（`forbidden`）。度合いが Collaborative なら、AI の `revert` も提案になる。
4. 「まとめて全部外す」は、［部品ごとに選ぶ］を開いた中にだけ置く。押すと、失われる直しの数と一覧を出してから、もう1回確かめる。最初の画面には置かない。
5. 残した物は、`revert` の記録に一覧として残る。あとから人が、ふつうの操作で外せる（それも取り消せる）。
6. 固定 frozen の物は、人の `revert` でも変えない。外すなら、先に固定を外す。
7. 結果は `revert` の命令として記録に残り、それ自体を取り消せる。
8. **核は、足りない情報を推し量って埋めない**。行 3・9・17 のように、差し引きの答えが1つに決まらないときは、残す。

**この仕組みでも変わらないこと（正直な限界）**
- **AI が丸ごと作った物を、人が直したあとで「無かったことにする」ことは、もともとできない。** 人の直しは AI の物の上に乗っているので、残すか、直しごと外すかのどちらかしかない。この仕組みが減らすのは「聞かれる回数」で、「残る物の数」ではない。下組み＋人の作り方では、下組みは人が直した時点で人の物になる、と考えるのが正しい。下組みが気に入らないなら、**直す前に**断る。
- 人の直しが AI の形を前提にしている場合のうち、値としてぶつからない物（AI が足した点の隣の点を、人が合わせて動かした など）は見つけられない。戻す前と後の絵を必ず並べて見せることで補う。
- 式・参照・写しを通した間接の依りかかりは、⑦の検査で見つかる物だけ止まる。
- **決める単位が1回の操作でいくつ出るかは、まだ測っていない**（P3a が測ったのは効果ごとの数）。P3a の `tools/measure.js` を単位ごとに数える形に直し、P4 の本物の操作の記録でも測る。

### 9.6 順番・版・ぶつかり

> **書き直しの予定（2026-11-27）**：下の「端末ごとに数える番号と端末 id の組」だけでは、オフラインだった端末の命令が過去に割りこむ。手当ての案（順番の台帳）と、送り主を名乗りで信じない案（端末の署名）を SYSTEM_ARCHITECTURE.md 5b節に書いた。作り手の承認のあと、この節と 9.1節の `actor`・`Applied` の扱いを書き直す。「道ごとに比べる」決まりは変わらない。


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
- 9.5節の決める単位が、本物の操作で1回にいくつ出るか（P3a が測ったのは効果ごとの数だけ。筋書きで 18.5%）。P4 の操作の記録で測る。
- 鍵のある値を全体にずらす・伸ばす操作を、足す量・掛ける量としてどう持つか（9.2節）。
- 9.6節の「ぶつかった変更として残す」の置き場（P3a の核は `conflict` を返すだけ）。前提を、物ごとの版で運ぶか、台帳の位置で運ぶか（P3b）。
- 色の名前（palette）への参照が切れていないかの検査。式の計算と、1コマの計算量の上限の数え方。
- トークンの細かさと、語りを直したときの id の残し方（6節）。
- 3節の上限の数字。
