type Options = {
    loose?: boolean;
};
/**
 * Tokenize a shell string into argv array
 */
export declare const tokenizeArgs: (argsString: string, options?: Options) => string[];
export {};
