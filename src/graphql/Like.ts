import { extendType, nonNull, objectType, stringArg } from "nexus";

export const Like = objectType({
  name: "Like",
  definition(t) {
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("userId");
    t.nonNull.string("postId");
    t.field("user", {
      type: "User",
      resolve(parent, _args, context) {
        return context.prisma.user.findUnique({
          where: { id: parent.userId },
        });
      },
    });
    t.field("post", {
      type: "Post",
      resolve(parent, _args, context) {
        return context.prisma.post.findUnique({
          where: { id: parent.postId },
        });
      },
    });
  },
});

export const LikesPage = objectType({
  name: "LikesPage",
  definition(t) {
    t.id("id");
    t.boolean("isNextPage");
    t.list.field("profiles", { type: "User" });
  },
});

export const LikeQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("postLikes", {
      type: Like,
      args: {
        postId: nonNull(stringArg()),
      },
      resolve(parent, args, context) {
        const { postId } = args;
        return context.prisma.like.findMany({
          where: { postId },
          orderBy: { createdAt: "desc" },
        });
      },
    });
  },
});

export const LikeMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("unlike", {
      type: "Post",
      args: {
        postId: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { userId } = context;
        const { postId } = args;
        if (!userId) {
          throw new Error("Cannot unlike without logging in.");
        }
        const removeLike = await context.prisma.like.delete({
          where: {
            userId_postId: {
              userId,
              postId,
            },
          },
        });

        return context.prisma.post.findUnique({
          where: { id: postId },
        });
      },
    });

    t.field("like", {
      type: "Post",
      args: {
        postId: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { userId } = context;
        const { postId } = args;
        if (!userId) {
          throw new Error("Cannot like without logging in.");
        }

        const newLike = await context.prisma.like.create({
          data: {
            userId,
            postId,
          },
        });
        const post = await context.prisma.post.findUnique({
          where: { id: postId },
        });
        if (!post) throw new Error("Post cannot be found.");
        if (userId === post.postedById) return post;
        const activity = await context.prisma.activity.create({
          data: {
            type: "like",
            sentBy: { connect: { id: userId } },
            receivedBy: { connect: { id: post.postedById } },
            like: { connect: { userId_postId: { userId, postId } } },
          },
        });
        context.pubsub.publish("NEW_ACTIVITY", { receiveId: post.postedById });
        return post;
      },
    });
  },
});
