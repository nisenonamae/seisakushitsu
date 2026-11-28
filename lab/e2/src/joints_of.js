/* 絵のデータの pivot（付け根）から、関節の表を作る。グループは中の部品をまとめて回す。follow＝ついて行く親の id */
const fs = require('fs');
function jointsOf(d, want) {
  const kids = id => d.nodes.filter(n => n.parent === id || n.follow === id).flatMap(n => [n.id].concat(kids(n.id)));
  return want.map(([name, id]) => { const n = d.nodes.find(x => x.id === id); return { name, ids: (n.kind === 'group' ? [] : [id]).concat(kids(id)), pivot: n.pivot }; });
}
const WANT = [['頭', 'gHead'], ['前脚（手前）', 'legFN'], ['前脚（奥）', 'legFF'], ['後ろ脚（手前）', 'legHN'], ['後ろ脚（奥）', 'legHF'], ['耳（手前）', 'earN'], ['耳（奥）', 'earF'], ['しっぽ', 'tail']];
module.exports = { jointsOf, WANT };
if (require.main === module) { const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); fs.writeFileSync(process.argv[3], JSON.stringify(jointsOf(d, WANT.concat(process.argv[4] === 'jaw' ? [['下あご', 'jaw']] : [])), null, 1)); }
