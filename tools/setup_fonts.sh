#!/bin/bash
# 字幕用のフォント（Google Fonts・SIL OFL）を /home/claude/vv/fonts に入れる。render_draft.py の --subfont で選ぶ
mkdir -p /home/claude/vv/fonts && cd /home/claude/vv/fonts
for f in "Zen+Maru+Gothic:wght@700" "M+PLUS+Rounded+1c:wght@800" "BIZ+UDPGothic:wght@700" "Zen+Kaku+Gothic+New:wght@700" "Noto+Serif+JP:wght@700" "RocknRoll+One" "Murecho:wght@700" "Kiwi+Maru:wght@500" "Dela+Gothic+One"; do
  n=$(echo $f | sed 's/[:+@]/_/g'); [ -s $n.ttf ] && continue
  u=$(curl -s -m 15 -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=$f" | grep -o 'https://[^)]*\.ttf' | head -1); [ -n "$u" ] && curl -s -m 60 -o $n.ttf "$u"
done
