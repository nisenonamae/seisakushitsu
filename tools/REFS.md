# 実物帳・手本帳・好み帳（見直しループの次の段で使う）

| 帳面 | 置き場所 | 中身 | 置いてよい物 |
|---|---|---|---|
| 実物帳 | `docs/refs/jitsubutsu/<種類>/`・`index.json` | 実物の写真・映像のコマ（幅640） | Wikimedia Commons の CC0・PD・CC BY・CC BY-SA だけ。出どころ・作者・許諾を index.json に必ず残す（`tools/refs_commons.py` が自動で断る・書く） |
| 手本帳 | `docs/refs/tehon.md` | kurzgesagt などから読み取った「やり方」の言葉 | 言葉だけ。コマは置かない（著作物） |
| 好み帳 | `docs/refs/liked/`・`index.json` | 作り手が「いい」と言った版のコマ | うちの絵なので置いてよい |
| 調べた記録 | `docs/refs/facts/<題材>.md` | 文献・映像で確かめたこと＋要確認 | 要点を自分の言葉で |

- 種類（フォルダ名）：カバ・骨・水中・草原・水辺 …（題材に合わせて足す）。タグ：群れ・横・正面・斜め・真上・口・岸・遠景・空と雲 など
- Wikimedia は元の映像の取得を断る（429）ので、映像は「その秒の縮小画像」をもらう（refs_commons.py がやる）。連続で取ると断られるので、少しずつ
- YouTube の映像はリポジトリに置かない。音も取らない
- まとめて見るとき：`python3 tools/refs_sheet.py 出力.png --kind カバ --tags 真上`
