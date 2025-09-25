// src/args-tokenizer.ts
var spaceRegex = /\s/;
var tokenizeArgs = (argsString, options) => {
  const tokens = [];
  let currentToken = "";
  let openningQuote;
  let escaped = false;
  for (let index = 0; index < argsString.length; index += 1) {
    const char = argsString[index];
    if (escaped) {
      escaped = false;
      if (openningQuote || char !== "\n") {
        currentToken += char;
      }
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (openningQuote === void 0 && spaceRegex.test(char)) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = "";
      }
      continue;
    }
    if (char === "'" || char === '"') {
      if (openningQuote === void 0) {
        openningQuote = char;
        continue;
      }
      if (openningQuote === char) {
        openningQuote = void 0;
        continue;
      }
    }
    currentToken += char;
  }
  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }
  if (options?.loose) {
    return tokens;
  }
  if (openningQuote) {
    throw Error("Unexpected end of string. Closing quote is missing.");
  }
  return tokens;
};
export {
  tokenizeArgs
};
