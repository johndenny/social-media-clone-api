import { User } from "@prisma/client";
import { sign, verify } from "jsonwebtoken";

export interface AuthTokenPayload {
  userId: string;
}

export function decodeAuthHeader(authHeader: string): null | AuthTokenPayload {
  const headerArray = authHeader.split(" ");
  let token = authHeader;
  if (headerArray.length !== 1) {
    token = headerArray[1];
  }
  let payload: any = null;
  try {
    payload = verify(token, process.env.JID_SECRET!);
  } catch (error) {
    return null;
  }
  return payload as AuthTokenPayload;
}

export const createAccessToken = (user: User) => {
  return sign(
    { userId: user.id, tokenVersion: user.tokenVersion },
    process.env.JID_SECRET!,
    {
      expiresIn: "15m",
    }
  );
};

export const createRefreshToken = (user: User) => {
  return sign(
    { userId: user.id, tokenVersion: user.tokenVersion },
    process.env.JID_REFRESH!,
    {
      expiresIn: "5d",
    }
  );
};

export const createPasswordResetToken = (user: User) => {
  return sign({ userId: user.id }, process.env.PWD_RESET!, { expiresIn: "1d" });
};
