#!/bin/bash
# Mac で本番の書き出し（tools/final_export.py）ができるように、要る物を入れる（2026-11-21）
# 使い方：アプリのリポジトリ（seisakushitsu）の中で  bash tools/setup_mac.sh
# 2回目からは、足りない物だけ入れる。入れる物：
#   ffmpeg（Homebrew）・Python の部品（~/.seisaku/venv にまとめる）・ブラウザ（Playwright の Chromium）・フォント・声のエンジン
# データのリポジトリ（notion-daily）は、このリポジトリの隣（例：~/apps/notion-daily）に置く。別の所なら SS_DATA_REPO で指定
set -e
cd "$(dirname "$0")/.."
H="${SS_HOME:-$HOME/.seisaku}"; mkdir -p "$H"
say(){ echo "▶ $*"; }
if ! command -v brew >/dev/null; then echo "Homebrew がありません。https://brew.sh の1行を「ターミナル」に貼って入れてから、もう一度流してください"; exit 1; fi
command -v ffmpeg >/dev/null || { say "ffmpeg を入れます"; brew install ffmpeg; }
PY=$(command -v python3.12 || command -v python3.11 || command -v python3)
if ! "$PY" -c 'import sys;sys.exit(0 if sys.version_info>=(3,10) else 1)'; then say "新しい Python を入れます"; brew install python@3.12; PY=$(brew --prefix)/bin/python3.12; fi
if [ ! -x "$H/venv/bin/python" ]; then say "Python の置き場所を作ります（$H/venv）"; "$PY" -m venv "$H/venv"; fi
V="$H/venv/bin/python"
"$V" -m pip install -q --upgrade pip
"$V" -m pip install -q numpy scipy pillow playwright fugashi unidic-lite pyloudnorm py7zr
"$V" -m playwright install chromium
say "フォントを入れます"; SS_HOME="$H" bash tools/setup_fonts.sh
say "声のエンジンを用意します（VOICEVOX のアプリがあればそれを使います）"; PATH="$H/venv/bin:$PATH" bash tools/setup_engine.sh
D="${SS_DATA_REPO:-$(cd .. && pwd)/notion-daily}"
[ -d "$D/roadmap/apps/seisakushitsu" ] && say "データのリポジトリ：$D" || echo "！ データのリポジトリが見つかりません（$D）。このリポジトリの隣に notion-daily を置くか、SS_DATA_REPO で場所を教えてください"
echo "✓ 用意できました。書き出し：python3 tools/final_export.py <題材の一部>（自動で $H/venv の Python を使います）"
