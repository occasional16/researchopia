declare function semiff(lowVer: string, highVer: string): semiff.Difference | undefined;

declare namespace semiff {
    type Difference = 
        | 'major'
        | 'minor'
        | 'patch'
        | 'premajor'
        | 'preminor'
        | 'prepatch'
        | 'prerelease';
}

export = semiff;