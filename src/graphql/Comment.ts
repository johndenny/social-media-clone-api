import { objectType, extendType, stringArg, nonNull, intArg } from "nexus";
import { usernameFilter } from "../utils/textFilters";

export const Comment = objectType({
  name: "Comment",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("text");
    t.nonNull.boolean("isEdited");
    t.nonNull.string("postedById");
    t.nonNull.string("postId");
    t.field("post", {
      type: "Post",
      resolve(parent, args, context) {
        return context.prisma.post.findUnique({
          where: { id: parent.postId },
        });
      },
    });
    t.nonNull.field("replyPage", {
      type: "ReplyPage",
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { id } = parent;
        const { skip } = args;

        let limit = args.limit;
        if (skip === 0) limit = 3;

        const replies = await context.prisma.comment
          .findUnique({ where: { id } })
          .replies({ take: limit, skip, orderBy: { createdAt: "desc" } });

        const nextReply = await context.prisma.comment
          .findUnique({
            where: { id },
          })
          .replies({
            take: 1,
            skip: limit + skip,
            orderBy: { createdAt: "desc" },
          });

        return {
          id: id + skip + limit,
          isNextPage: nextReply.length === 0 ? false : true,
          replies,
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
        const { limit, skip } = args;
        const { id } = parent;
        const likes = await context.prisma.comment
          .findUnique({
            where: { id },
          })
          .likes({
            take: limit,
            skip,
            select: { user: true },
            orderBy: { createdAt: "desc" },
          });

        const nextLike = await context.prisma.comment
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
    t.nonNull.field("counts", {
      type: CommentCounts,
      async resolve(parent, args, context) {
        const { id } = parent;
        const likes = await context.prisma.commentLike.count({
          where: { commentId: id },
        });
        const replies = await context.prisma.reply.count({
          where: { commentId: id },
        });
        return { likes, replies };
      },
    });
    t.nonNull.boolean("isLiked", {
      async resolve(parent, args, context) {
        const { userId } = context;
        const commentId = parent.id;
        if (!userId) return false;

        const like = await context.prisma.commentLike.findUnique({
          where: { userId_commentId: { userId, commentId } },
        });

        return like ? true : false;
      },
    });
  },
});

export const CommentCounts = objectType({
  name: "commentCounts",
  definition(t) {
    t.nonNull.int("likes");
    t.nonNull.int("replies");
  },
});

export const CommentsPage = objectType({
  name: "CommentsPage",
  definition(t) {
    t.string("id");
    t.boolean("isNextPage");
    t.list.field("comments", { type: Comment });
  },
});

export const CommentQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.field("comment", {
      type: Comment,
      args: { commentId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { commentId } = args;
        const comment = await context.prisma.comment.findUnique({
          where: { id: commentId },
        });
        if (!comment) throw new Error("Comment not found.");
        return comment;
      },
    });

    t.nonNull.field("commentsPaged", {
      type: "CommentsPage",
      args: {
        postId: nonNull(stringArg()),
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
      },
      async resolve(parent, args, context) {
        const { limit, skip, postId } = args;

        const comments = await context.prisma.post
          .findUnique({
            where: { id: postId },
          })
          .comments({ take: limit, skip, orderBy: { createdAt: "desc" } });

        const nextComment = await context.prisma.post
          .findUnique({
            where: { id: postId },
          })
          .comments({
            take: 1,
            skip: limit + skip,
            orderBy: { createdAt: "desc" },
          });

        return {
          id: `comments${postId}${limit}${skip}`,
          isNextPage: nextComment.length !== 0 ? true : false,
          comments: comments,
        };
      },
    });
  },
});

export const CommentMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("deleteComment", {
      type: Comment,
      args: {
        commentId: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { commentId } = args;
        const { userId } = context;
        if (!userId) {
          throw new Error("Cannot comment without logging in.");
        }
        const comment = await context.prisma.comment.findUnique({
          where: { id: commentId },
          include: { post: true },
        });
        if (
          comment?.postedById !== userId &&
          comment?.post.postedById !== userId
        ) {
          throw new Error("Cannot delete another users content.");
        }

        return context.prisma.comment.delete({
          where: { id: commentId },
        });
      },
    });

    t.nonNull.field("comment", {
      type: Comment,
      args: {
        postId: nonNull(stringArg()),
        text: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { postId, text } = args;
        const { userId } = context;
        if (!userId) {
          throw new Error("Cannot comment without logging in.");
        }

        const post = await context.prisma.post.findUnique({
          where: { id: postId },
          select: { postedById: true },
        });

        const comment = await context.prisma.comment.create({
          data: {
            text,
            post: { connect: { id: postId } },
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
                  commentId: comment.id,
                };
              })
              .filter(
                (user) =>
                  user.receivedById !== userId ||
                  user.receivedById !== post?.postedById
              ),
          });
        }

        if (userId === post?.postedById) return comment;

        await context.prisma.activity.create({
          data: {
            type: "comment",
            sentBy: { connect: { id: userId } },
            receivedBy: { connect: { id: post?.postedById } },
            comment: { connect: { id: comment.id } },
            post: { connect: { id: postId } },
          },
        });

        return comment;
      },
    });
  },
});
