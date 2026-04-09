import ncmApi from '@neteasecloudmusicapienhanced/api';
async function run() {
  try {
    const res = await ncmApi.playlist_track_all({ id: 18918, limit: 10, offset: 0, timestamp: Date.now() });
    console.log('playlist_track_all:', res.body.code);
  } catch (e) {
    console.log('playlist_track_all error');
  }
  try {
    const res2 = await ncmApi.album({ id: 18918, timestamp: Date.now() });
    console.log('album:', res2.body.code, res2.body.songs?.length);
  } catch (e) {
    console.log('album error');
  }
}
run();
