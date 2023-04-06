import {
  extendType,
  intArg,
  list,
  nonNull,
  objectType,
  stringArg,
} from "nexus";
import { Follows, Message as MessageType, User } from "@prisma/client";
import { withFilter } from "graphql-subscriptions";
import { pubsub } from "../context";
import { connect } from "http2";

export const Chat = objectType({
  name: "Chat",
  definition(t) {
    t.nonNull.string("id");
    t.string("name");
    t.nonNull.string("createdById");
    t.nonNull.list.field("admins", {
      type: "User",
      resolve(parent, args, context) {
        return context.prisma.chat
          .findUnique({
            where: { id: parent.id },
          })
          .admins();
      },
    });
    t.field("createdBy", {
      type: "User",
      resolve(parent, args, context) {
        return context.prisma.chat
          .findUnique({
            where: { id: parent.id },
          })
          .createdBy();
      },
    });

    t.nonNull.list.field("members", {
      type: "User",
      resolve(parent, args, context) {
        return context.prisma.chat
          .findUnique({
            where: { id: parent.id },
          })
          .members();
      },
    });

    t.nonNull.field("messagesPage", {
      type: "MessagesPage",
      args: {
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
      },
      async resolve(parent, args, context) {
        const { limit, skip } = args;
        const { id } = parent;

        const messages = await context.prisma.chat
          .findUnique({
            where: { id },
          })
          .messages({
            take: limit,
            skip,
            orderBy: { createdAt: "desc" },
            where: { NOT: { type: "like" } },
          });

        const nextMessage = await context.prisma.chat
          .findUnique({
            where: { id },
          })
          .messages({
            take: 1,
            skip: limit + skip,
            orderBy: { createdAt: "desc" },
            where: { NOT: { type: "like" } },
          });

        return {
          id: id + limit + skip,
          isNextPage: nextMessage.length === 0 ? false : true,
          messages,
        };
      },
    });

    t.field("lastestMessage", {
      type: "Message",
      resolve(parent, args, context) {
        return context.prisma.chat
          .findUnique({ where: { id: parent.id } })
          .latestMessage();
      },
    });

    t.boolean("isAdmin", {
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");

        const chat = await context.prisma.chat.findFirst({
          select: { admins: true },
          where: {
            AND: [
              {
                id: parent.id,
              },
              {
                admins: { some: { id: userId } },
              },
            ],
          },
        });
        return Boolean(chat);
      },
    });

    t.nonNull.boolean("isRequest", {
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("No user logged in.");

        const following = await context.prisma.user.findUnique({
          where: { id: userId },
          select: { following: { select: { followingId: true } } },
        });

        const followingIds = following?.following.map(
          (user) => user.followingId
        );

        const chatRequest = await context.prisma.chat.findFirst({
          where: {
            AND: [
              {
                id: parent.id,
              },
              {
                members: { some: { id: userId } },
              },
              {
                createdBy: {
                  id: {
                    notIn: [...(followingIds || []), userId] || [],
                  },
                },
              },
              {
                admins: { none: { id: { in: followingIds || [] } } },
              },
              {
                acceptedBy: { none: { id: userId } },
              },
            ],
          },
        });

        return chatRequest ? true : false;
      },
    });
  },
});

export const ChatsPage = objectType({
  name: "ChatsPage",
  definition(t) {
    t.string("id");
    t.boolean("isNextPage");
    t.list.field("chats", { type: Chat });
  },
});

export const ChatQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.field("uniqueChat", {
      type: Chat,
      args: { chatId: nonNull(stringArg()), date: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { chatId } = args;
        if (!userId) throw new Error("Cannot chat without logging in.");

        const chat = await context.prisma.chat.findFirst({
          where: {
            AND: [
              {
                id: chatId,
              },
              {
                members: { some: { id: userId } },
              },
            ],
          },
        });
        if (!chat) throw new Error("Chat not found.");

        const lastUnreadWhere = {
          AND: [
            {
              chatId: chatId,
            },
            {
              readBy: {
                none: {
                  id: userId,
                },
              },
            },
          ],
        };
        const lastUnread = await context.prisma.message.findFirst({
          where: lastUnreadWhere,
          orderBy: { createdAt: "desc" },
        });
        if (!lastUnread) return chat;

        //adds viewerId to readBy array if last message unread
        const messagesToUpdate = await context.prisma.message.findMany({
          where: lastUnreadWhere,
          select: {
            id: true,
          },
        });

        await context.prisma.user.update({
          where: { id: userId },
          data: {
            readBy: { connect: messagesToUpdate },
          },
        });
        await context.prisma.message.updateMany({
          where: {
            OR: messagesToUpdate,
          },
          data: {
            readAt: new Date(),
          },
        });
        const updatedMessages = await context.prisma.message.findMany({
          where: {
            OR: messagesToUpdate,
          },
        });
        context.pubsub.publish("READ_MESSAGE", updatedMessages);
        return chat;
      },
    });

    t.field("chatPagedMessages", {
      type: "MessagesPage",
      args: {
        chatId: nonNull(stringArg()),
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
        date: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { limit, skip, chatId } = args;

        const messages = await context.prisma.chat
          .findUnique({
            where: { id: chatId },
          })
          .messages({
            take: limit,
            skip,
            orderBy: { createdAt: "desc" },
            where: { NOT: { type: "like" } },
          });

        const nextMessage = await context.prisma.chat
          .findUnique({
            where: { id: chatId },
          })
          .messages({
            take: 1,
            skip: limit + skip,
            orderBy: { createdAt: "desc" },
            where: { NOT: { type: "like" } },
          });

        return {
          id: chatId + limit + skip,
          isNextPage: nextMessage.length === 0 ? false : true,
          messages,
        };
      },
    });

    t.field("requestChatsPaged", {
      type: ChatsPage,
      args: {
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
        date: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { limit, skip } = args;
        const { userId } = context;
        if (!userId) throw new Error("No user logged in.");

        const following = await context.prisma.user.findUnique({
          where: { id: userId },
          select: { following: { select: { followingId: true } } },
        });

        const followingIds = following?.following.map(
          (user) => user.followingId
        );

        const where = {
          AND: [
            {
              members: { some: { id: userId } },
            },
            {
              createdBy: {
                id: {
                  notIn: [...(followingIds || []), userId] || [],
                },
              },
            },
            {
              admins: { none: { id: { in: followingIds || [] } } },
            },
            {
              acceptedBy: { none: { id: userId } },
            },
          ],
        };
        const chatRequests = await context.prisma.chat.findMany({
          take: limit,
          skip,
          where,
          orderBy: { latestMessage: { createdAt: "desc" } },
        });
        const nextChatRequest = await context.prisma.chat.findMany({
          take: 1,
          skip: skip + limit,
          where,
          orderBy: { latestMessage: { createdAt: "desc" } },
        });

        return {
          id: `chatRequest${userId}${limit}${skip}`,
          isNextPage: nextChatRequest.length !== 0 ? true : false,
          chats: chatRequests,
        };
      },
    });

    t.field("viewerChatsPaged", {
      type: ChatsPage,
      args: {
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
        date: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { limit, skip } = args;
        const { userId } = context;
        if (!userId) throw new Error("No user logged in.");

        const viewer = await context.prisma.user.findFirst({
          where: { id: userId },
          select: {
            following: { select: { followingId: true } },
            acceptedChats: { select: { id: true } },
          },
        });

        const followingIds = viewer?.following.map((user) => user.followingId);
        const acceptedChatsIds = viewer?.acceptedChats.map((user) => user.id);

        //if viewer creates chat it will be fetched without messages requirement.
        const where = {
          OR: [
            {
              createdBy: { id: userId },
            },
            {
              AND: [
                {
                  OR: [
                    {
                      createdBy: { id: { in: followingIds || [] } },
                    },
                    {
                      admins: { some: { id: { in: followingIds || [] } } },
                    },
                    {
                      id: { in: acceptedChatsIds || [] },
                    },
                  ],
                },
                {
                  members: { some: { id: userId } },
                },
                {
                  messages: { some: {} },
                },
              ],
            },
          ],
        };
        const chats = await context.prisma.chat.findMany({
          take: limit,
          skip,
          where,
          orderBy: { latestMessage: { createdAt: "desc" } },
        });

        const nextChat = await context.prisma.chat.findMany({
          take: 1,
          skip: limit + skip,
          where,
          orderBy: { latestMessage: { createdAt: "desc" } },
        });

        return {
          id: `chatsList${userId}${limit}${skip}`,
          isNextPage: nextChat.length !== 0 ? true : false,
          chats,
        };
      },
    });

    t.field("viewerSoloChats", {
      type: ChatsPage,
      args: {
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
        date: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { limit, skip } = args;
        const { userId } = context;
        if (!userId) throw new Error("No user logged in.");

        const viewer = await context.prisma.user.findFirst({
          where: { id: userId },
          select: {
            following: { select: { followingId: true } },
            acceptedChats: { select: { id: true } },
          },
        });

        const followingIds = viewer?.following.map((user) => user.followingId);
        const acceptedChatsIds = viewer?.acceptedChats.map((user) => user.id);

        const where = {
          OR: [
            {
              AND: [
                {
                  createdBy: { id: userId },
                },
                {
                  admins: { none: {} },
                },
              ],
            },
            {
              AND: [
                {
                  OR: [
                    {
                      createdBy: { id: { in: followingIds || [] } },
                    },
                    {
                      id: { in: acceptedChatsIds || [] },
                    },
                  ],
                },
                {
                  members: { some: { id: userId } },
                },
                {
                  messages: { some: {} },
                },
                {
                  admins: { none: {} },
                },
              ],
            },
          ],
        };

        const soloChats = await context.prisma.chat.findMany({
          take: limit,
          skip,
          where,
          orderBy: { latestMessage: { createdAt: "desc" } },
        });

        const nextSoloChat = await context.prisma.chat.findMany({
          take: 1,
          skip: limit + skip,
          where,
          orderBy: { latestMessage: { createdAt: "desc" } },
        });

        return {
          id: `soloChatList${userId}${limit}${skip}`,
          isNextPage: nextSoloChat.length !== 0 ? true : false,
          chats: soloChats,
        };
      },
    });
  },
});

export const ShareList = objectType({
  name: "ShareList",
  definition(t) {
    t.string("userId");
    t.string("chatId");
    t.nonNull.string("postId");
    t.nonNull.string("text");
  },
});

export const ChatMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("newChat", {
      type: Chat,
      args: {
        members: nonNull(list(nonNull(stringArg()))),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Cannot created chat without logging in.");

        if (args.members.includes(userId))
          throw new Error("Cannot message yourself.");

        const fullMembers = [...args.members, userId];

        const chat = await context.prisma.chat.findFirst({
          where: {
            members: { every: { id: { in: fullMembers } } },
          },
        });
        if (chat) return chat;

        return context.prisma.chat.create({
          data: {
            admins:
              fullMembers.length > 2
                ? {
                    connect: { id: userId },
                  }
                : {},
            createdBy: { connect: { id: userId } },
            members: {
              connect:
                fullMembers.map((member): any => {
                  return {
                    id: member,
                  };
                }) || [],
            },
          },
        });
      },
    });

    t.nonNull.field("acceptChat", {
      type: "User",
      args: { chatId: nonNull(stringArg()), date: nonNull(stringArg()) },
      resolve(parent, args, context) {
        const { chatId } = args;
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");

        return context.prisma.user.update({
          where: { id: userId },
          data: { acceptedChats: { connect: { id: chatId } } },
        });
      },
    });

    t.nonNull.field("removeChatRequest", {
      type: Chat,
      args: { chatId: nonNull(stringArg()), date: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { chatId } = args;
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");

        const chat = await context.prisma.chat.findFirst({
          where: {
            AND: [{ id: chatId }, { members: { some: { id: userId } } }],
          },
          select: { admins: true },
        });
        if (!chat) throw new Error("Chat not found.");

        if (chat.admins.length === 0)
          return context.prisma.chat.delete({
            where: { id: chatId },
          });

        return context.prisma.chat.update({
          where: { id: chatId },
          data: {
            admins: { disconnect: { id: userId } },
            members: { disconnect: { id: userId } },
          },
        });
      },
    });

    t.nonNull.boolean("removeAllChatRequests", {
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in");

        const following = await context.prisma.user.findUnique({
          where: { id: userId },
          select: { following: { select: { followingId: true } } },
        });

        const followingIds = following?.following.map(
          (user) => user.followingId
        );
        const where = {
          AND: [
            {
              members: { some: { id: userId } },
            },
            {
              createdBy: {
                id: {
                  notIn: [...(followingIds || []), userId] || [],
                },
              },
            },
            {
              admins: { none: { id: { in: followingIds || [] } } },
            },
            {
              acceptedBy: { none: { id: userId } },
            },
          ],
        };
        const chatRequests = await context.prisma.chat.findMany({
          include: { admins: true },
          where,
          orderBy: { latestMessage: { createdAt: "desc" } },
        });
        if (chatRequests.length === 0) throw new Error("No requests found.");

        for (let i = 0; i < chatRequests.length; i++) {
          if (chatRequests[i].admins.length === 0) {
            await context.prisma.chat.delete({
              where: { id: chatRequests[i].id },
            });
          } else {
            await context.prisma.chat.update({
              where: { id: chatRequests[i].id },
              data: {
                admins: { disconnect: { id: userId } },
                members: { disconnect: { id: userId } },
              },
            });
          }
        }

        return true;
      },
    });

    t.nonNull.field("addPeople", {
      type: Chat,
      args: {
        members: nonNull(list(nonNull(stringArg()))),
        chatId: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { chatId, members } = args;
        if (!userId) throw new Error("Must be logged in.");

        const isAdmin = await context.prisma.chat.findFirst({
          where: {
            AND: [{ id: chatId }, { admins: { some: { id: userId } } }],
          },
        });
        if (!isAdmin) throw new Error("Must be admin to add.");

        const updatedChat = await context.prisma.chat.update({
          include: { members: true },
          where: {
            id: chatId,
          },
          data: {
            members: {
              connect:
                members.map((member: any) => {
                  return {
                    id: member,
                  };
                }) || [],
            },
          },
        });

        for (let i = 0; i < members.length; i++) {
          await context.prisma.message.create({
            data: {
              type: "activity",
              text: "add-chat",
              user: { connect: { id: members[i] } },
              chat: { connect: { id: chatId } },
              sentBy: { connect: { id: userId } },
              readBy: {
                connect: updatedChat.members.map((user) => ({ id: user.id })),
              },
            },
          });
        }

        return updatedChat;
      },
    });

    t.nonNull.field("removePeople", {
      type: Chat,
      args: {
        memberId: nonNull(stringArg()),
        chatId: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { memberId, chatId } = args;
        if (!userId) throw new Error("Must be logged in.");

        const isAdmin = await context.prisma.chat.findFirst({
          where: {
            AND: [{ id: chatId }, { admins: { some: { id: userId } } }],
          },
        });
        if (!isAdmin) throw new Error("Must be admin to remove");

        const updatedChat = await context.prisma.chat.update({
          include: { members: true },
          where: {
            id: chatId,
          },
          data: {
            members: {
              disconnect: {
                id: memberId,
              },
            },
          },
        });

        await context.prisma.message.create({
          data: {
            type: "activity",
            text: "remove-chat",
            user: { connect: { id: memberId } },
            chat: { connect: { id: chatId } },
            sentBy: { connect: { id: userId } },
            readBy: {
              connect: updatedChat.members.map((user) => ({ id: user.id })),
            },
          },
        });

        return updatedChat;
      },
    });

    t.nonNull.field("adminToggle", {
      type: Chat,
      args: {
        memberId: nonNull(stringArg()),
        chatId: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { memberId, chatId } = args;
        if (!userId) throw new Error("Must be logged in.");

        const isAdmin = await context.prisma.chat.findFirst({
          include: { admins: true },
          where: {
            AND: [{ id: chatId }, { admins: { some: { id: userId } } }],
          },
        });
        if (!isAdmin) throw new Error("Must be admin.");

        const index = isAdmin.admins.findIndex((user) => user.id === memberId);

        return context.prisma.chat.update({
          where: {
            id: chatId,
          },
          data: {
            admins:
              index === -1
                ? { connect: { id: memberId } }
                : { disconnect: { id: memberId } },
          },
        });
      },
    });

    t.nonNull.field("saveChatName", {
      type: Chat,
      args: {
        name: nonNull(stringArg()),
        chatId: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");
        const { name, chatId } = args;

        const isAdmin = await context.prisma.chat.findFirst({
          where: {
            AND: [{ id: chatId }, { admins: { some: { id: userId } } }],
          },
        });
        if (!isAdmin) throw new Error("Must be admin.");

        const updatedChat = await context.prisma.chat.update({
          include: { members: true },
          where: {
            id: chatId,
          },
          data: {
            name,
          },
        });

        await context.prisma.message.create({
          data: {
            type: "activity",
            text: name,
            chat: { connect: { id: chatId } },
            sentBy: { connect: { id: userId } },
            readBy: {
              connect: updatedChat.members.map((user) => ({ id: userId })),
            },
          },
        });

        return updatedChat;
      },
    });

    t.nonNull.field("leaveChat", {
      type: Chat,
      args: {
        chatId: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");
        const { chatId } = args;

        const chat = await context.prisma.chat.findFirst({
          include: { admins: true, members: true },
          where: {
            AND: [{ id: chatId }, { members: { some: { id: userId } } }],
          },
        });
        if (!chat) throw new Error("Access Denied.");

        let updatedChat;

        const isViewerLastAdmin =
          chat.admins.length === 1 && chat.admins[0].id === userId;
        const isCreatedBy = chat.createdById === userId;

        if (isViewerLastAdmin) {
          const nextAdmin = chat.members[0];
          updatedChat = await context.prisma.chat.update({
            include: { members: true },
            where: {
              id: chatId,
            },
            data: {
              createdBy: { connect: { id: nextAdmin.id } },
              admins: {
                connect: { id: nextAdmin.id },
                disconnect: { id: userId },
              },
              members: { disconnect: { id: userId } },
            },
          });
          await context.prisma.message.create({
            data: {
              type: "activity",
              text: "new-admin",
              user: { connect: { id: nextAdmin.id } },
              chat: { connect: { id: chatId } },
              sentBy: { connect: { id: userId } },
              readBy: {
                connect: updatedChat.members.map((user) => ({ id: user.id })),
              },
            },
          });
        } else {
          const nextAdmin = chat.admins.find(
            (user: User) => user.id !== userId
          );
          updatedChat = await context.prisma.chat.update({
            include: { members: true },
            where: {
              id: chatId,
            },
            data: {
              createdBy: isCreatedBy ? { connect: { id: nextAdmin?.id } } : {},
              admins: { disconnect: { id: userId } },
              members: { disconnect: { id: userId } },
            },
          });
        }

        await context.prisma.message.create({
          data: {
            type: "activity",
            text: "left-chat",
            chat: { connect: { id: chatId } },
            sentBy: { connect: { id: userId } },
            readBy: {
              connect: updatedChat.members.map((user) => ({ id: user.id })),
            },
          },
        });

        return updatedChat;
      },
    });

    t.nonNull.field("deleteChat", {
      type: Chat,
      args: { chatId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { chatId } = args;
        if (!userId) throw new Error("Must be logged in.");

        const isAdmin = await context.prisma.chat.findFirst({
          where: {
            AND: [{ id: chatId }, { admins: { some: { id: userId } } }],
          },
        });
        const chat = await context.prisma.chat.findUnique({
          select: { admins: true },
          where: { id: chatId },
        });
        if (!isAdmin && chat?.admins.length !== 0)
          throw new Error("Must be admin.");

        return context.prisma.chat.delete({
          where: { id: chatId },
        });
      },
    });

    t.nonNull.list.field("sharePost", {
      type: "Message",
      args: {
        postId: nonNull(stringArg()),
        text: nonNull(stringArg()),
        ids: nonNull(list(nonNull(stringArg()))),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { ids, text, postId } = args;
        if (!userId) throw new Error("Must be logged in.");

        const chatIds = [];
        for (let index = 0; index < ids.length; index++) {
          const chat = await context.prisma.chat.findFirst({
            where: {
              OR: [
                { id: ids[index] },
                { members: { every: { id: { in: [ids[index], userId] } } } },
              ],
            },
            select: { id: true },
          });
          if (chat) chatIds.push(chat.id);
          if (!chat) {
            const newChat = await context.prisma.chat.create({
              data: {
                createdBy: { connect: { id: userId } },
                members: { connect: [{ id: ids[index] }, { id: userId }] },
              },
            });
            chatIds.push(newChat.id);
          }
        }

        const newMessages = [];
        for (let index = 0; index < chatIds.length; index++) {
          const message = await context.prisma.message.create({
            data: {
              type: "post",
              post: { connect: { id: postId } },
              chat: { connect: { id: chatIds[index] } },
              sentBy: { connect: { id: userId } },
              readBy: { connect: { id: userId } },
            },
          });
          if (message) {
            await context.prisma.chat.update({
              where: { id: chatIds[index] },
              data: { latestMessage: { connect: { id: message.id } } },
            });
            context.pubsub.publish("NEW_MESSAGE", message);
            newMessages.push(message);
          }
          if (text) {
            const textMessage = await context.prisma.message.create({
              data: {
                type: "text",
                text,
                chat: { connect: { id: chatIds[index] } },
                sentBy: { connect: { id: userId } },
                readBy: { connect: { id: userId } },
              },
            });
            if (textMessage) {
              context.pubsub.publish("NEW_MESSAGE", textMessage);
              newMessages.push(textMessage);
            }
          }
        }

        return newMessages;
      },
    });

    t.nonNull.list.field("forwardMessage", {
      type: "Message",
      args: {
        text: stringArg(),
        photoId: stringArg(),
        postId: stringArg(),
        ids: nonNull(list(nonNull(stringArg()))),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { text, photoId, postId, ids } = args;
        if (!userId) throw new Error("Cannot message without logging in.");

        const chatIds = [];
        for (let i = 0; i < ids.length; i++) {
          const chat = await context.prisma.chat.findFirst({
            where: {
              OR: [
                { id: ids[i] },
                { members: { every: { id: { in: [ids[i], userId] } } } },
              ],
            },
            select: { id: true },
          });
          if (chat) {
            chatIds.push(chat.id);
            continue;
          }
          const newChat = await context.prisma.chat.create({
            data: {
              createdBy: { connect: { id: userId } },
              members: {
                connect: [{ id: ids[i] }, { id: userId }],
              },
            },
          });
          chatIds.push(newChat.id);
        }

        const newMessages = [];
        for (let i = 0; i < chatIds.length; i++) {
          switch (true) {
            case text !== null && !photoId && !postId:
              const textMessage = await context.prisma.message.create({
                data: {
                  type: "text",
                  text,
                  chat: { connect: { id: chatIds[i] } },
                  sentBy: { connect: { id: userId } },
                  readBy: { connect: { id: userId } },
                },
              });
              if (textMessage) {
                context.pubsub.publish("NEW_MESSAGE", textMessage);
                newMessages.push(textMessage);
              }
              break;

            case postId !== undefined && !text && !photoId:
              if (!postId) break;
              const postMessage = await context.prisma.message.create({
                data: {
                  type: "post",
                  post: { connect: { id: postId } },
                  chat: { connect: { id: chatIds[i] } },
                  sentBy: { connect: { id: userId } },
                  readBy: { connect: { id: userId } },
                },
              });
              if (postMessage) {
                context.pubsub.publish("NEW_MESSAGE", postMessage);
                newMessages.push(postMessage);
              }
              break;

            case photoId !== undefined && !text && !postId:
              if (!photoId) break;
              const photoMessage = await context.prisma.message.create({
                data: {
                  type: "photo",
                  photo: { connect: { id: photoId } },
                  chat: { connect: { id: chatIds[i] } },
                  sentBy: { connect: { id: userId } },
                  readBy: { connect: { id: userId } },
                },
              });
              if (photoMessage) {
                context.pubsub.publish("NEW_MESSAGE", photoMessage);
                newMessages.push(photoMessage);
              }
              break;

            default:
              break;
          }
        }
        return newMessages;
      },
    });

    t.nonNull.field("message", {
      type: "Message",
      args: {
        chatId: nonNull(stringArg()),
        type: stringArg(),
        text: stringArg(),
        postId: stringArg(),
        sticker: stringArg(),
        messageId: stringArg(),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { text, chatId, postId, sticker, messageId } = args;
        if (!userId) throw new Error("Cannot send message without logging in.");

        let message;

        switch (true) {
          case text !== undefined && messageId === undefined:
            message = await context.prisma.message.create({
              data: {
                type: "text",
                text,
                chat: { connect: { id: chatId } },
                sentBy: { connect: { id: userId } },
                readBy: { connect: { id: userId } },
              },
            });
            break;
          case text !== undefined && messageId !== undefined:
            if (messageId)
              message = await context.prisma.message.create({
                data: {
                  type: "reply",
                  text,
                  message: { connect: { id: messageId } },
                  chat: { connect: { id: chatId } },
                  sentBy: { connect: { id: userId } },
                  readBy: { connect: { id: userId } },
                },
              });
            break;
          case text === undefined && messageId !== undefined:
            if (messageId)
              message = await context.prisma.message.create({
                data: {
                  type: "forward",
                  text,
                  message: { connect: { id: messageId } },
                  chat: { connect: { id: chatId } },
                  sentBy: { connect: { id: userId } },
                  readBy: { connect: { id: userId } },
                },
              });
            break;
          case postId !== undefined:
            if (postId)
              message = await context.prisma.message.create({
                data: {
                  type: "post",
                  post: { connect: { id: postId } },
                  chat: { connect: { id: chatId } },
                  sentBy: { connect: { id: userId } },
                  readBy: { connect: { id: userId } },
                },
              });
            break;
          case sticker !== undefined:
            if (sticker)
              message = await context.prisma.message.create({
                data: {
                  type: "sticker",
                  sticker,
                  chat: { connect: { id: chatId } },
                  sentBy: { connect: { id: userId } },
                  readBy: { connect: { id: userId } },
                },
              });
            break;
          default:
            break;
        }

        if (!message) throw new Error("Message missing content.");

        await context.prisma.chat.update({
          where: { id: chatId },
          data: { latestMessage: { connect: { id: message.id } } },
        });
        context.pubsub.publish("NEW_MESSAGE", message);

        return message;
      },
    });

    t.field("likeMessage", {
      type: "Message",
      args: {
        messageId: nonNull(stringArg()),
        reaction: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { messageId, reaction } = args;
        if (!userId) throw new Error("Must be logged in.");

        try {
          await context.prisma.messageLike.create({
            data: {
              reaction,
              userId,
              messageId,
            },
          });
        } catch (error) {
          await context.prisma.messageLike.update({
            where: {
              userId_messageId: { userId, messageId },
            },
            data: {
              reaction,
            },
          });
        }

        const message = await context.prisma.message.findUnique({
          where: { id: messageId },
        });
        if (!message) throw new Error("Message cannot be found.");
        if (userId === message.sentById) {
          context.pubsub.publish("READ_MESSAGE", [message]);
          return message;
        }

        const likeMessage = await context.prisma.message.create({
          data: {
            type: "like",
            chat: { connect: { id: message.chatId } },
            sentBy: { connect: { id: userId } },
            readBy: { connect: { id: userId } },
            like: {
              connect: { userId_messageId: { userId, messageId } },
            },
          },
        });
        context.pubsub.publish("NEW_MESSAGE", likeMessage);
        context.pubsub.publish("READ_MESSAGE", [message]);
        return message;
      },
    });

    t.field("unlikeMessage", {
      type: "Message",
      args: {
        messageId: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { messageId } = args;
        if (!userId) throw new Error("Must be logged in.");

        await context.prisma.messageLike.delete({
          where: {
            userId_messageId: {
              userId,
              messageId,
            },
          },
        });

        const message = await context.prisma.message.findUnique({
          where: { id: messageId },
        });

        context.pubsub.publish("READ_MESSAGE", [message]);
        return message;
      },
    });

    t.field("deleteMessage", {
      type: "Message",
      args: { messageId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");
        const { messageId } = args;

        const message = await context.prisma.message.findUnique({
          where: { id: args.messageId },
          include: { latestChat: true },
        });

        if (message?.sentById !== userId)
          throw new Error("Cannot delete other users messages.");

        const deletedMessage = await context.prisma.message.delete({
          where: { id: messageId },
        });

        if (message?.latestChat) {
          const lastestMessage = await context.prisma.message.findFirst({
            take: 1,
            where: { chatId: message.chatId },
            orderBy: { createdAt: "desc" },
          });
          const update = await context.prisma.chat.update({
            where: { id: message.chatId },
            data: { latestMessage: { connect: { id: lastestMessage?.id } } },
            include: { latestMessage: true },
          });
        }

        context.pubsub.publish("DELETE_MESSAGE", deletedMessage);
        return deletedMessage;
      },
    });
  },
});

export const ChatSubscriptions = extendType({
  type: "Subscription",
  definition(t) {
    t.field("newMessage", {
      type: "Message",
      args: { chatId: nonNull(stringArg()) },
      subscribe: withFilter(
        () => pubsub.asyncIterator<MessageType>(["NEW_MESSAGE"]),
        async (payload, variables, context) => {
          const { chatId } = variables;
          const { userId } = context;

          const viewer = await context.prisma.user.findFirst({
            where: { id: userId },
            select: {
              following: { select: { followingId: true } },
              acceptedChats: { select: { id: true } },
            },
          });

          const followingIds = viewer?.following.map(
            (user: { followingId: string }) => user.followingId
          );
          const acceptedChatsIds = viewer?.acceptedChats.map(
            (user: { id: string }) => user.id
          );

          const chat = await context.prisma.chat.findFirst({
            where: {
              OR: [
                {
                  createdBy: { id: userId },
                },
                {
                  AND: [
                    {
                      OR: [
                        {
                          createdBy: { id: { in: followingIds || [] } },
                        },
                        {
                          admins: { some: { id: { in: followingIds || [] } } },
                        },
                        {
                          id: { in: acceptedChatsIds || [] },
                        },
                      ],
                    },
                    {
                      members: { some: { id: userId } },
                    },
                    {
                      messages: { some: {} },
                    },
                  ],
                },
              ],
            },
          });
          if (!chat) throw new Error("Chat not found.");
          if (payload.likeUserId) return false;
          return payload.chatId === variables.chatId;
        }
      ),

      resolve: async (payload, args, context) => {
        const { userId } = context;

        if (!userId) throw new Error("Must be logged in.");
        if (userId === payload.sentById) return payload;
        const message = await context.prisma.message.update({
          where: { id: payload.id },
          data: { readBy: { connect: { id: userId } }, readAt: new Date() },
        });
        pubsub.publish("READ_MESSAGE", [message]);
        return payload;
      },
    });

    t.list.field("readMessage", {
      type: "Message",
      subscribe: withFilter(
        () => pubsub.asyncIterator<MessageType>(["READ_MESSAGE"]),
        async (payload, variables, context) => {
          const { userId } = context;

          const chat = await context.prisma.chat.findFirst({
            where: {
              AND: [
                {
                  id: payload.chatId,
                },
                {
                  memberIds: {
                    has: userId,
                  },
                },
              ],
            },
          });
          return chat ? true : false;
        }
      ),

      resolve: (payload, variables, context) => {
        return payload;
      },
    });

    t.field("deletedMessage", {
      type: "Message",
      subscribe: withFilter(
        () => pubsub.asyncIterator<MessageType>(["DELETE_MESSAGE"]),
        async (payload, variables, context) => {
          const { userId } = context;

          const chat = await context.prisma.chat.findFirst({
            where: {
              AND: [
                {
                  id: payload.chatId,
                },
                {
                  memberIds: {
                    has: userId,
                  },
                },
              ],
            },
          });
          return chat ? true : false;
        }
      ),

      resolve: (payload, variables, context) => {
        return payload;
      },
    });

    t.field("unreadMessageCount", {
      type: "User",
      subscribe: withFilter(
        () =>
          pubsub.asyncIterator<MessageType>([
            "NEW_MESSAGE",
            "READ_MESSAGE",
            "DELETE_MESSAGE",
          ]),
        async (payload, variables, context) => {
          const { userId } = context;
          let Payload = payload;
          if (Array.isArray(payload)) Payload = payload[0];
          if (Payload.sentById === userId) return false;

          const chat = await context.prisma.chat.findFirst({
            where: {
              AND: [
                {
                  id: payload.chatId,
                },
                {
                  members: { some: { id: userId } },
                },
              ],
            },
          });
          return chat ? true : false;
        }
      ),

      resolve: (payload, variables, context) => {
        return context.prisma.user.findUnique({
          where: { id: context.userId },
        });
      },
    });

    t.field("newInboxMessage", {
      type: Chat,
      subscribe: withFilter(
        () => pubsub.asyncIterator<MessageType>(["NEW_MESSAGE"]),
        async (payload, variables, context) => {
          const { chatId } = payload;
          const { userId } = context;
          const following = await context.prisma.user.findFirst({
            where: { id: userId },
            select: { following: { select: { followingId: true } } },
          });

          const chat = await context.prisma.chat.findFirst({
            where: {
              AND: [
                {
                  id: chatId,
                },
                {
                  members: { some: { id: userId } },
                },
                {
                  OR: [
                    {
                      createdBy: {
                        id: userId,
                      },
                    },
                    {
                      createdBy: {
                        id: {
                          in:
                            following?.following.map(
                              (user: Follows) => user.followingId
                            ) || [],
                        },
                      },
                    },
                  ],
                },
              ],
            },
          });

          return chat ? true : false;
        }
      ),
      resolve: (payload, variables, context) => {
        return context.prisma.chat.findUnique({
          where: { id: payload.chatId },
        });
      },
    });
  },
});
