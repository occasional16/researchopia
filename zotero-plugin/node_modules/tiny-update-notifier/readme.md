# tiny-update-notifier 📬

[![npm][npm-version]][npm-link]
[![npm bundle size][bundle-size]][bundlephobia]
[![License][license]](./license)

> Simple check for npm package updates.

A lightweight alternative for [update-notifier](https://github.com/yeoman/update-notifier) with most of the essential features. Useful for CLI apps.

## Install

```bash
npm i tiny-update-notifier
```

## Usage

```ts
import updateNotifier from 'tiny-update-notifier';
import packageJson from './package.json' assert { type: 'json' };

try {
    const update = await updateNotifier({ pkg: packageJson });

    if (update) {
        console.log(`New version of ${update.name} available!`);
        console.log(`Update: ${update.current} → ${update.latest} (${update.type})`);
    }
} catch {
    console.log('Couldn\'t get the latest version.');
}
```

<img src="./.github/demo.png" alt="Example in terminal window">

## API

### updateNotifier(options)

Check for updates for an npm module.\
Returns: `Update | false`

#### Update

Contains information about update version etc.\
Type: `Object`

For example:
```js
{ name: 'test', current: '1.0.0', latest: '3.3.0', type: 'major' }
```

##### name

The name of an npm module.\
Type: `String`

##### current

Current version of an npm module.\
Type: `String`

##### latest

Latest version of an npm module.\
Type: `String`

##### type

Difference type between current and latest semver version.\
Type: `String`

Possible values:

* `'major'`
* `'premajor'`
* `'minor'`
* `'preminor'`
* `'patch'`
* `'prepatch'`
* `'prerelease'`

#### options

Type: `Object`\
Options for getting new update.

##### pkg
Type: `object` _(required)_

###### name

Name of npm module.\
Type: `String` _(required)_

###### version

Version of npm module.\
Type: `String` _(required)_

##### distTag

Which [dist-tag](https://docs.npmjs.com/adding-dist-tags-to-packages) to use to find the latest version.

Type: `String`\
Default: `'latest'`

##### checkInterval

How often to check for updates.

Type: `Number`\
Default: `1000 * 60 * 60 * 24` _(1 day)_

##### cache

Whether to use cache. Setting this option to `false` will cause `checkInterval` to not function, thus checking for new update every run.

Type: `Boolean`\
Default: `true`

##### timeout

Maximum time in milliseconds to wait for the request to npm registry to complete.

Type: `Number`\
Default: `30000` _(30 seconds)_

## License

MIT 💖

<!-- badges -->
[npm-link]: https://npmjs.com/package/tiny-update-notifier
[npm-version]: https://img.shields.io/npm/v/tiny-update-notifier?labelColor=000&color=57B759
[bundle-size]: https://img.shields.io/bundlephobia/min/tiny-update-notifier?labelColor=000&color=57B759
[bundlephobia]: https://bundlephobia.com/package/tiny-update-notifier
[license]: https://img.shields.io/npm/l/tiny-update-notifier?labelColor=000&color=57B759