#!/bin/bash
# VOICEVOX エンジン（声の調整室と同じもの）を用意して起動する。tools/voice_render.py と render_draft.py --kata が使う
# この作業場（Linux）でも Mac でも動く（2026-11-21）。Mac では、VOICEVOX のアプリが開いていればそれをそのまま使う
set -e
VER=0.26.2
if [ -n "$SS_ENGINE_DIR" ]; then D="$SS_ENGINE_DIR"; elif [ -d /home/claude ]; then D=/home/claude/vve; else D="$HOME/.seisaku/vve"; fi
up(){ curl -s -m 3 http://127.0.0.1:50021/version >/dev/null; }
if up; then curl -s http://127.0.0.1:50021/version; echo " エンジン起動ずみ"; exit 0; fi
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) P=macos-arm64 ;;
  Darwin-*)     P=macos-x64 ;;
  *)            P=linux-cpu-x64 ;;
esac
RUN=""
# Mac：VOICEVOX のアプリが入っていれば、その中のエンジンを画面なしで動かす
if [ "$(uname -s)" = Darwin ]; then
  for c in "/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run" "$HOME/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run"; do
    [ -x "$c" ] && RUN="$c" && break
  done
fi
if [ -z "$RUN" ]; then
  if [ ! -x "$D/$P/run" ]; then
    mkdir -p "$D" && cd "$D"
    curl -sL -o e.7z.001 "https://github.com/VOICEVOX/voicevox_engine/releases/download/$VER/voicevox_engine-$P-$VER.7z.001"
    python3 -c "import py7zr" 2>/dev/null || python3 -m pip install -q py7zr 2>/dev/null || python3 -m pip install --break-system-packages -q py7zr
    python3 -c "import py7zr;py7zr.SevenZipFile('e.7z.001','r').extractall('.')" && rm e.7z.001
    chmod +x "$D/$P/run" 2>/dev/null || true
  fi
  RUN="$D/$P/run"
fi
NT=$( (nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4) | head -1)
cd "$(dirname "$RUN")" && (nohup "$RUN" --host 127.0.0.1 --port 50021 --cpu_num_threads "$NT" > "${TMPDIR:-/tmp}/vve.log" 2>&1 &)
for i in $(seq 1 90); do up && break; sleep 2; done
curl -s http://127.0.0.1:50021/version; echo " エンジン起動ずみ"
