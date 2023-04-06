export const hashTagFilter = (text: string) => {
  const wordsArray = text
    .split(" ")
    .filter((word) => word[0] === "#")
    .map((word) => {
      return word.substring(1);
    });
  return wordsArray;
};

export const usernameFilter = (text: string) => {
  const wordsArray = text
    .split(" ")
    .filter((word) => word[0] === "@")
    .map((word) => {
      return { username: word.substring(1) };
    });
  return wordsArray;
};
