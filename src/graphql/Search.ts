import { User, UserSearch } from "@prisma/client";
import { extendType, nonNull, objectType, stringArg, unionType } from "nexus";

export const SearchResult = objectType({
  name: "SearchResult",
  definition(t) {
    t.nonNull.string("id");
    t.string("userId");
    t.string("hashTagId");
    t.field("user", {
      type: "User",
      resolve(parent, args, context) {
        if (!parent.userId) return null;
        return context.prisma.user.findUnique({
          where: { id: parent.userId },
        });
      },
    });
    t.field("hashTag", {
      type: "Hashtag",
      resolve(parent, args, context) {
        if (!parent.hashTagId) return null;
        return context.prisma.hashTag.findUnique({
          where: { id: parent.hashTagId },
        });
      },
    });
  },
});

export const ShareSearch = objectType({
  name: "ShareSearch",
  definition(t) {
    t.string("userId");
  },
});

export const RecentSearch = objectType({
  name: "RecentSearch",
  definition(t) {
    t.string("id");
    t.nonNull.dateTime("createdAt");
    t.string("userId");
    t.string("hashTagName");
    t.field("user", {
      type: "User",
      resolve(parent, args, context) {
        if (!parent.userId) return null;
        return context.prisma.user.findUnique({
          where: { id: parent.userId },
        });
      },
    });
    t.field("hashTag", {
      type: "Hashtag",
      resolve(parent, args, context) {
        if (!parent.hashTagName) return null;
        return context.prisma.hashTag.findUnique({
          where: { name: parent.hashTagName },
        });
      },
    });
  },
});

export const UserRecentSearch = objectType({
  name: "UserSearch",
  definition(t) {
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("userId");
    t.nonNull.string("searchedById");
    t.field("user", {
      type: "User",
      resolve(parent, args, context) {
        return context.prisma.user.findUnique({
          where: { id: parent.userId },
        });
      },
    });
  },
});

export const HashTagSearch = objectType({
  name: "HashTagSearch",
  definition(t) {
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("hashTagName");
    t.nonNull.string("searchedById");
    t.field("hashTag", {
      type: "Hashtag",
      resolve(parent, args, context) {
        return context.prisma.hashTag.findUnique({
          where: { name: parent.hashTagName },
        });
      },
    });
  },
});

export const SearchQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.list.field("search", {
      type: SearchResult,
      args: { filter: nonNull(stringArg()) },
      resolve(parent, args, context) {
        const filter = `%${args.filter}%`;
        const startFilter = `${args.filter}%`;
        return context.prisma.$queryRaw<User[]>`
          SELECT 
            COALESCE(u.id, t.id) as id,
            u.id as "userId",
            u.username, 
            u."fullName", 
            t.name as "hashTagName",
            t.id as "hashTagId",
            CASE 
          WHEN u.username ILIKE ${startFilter} THEN 1
          WHEN u."fullName" ILIKE ${startFilter} THEN 1
          WHEN t.name ILIKE ${startFilter} THEN 1
          ELSE 0 END as score
          FROM "User" u
          FULL OUTER JOIN "HashTag" t ON u.id = t.id
          WHERE u.username ILIKE ${filter}
          OR u."fullName" ILIKE ${filter}
          OR t.name ILIKE ${filter}
          ORDER BY score DESC
          LIMIT 50;
        `;
      },
    });

    t.nonNull.list.field("recentSearch", {
      type: RecentSearch,
      resolve(parent, args, context) {
        const { userId } = context;
        if (!userId)
          throw new Error("Cannot access recent Search without logging in.");
        return context.prisma.$queryRaw<UserSearch[]>`
          SELECT
            COALESCE(u."searchedById", t."searchedById") as "searchedById",
            COALESCE(u."createdAt", t."createdAt") as "createdAt",
            COALESCE(u."userId", t."hashTagName") as id,
            u."userId",
            t."hashTagName"
          FROM "UserSearch" u
          FULL OUTER JOIN "HashTagSearch" t ON u."userId" = t."hashTagName"
          WHERE u."searchedById" = ${userId}
          OR t."searchedById" = ${userId}
          ORDER BY "createdAt" DESC
          LIMIT 30;
        `;
      },
    });
  },
});

export const SearchMutation = extendType({
  type: "Mutation",

  definition(t) {
    t.nonNull.field("addUserSearch", {
      type: UserRecentSearch,
      args: { userId: nonNull(stringArg()) },
      resolve(parent, args, context) {
        const searchedById = context.userId;
        const { userId } = args;
        if (!searchedById) throw new Error("Cannot search without logging in.");
        return context.prisma.userSearch.upsert({
          where: {
            userId_searchedById: {
              searchedById,
              userId,
            },
          },
          update: {
            createdAt: new Date(),
          },
          create: {
            user: { connect: { id: userId } },
            searchedById,
          },
        });
      },
    });

    t.nonNull.field("removeUserSearch", {
      type: UserRecentSearch,
      args: { userId: nonNull(stringArg()) },
      resolve(parent, args, context) {
        const searchedById = context.userId;
        if (!searchedById)
          throw new Error("Cannot remove recent search without logging in.");
        const { userId } = args;
        return context.prisma.userSearch.delete({
          where: { userId_searchedById: { userId, searchedById } },
        });
      },
    });

    t.nonNull.field("addHashTagSearch", {
      type: HashTagSearch,
      args: {
        hashTagName: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const searchedById = context.userId;
        const { hashTagName } = args;
        if (!searchedById)
          throw new Error("Cannot add search without logging in.");
        const recentSearch = await context.prisma.hashTagSearch.upsert({
          where: {
            hashTagName_searchedById: {
              hashTagName,
              searchedById,
            },
          },
          update: {
            createdAt: new Date(),
          },
          create: {
            hashTag: { connect: { name: args.hashTagName } },
            searchedById,
          },
        });
        return recentSearch;
      },
    });

    t.nonNull.field("removeHashTagSearch", {
      type: HashTagSearch,
      args: { hashTagName: nonNull(stringArg()) },
      resolve(parent, args, context) {
        const searchedById = context.userId;
        const { hashTagName } = args;
        if (!searchedById)
          throw new Error("Cannot remove recent search without logging in.");
        return context.prisma.hashTagSearch.delete({
          where: { hashTagName_searchedById: { hashTagName, searchedById } },
        });
      },
    });

    t.nonNull.boolean("clearRecentSearch", {
      async resolve(parent, args, context) {
        const searchedById = context.userId;
        if (!searchedById)
          throw new Error("Cannot clear recent search without logging in.");
        await context.prisma.userSearch.deleteMany({
          where: { searchedById },
        });
        await context.prisma.hashTagSearch.deleteMany({
          where: { searchedById },
        });
        return true;
      },
    });
  },
});
