import { subscribe } from "graphql";
import { withFilter } from "graphql-subscriptions";
import { extendType, intArg, nonNull, objectType, stringArg } from "nexus";
import { Activity as ActivityType, FollowRequest } from "@prisma/client";
import { pubsub } from "../context";

export const ActivityCount = objectType({
  name: "ActivityCount",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.int("likes");
    t.nonNull.int("comments");
    t.nonNull.int("follows");
    t.nonNull.int("tagged");
    t.nonNull.int("followRequests");
    t.nonNull.int("totalFollowRequests");
    t.nonNull.int("sum");
  },
});

export const Activity = objectType({
  name: "Activity",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("type");
    t.nonNull.boolean("isRead");
    t.field("sentBy", {
      type: "User",
      resolve(parent, args, context) {
        return context.prisma.activity
          .findUnique({
            where: { id: parent.id },
          })
          .sentBy();
      },
    });
    t.field("receivedBy", {
      type: "User",
      resolve(parent, args, context) {
        return context.prisma.activity
          .findUnique({
            where: { id: parent.id },
          })
          .receivedBy();
      },
    });
    t.field("post", {
      type: "Post",
      resolve(parent, args, context) {
        return context.prisma.activity
          .findUnique({
            where: { id: parent.id },
          })
          .post();
      },
    });
    t.field("comment", {
      type: "Comment",
      resolve(parent, args, context) {
        return context.prisma.activity
          .findUnique({
            where: { id: parent.id },
          })
          .comment();
      },
    });
    t.field("reply", {
      type: "Reply",
      resolve(parent, args, context) {
        return context.prisma.activity
          .findUnique({
            where: { id: parent.id },
          })
          .reply();
      },
    });
  },
});

export const ActivityPage = objectType({
  name: "ActivityPage",
  definition(t) {
    t.id("id");
    t.boolean("isNextPage");
    t.nonNull.list.nonNull.field("activity", { type: Activity });
    t.list.field("followRequests", { type: "User" });
    t.field("activityCounts", {
      type: "ActivityCount",
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");

        const follows = await context.prisma.activity.count({
          where: {
            AND: [
              { type: "follow" },
              { receivedById: userId },
              { isRead: false },
            ],
          },
        });

        const likes = await context.prisma.activity.count({
          where: {
            AND: [
              { type: "like" },
              { receivedById: userId },
              { isRead: false },
            ],
          },
        });

        const comments = await context.prisma.activity.count({
          where: {
            AND: [
              {
                OR: [
                  { type: "comment" },
                  { type: "comment-mention" },
                  { type: "post-mention" },
                ],
              },
              { receivedById: userId },
              { isRead: false },
            ],
          },
        });

        const tagged = await context.prisma.activity.count({
          where: {
            AND: [
              { type: "tagged" },
              { receivedById: userId },
              { isRead: false },
            ],
          },
        });

        const followRequests = await context.prisma.followRequest.count({
          where: {
            AND: [{ userReceiveId: userId }, { isRead: false }],
          },
        });

        const totalFollowRequests = await context.prisma.followRequest.count({
          where: { userReceiveId: userId },
        });

        const sum = follows + likes + comments + tagged + followRequests;

        return {
          id: userId,
          follows,
          likes,
          comments,
          tagged,
          followRequests,
          totalFollowRequests,
          sum,
        };
      },
    });
  },
});

export const ActivityQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.field("activityPage", {
      type: ActivityPage,
      args: {
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
        date: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { limit, skip } = args;
        if (!userId) throw new Error("Must be logged in.");

        const activity = await context.prisma.activity.findMany({
          take: limit,
          skip,
          where: { receivedById: userId },
          orderBy: { createdAt: "desc" },
        });

        const nextActivity = await context.prisma.activity.findMany({
          take: 1,
          skip: limit + skip,
          orderBy: { createdAt: "desc" },
          where: { receivedById: userId },
        });

        let followRequest = null;
        if (skip === 0) {
          followRequest = await context.prisma.followRequest.findMany({
            take: limit,
            where: { userReceiveId: userId },
            select: { userRequest: true },
            orderBy: { createdAt: "desc" },
          });

          await context.prisma.followRequest.updateMany({
            where: { AND: [{ userReceiveId: userId }, { isRead: false }] },
            data: { isRead: true },
          });
        }

        await context.prisma.activity.updateMany({
          where: { AND: [{ receivedById: userId }, { isRead: false }] },
          data: { isRead: true },
        });

        return {
          id: userId + limit + skip,
          isNextPage: nextActivity.length === 0 ? false : true,
          followRequests: followRequest?.map((user) => user.userRequest),
          activity,
        };
      },
    });
  },
});

export const ActivitySubscriptions = extendType({
  type: "Subscription",
  definition(t) {
    t.field("newActivity", {
      type: "User",
      subscribe: withFilter(
        () => pubsub.asyncIterator<{ receiveId: string }>(["NEW_ACTIVITY"]),
        async (payload, variables, context) => {
          const { userId } = context;
          return payload.receiveId === userId;
        }
      ),
      resolve: (payload, variables, context) => {
        return context.prisma.user.findUnique({
          where: { id: payload.receiveId },
        });
      },
    });
  },
});
