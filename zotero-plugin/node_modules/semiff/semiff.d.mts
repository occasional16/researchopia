export default function semiff(lowVer: string, highVer: string): Difference | undefined;

export type Difference = 
    | 'major'
    | 'minor'
    | 'patch'
    | 'premajor'
    | 'preminor'
    | 'prepatch'
    | 'prerelease';