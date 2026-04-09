async function run() {
  const url = 'http://mobilecdn.kugou.com/api/v3/search/album?api_ver=1&area_code=1&correct=1&pagesize=2&plat=2&tag=1&sver=5&showtype=10&page=1&keyword=jay&version=8990';
  const res = await fetch(url);
  console.log(JSON.stringify(await res.json(), null, 2));
}
run();
