
# shell-exec
[![package version](https://img.shields.io/npm/v/shell-exec.svg?style=flat-square)](https://npmjs.org/package/shell-exec)
[![package downloads](https://img.shields.io/npm/dm/shell-exec.svg?style=flat-square)](https://npmjs.org/package/shell-exec)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![package license](https://img.shields.io/npm/l/shell-exec.svg?style=flat-square)](https://npmjs.org/package/shell-exec)
[![make a pull request](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com) [![Greenkeeper badge](https://badges.greenkeeper.io/tiaanduplessis/shell-exec.svg)](https://greenkeeper.io/)

> A tiny cross-platform promise based wrapper around child_process.spawn.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Contribute](#contribute)
- [License](#License)

## Install

This project uses [node](https://nodejs.org) and [npm](https://www.npmjs.com). 

```sh
$ npm install shell-exec
$ # OR
$ yarn add shell-exec
```

## Usage

```js
const shellExec = require('shell-exec')

shellExec('echo Hi!').then(console.log).catch(console.log)
// Hi!
// { stdout: '', stderr: '', cmd: 'echo Hi!', code: 0 }
```

## API

### `shellExec(command, options)`

**Parameters:**

- *`command`* {String | Array} - String or Array of commands to run
- *`options`* {Object} - Options object passed to [`child_process.spawn`](https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options)

The function then returns a `Promise`.

## Contribute

1. Fork it and create your feature branch: git checkout -b my-new-feature
2. Commit your changes: git commit -am 'Add some feature'
3.Push to the branch: git push origin my-new-feature 
4. Submit a pull request

## License

MIT
    