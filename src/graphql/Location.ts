import { extendType, intArg, nonNull, objectType } from "nexus";

export const Location = objectType({
  name: "Location",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("name");
    t.nonNull.string("lat");
    t.nonNull.string("lon");
    t.nonNull.field("pagedPosts", {
      type: "PagedPosts",
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { limit, skip } = args;
        const posts = await context.prisma.location
          .findUnique({ where: { id: parent.id } })
          .posts({ take: limit, skip, orderBy: { createdAt: "desc" } });

        const nextPost = await context.prisma.location
          .findUnique({
            where: { id: parent.id },
          })
          .posts({
            take: 1,
            skip: limit + skip,
            orderBy: { createdAt: "desc" },
          });

        return {
          id: `${parent.id}${skip}${limit}`,
          posts,
          isNextPage: nextPost.length !== 0 ? true : false,
        };
      },
    });
    t.nonNull.int("PostCount", {
      async resolve(parent, args, context) {
        const count = await context.prisma.location.findUnique({
          where: { id: parent.id },
          select: { _count: { select: { posts: true } } },
        });

        return count?._count.posts ? count._count.posts : 0;
      },
    });
  },
});

export const LocationQuery = extendType({
  type: "Query",
  definition(t) {
    t.field("location", {
      type: Location,
      args: { locationId: nonNull(intArg()) },
      resolve(parent, args, context) {
        const { locationId } = args;
        return context.prisma.location.findUnique({
          where: { id: locationId },
        });
      },
    });
  },
});
