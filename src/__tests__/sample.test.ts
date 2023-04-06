import { sign } from "jsonwebtoken";
import { decodeAuthHeader } from "../utils/auth";
import "dotenv/config";
import { text } from "body-parser";
import { hashTagFilter, usernameFilter } from "../utils/textFilters";

const add = (a: number, b: number): number => {
  return a + b;
};

test("number should be 3", () => {
  const result = add(1, 2);
  expect(result).toBe(3);
});

test("", () => {
  const user = { id: 1, tokenVersion: 0 };
  const accesstoken = sign(
    { userId: user.id, tokenVersion: user.tokenVersion },
    process.env.JID_SECRET!,
    {
      expiresIn: "15m",
    }
  );
  const authHeader = `Bearer ${accesstoken}`;
  const valid = decodeAuthHeader(authHeader);
  expect(valid?.userId).toBe(1);
});

test("censor name", () => {
  const user = { email: "jimmyjohns@gmail.com" };
  const emailName = user.email.split("@")[0];
  const emailAddress = user.email.split("@")[1];
  const firstletter = emailName[0];
  const lastLetter = emailName[emailName.length - 1];
  const censoredNameArray = new Array(emailName.length).fill("*");
  censoredNameArray.splice(0, 1, firstletter);
  censoredNameArray.splice(-1, 1, lastLetter);
  const censoredEmail = [censoredNameArray.join(""), emailAddress].join("@");
  expect(censoredEmail).toBe("j********s@gmail.com");
});

test("should find hashtags", () => {
  expect(
    hashTagFilter(
      "Any other #value will be coerced to a string #before being used #as separator."
    )
  ).toStrictEqual(["value", "before", "as"]);
});

test("should return empty array", () => {
  expect(
    hashTagFilter(
      "Any other value will be coerced to a string before being used as separator."
    )
  ).toStrictEqual([]);
});

test("should return objects with username feild", () => {
  expect(
    usernameFilter(
      "Any other @value will be coerced to a string before being used as separator."
    )
  ).toStrictEqual([{ username: "value" }]);
});
