"""加筆ツールを1つのHTMLにする： python3 build.py <素材パック.json> <出力.html>
素材パック＝{pack,title,items:[{id,name,kind,parts,src(dataURL)}]}。HTMLを開けばその素材がすぐ出る（開く操作を覚えなくていい）"""
import sys,os
d=os.path.dirname(os.path.abspath(__file__));t=open(os.path.join(d,'kahitsu_template.html'),encoding='utf-8').read()
pack=open(sys.argv[1],encoding='utf-8').read().replace('</','<\\/')
open(sys.argv[2],'w',encoding='utf-8').write(t.replace('/*PACK*/null',pack));print('作った：',sys.argv[2])
