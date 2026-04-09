async function run() {
  const url = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
  const payload = {
    comm: { ct: '6', cv: '80600', tmeAppID: 'qqmusic' },
    'music.search.SearchCgiService.DoSearchForQQMusicDesktop': {
      module: 'music.search.SearchCgiService',
      method: 'DoSearchForQQMusicDesktop',
      param: { num_per_page: 2, page_num: 1, search_type: 2, query: 'jay chou', grp: 1 }
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  console.log(JSON.stringify(await res.json(), null, 2));
}
run();
