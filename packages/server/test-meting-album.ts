import Meting from '@meting/core';
async function run() {
  const m = new Meting('netease');
  m.format(false);
  const raw = await m.playlist(18918);
  console.log('playlist:', raw.substring(0, 100));
  
  const raw2 = await m.album(18918);
  console.log('album:', raw2.substring(0, 100));
}
run();
