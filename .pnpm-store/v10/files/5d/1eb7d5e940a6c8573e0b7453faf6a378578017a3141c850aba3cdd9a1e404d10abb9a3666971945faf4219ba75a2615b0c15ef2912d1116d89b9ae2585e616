
# get-them-args
[![package version](https://img.shields.io/npm/v/get-them-args.svg?style=flat-square)](https://npmjs.org/package/get-them-args)
[![package downloads](https://img.shields.io/npm/dm/get-them-args.svg?style=flat-square)](https://npmjs.org/package/get-them-args)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![package license](https://img.shields.io/npm/l/get-them-args.svg?style=flat-square)](https://npmjs.org/package/get-them-args)
[![make a pull request](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com) [![Greenkeeper badge](https://badges.greenkeeper.io/tiaanduplessis/get-them-args.svg)](https://greenkeeper.io/)

> Parse argument options

## Table of Contents

- [About](#about)
- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [License](#License)


## About

Simple CLI argument parser hacked from [minimist](https://github.com/substack/minimist) that adds support for objects and additional initialization options.

## Install

```sh
$ npm install --save get-them-args
# Or
$ yarn add get-them-args
```

## Usage
To use, provide arguments as argument:

```js
const parse = require('get-them-args')
const options = {} // Options to be passed. CURRENTLY NONE AVAILABLE

// $ node ./example.js --dir . --command foo
console.log(parse(process.argv.slice(2) ))
// { unknown: [], dir: '.', command: 'foo' }

console.log(parse(process.argv))
// { unknown: [], dir: '.', command: 'foo' }

console.log(parse())
// { unknown: [], dir: '.', command: 'foo' }

```

For example, if the arguments provided are `--hello world --parse=all --no-drugs --make-friends -n 4 -t 5`, the function will return:

```js
{ unknown: [],
  hello: 'world',
  parse: 'all',
  drugs: false,
  'make-friends': true,
  n: 4,
  t: 5
}

```

There is also support for parsing objects:

```sh

$ node example.js --headers={"Foo": "5", "bar": "6"}
# { unknown: [], headers: { Foo: 5, bar: 6 } }

```

All unparsed arguments will end up in the `unknown` array. The following types of arguments are supported:

```sh
--key=value
--key value
--key # true
--no-key # false
-key=value
-key value
```

## Contribute

1. Fork it and create your feature branch: git checkout -b my-new-feature
2. Commit your changes: git commit -am 'Add some feature'
3. Push to the branch: git push origin my-new-feature 
4. Submit a pull request

## License

MIT
    