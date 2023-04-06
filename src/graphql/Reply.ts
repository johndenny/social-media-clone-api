import { extendType, intArg, nonNull, objectType, stringArg } from "nexus";
import { resolve } from "path";
import { usernameFilter } from "../utils/textFilters";

export const Reply = objectType({
  name: "Reply",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.string("postId");
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("text");
    t.nonNull.string("postedById");
    t.nonNull.string("commentId");
    t.field("comment", {
      type: "Comment",
      resolve(parent, args, context) {
        return context.prisma.comment.findUnique({
          where: { id: parent.commentId },
        });
      },
    });
    t.field("postedBy", {
      type: "User",
      resolve(parent, _args, context) {
        return context.prisma.user.findUnique({
          where: { id: parent.postedById },
        });
      },
    });
    t.nonNull.field("likes", {
      type: "LikesPage",
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { id } = parent;
        const { limit, skip } = args;

        const likes = await context.prisma.reply
          .findUnique({
            where: { id },
          })
          .likes({
            take: limit,
            skip,
            select: { user: true },
            orderBy: { createdAt: "desc" },
          });

        const nextLike = await context.prisma.reply
          .findUnique({
            where: { id },
          })
          .likes({
            take: 1,
            skip: limit + skip,
            orderBy: { createdAt: "desc" },
          });

        return {
          id: id + limit + skip,
          isNextPage: nextLike.length === 0 ? false : true,
          profiles: likes.map((like) => like.user),
        };
      },
    });
    t.nonNull.int("likeCount", {
      resolve(parent, args, context) {
        const { id } = parent;
        return context.prisma.replyLike.count({
          where: { replyId: id },
        });
      },
    });
    t.nonNull.boolean("isLiked", {
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) return false;

        const replyId = parent.id;
        const like = await context.prisma.replyLike.findUnique({
          where: { userId_replyId: { userId, replyId } },
        });

        return like ? true : false;
      },
    });
  },
});

export const ReplyPage = objectType({
  name: "ReplyPage",
  definition(t) {
    t.string("id");
    t.boolean("isNextPage");
    t.list.field("replies", { type: Reply });
  },
});

export const ReplyQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.nonNull.field("replies", {
      type: "Reply",
      args: { commentId: nonNull(stringArg()), cursorId: stringArg() },
      resolve(parent, args, context) {
        const { cursorId, commentId } = args;
        if (cursorId) {
          return context.prisma.reply.findMany({
            take: 15,
            skip: 1,
            cursor: {
              id: cursorId,
            },
            where: { commentId },
            orderBy: {
              createdAt: "desc",
            },
          });
        }
        return context.prisma.reply.findMany({
          take: 3,
          where: { commentId },
          orderBy: {
            createdAt: "desc",
          },
        });
      },
    });
    t.nonNull.field("pageInfo", {
      type: "PageInfo",
      args: { commentId: nonNull(stringArg()), cursorId: stringArg() },
      async resolve(parent, args, context) {
        const { cursorId, commentId } = args;
        let replies;
        if (cursorId) {
          replies = await context.prisma.reply.findMany({
            take: 15,
            skip: 1,
            cursor: {
              id: cursorId,
            },
            where: { commentId },
            orderBy: {
              createdAt: "desc",
            },
          });
        } else {
          replies = await context.prisma.reply.findMany({
            take: 3,
            where: { commentId },
            orderBy: {
              createdAt: "desc",
            },
          });
        }
        const newCursorId = replies[replies.length - 1].id;
        const nextPage = await context.prisma.reply.findMany({
          take: 1,
          skip: 1,
          cursor: {
            id: newCursorId,
          },
          where: { commentId: commentId },
          orderBy: {
            createdAt: "desc",
          },
        });
        return {
          cursorId: newCursorId,
          isNextPage: nextPage.length === 0 ? false : true,
        };
      },
    });
    t.field("uniqueReply", {
      type: "Reply",
      args: { replyId: nonNull(stringArg()) },
      resolve(parent, args, context) {
        const { replyId } = args;
        return context.prisma.reply.findUnique({
          where: { id: replyId },
        });
      },
    });
  },
});

export const ReplyMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("deleteReply", {
      type: Reply,
      args: {
        replyId: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { replyId } = args;
        const { userId } = context;
        if (!userId) {
          throw new Error("Cannot comment without logging in.");
        }
        const reply = await context.prisma.reply.findUnique({
          where: { id: replyId },
          include: { post: true },
        });
        if (reply?.postedById !== userId && reply?.post.postedById !== userId) {
          throw new Error("Cannot delete another users reply");
        }
        return context.prisma.reply.delete({
          where: { id: replyId },
        });
      },
    });

    t.nonNull.field("reply", {
      type: Reply,
      args: {
        postId: nonNull(stringArg()),
        commentId: nonNull(stringArg()),
        text: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { commentId, text, postId } = args;
        const { userId } = context;
        if (!userId) {
          throw new Error("Cannot comment without logging in.");
        }

        const post = await context.prisma.post.findUnique({
          where: { id: postId },
        });
        if (!post) throw new Error("Post not found.");

        const reply = await context.prisma.reply.create({
          data: {
            post: { connect: { id: postId } },
            text,
            comment: { connect: { id: commentId } },
            postedBy: { connect: { id: userId } },
          },
        });

        const usernames = usernameFilter(text);
        if (usernames.length !== 0) {
          const userIds = await context.prisma.user.findMany({
            where: { OR: usernames },
            select: { id: true },
          });
          await context.prisma.activity.createMany({
            data: userIds
              .map((user) => {
                return {
                  type: "comment-mention",
                  sentById: userId,
                  receivedById: user.id,
                  replyId: reply.id,
                };
              })
              .filter(
                (user) =>
                  user.receivedById !== userId ||
                  user.receivedById !== post.postedById
              ),
          });
        }

        if (userId === post.postedById) return reply;

        await context.prisma.activity.create({
          data: {
            type: "comment",
            sentBy: { connect: { id: userId } },
            receivedBy: { connect: { id: post.postedById } },
            reply: { connect: { id: reply.id } },
          },
        });

        return reply;
      },
    });
  },
});
