/**
 * The main entry point of the CLI
 */
declare function main(): Promise<void>;
declare function checkGitStatus(): Promise<void>;

export { checkGitStatus, main };
