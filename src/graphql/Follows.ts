import { extendType, intArg, nonNull, objectType, stringArg } from "nexus";

export const Follows = objectType({
  name: "Follows",
  definition(t) {
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("id", {
      resolve(parent) {
        return parent.followerId + parent.followingId;
      },
    });
    t.nonNull.string("followerId");
    t.nonNull.string("followingId");
    t.field("follower", {
      type: "User",
      resolve(parent, _args, context) {
        return context.prisma.user.findUnique({
          where: { id: parent.followerId },
        });
      },
    });
    t.field("following", {
      type: "User",
      resolve(parent, _args, context) {
        return context.prisma.user.findUnique({
          where: { id: parent.followingId },
        });
      },
    });
  },
});

export const FollowRequest = objectType({
  name: "FollowRequest",
  definition(t) {
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("userRequestId");
    t.field("userRequest", {
      type: "User",
      resolve(parent, args, context) {
        return context.prisma.user.findUnique({
          where: { id: parent.userRequestId },
        });
      },
    });
    t.nonNull.string("userReceiveId");
    t.field("userReceive", {
      type: "User",
      resolve(parent, args, context) {
        return context.prisma.user.findUnique({
          where: { id: parent.userReceiveId },
        });
      },
    });
  },
});

export const FollowQueries = extendType({
  type: "Query",
  definition(t) {
    t.field("following", {
      type: "UsersListPage",
      args: {
        username: nonNull(stringArg()),
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
      },
      async resolve(parent, args, context) {
        const { username, limit, skip } = args;
        const following = await context.prisma.user
          .findUnique({
            where: { username },
          })
          .following({
            take: limit,
            skip,
            select: { following: true },
            orderBy: { createdAt: "desc" },
          });

        const nextUser = await context.prisma.user
          .findUnique({
            where: { username },
          })
          .following({
            take: 1,
            skip: skip + limit,
            orderBy: { createdAt: "desc" },
          });

        return {
          id: "following" + username + skip + limit,
          isNextPage: nextUser.length === 0 ? false : true,
          profiles: following.map((follower) => follower.following),
        };
      },
    });

    t.nonNull.field("followers", {
      type: "UsersListPage",
      args: {
        username: nonNull(stringArg()),
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
      },
      async resolve(parent, args, context) {
        const { username, limit, skip } = args;
        const followers = await context.prisma.user
          .findUnique({
            where: { username },
          })
          .followedBy({
            take: limit,
            skip,
            select: { follower: true },
            orderBy: { createdAt: "desc" },
          });

        const nextUser = await context.prisma.user
          .findUnique({
            where: { username },
          })
          .followedBy({
            take: 1,
            skip: skip + limit,
            orderBy: { createdAt: "desc" },
          });

        return {
          id: "followers" + username + skip + limit,
          isNextPage: nextUser.length === 0 ? false : true,
          profiles: followers.map((follower) => follower.follower),
        };
      },
    });

    t.nonNull.field("followRequests", {
      type: "UsersListPage",
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { limit, skip } = args;
        if (!userId) throw new Error("Must be logged in.");

        const followRequests = await context.prisma.followRequest.findMany({
          take: limit,
          skip,
          where: { userReceiveId: userId },
          select: { userRequest: true },
          orderBy: { createdAt: "desc" },
        });

        const nextFollowRequest = await context.prisma.followRequest.findMany({
          take: 1,
          skip: limit + skip,
          where: { userReceiveId: userId },
          orderBy: { createdAt: "desc" },
        });

        return {
          id: "followRequests" + userId + limit + skip,
          isNextPage: nextFollowRequest.length === 0 ? false : true,
          profiles: followRequests.map((request) => request.userRequest),
        };
      },
    });
  },
});

export const followMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("unfollow", {
      type: Follows,
      args: { username: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { username } = args;
        if (!userId) {
          throw new Error("Cannot unfollow without logging in.");
        }
        const user = await context.prisma.user.findUnique({
          where: { username },
          select: { id: true },
        });
        if (!user) throw new Error("Following user can't be found.");
        const removeFollow = await context.prisma.follows.delete({
          where: {
            followerId_followingId: {
              followerId: userId,
              followingId: user.id,
            },
          },
        });
        await context.prisma.activity.deleteMany({
          where: {
            AND: [
              { sentById: userId },
              { receivedById: user.id },
              { type: "follow" },
            ],
          },
        });
        return removeFollow;
      },
    });

    t.field("follow", {
      type: Follows,
      args: { username: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { username } = args;
        if (!userId) {
          throw new Error("Cannot follow without logging in.");
        }
        const user = await context.prisma.user.findUnique({
          where: { username },
          select: { id: true, isPrivate: true },
        });
        if (!user) throw new Error("Following user can't be found.");
        if (user.isPrivate) throw new Error("Access denied.");
        const newFollow = await context.prisma.follows.create({
          data: {
            followerId: userId,
            followingId: user.id,
          },
        });
        await context.prisma.activity.create({
          data: {
            type: "follow",
            sentBy: { connect: { id: userId } },
            receivedBy: { connect: { id: user.id } },
          },
        });
        return newFollow;
      },
    });

    t.nonNull.field("createFollowRequest", {
      type: FollowRequest,
      args: { receiveId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { receiveId } = args;

        if (!userId) throw new Error("Must be logged in.");

        const followRequest = await context.prisma.followRequest.create({
          data: {
            userRecieve: { connect: { id: receiveId } },
            userRequest: { connect: { id: userId } },
          },
        });

        context.pubsub.publish("NEW_ACTIVITY", { receiveId });
        return followRequest;
      },
    });

    t.nonNull.field("removeFollowRequest", {
      type: FollowRequest,
      args: {
        receiveId: nonNull(stringArg()),
        requestId: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { receiveId, requestId } = args;

        const followRequest = await context.prisma.followRequest.delete({
          where: {
            userReceiveId_userRequestId: {
              userReceiveId: receiveId,
              userRequestId: requestId,
            },
          },
        });

        return followRequest;
      },
    });

    t.nonNull.field("confirmFollowRequest", {
      type: Follows,
      args: { requestId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { requestId } = args;
        const { userId } = context;

        if (!userId) throw new Error("Must be logged in.");

        const follow = context.prisma.follows.create({
          data: {
            follower: { connect: { id: requestId } },
            following: { connect: { id: userId } },
          },
        });

        await context.prisma.followRequest.delete({
          where: {
            userReceiveId_userRequestId: {
              userReceiveId: userId,
              userRequestId: requestId,
            },
          },
        });

        await context.prisma.activity.create({
          data: {
            type: "follow",
            sentBy: { connect: { id: requestId } },
            receivedBy: { connect: { id: userId } },
            isRead: true,
          },
        });

        return follow;
      },
    });

    t.nonNull.field("removeFollower", {
      type: Follows,
      args: { followerId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { followerId } = args;
        const { userId } = context;

        if (!userId) throw new Error("Must be logged in.");

        const removedFollower = await context.prisma.follows.delete({
          where: {
            followerId_followingId: { followerId, followingId: userId },
          },
        });

        await context.prisma.activity.deleteMany({
          where: {
            AND: [
              { sentById: followerId },
              { receivedById: userId },
              { type: "follow" },
            ],
          },
        });

        return removedFollower;
      },
    });
  },
});
