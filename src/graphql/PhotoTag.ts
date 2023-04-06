import { extendType, intArg, nonNull, objectType, stringArg } from "nexus";

export const Tag = objectType({
  name: "Tag",
  definition(t) {
    t.nonNull.string("id", {
      resolve(parent, args, context) {
        return `${parent.photoId}${parent.userId}`;
      },
    });
    t.nonNull.string("photoId");
    t.nonNull.string("userId");
    t.nonNull.string("postId");
    t.nonNull.int("x");
    t.nonNull.int("y");
    t.nonNull.field("User", {
      type: "User",
      async resolve(parent, args, context) {
        const user = await context.prisma.user.findUnique({
          where: { id: parent.userId },
        });
        if (!user) {
          throw new Error("no user");
        }
        return user;
      },
    });
    t.field("post", {
      type: "Post",
      resolve(parent, args, context) {
        const { photoId, userId } = parent;
        return context.prisma.tag
          .findUnique({
            where: { photoId_userId: { photoId, userId } },
          })
          .post();
      },
    });
  },
});

const TagsPage = objectType({
  name: "TagsPage",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.boolean("isNextPage");
    t.list.field("posts", { type: "Post" });
  },
});

export const TagQuery = extendType({
  type: "Query",
  definition(t) {
    t.field("tags", {
      type: TagsPage,
      args: {
        username: nonNull(stringArg()),
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
      },
      async resolve(parent, args, context) {
        const { username, limit, skip } = args;
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");

        const taggedPosts = await context.prisma.user
          .findUnique({
            where: { username },
          })
          .tagged({
            take: limit,
            skip,
            include: { post: { include: { tagsHidden: true } } },
            where: { post: { tagsHidden: { none: { id: userId } } } },
            orderBy: { post: { createdAt: "desc" } },
          });

        const nextPost = await context.prisma.user
          .findUnique({
            where: { username },
          })
          .tagged({
            take: 1,
            skip: skip + limit,
            include: { post: { include: { tagsHidden: true } } },
            where: { post: { tagsHidden: { none: { id: userId } } } },
            orderBy: { post: { createdAt: "desc" } },
          });

        return {
          id: username + skip + limit,
          isNextPage: nextPost.length === 0 ? false : true,
          posts: taggedPosts.map((tag) => tag.post),
        };
      },
    });
  },
});

export const TagMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("removeTag", {
      type: "Post",
      args: { postId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { postId } = args;
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");

        await context.prisma.tag.deleteMany({ where: { userId, postId } });

        return context.prisma.post.findUnique({
          where: { id: postId },
        });
      },
    });

    t.nonNull.field("hideTag", {
      type: "Post",
      args: { postId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { postId } = args;
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");

        return context.prisma.post.update({
          where: { id: postId },
          data: { tagsHidden: { connect: { id: userId } } },
        });
      },
    });

    t.nonNull.field("showTag", {
      type: "Post",
      args: { postId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { postId } = args;
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");

        return context.prisma.post.update({
          where: { id: postId },
          data: { tagsHidden: { disconnect: { id: userId } } },
        });
      },
    });
  },
});
