import { extendType, nonNull, objectType, stringArg } from "nexus";

export const ReplyLike = objectType({
  name: "ReplyLike",
  definition(t) {
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("userId");
    t.nonNull.string("replyId");
    t.field("user", {
      type: "User",
      resolve(parent, _args, context) {
        return context.prisma.user.findUnique({
          where: { id: parent.userId },
        });
      },
    });
    t.field("reply", {
      type: "Reply",
      resolve(parent, args, context) {
        return context.prisma.reply.findUnique({
          where: { id: parent.replyId },
        });
      },
    });
  },
});

export const ReplyLikeMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("replyUnlike", {
      type: ReplyLike,
      args: {
        replyId: nonNull(stringArg()),
      },
      resolve(_parent, args, context) {
        const { userId } = context;
        const { replyId } = args;
        if (!userId) {
          throw new Error("Cannot unlike without logging in.");
        }
        return context.prisma.replyLike.delete({
          where: {
            userId_replyId: {
              userId,
              replyId,
            },
          },
        });
      },
    });

    t.field("replyLike", {
      type: ReplyLike,
      args: {
        replyId: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { userId } = context;
        const { replyId } = args;
        if (!userId) {
          throw new Error("Cannot like without logging in.");
        }
        const reply = await context.prisma.reply.findUnique({
          where: { id: replyId },
        });
        if (!reply) throw new Error("Reply cannot be found.");
        const like = await context.prisma.replyLike.create({
          data: {
            userId,
            replyId,
          },
        });
        if (userId === reply.postedById) return like;
        await context.prisma.activity.create({
          data: {
            type: "like",
            sentBy: { connect: { id: userId } },
            receivedBy: { connect: { id: reply.postedById } },
            comment: { connect: { id: replyId } },
          },
        });

        return like;
      },
    });
  },
});
