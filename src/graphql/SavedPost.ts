import { Post } from "@prisma/client";
import {
  booleanArg,
  extendType,
  intArg,
  list,
  nonNull,
  objectType,
  stringArg,
} from "nexus";

export const SavedPost = objectType({
  name: "SavedPost",
  definition(t) {
    t.nonNull.string("id", {
      resolve(parent, args, context) {
        return `${parent.savedById}${parent.postId}`;
      },
    });
    t.nonNull.dateTime("savedAt");
    t.nonNull.string("savedById");
    t.nonNull.string("postId");
    t.field("savedBy", {
      type: "User",
      resolve(parent, args, context) {
        return context.prisma.user.findUnique({
          where: { id: parent.savedById },
        });
      },
    });
    t.field("post", {
      type: "Post",
      resolve(parent, args, context) {
        return context.prisma.post.findUnique({
          where: { id: parent.postId },
        });
      },
    });
  },
});

export const Collection = objectType({
  name: "Collection",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.string("name");
    t.nonNull.string("nameLink");
    t.nonNull.dateTime("updatedAt");
    t.nonNull.string("createdById");
    t.nonNull.boolean("isCollected", {
      args: { postId: stringArg() },
      async resolve(parent, args, context) {
        const { postId } = args;
        if (!postId) return false;
        const collectedPost = await context.prisma.collectedPost.findUnique({
          where: {
            collectionId_postId: {
              collectionId: parent.id,
              postId: postId,
            },
          },
        });
        return Boolean(collectedPost);
      },
    });
    t.list.field("posts", {
      type: "Post",
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");

        if (parent.id === `allPosts${userId}`) {
          const savedPosts = await context.prisma.user
            .findUnique({ where: { id: userId } })
            .savedPosts({
              take: 4,
              select: { post: true },
              orderBy: { savedAt: "desc" },
            });

          return savedPosts.map((savedPost) => savedPost.post);
        }

        const collectedPosts = await context.prisma.collection
          .findUnique({
            where: { id: parent.id },
          })
          .posts({ select: { post: true }, orderBy: { createdAt: "desc" } });

        return collectedPosts?.map((collectedPost) => collectedPost.post);
      },
    });
    t.nonNull.field("pagedPosts", {
      type: "PagedPosts",
      args: {
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
      },
      async resolve(parent, args, context) {
        const { limit, skip } = args;
        const { id } = parent;

        const collectedPosts = await context.prisma.collection
          .findUnique({
            where: { id },
          })
          .posts({
            select: { post: true },
            take: limit,
            skip,
            orderBy: { createdAt: "desc" },
          });

        const nextCollectedPost = await context.prisma.collection
          .findUnique({
            where: { id },
          })
          .posts({
            take: 1,
            skip: limit + skip,
            orderBy: { createdAt: "desc" },
          });

        return {
          id: id + limit + skip,
          isNextPage: nextCollectedPost.length !== 0 ? true : false,
          posts: collectedPosts.map((collectedPost) => collectedPost.post),
        };
      },
    });
  },
});

export const CollectionsPaged = objectType({
  name: "CollectionsPaged",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.boolean("isNextPage");
    t.nonNull.list.field("collections", { type: Collection });
  },
});

export const CollectedPost = objectType({
  name: "CollectedPost",
  definition(t) {
    t.nonNull.string("id", {
      resolve(parent, args, context) {
        return `${parent.collectionId}${parent.postId}`;
      },
    });
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("collectionId");
    t.field("collection", {
      type: Collection,
      resolve(parent, args, context) {
        return context.prisma.collection.findUnique({
          where: { id: parent.collectionId },
        });
      },
    });
    t.nonNull.string("postId");
    t.field("post", {
      type: "Post",
      resolve(parent, args, context) {
        return context.prisma.post.findUnique({
          where: { id: parent.postId },
        });
      },
    });
  },
});

export const SavedPostsPage = objectType({
  name: "SavedPostsPage",
  definition(t) {
    t.string("id");
    t.boolean("isNextPage");
    t.list.field("posts", { type: "Post" });
  },
});

export const CollectionAndPosts = objectType({
  name: "CollectionAndPosts",
  definition(t) {
    t.nonNull.field("collection", { type: Collection });
    t.nonNull.list.field("posts", { type: "Post" });
  },
});

export const SavedPostQuery = extendType({
  type: "Query",
  definition(t) {
    t.field("savedPostsPaged", {
      type: "PagedPosts",
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { limit, skip } = args;
        if (!userId)
          throw new Error("Cannot access saved posts without logging in.");

        const savedPosts = await context.prisma.user
          .findUnique({
            where: { id: userId },
          })
          .savedPosts({
            select: { post: true },
            take: limit,
            skip,
            orderBy: { savedAt: "desc" },
          });

        const nextPost = await context.prisma.user
          .findUnique({
            where: { id: userId },
          })
          .savedPosts({
            take: 1,
            skip: skip + limit,
            orderBy: { savedAt: "desc" },
          });

        return {
          id: "savedPostsPaged" + userId + skip + limit,
          isNextPage: nextPost.length === 0 ? false : true,
          posts: savedPosts.map((savedPost) => savedPost.post),
        };
      },
    });

    t.nonNull.field("uniqueCollection", {
      type: Collection,
      args: {
        collectionId: nonNull(stringArg()),
      },
      async resolve(parnet, args, context) {
        const { userId } = context;
        const { collectionId } = args;
        if (!userId) throw new Error("Must be logged in.");

        const collection = await context.prisma.collection.findFirst({
          where: { AND: [{ id: collectionId }, { createdById: userId }] },
        });
        if (!collection) throw new Error("collection not found.");

        return collection;
      },
    });

    t.nonNull.field("collectionsPaged", {
      type: CollectionsPaged,
      args: {
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
        isSelection: booleanArg(),
      },
      async resolve(parnet, args, context) {
        const { userId } = context;
        const { limit, skip, isSelection } = args;
        if (!userId) throw new Error("Must be logged in.");

        if (isSelection) {
          const collections = await context.prisma.collection.findMany({
            take: limit,
            skip: skip,
            where: { createdById: userId },
            include: {
              posts: {
                take: 4,
                orderBy: { createdAt: "desc" },
                include: { post: true },
              },
            },
            orderBy: { updatedAt: "desc" },
          });

          const nextCollection = await context.prisma.collection.findMany({
            take: 1,
            skip: limit + skip,
            where: { createdById: userId },
          });
          return {
            id: "collectionsSelection" + userId + limit + skip,
            isNextPage: nextCollection.length !== 0 ? true : false,
            collections,
          };
        }

        const newLimit = skip === 0 ? limit - 1 : limit;
        const newSkip = skip === limit / 2 ? skip - 1 : skip;

        const collections = await context.prisma.collection.findMany({
          take: newLimit,
          skip: newSkip,
          where: { createdById: userId },
          include: {
            posts: {
              take: 4,
              orderBy: { createdAt: "desc" },
              include: { post: true },
            },
          },
          orderBy: { updatedAt: "desc" },
        });

        const nextCollection = await context.prisma.collection.findMany({
          take: 1,
          skip: newLimit + newSkip,
          where: { createdById: userId },
        });

        const savedPosts = await context.prisma.user
          .findUnique({
            where: { id: userId },
          })
          .savedPosts({
            include: { post: true },
            take: 4,
            orderBy: { savedAt: "desc" },
          });

        const allPostsCollection = {
          id: "allPosts" + userId,
          name: "All Posts",
          nameLink: "all-posts",
          updatedAt: new Date().toISOString(),
          createdById: userId,
          posts: savedPosts.map((savedPost) => savedPost.post),
        };

        const collectionsWithAllPosts = [allPostsCollection, ...collections];

        return {
          id: "collections" + userId + limit + skip,
          isNextPage: nextCollection.length !== 0 ? true : false,
          collections: skip === 0 ? collectionsWithAllPosts : collections,
        };
      },
    });
  },
});

export const SavedPostMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("savePost", {
      type: "Post",
      args: { postId: nonNull(stringArg()), collectionId: stringArg() },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { postId, collectionId } = args;
        if (!userId) throw new Error("Cannot save without logging in.");

        if (collectionId)
          await context.prisma.collectedPost.upsert({
            where: { collectionId_postId: { collectionId, postId } },
            update: {},
            create: {
              collection: { connect: { id: collectionId } },
              post: { connect: { id: postId } },
            },
          });

        const savedPost = await context.prisma.savedPost.upsert({
          select: { post: true },
          where: { savedById_postId: { postId, savedById: userId } },
          update: {},
          create: {
            savedBy: { connect: { id: userId } },
            post: { connect: { id: postId } },
          },
        });

        return savedPost.post;
      },
    });

    t.nonNull.field("createCollection", {
      type: CollectionAndPosts,
      args: {
        name: nonNull(stringArg()),
        newPostId: stringArg(),
        savedPostIds: list(nonNull(stringArg())),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { name, newPostId, savedPostIds } = args;
        if (!userId) throw new Error("Must be logged in.");

        const nameLink = collectionTextFilter(name);

        const collection = await context.prisma.collection.create({
          data: { name, nameLink, createdById: userId },
        });

        if (!newPostId && !savedPostIds)
          return {
            posts: [],
            collection,
          };

        if (savedPostIds)
          await context.prisma.collectedPost.createMany({
            data: savedPostIds.map((savedPostId) => {
              return { collectionId: collection.id, postId: savedPostId };
            }),
          });

        if (newPostId) {
          await context.prisma.savedPost.upsert({
            where: {
              savedById_postId: { savedById: userId, postId: newPostId },
            },
            update: {},
            create: { postId: newPostId, savedById: userId },
          });
          await context.prisma.collectedPost.create({
            data: { collectionId: collection.id, postId: newPostId },
          });
        }

        let posts = [] as Post[];
        if (newPostId) {
          posts = await context.prisma.post.findMany({
            where: { id: newPostId },
          });
        } else if (savedPostIds) {
          posts = await context.prisma.post.findMany({
            where: { id: { in: savedPostIds } },
          });
        }

        return {
          collection,
          posts,
        };
      },
    });

    t.nonNull.list.field("addCollectionPosts", {
      type: "Post",
      args: {
        postIds: nonNull(list(nonNull(stringArg()))),
        collectionId: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { postIds, collectionId } = args;
        if (!userId) throw new Error("Must be logged in");

        const collection = await context.prisma.collection.findFirst({
          where: { AND: [{ createdById: userId }, { id: collectionId }] },
        });
        if (!collection) throw new Error("Cannot access collection.");

        const data = postIds.map((postId) => {
          return { postId, collectionId };
        });

        if (postIds.length === 1) {
          await context.prisma.savedPost.upsert({
            where: {
              savedById_postId: { savedById: userId, postId: postIds[0] },
            },
            update: {},
            create: {
              post: { connect: { id: postIds[0] } },
              savedBy: { connect: { id: userId } },
            },
          });
        }

        let updatedIds = [];
        for (let i = 0; i < data.length; i++) {
          let collectedPost;
          try {
            collectedPost = await context.prisma.collectedPost.create({
              data: data[i],
            });
          } catch (error) {
            continue;
          }
          updatedIds.push(collectedPost.postId);
        }

        if (updatedIds.length !== 0)
          await context.prisma.collection.update({
            where: { id: collectionId },
            data: { updatedAt: new Date() },
          });

        return context.prisma.post.findMany({
          where: { id: { in: updatedIds } },
        });
      },
    });

    t.nonNull.list.field("deleteCollectionPosts", {
      type: "Post",
      args: {
        postIds: nonNull(list(nonNull(stringArg()))),
        collectionId: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { postIds, collectionId } = args;
        if (!userId) throw new Error("Must be logged in.");

        const collection = await context.prisma.collection.findFirst({
          where: { AND: [{ createdById: userId }, { id: collectionId }] },
        });
        if (!collection) throw new Error("Cannot access collection.");

        const collectionPosts = await context.prisma.collectedPost.deleteMany({
          where: { AND: [{ collectionId }, { postId: { in: postIds } }] },
        });

        return context.prisma.post.findMany({
          where: { id: { in: postIds } },
        });
      },
    });

    t.nonNull.field("editCollection", {
      type: Collection,
      args: { name: nonNull(stringArg()), collectionId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { collectionId, name } = args;
        if (!userId) throw new Error("Must be logged in.");

        const collection = await context.prisma.collection.findFirst({
          where: { AND: [{ createdById: userId }, { id: collectionId }] },
        });
        if (!collection) throw new Error("Cannot access collection.");

        const nameLink = collectionTextFilter(name);

        return context.prisma.collection.update({
          where: { id: collectionId },
          data: { name, nameLink },
        });
      },
    });

    t.nonNull.list.field("deleteCollection", {
      type: "Post",
      args: { collectionId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { collectionId } = args;
        if (!userId) throw new Error("Must be logged in.");

        const collection = await context.prisma.collection.findFirst({
          where: { AND: [{ createdById: userId }, { id: collectionId }] },
        });
        if (!collection) throw new Error("Cannot access collection.");

        const collectionPosts = await context.prisma.collectedPost.findMany({
          where: { collectionId },
          select: { post: true },
        });

        await context.prisma.collection.delete({
          where: { id: collectionId },
        });

        return collectionPosts.map((collectionPost) => collectionPost.post);
      },
    });

    t.nonNull.field("unsavePost", {
      type: "Post",
      args: { postId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { postId } = args;
        if (!userId) throw new Error("Cannot unsave without logging in.");

        await context.prisma.collectedPost.deleteMany({
          where: { postId },
        });

        const savedPost = await context.prisma.savedPost.delete({
          select: { post: true },
          where: {
            savedById_postId: {
              savedById: userId,
              postId: postId,
            },
          },
        });
        return savedPost.post;
      },
    });
  },
});

const collectionTextFilter = (text: string) => {
  return text
    .replace(/[^a-zA-Z0-9_-\s]/g, "")
    .split(" ")
    .join("-")
    .toLowerCase();
};
