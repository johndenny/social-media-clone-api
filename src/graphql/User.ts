import {
  objectType,
  extendType,
  stringArg,
  intArg,
  nonNull,
  booleanArg,
} from "nexus";
import { User as UserType } from "@prisma/client";
import { Context } from "../context";

export const Counts = objectType({
  name: "counts",
  definition(t) {
    t.id("id");
    t.nonNull.int("followedBy");
    t.nonNull.int("follows");
    t.nonNull.int("media");
  },
});

export const HiddenUser = objectType({
  name: "HiddenUser",
  definition(t) {
    t.nonNull.string("userId");
    t.nonNull.string("viewerId");
    t.field("viewer", {
      type: User,
      resolve(parent, args, context) {
        const { viewerId } = parent;
        return context.prisma.user.findUnique({ where: { id: viewerId } });
      },
    });
    t.field("user", {
      type: "User",
      resolve(parent, args, context) {
        const { userId } = parent;
        return context.prisma.user.findUnique({ where: { id: userId } });
      },
    });
  },
});

export const UserMini = objectType({
  name: "UserMini",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.string("username");
    t.nonNull.string("fullName");
    t.nonNull.int("photoVersion");
    t.nonNull.boolean("isFollowing", {
      async resolve(parent, args, context) {
        const { id } = parent;
        const { userId } = context;
        if (!userId) return false;
        const follow = await context.prisma.follows.findUnique({
          where: {
            followerId_followingId: { followerId: userId, followingId: id },
          },
        });
        return follow ? true : false;
      },
    });
  },
});

export const MutualFollowers = objectType({
  name: "MutualFollowers",
  definition(t) {
    t.id("id");
    t.nonNull.int("count");
    t.list.field("users", {
      type: UserMini,
    });
  },
});

const UsersListPage = objectType({
  name: "UsersListPage",
  definition(t) {
    t.string("id");
    t.boolean("isNextPage");
    t.list.field("profiles", { type: User });
  },
});

export const User = objectType({
  name: "User",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.string("username");
    t.int("photoVersion");
    t.string("fullName");
    t.string("bio");
    t.string("gender");
    t.string("url");
    t.string("email", {
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");
        if (userId !== parent.id) throw new Error("Access denied.");

        const user = await context.prisma.user.findUnique({
          where: { id: parent.id },
        });
        if (!user) throw new Error("User not found.");

        return user.email;
      },
    });
    t.nonNull.boolean("isPrivate");
    t.nonNull.int("tokenVersion");
    t.field("postsPage", {
      type: "PagedPosts",
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { id, isPrivate } = parent;
        const { limit, skip } = args;

        if (isPrivate) {
          if (!userId) return null;

          const follow = await context.prisma.follows.findUnique({
            where: {
              followerId_followingId: { followerId: userId, followingId: id },
            },
          });

          if (userId !== id && !follow) return null;
        }

        const posts = await context.prisma.post.findMany({
          take: limit,
          skip,
          orderBy: { createdAt: "desc" },
          where: { postedById: parent.id },
        });

        const nextPost = await context.prisma.user
          .findUnique({
            where: { id: parent.id },
          })
          .posts({
            take: 1,
            skip: skip + limit,
            orderBy: { createdAt: "desc" },
          });

        return {
          id: parent.id + skip + limit,
          posts,
          isNextPage: nextPost.length === 0 ? false : true,
        };
      },
    });
    t.nonNull.list.nonNull.field("likes", {
      type: "Like",
      resolve(_parent, _args, context) {
        const { userId } = context;
        return context.prisma.like.findMany({ where: { userId } });
      },
    });
    t.field("followedBy", {
      type: UsersListPage,
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { id, isPrivate } = parent;
        const { limit, skip } = args;

        if (!userId) throw new Error("Must be logged in.");

        const follow = await context.prisma.follows.findUnique({
          where: {
            followerId_followingId: { followerId: userId, followingId: id },
          },
        });

        if (isPrivate && userId !== id && !follow) return null;

        const follows = await context.prisma.follows.findMany({
          take: limit,
          skip,
          where: { followingId: parent.id },
          select: { follower: true },
        });

        const nextPage = await context.prisma.user
          .findUnique({
            where: { id: parent.id },
          })
          .followedBy({ take: 1, skip: skip + limit });

        return {
          id: "followers" + parent.id + skip + limit,
          isNextPage: nextPage.length === 0 ? false : true,
          profiles: follows.map((follow) => follow.follower),
        };
      },
    });
    t.field("following", {
      type: UsersListPage,
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { id, isPrivate } = parent;
        const { limit, skip } = args;

        if (!userId) throw new Error("Must be logged in.");

        const follow = await context.prisma.follows.findUnique({
          where: {
            followerId_followingId: { followerId: userId, followingId: id },
          },
        });

        if (isPrivate && userId !== id && !follow) return null;

        const follows = await context.prisma.follows.findMany({
          take: limit,
          skip,
          where: { followerId: parent.id },
          select: { following: true },
        });

        const nextPage = await context.prisma.user
          .findUnique({
            where: { id: parent.id },
          })
          .following({ take: 1, skip: skip + limit });

        return {
          id: "following" + parent.id + skip + limit,
          isNextPage: nextPage.length === 0 ? false : true,
          profiles: follows.map((follow) => follow.following),
        };
      },
    });
    t.nonNull.boolean("isFollowing", {
      async resolve(parent, args, context) {
        const { id } = parent;
        const { userId } = context;
        if (!userId) return false;

        const follow = await context.prisma.follows.findUnique({
          where: {
            followerId_followingId: { followerId: userId, followingId: id },
          },
        });
        return follow ? true : false;
      },
    });
    t.nonNull.boolean("isRequested", {
      async resolve(parent, args, context) {
        const { id } = parent;
        const { userId } = context;
        if (!userId) return false;

        const followRequest = await context.prisma.followRequest.findUnique({
          where: {
            userReceiveId_userRequestId: {
              userReceiveId: id,
              userRequestId: userId,
            },
          },
        });

        return followRequest ? true : false;
      },
    });
    t.nonNull.field("counts", {
      type: Counts,
      async resolve(parent, args, context) {
        const { id } = parent;
        const followedBy = await context.prisma.follows.count({
          where: { followingId: id },
        });
        const follows = await context.prisma.follows.count({
          where: { followerId: id },
        });
        const media = await context.prisma.post.count({
          where: { postedById: id },
        });
        return { followedBy, follows, media, id: parent.id };
      },
    });
    t.nonNull.int("unreadCount", {
      async resolve(parent, args, context) {
        const { userId } = context;
        if (userId !== parent.id)
          throw new Error("You cannot access others unread count.");

        const viewer = await context.prisma.user.findFirst({
          where: { id: userId },
          select: {
            following: { select: { followingId: true } },
            acceptedChats: { select: { id: true } },
          },
        });

        const followingIds = viewer?.following.map((user) => user.followingId);
        const acceptedChatsIds = viewer?.acceptedChats.map((user) => user.id);

        return context.prisma.chat.count({
          where: {
            AND: [
              {
                OR: [
                  {
                    createdBy: { id: userId },
                  },
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
              { members: { some: { id: userId } } },
              {
                messages: { some: { readBy: { none: { id: userId } } } },
              },
            ],
          },
        });
      },
    });
    t.nonNull.int("chatRequestsCount", {
      async resolve(parent, args, context) {
        const { userId } = context;
        if (userId !== parent.id)
          throw new Error("You cannot access others unread count.");

        const following = await context.prisma.user.findUnique({
          where: { id: userId },
          select: { following: { select: { followingId: true } } },
        });

        const followingIds = following?.following.map(
          (user) => user.followingId
        );

        const chatRequests = await context.prisma.chat.count({
          where: {
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
              { latestMessage: { readBy: { none: { id: userId } } } },
            ],
          },
        });

        return chatRequests;
      },
    });
    t.nonNull.field("activityCounts", {
      type: "ActivityCount",
      async resolve(parent, args, context) {
        const { userId } = context;
        if (userId !== parent.id)
          throw new Error("You cannot access others activity counts.");

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
          id: parent.id,
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
    t.field("tagged", {
      type: "TagsPage",
      args: {
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { id, isPrivate } = parent;
        const { limit, skip } = args;

        if (userId) {
          const follow = await context.prisma.follows.findUnique({
            where: {
              followerId_followingId: { followerId: userId, followingId: id },
            },
          });

          if (isPrivate && userId !== id && !follow) return null;
        }

        if (isPrivate) return null;

        const taggedPosts = await context.prisma.user
          .findUnique({
            where: { id: parent.id },
          })
          .tagged({
            take: limit,
            skip,
            orderBy: { post: { createdAt: "desc" } },
            select: { post: true },
          });

        const nextPost = await context.prisma.user
          .findUnique({
            where: { id: parent.id },
          })
          .tagged({
            take: 1,
            skip: skip + limit,
            orderBy: { post: { createdAt: "desc" } },
          });

        return {
          id: parent.id + skip + limit,
          isNextPage: nextPost.length === 0 ? false : true,
          posts: taggedPosts.map((tag) => tag.post),
        };
      },
    });
    t.field("mutualFollowers", {
      type: MutualFollowers,
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) return null;
        const mutual = await context.prisma.$queryRaw<
          [
            {
              id: string;
              username: string;
              fullName: string;
              photoVersion: number;
            }
          ]
        >`
          SELECT 
            "viewerFollowing".id, 
            "User".username,
            "User"."fullName",
            "User"."photoVersion"
          FROM (
            SELECT "followingId" id 
            FROM "Follows" 
            WHERE "followerId" = ${userId}
          ) AS "viewerFollowing"
            JOIN
          (
            SELECT "followerId" id 
            FROM "Follows" 
            WHERE "followingId" = ${parent.id}
          ) AS "userFollowers"
          ON "viewerFollowing".id = "userFollowers".id
          JOIN "User" ON "User".id = "viewerFollowing".id
          LIMIT 3
        `;
        const mutualCount = await context.prisma.$queryRaw<[{ count: number }]>`
            SELECT COUNT(*) FROM (
              SELECT 
                "viewerFollowing".id, 
                "User".username,
                "User"."fullName",
                "User"."photoVersion"
              FROM (
                SELECT "followingId" id 
                FROM "Follows" 
                WHERE "followerId" = ${userId}
              ) AS "viewerFollowing"
                JOIN
              (
                SELECT "followerId" id 
                FROM "Follows" 
                WHERE "followingId" = ${parent.id}
              ) AS "userFollowers"
              ON "viewerFollowing".id = "userFollowers".id
              JOIN "User" ON "User".id = "viewerFollowing".id
            ) T
        `;
        return { id: parent.id, count: mutualCount[0].count, users: mutual };
      },
    });
    t.nonNull.list.field("acceptedChats", {
      type: "Chat",
      resolve(parent, args, context) {
        return context.prisma.user
          .findUnique({ where: { id: parent.id } })
          .acceptedChats();
      },
    });
    t.nonNull.boolean("isCollection", {
      async resolve(parent, args, context) {
        const collection = await context.prisma.collection.findFirst({
          where: { createdById: parent.id },
        });
        return Boolean(collection);
      },
    });
  },
});

export const UserQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.field("viewer", {
      type: "User",
      async resolve(_parent, _args, context) {
        const { userId } = context;
        if (!userId) throw new Error("User not logged in.");
        const user = await context.prisma.user.findUnique({
          where: { id: userId },
        });
        if (!user) {
          throw new Error("User not found.");
        }
        return user;
      },
    });

    t.nonNull.field("checkUsername", {
      type: "Boolean",
      args: {
        username: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { username } = args;
        const user = await context.prisma.user.findUnique({
          where: { username },
        });
        return user ? true : false;
      },
    });

    t.nonNull.list.nonNull.field("usersFilter", {
      type: "User",
      args: {
        filter: nonNull(stringArg()),
      },
      resolve(_parent, args, context) {
        const where = args.filter
          ? { username: { contains: args.filter } }
          : {};
        return context.prisma.user.findMany({ where });
      },
    });

    t.nonNull.field("user", {
      type: "User",
      args: {
        username: nonNull(stringArg()),
      },
      async resolve(_parents, args, context) {
        const { username } = args;
        const user = await context.prisma.user.findUnique({
          where: { username },
        });
        if (!user) throw new Error("No user found.");
        return user;
      },
    });

    t.nonNull.field("suggestedUsers", {
      type: UsersListPage,
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { limit, skip } = args;
        const { userId } = context;
        if (!userId) throw new Error("no user logged in.");

        const suggestedUsers = await suggestedUsersQuery({
          context,
          userId,
          limit,
          skip,
        });

        const nextSuggestedUser = await suggestedUsersQuery({
          context,
          userId,
          limit: 1,
          skip: limit + skip,
        });

        return {
          id: "suggestedUsers" + userId + skip + limit,
          isNextPage: nextSuggestedUser.length === 0 ? false : true,
          profiles: suggestedUsers,
        };
      },
    });

    t.nonNull.field("popularUsers", {
      type: UsersListPage,
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { limit, skip } = args;
        const { userId } = context;
        if (!userId) throw new Error("no user logged in.");

        const popularUsers = await context.prisma.user.findMany({
          take: limit,
          skip,
          where: {
            AND: [
              { hiddenUsers: { none: { viewerId: userId } } },
              { followedBy: { none: { followerId: userId } } },
              { NOT: { id: userId } },
            ],
          },
          orderBy: [
            {
              followedBy: { _count: "desc" },
            },
            { username: "asc" },
          ],
        });

        const nextPopularUser = await context.prisma.user.findMany({
          take: 1,
          skip: limit + skip,
          where: { NOT: { hiddenViewers: { some: { viewerId: userId } } } },
          orderBy: [
            {
              followedBy: { _count: "desc" },
            },
            { username: "asc" },
          ],
        });

        return {
          id: "popularUsers" + userId + skip + limit,
          isNextPage: nextPopularUser.length === 0 ? false : true,
          profiles: popularUsers,
        };
      },
    });

    t.boolean("rawQuery", {
      args: {},
      async resolve(parent, args, context) {
        const query = await context.prisma.$queryRaw`
      SELECT *
      FROM "User"   
      WHERE id = '9d96d1a4-d366-4112-abda-a1acbf6345ba'

        `;
        console.log(query);
        return true;
      },
    });
  },
});

export const UserMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("editUser", {
      type: User,
      args: {
        fullName: nonNull(stringArg()),
        username: nonNull(stringArg()),
        bio: nonNull(stringArg()),
        url: nonNull(stringArg()),
        email: nonNull(stringArg()),
        isPrivate: nonNull(booleanArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) {
          throw new Error("Cannot edit without logging in.");
        }

        if (!args.isPrivate) {
          const followRequests = await context.prisma.followRequest.findMany({
            where: { userReceiveId: userId },
          });

          if (followRequests.length !== 0) {
            await context.prisma.followRequest.deleteMany({
              where: { userReceiveId: userId },
            });
            await context.prisma.follows.createMany({
              data: followRequests.map((request) => {
                return {
                  followerId: request.userRequestId,
                  followingId: request.userReceiveId,
                };
              }),
            });
          }
        }
        const user = await context.prisma.user.update({
          where: { id: userId },
          data: {
            ...args,
          },
        });
        return user;
      },
    });

    t.nonNull.field("hideUser", {
      type: HiddenUser,
      args: {
        id: nonNull(stringArg()),
      },
      resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");

        const { id } = args;

        return context.prisma.hiddenUser.create({
          data: {
            user: { connect: { id: id } },
            viewer: { connect: { id: userId } },
          },
        });
      },
    });
  },
});

interface suggestedUsersQueryI {
  context: Context;
  userId: string;
  limit: number;
  skip: number;
}

const suggestedUsersQuery = async ({
  context,
  userId,
  limit,
  skip,
}: suggestedUsersQueryI) => {
  return context.prisma.$queryRaw<UserType[]>`
  SELECT 
    T.id, 
    u.username, 
    u."fullName", 
    u."photoVersion",
    u."isPrivate"
  FROM (
    SELECT 
      "followingId" id, 
      COUNT(*) as count
    FROM "Follows"
    WHERE "followerId" IN (
      SELECT "followingId"
      FROM "Follows"
      WHERE "followerId" = ${userId}
    )
    AND "followingId" NOT IN (
      SELECT "followingId"
      FROM "Follows"
      WHERE "followerId" = ${userId}
    )
    AND "followingId" NOT IN (
      SELECT "userId" as "followingId"
      FROM "HiddenUser"
      WHERE "viewerId" = ${userId}
    )
    AND NOT "followingId" = ${userId}
    GROUP BY "followingId"
    
    UNION

    SELECT
    "User".id as "followingId",
    0 as count
    FROM "User"   
    WHERE NOT "User".id = ${userId}
    AND "User".id NOT IN (
      SELECT "followingId"
      FROM "Follows"
      WHERE "followerId" = ${userId}
    )  
    AND "User".id NOT IN (
      SELECT "userId" as "followingId"
      FROM "HiddenUser"
      WHERE "viewerId" = ${userId}
    )     
  ) T
  JOIN "User" u ON u.id = T.id
  GROUP BY 
    T.id, 
    u.username, 
    u."fullName", 
    u."photoVersion",
    u."isPrivate"
  ORDER BY max(count) DESC, u.username ASC
  LIMIT ${limit} OFFSET ${skip}
  `;
};
