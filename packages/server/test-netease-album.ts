import Meting from '@meting/core';
async function run() {
  const m = new Meting('netease');
  m.format(false); // don't format because format assumes songs
  const raw = await m.search('jay chou', { type: 10, limit: 2 });
  console.log(JSON.stringify(JSON.parse(raw), null, 2));
}
run();
