import { PrismaClient } from "@prisma/client";
import { decodeAuthHeader } from "./utils/auth";
import { Request, Response } from "express";
import { PubSub } from "graphql-subscriptions";

export const prisma = new PrismaClient();
export const pubsub = new PubSub();

export interface Context {
  pubsub: PubSub;
  prisma: PrismaClient;
  userId?: string;
  res: Response;
  req: Request;
}

export const context = ({
  req,
  res,
}: {
  req: Request;
  res: Response;
  connection: any;
}): Context => {
  const token =
    req && req.headers.authorization
      ? decodeAuthHeader(req.headers.authorization)
      : null;
  return {
    pubsub,
    prisma,
    userId: token?.userId,
    res,
    req,
  };
};
