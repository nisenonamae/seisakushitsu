# データの形（DATA_MODEL）

2026-11-27。**案**。名前や細部は試作（P3・P4）で変わりうる。書き方は TypeScript 風だが、言語を決めたわけではない。

## 1. 決まりごと

1. **id で指す**：部品・場面・素材は id を持ち、ほかからは id で指す（名前を変えても切れない）。
2. **元を残す**：清書・合成・変形は、元のデータの上に「加工」として重ねる。焼きこまない。
3. **どの値も動かせる**：数・色・点の位置は、すべて「値」（3節）で持つ。止まった値と動く値を区別しない。
4. **時刻は秒**。ただし絵の合図は、できるだけ「語りの言葉」に結ぶ（6節）。
5. **版の番号**：どのファイルにも `v`（形の版）を入れる。古い版は読みこむときに移し替える。
6. **小分け**：1つの大きなファイルにしない。場面・素材ごとに1ファイル。
7. **乱数は種で**：ばらつきは `seed` から計算する。同じデータなら同じ絵。

## 2. 置き方（ファイル）

```
projects/<制作id>/
  project.json          制作の表紙：題・工程の状態・自動化の度合い・場面の並び
  script.json           語り（構成・肉付け・語りの文と合図）
  scenes/<場面id>.json   場面：部品の木・時間の線・カメラ
  audio.json            音の置き方（語り・効果音・BGM）
  log/<日付>-<端末>.jsonl 命令の記録（足すだけ。書きかえない）
  proposals/<id>.json   AI の提案（まだ採っていない変更）
library/
  assets/<素材id>.json   素材：キャラ・背景・小物（絵＋リグ＋動きの部品）
  palettes.json         色の組
  motions/<id>.json     動きの部品（歩き・呼吸・揺れ）
  rules.json            決まり（今の rules を移す）
  refs/…                実物帳・手本帳（画像と索引）
media/…                 画像・音・動画（大きい物。JSON からは道で指す）
```

- 1ファイルは、小さいうちは数十KB まで。場面が大きくなれば、入れ子の場面に分ける。
- 今の `data.json` の `projects`・`rules`・`jobs` などは、当面そのまま置く（新しい仕組みは新しい置き場を使う）。

## 3. 値（動かせる値）

```ts
type Value<T> =
  | T                                   // 止まった値
  | { keys: Key<T>[] }                  // キーフレーム
  | { expr: string, base?: Value<T> }   // 式（base に式を重ねる）
  | { ref: string }                     // ほかの値・色の名前を指す

type Key<T> = {
  t: number | Cue          // 秒、または語りの合図（6節）
  v: T
  ease?: Ease              // この鍵から次の鍵までの速度の曲線
  hold?: boolean           // 次の鍵まで止める（差し替え絵に使う）
}
type Ease = 'linear' | 'in' | 'out' | 'inout' | [x1,y1,x2,y2]   // 4つの数＝自由な曲線
```

- 式は、決まった関数だけが使える小さな言葉（`time`・`loop()`・`wiggle(seed,速さ,幅)`・`follow(相手,遅れ)`・`spring()`・ほかの値の参照）。ふつうの JS は書けない＝同じ結果になり、安全。

## 4. 絵（ベクター）

```ts
type Node = {
  id: string
  name: string
  kind: 'group' | 'shape' | 'line' | 'instance' | 'image' | 'clone' | 'camera' | 'bone'
  parent?: string                  // 親（親が動くとついてくる）
  order: number                    // 重なり順（同じ親の中で）
  xf: {                            // 変形。どれも Value
    pos: Value<[number,number]>, rot: Value<number>, scale: Value<[number,number]>,
    pivot: [number,number]         // 回す中心＝付け根
  }
  opacity?: Value<number>
  visible?: Value<boolean>
  blend?: 'normal' | 'multiply' | 'screen' | 'add'
  mask?: string                    // この id の形で切り抜く
  depth?: number                   // 奥行き（カメラの視差に使う）
  lock?: Lock                      // 固定（AUTOMATION_DESIGN.md）
  tags?: string[]                  // 例：'光' '影' '目'。点検や AI の手がかり
  stage?: 0|1|2|3|4|5|6            // どの段で足した物か（段を分けて作る）
  meta?: { src?: string, by?: 'human'|'ai', note?: string }
}
```

### 形
```ts
type Shape = Node & { kind:'shape',
  geo: Geo                         // 形の元
  ops?: PathOp[]                   // 加工（壊さない）
  fill?: Paint
  stroke?: { paint: Paint, w: Value<number>, cap:'round'|'butt', join:'round'|'miter' }
}
type Geo =
  | { t:'path', pts: Value<Pt[]>, closed: boolean }           // 自由な曲線
  | { t:'ellipse', size: Value<[number,number]> }
  | { t:'rect', size: Value<[number,number]>, round: Value<number> }
  | { t:'capsule', len: Value<number>, w: Value<number> }     // 長丸
  | { t:'poly', n: number, r: Value<number>, round: Value<number> }
  | { t:'bool', op:'add'|'sub'|'and', of: string[] }          // 形の合成（ほかの形の id）
type Pt = {
  p: [number,number]
  in?: [number,number], out?: [number,number]   // 取っ手。無ければ自動（今の HND の式）
  corner?: boolean
}
type PathOp =
  | { t:'trim', from: Value<number>, to: Value<number> }      // 線を端から描く
  | { t:'round', r: Value<number> }                           // 角を丸める
  | { t:'offset', d: Value<number> }                          // 太らせる・やせさせる
  | { t:'wobble', amp: Value<number>, freq: number, seed: number }
  | { t:'mirror', axis:'x'|'y' }                              // 左右対称
type Paint =
  | { color: string }              // '#rrggbb' か 色の名前（'@hada' → palettes を見る）
  | { grad:'linear'|'radial', stops:[number,string][], from:[number,number], to:[number,number] }
```

- **取っ手は任意**：無ければ今の「少ない点をなめらかにつなぐ」式で自動に決まる（今の部品はそのまま移せる）。細かく決めたい点だけ取っ手を持つ。
- **図形は数値のまま**：円は円、長丸は長丸として持つ。だから丸みや長さを動かせる。自由に崩したくなったら `path` に変える（元の図形は記録に残る）。
- **線の部品**（`kind:'line'`）：中心の点＋太さ。今の `line:{pts,w}` と同じ考え。先細りも持てるようにする。
- **色は名前で指せる**：`'@hada'` のように書くと色の組の値になる。色の組を替えると全部変わる。

### ひな形と写し・並べて増やす
```ts
type Instance = Node & { kind:'instance',
  of: string                       // 素材 id か、場面 id（入れ子）
  variant?: string                 // 向き・版（'横' '正面' '斜め'）
  overrides?: { [nodeId_値の道: string]: any }  // この写しだけ変える所
  time?: { offset: Value<number>, speed?: number, loop?: boolean }   // 入れ子の時間
}
type Clone = Node & { kind:'clone',
  of: string
  layout: { t:'grid'|'line'|'path'|'scatter', n: number, … }
  vary: { pos?:number, rot?:number, scale?:[number,number], hue?:number, time?:number, seed:number }  // ばらつき
}
```

## 5. リグ

```ts
type Bone = Node & { kind:'bone', len: number, limit?: [min:number,max:number] }
type Rig = {
  bones: string[]                              // 骨の id（親子で鎖になる）
  ik?: { chain: string[], target: string, bend: 1|-1 }[]
  binds: { node: string, bone: string }[]      // どの部品がどの骨につくか
  controls: { id:string, name:string, drives: {path:string, map:[number,number]}[] }[]  // つまみ（例：口の開き 0〜1）
  swaps?: { id:string, name:string, options: { name:string, show:string[] }[] }[]       // 差し替え（口の形・まぶた）
  poses?: { name:string, values:{[道:string]:any} }[]                                   // 名前つきの姿勢
}
```
- 最初は「親子＋付け根＋差し替え＋つまみ」だけで始める。骨と IK は次の段階。
- **向きの違う絵**は、同じ素材の `variants`（横・正面・斜め）として持ち、つまみ・差し替えの名前をそろえる。

## 6. 時間と語り

```ts
type Cue = { line: string, word?: string, offset?: number }
// 例 { line:'L012', word:'カバは', offset:-0.2 } ＝ 語りの12行めの「カバは」の 0.2秒前
type Script = {
  lines: { id:string, chapter:string, text:string, voice?:{…}, t0?:number, t1?:number,
           words?: { w:string, t:number }[] }[]     // t0・t1・words は、声を作ったあとに自動で入る
}
```
- 絵の鍵の時刻に `Cue` を書ける。声を作り直すと、`Cue` から秒が計算し直される。**語りを直しても絵がずれない**（今の `ats` の考えを一般化した物）。
- 秒で直接書くこともできる（語りのない所・エンディング）。

## 7. 場面

```ts
type Scene = {
  v: number, id: string, name: string
  size: [1920,1080], fps: 60 | 30
  dur: number | { from: Cue, to: Cue }
  nodes: { [id:string]: Node }
  root: string[]
  camera?: string                  // カメラの id（位置・寄り・回り・ぼかしの深さを Value で持つ）
  markers?: { t:number|Cue, name:string }[]
  stage: 0|1|2|3|4|5|6             // いまどの段まで作ったか
  status: 'draft'|'review'|'ok'
}
```

## 8. 制作の表紙と自動化

```ts
type Project = {
  v:number, id:string, title:string
  stages: { [工程:string]: {
    mode: 'human' | 'collab' | 'ai'         // 自動化の度合い。いつでも変えられる
    status: 'todo'|'doing'|'review'|'ok'
    perms?: Perms                            // この工程で AI に許すこと（無ければ既定）
    budget?: { rounds:number }               // 見直しの上限など
  } }
  scenes: { id:string, chapter:string, order:number }[]
  palette: string
  locks: Lock[]
}
type Lock = { target:string /* 部品・場面・値の道 */, level:'frozen'|'ask', by:string, at:number, why?:string }
```
- 工程の名前（案）：`topic` `research` `outline` `flesh` `board` `assets` `rig` `motion` `camera` `comp` `sound` `title` `thumb` `export`。
- 度合いは場面ごとに上書きできる（例：つかみの場面だけ「人が主導」）。

## 9. 命令と記録

```ts
type Command = {
  id:string, at:number, by:{ who:'human'|'ai', agent?:string, device?:string }
  scope:{ project:string, file:string }
  op:string                        // 例 'node.add' 'pt.move' 'key.set' 'node.reparent' 'paint.set'
  args:any
  undo:any                         // 逆向きにするのに要る情報
  group?:string                    // ひとまとめに取り消す単位（1回のドラッグ・AI の1つの作業）
  proposal?:string                 // 提案から採った物なら、その id
}
type Proposal = {
  id:string, by:{agent:string}, at:number, stage:string, title:string, why:string
  base:string                      // どの時点の文書に対する提案か
  commands:Command[]
  preview?:string[]                // 見本の画像・動画
  checks?:CheckResult[]            // 機械の点検の結果
  status:'open'|'accepted'|'partly'|'rejected'|'stale'
}
```
- 記録は足すだけ。取り消しは「逆向きの命令を足す」。だから、どの端末・誰の変更でも1つずつ戻せる。
- 文書そのもの（`scenes/*.json`）は、記録から作り直せる。読みこみを速くするための写しとして置く。

## 10. 今のデータからの移し方

| 今 | 新しい形 | 移し方 |
|---|---|---|
| 部品のパック `items[].parts[]`（`pts`・`color`・`z`・`parent`・`joint`・`line`・`folder`・`hide`） | 素材 `assets/*.json` の `Node` | 機械でそのまま移せる。`pts` → `geo:{t:'path'}`（取っ手なし）、`line` → `kind:'line'`、`folder` → `group`、`joint` → `pivot` |
| 場面の指定 `{"t":"html","page","mode","ats"}` | そのまま残す。新しい場面は `{"t":"doc","scene":id}` | 移さない（新しい動画から） |
| `flesh.blocks[].narr` と `ats` | `script.lines` と `Cue` | 語りは機械で移せる。合図は新しい場面でだけ使う |
| `rules`（117）・`points`・指摘帳 | `library/rules.json` ほか | そのまま |
| `arts`（ラスターのレイヤー） | `kind:'image'` として置ける | 下敷き・質感として使う |
| `jobs` | 提案と作業の記録（AUTOMATION_DESIGN.md） | 並べて動かし、少しずつ移す |

## 11. まだ決めていないこと
- 形の合成を「元を残す加工」として持つか、結果の曲線に焼くか（計算の重さと直しやすさのつり合い）。
- 骨で形を曲げる（メッシュの変形）まで要るか。まずは部品を回すだけで足りるか。
- 命令の細かさ（1つのドラッグを何個の命令にするか）と、記録の大きさ。
- 2台で同時に直したときの解き方（P3 で試す）。
