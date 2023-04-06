import { extendType, nonNull, objectType, stringArg } from "nexus";

export const CommentLike = objectType({
  name: "CommentLike",
  definition(t) {
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("userId");
    t.nonNull.string("commentId");
    t.field("user", {
      type: "User",
      resolve(parent, _args, context) {
        return context.prisma.user.findUnique({
          where: { id: parent.userId },
        });
      },
    });
    t.field("comment", {
      type: "Comment",
      resolve(parent, _args, context) {
        return context.prisma.comment.findUnique({
          where: { id: parent.commentId },
        });
      },
    });
  },
});

export const CommentLikeMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("commentUnlike", {
      type: CommentLike,
      args: {
        commentId: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { userId } = context;
        const { commentId } = args;
        if (!userId) {
          throw new Error("Cannot unlike without logging in.");
        }
        return context.prisma.commentLike.delete({
          where: {
            userId_commentId: {
              userId,
              commentId,
            },
          },
        });
      },
    });

    t.field("commentLike", {
      type: CommentLike,
      args: {
        commentId: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { userId } = context;
        const { commentId } = args;
        if (!userId) {
          throw new Error("Cannot like without logging in.");
        }
        const comment = await context.prisma.comment.findUnique({
          where: { id: commentId },
        });
        if (!comment) throw new Error("Comment cannot be found.");
        const like = await context.prisma.commentLike.create({
          data: {
            userId,
            commentId,
          },
        });

        if (userId === comment.postedById) return like;
        await context.prisma.activity.create({
          data: {
            type: "like",
            sentBy: { connect: { id: userId } },
            receivedBy: { connect: { id: comment.postedById } },
            comment: { connect: { id: commentId } },
            post: { connect: { id: comment.postId } },
          },
        });

        return like;
      },
    });
  },
});
