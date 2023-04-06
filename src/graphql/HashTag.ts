import { extendType, intArg, nonNull, objectType, stringArg } from "nexus";

export const HashTag = objectType({
  name: "Hashtag",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.string("name");
    t.nonNull.field("pagedPosts", {
      type: "PagedPosts",
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { limit, skip } = args;

        const posts = await context.prisma.hashTag
          .findUnique({ where: { id: parent.id } })
          .posts({ take: limit, skip, orderBy: { createdAt: "desc" } });

        const nextPost = await context.prisma.hashTag
          .findUnique({ where: { id: parent.id } })
          .posts({
            take: 1,
            skip: limit + skip,
            orderBy: { createdAt: "desc" },
          });

        return {
          id: parent.id,
          isNextPage: nextPost.length !== 0 ? true : false,
          posts,
        };
      },
    });
    t.nonNull.int("postCount", {
      async resolve(parent, args, context) {
        const count = await context.prisma.hashTag.findUnique({
          where: { id: parent.id },
          select: { _count: { select: { posts: true } } },
        });
        return count?._count.posts ? count._count.posts : 0;
      },
    });
  },
});

export const HashTagQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.field("hashTag", {
      type: HashTag,
      args: {
        name: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { name } = args;
        const hashTag = await context.prisma.hashTag.findUnique({
          where: { name },
        });
        if (!hashTag) throw new Error("Tag not found.");
        return hashTag;
      },
    });
    t.nonNull.list.nonNull.field("tagFilter", {
      type: HashTag,
      args: {
        filter: nonNull(stringArg()),
      },
      resolve(parent, args, context) {
        const where = args.filter ? { name: { contains: args.filter } } : {};
        return context.prisma.hashTag.findMany({ where });
      },
    });

    t.nonNull.list.nonNull.field("topHashTags", {
      type: HashTag,
      resolve(parent, args, context) {
        return context.prisma.hashTag.findMany({
          include: {
            _count: {
              select: { posts: true },
            },
          },
          orderBy: {
            posts: {
              _count: "desc",
            },
          },
          take: 10,
        });
      },
    });
  },
});
