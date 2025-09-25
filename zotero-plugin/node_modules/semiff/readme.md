# semiff [![npm](https://img.shields.io/npm/v/semiff?color=4CAF50&label=)](https://npm.im/semiff)

> A tiny (740B) utility to get the type difference between two [semver](https://semver.org/spec/v2.0.0.html) versions.\
Similar to [`semver#diff`](https://github.com/npm/node-semver/blob/main/functions/diff.js) function.

## Features

* No dependencies.
* Extremely lightweight - _740 bytes_ bundled, ~5 kB publish size.
* Up to [__6x faster__](#benchmarks) than the [semver package](https://github.com/npm/node-semver).
* Built-in Typescript definitions.
* ESM and CJS exports.

## Install

```sh
npm i semiff
```

## Usage

```ts
import semiff from 'semiff';

semiff('1.0.0', '2.0.0'); // major
semiff('1.0.0', '1.1.0'); // minor
semiff('1.1.1', '1.1.2'); // patch
semiff('1.0.0-1', '1.0.1-1'); // prepatch
semiff('1.1.0-pre-1', '1.1.0-pre-2'); // prerelease
semiff('1.0.0', '1.0.0'); // undefined
semiff('2.0.0', '1.0.0'); // undefined
```

## API

### semiff(lowVer, highVer)

Compares both versions and returns the difference between them.\
If `lowVer` is equal or higher than `highVer`, it will return `undefined`.\
Otherwise, one of the following outcomes will be returned:

* `'major'`
* `'premajor'`
* `'minor'`
* `'preminor'`
* `'patch'`
* `'prepatch'`
* `'prerelease'`

## [Benchmarks](https://github.com/mrozio13pl/semiff/blob/main/benchmark)

```diff
  semver x 1,635,459 ops/sec ±1.09% (95 runs sampled)
  semver-diff x 696,929 ops/sec ±1.04% (96 runs sampled)
+ semiff x 4,594,155 ops/sec ±1.67% (85 runs sampled)
```

## License

MIT 💖