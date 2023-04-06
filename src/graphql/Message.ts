import { extendType, intArg, nonNull, objectType, stringArg } from "nexus";

export const MessageLike = objectType({
  name: "MessageLike",
  definition(t) {
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("reaction");
    t.nonNull.string("userId"),
      t.nonNull.string("messageId"),
      t.field("user", {
        type: "User",
        resolve(parent, args, context) {
          return context.prisma.user.findUnique({
            where: { id: parent.userId },
          });
        },
      });
    t.field("message", {
      type: Message,
      resolve(parent, args, context) {
        return context.prisma.message.findUnique({
          where: { id: parent.messageId },
        });
      },
    });
  },
});

export const MessageLikesPage = objectType({
  name: "MessageLikesPage",
  definition(t) {
    t.string("id");
    t.boolean("isNextPage");
    t.list.field("reactions", { type: MessageLike });
  },
});

export const MessagesPage = objectType({
  name: "MessagesPage",
  definition(t) {
    t.string("id");
    t.boolean("isNextPage");
    t.list.field("messages", { type: Message });
  },
});

export const Message = objectType({
  name: "Message",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.string("chatId");
    t.nonNull.dateTime("createdAt");
    t.dateTime("readAt");
    t.string("type");
    t.string("text");
    t.string("sticker");
    t.field("user", {
      type: "User",
      resolve(parent, args, context) {
        return context.prisma.message
          .findUnique({
            where: { id: parent.id },
          })
          .user();
      },
    });
    t.field("message", {
      type: Message,
      resolve(parent, args, context) {
        return context.prisma.message
          .findUnique({
            where: { id: parent.id },
          })
          .message();
      },
    });
    t.field("post", {
      type: "Post",
      resolve(parent, args, context) {
        return context.prisma.message
          .findUnique({
            where: { id: parent.id },
          })
          .post();
      },
    });
    t.field("photo", {
      type: "Photo",
      resolve(parent, args, context) {
        return context.prisma.message
          .findUnique({
            where: { id: parent.id },
          })
          .photo();
      },
    });
    t.field("like", {
      type: MessageLike,
      resolve(parent, args, context) {
        return context.prisma.message
          .findUnique({
            where: { id: parent.id },
          })
          .like();
      },
    });
    t.field("sentBy", {
      type: "User",
      resolve(parent, args, context) {
        return context.prisma.message
          .findUnique({
            where: { id: parent.id },
          })
          .sentBy();
      },
    });
    t.list.field("readBy", {
      type: "User",
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");
        const readBy = await context.prisma.message
          .findUnique({
            where: { id: parent.id },
          })
          .readBy();
        return readBy.filter((user) => user.id !== userId);
      },
    });
    t.boolean("isRead", {
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");
        const readBy = await context.prisma.message.findUnique({
          where: { id: parent.id },
          select: { readBy: true },
        });
        const index = readBy?.readBy?.findIndex((user) => user.id === userId);
        return index === -1 ? false : true;
      },
    });
    t.nonNull.int("likesCount", {
      resolve(parent, args, context) {
        return context.prisma.messageLike.count({
          where: {
            messageId: parent.id,
          },
        });
      },
    });
    t.nonNull.field("reactionsPage", {
      type: MessageLikesPage,
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { limit, skip } = args;
        const { id } = parent;

        const reactions = await context.prisma.message
          .findUnique({
            where: { id },
          })
          .likes({ take: limit, skip, orderBy: { createdAt: "desc" } });

        const nextReaction = await context.prisma.message
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
          isNextPage: nextReaction.length === 0 ? false : true,
          reactions,
        };
      },
    });
    t.list.string("topReactions", {
      async resolve(parent, args, context) {
        const reactions = await context.prisma.message
          .findUnique({
            where: { id: parent.id },
          })
          .likes({ select: { reaction: true } });
        if (reactions.length === 0) return [];
        if (reactions.length === 1) return [reactions[0].reaction];

        let visited = Array.from({ length: reactions.length }, (_, i) => false);
        let topReactions = [];

        for (let i = 0; i < reactions.length; i++) {
          if (visited[i] === true) continue;

          let count = 1;
          for (let j = i + 1; j < reactions.length; j++) {
            if (reactions[i].reaction === reactions[j].reaction) {
              visited[j] = true;
              count++;
            }
          }

          topReactions.push({ reaction: reactions[i].reaction, count });
        }

        topReactions.sort((a, z) => z.count - a.count);

        if (topReactions.length === 1) return [topReactions[0].reaction];
        return [topReactions[0].reaction, topReactions[1].reaction];
      },
    });
    t.nonNull.boolean("isLiked", {
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");
        const like = await context.prisma.messageLike.findUnique({
          where: { userId_messageId: { userId, messageId: parent.id } },
          select: { reaction: true },
        });

        return like?.reaction === "❤️" ? true : false;
      },
    });
  },
});

export const MessageQuery = extendType({
  type: "Query",
  definition(t) {
    t.field("uniqueMessage", {
      type: "Message",
      args: { messageId: nonNull(stringArg()) },
      resolve(parent, args, context) {
        return context.prisma.message.findUnique({
          where: { id: args.messageId },
        });
      },
    });
  },
});
