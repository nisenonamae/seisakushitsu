# vendor（外から持ってきた物）

| ファイル | 出どころ | 版 | 大きさ | 使用の条件 |
|---|---|---|---|---|
| `canvaskit.js` | npm `canvaskit-wasm` の `bin/canvaskit.js`（Google の Skia。https://github.com/google/skia/tree/main/modules/canvaskit ）| 0.42.0（npm での公開 2026-08-18）| 120,877 バイト | BSD-3-Clause（`LICENSE.canvaskit.txt`）|
| `canvaskit.wasm` | 同じく `bin/canvaskit.wasm`（ふつうの組み立て。`full`・`profiling` は使っていない）| 0.42.0 | 7,317,345 バイト（gzip で 2,946,763）| 同上 |

- 取ってきた方法：`npm i canvaskit-wasm`（2026-11-27）。中身は変えていない。
- 読みこみ方：`CanvasKitInit({ locateFile: f => 'vendor/' + f })`。外の配信元からは読まない。
- **要確認**：wasm の中に入っている別の部品（FreeType・HarfBuzz・ICU・libpng など）それぞれの使用の条件は、まだ1つずつ確かめていない。本番に採る前に確かめる。
