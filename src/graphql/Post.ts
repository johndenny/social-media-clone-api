import { Prisma, Comment } from "@prisma/client";
import cloudinary from "cloudinary";
import {
  arg,
  enumType,
  extendType,
  inputObjectType,
  intArg,
  list,
  nonNull,
  nullable,
  objectType,
  stringArg,
} from "nexus";
import { resolve } from "path";
import { hashTagFilter, usernameFilter } from "../utils/textFilters";
import { LocationInputType } from "./Upload";

export const Photo = objectType({
  name: "Photo",
  definition(t) {
    t.nonNull.string("id");
    t.string("postId");
    t.nonNull.float("aspectRatio");
    t.nonNull.list.nonNull.field("tags", {
      type: "Tag",
      resolve(parent, args, context) {
        return context.prisma.photo
          .findUnique({ where: { id: parent.id } })
          .tags();
      },
    });
  },
});

export const PhotoEditType = inputObjectType({
  name: "PhotoEditType",
  definition(t) {
    t.nonNull.string("photoId");
    t.nonNull.list.nonNull.field("tags", {
      type: "TagInputType",
    });
  },
});

export const PageInfo = objectType({
  name: "PageInfo",
  definition(t) {
    t.nonNull.boolean("isNextPage");
    t.nonNull.string("cursorId");
  },
});

export const PostCounts = objectType({
  name: "postCounts",
  definition(t) {
    t.nonNull.int("comments");
    t.nonNull.int("likes");
    t.nonNull.int("commentsOnly");
  },
});

export const Post = objectType({
  name: "Post",
  definition(t) {
    t.nonNull.string("id");
    t.nonNull.string("text");
    t.nonNull.dateTime("createdAt");
    t.nonNull.string("postedById");
    t.nonNull.boolean("isEdited");
    t.field("postedBy", {
      type: "User",
      resolve(parent, _args, context) {
        return context.prisma.post
          .findUnique({ where: { id: parent.id } })
          .postedBy();
      },
    });
    t.nonNull.list.nonNull.field("hashTags", {
      type: "Hashtag",
      resolve(parent, args, context) {
        return context.prisma.post
          .findUnique({ where: { id: parent.id } })
          .hashTags();
      },
    });
    t.nonNull.field("likes", {
      type: "LikesPage",
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { limit, skip } = args;
        const { id } = parent;
        const likes = await context.prisma.post
          .findUnique({
            where: { id },
          })
          .likes({
            take: limit,
            skip,
            select: { user: true },
            orderBy: { createdAt: "desc" },
          });

        const nextLike = await context.prisma.post
          .findUnique({
            where: { id },
          })
          .likes({
            take: 1,
            skip: limit + skip,
            orderBy: { createdAt: "desc" },
          });

        return {
          id: id + skip + limit,
          isNextPage: nextLike.length === 0 ? false : true,
          profiles: likes.map((like) => like.user),
        };
      },
    });
    t.list.field("featuredComments", {
      type: "Comment",
      resolve(parent, args, context) {
        const postId = parent.id;
        return context.prisma.$queryRaw<Comment[]>`
          SELECT 
            "isEdited",
            "postedById",
            "postId",
            "createdAt",
            c.id, 
            text, 
            (
              SELECT
                COUNT(*)
              FROM
                "Reply"
              WHERE
                "commentId" = c.id
            ) +
            (
              SELECT
                COUNT(*)
              FROM
                "CommentLike"
              WHERE
                "commentId" = c.id
            ) as count
          FROM "Comment" c
          WHERE "postId" = ${postId}
          ORDER BY
            count DESC,
            "createdAt" DESC
          LIMIT 2;
        `;
      },
    });
    t.nonNull.field("commentsPage", {
      type: "CommentsPage",
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { limit, skip } = args;
        const { id } = parent;

        const comments = await context.prisma.post
          .findUnique({ where: { id } })
          .comments({ take: limit, skip, orderBy: { createdAt: "desc" } });

        const nextComment = await context.prisma.post
          .findUnique({ where: { id } })
          .comments({
            take: 1,
            skip: limit + skip,
            orderBy: { createdAt: "desc" },
          });
        return {
          id: id + skip + limit,
          isNextPage: nextComment.length === 0 ? false : true,
          comments,
        };
      },
    });
    t.nonNull.list.nonNull.field("photos", {
      type: "Photo",
      resolve(parent, args, context) {
        const postId = parent.id;
        return context.prisma.photo.findMany({
          where: { postId },
        });
      },
    });
    t.nonNull.int("likeCount", {
      resolve(parent, args, context) {
        return context.prisma.like.count({
          where: { postId: parent.id },
        });
      },
    });
    t.nonNull.field("counts", {
      type: PostCounts,
      async resolve(parent, args, context) {
        const { id } = parent;
        const comments = await context.prisma.comment.count({
          where: { postId: id },
        });
        const replies = await context.prisma.reply.count({
          where: { postId: id },
        });
        const likes = await context.prisma.like.count({
          where: { postId: id },
        });
        return { comments: comments + replies, likes, commentsOnly: comments };
      },
    });
    t.nonNull.boolean("isLiked", {
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) return false;
        const postId = parent.id;
        const like = await context.prisma.like.findUnique({
          where: { userId_postId: { userId, postId } },
        });
        return like ? true : false;
      },
    });
    t.nonNull.boolean("isSaved", {
      async resolve(parent, args, context) {
        const { userId } = context;
        const postId = parent.id;
        if (!userId) return false;
        const savedPost = await context.prisma.savedPost.findUnique({
          where: {
            savedById_postId: {
              savedById: userId,
              postId: postId,
            },
          },
        });
        return savedPost ? true : false;
      },
    });
    t.int("locationId");
    t.field("location", {
      type: "Location",
      resolve(parent, args, context) {
        if (!parent.locationId) return null;
        return context.prisma.location.findUnique({
          where: { id: parent.locationId },
        });
      },
    });
    t.nonNull.boolean("isCollected", {
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) return false;

        const viewerCollections = await context.prisma.collection.findMany({
          where: { createdById: userId },
          select: { id: true },
        });
        if (!viewerCollections) return false;
        const collectionIds = viewerCollections.map(
          (collection) => collection.id
        );

        const collectedPost = await context.prisma.collectedPost.findFirst({
          where: {
            AND: [
              { collectionId: { in: collectionIds } },
              { postId: parent.id },
            ],
          },
        });

        return Boolean(collectedPost);
      },
    });
    t.nonNull.boolean("isTagged", {
      async resolve(parent, args, context) {
        const { userId } = context;
        const { id } = parent;
        if (!userId) return false;

        const tag = await context.prisma.post
          .findUnique({ where: { id } })
          .tags({ where: { userId } });

        return tag.length !== 0;
      },
    });
    t.nonNull.boolean("isTagHidden", {
      async resolve(parent, args, context) {
        const { userId } = context;
        const { id } = parent;
        if (!userId) return false;

        const isTagHidden = await context.prisma.post
          .findUnique({ where: { id } })
          .tagsHidden({ where: { id: userId } });

        return isTagHidden.length !== 0;
      },
    });
  },
});

export const UniquePost = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.field("uniquePost", {
      type: "Post",
      args: { postId: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { postId } = args;
        const post = await context.prisma.post.findUnique({
          where: { id: postId },
        });
        if (!post) {
          throw new Error("Post not found.");
        }
        return post;
      },
    });
  },
});

export const PostOrderBy = inputObjectType({
  name: "PostOrderBy",
  definition(t) {
    t.field("createdAt", { type: Sort });
  },
});

export const Sort = enumType({
  name: "Sort",
  members: ["asc", "desc"],
});

export const Feed = objectType({
  name: "Feed",
  definition(t) {
    t.nonNull.list.nonNull.field("posts", { type: Post });
    t.nonNull.int("count");
    t.id("id");
  },
});

export const FollowingPosts = objectType({
  name: "FollowingPosts",
  definition(t) {
    t.list.field("posts", { type: Post });
    t.nonNull.boolean("isNextPage");
    t.nonNull.id("id");
  },
});

export const PagedPosts = objectType({
  name: "PagedPosts",
  definition(t) {
    t.nonNull.boolean("isNextPage");
    t.nonNull.id("id");
    t.list.field("posts", { type: Post });
  },
});

export const PostQuery = extendType({
  type: "Query",
  definition(t) {
    t.nonNull.field("feed", {
      type: "Feed",
      args: {
        skip: intArg(),
        take: intArg(),
        orderBy: arg({ type: list(nonNull(PostOrderBy)) }),
      },
      async resolve(_parent, args, context) {
        const posts = await context.prisma.post.findMany({
          skip: args?.skip as number | undefined,
          take: args?.take as number | undefined,
          orderBy: args?.orderBy as
            | Prisma.Enumerable<Prisma.PostOrderByWithRelationInput>
            | undefined,
        });
        const count = await context.prisma.post.count();
        const id = `main-feed:${JSON.stringify(args)}`;

        return {
          posts,
          count,
          id,
        };
      },
    });

    t.nonNull.field("explorePosts", {
      type: PagedPosts,
      args: { limit: nonNull(intArg()), skip: nonNull(intArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { limit, skip } = args;
        if (!userId) throw new Error("Must be logged in.");

        const following = await context.prisma.user.findUnique({
          where: { id: userId },
          select: { following: { select: { followingId: true } } },
        });
        if (!following) throw new Error("User not found.");

        const followingIds = following?.following.map(
          (user) => user.followingId
        );

        const posts = await context.prisma.post.findMany({
          take: limit,
          skip,
          include: { postedBy: true },
          where: {
            AND: [
              { postedBy: { isPrivate: false } },
              { postedById: { notIn: [...followingIds, userId] } },
            ],
          },
          orderBy: { createdAt: "desc" },
        });

        const nextPost = await context.prisma.post.findMany({
          take: 1,
          skip: skip + limit,
          include: { postedBy: true },
          where: { postedBy: { isPrivate: false } },
          orderBy: { createdAt: "desc" },
        });

        return {
          id: "explore" + skip,
          isNextPage: nextPost.length === 0 ? false : true,
          posts,
        };
      },
    });

    t.field("followingPosts", {
      type: FollowingPosts,
      args: {
        date: nonNull(stringArg()),
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { limit, skip, date } = args;
        if (!userId) throw new Error("No user logged in.");

        const following = await context.prisma.user.findFirst({
          where: { id: userId },
          select: { following: { select: { followingId: true } } },
        });
        const posts = await context.prisma.post.findMany({
          take: limit,
          skip: skip,
          where: {
            AND: [
              {
                postedById: {
                  in: following
                    ? [
                        ...following.following.map((user) => user.followingId),
                        userId,
                      ]
                    : [userId],
                },
              },
              {
                createdAt: {
                  lt: new Date(date),
                },
              },
            ],
          },
          orderBy: { createdAt: "desc" },
        });

        const nextPosts = await context.prisma.post.findMany({
          take: limit,
          skip: skip + limit,
          where: {
            postedById: {
              in: following
                ? [
                    ...following.following.map((user) => user.followingId),
                    userId,
                  ]
                : [userId],
            },
          },
          orderBy: { createdAt: "desc" },
        });
        return {
          id: userId + skip + limit,
          posts,
          isNextPage: nextPosts.length === 0 ? false : true,
        };
      },
    });

    t.boolean("isNewPosts", {
      args: { date: nonNull(stringArg()) },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { date } = args;
        if (!userId) throw new Error("No user logged in.");
        const following = await context.prisma.user.findFirst({
          where: { id: userId },
          select: { following: { select: { followingId: true } } },
        });
        const posts = await context.prisma.post.findMany({
          take: 1,
          where: {
            AND: [
              {
                postedById: {
                  in: following
                    ? [
                        ...following.following.map((user) => user.followingId),
                        userId,
                      ]
                    : [userId],
                },
              },
              {
                createdAt: {
                  lt: new Date(date),
                },
              },
            ],
          },
          orderBy: { createdAt: "desc" },
        });
        return posts.length !== 0 ? true : false;
      },
    });

    t.field("uniqueUserPosts", {
      type: PagedPosts,
      args: {
        username: nonNull(stringArg()),
        limit: nonNull(intArg()),
        skip: nonNull(intArg()),
      },
      async resolve(parent, args, context) {
        const { username, limit, skip } = args;
        const posts = await context.prisma.user
          .findUnique({
            where: { username },
          })
          .posts({ take: limit, skip, orderBy: { createdAt: "desc" } });

        const nextPost = await context.prisma.user
          .findUnique({
            where: { username },
          })
          .posts({
            take: 1,
            skip: skip + limit,
            orderBy: { createdAt: "desc" },
          });

        return {
          id: username + skip + limit,
          posts,
          isNextPage: nextPost.length === 0 ? false : true,
        };
      },
    });
  },
});

export const PostMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("deletePost", {
      type: "Post",
      args: {
        postId: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { postId } = args;
        if (!userId) {
          throw new Error("Cannot delete post without logging in.");
        }
        const post = await context.prisma.post.findUnique({
          where: { id: postId },
          include: { photos: true },
        });
        if (!post) throw new Error("Post not found.");
        if (post?.postedById !== userId) {
          throw new Error("Cannot delete other users posts");
        }

        const public_ids = post.photos.map((photo) => photo.id);
        const options = { folder: "post_uploads" };
        try {
          await cloudinary.v2.api.delete_resources(public_ids, options);
        } catch (error) {
          throw new Error("Cloudindary error.");
        }

        return context.prisma.post.delete({
          where: { id: postId },
        });
      },
    });

    t.nonNull.field("editPost", {
      type: "Post",
      args: {
        postId: nonNull(stringArg()),
        photos: nonNull(list(nonNull(PhotoEditType))),
        text: stringArg(),
        location: nullable(LocationInputType),
      },
      async resolve(parent, args, context) {
        const viewerId = context.userId;
        const { postId, photos, location, text } = args;

        if (!viewerId) {
          throw new Error("Cannot edit post without logging in.");
        }
        const oldPost = await context.prisma.post.findUnique({
          where: { id: postId },
          include: { photos: { include: { tags: true } } },
        });
        if (oldPost?.postedById !== viewerId) {
          throw new Error("Cannot edit other users posts");
        }

        //identifies removed tags
        for (let i = 0; i < oldPost.photos.length; i++) {
          const { tags } = oldPost.photos[i];
          const newTags = photos[i].tags;
          if (!tags) break;

          for (let j = 0; j < tags.length; j++) {
            const { userId } = tags[j];
            const index = newTags.findIndex(
              (tag) => tag.userId === tags[j].userId
            );
            if (index === -1) {
              await context.prisma.tag.delete({
                where: {
                  photoId_userId: {
                    photoId: photos[i].photoId,
                    userId: tags[j].userId,
                  },
                },
              });
              const activity = await context.prisma.activity.deleteMany({
                where: {
                  AND: [
                    { type: "tagged" },
                    { sentById: viewerId },
                    { receivedById: userId },
                    { postId },
                  ],
                },
              });
            }
          }
        }

        //updates existing tags and identify new unique tags
        const newUniqueTags: string[] = [];
        for (let i = 0; i < photos.length; i++) {
          const oldTags = oldPost.photos[i].tags;
          const { tags, photoId } = photos[i];

          for (let j = 0; j < tags.length; j++) {
            if (!tags) break;
            const { userId } = tags[j];
            if (oldTags.length === 0) {
              newUniqueTags.push(...tags.map((tag) => tag.userId));
            } else {
              const index = oldTags.findIndex(
                (tag) => tag.userId === tags[j].userId
              );

              if (
                newUniqueTags.indexOf(userId) === -1 &&
                userId !== viewerId &&
                index === -1
              ) {
                newUniqueTags.push(userId);
              }
            }

            await context.prisma.tag.upsert({
              where: { photoId_userId: { photoId, userId } },
              update: {
                x: Math.round(tags[j].x),
                y: Math.round(tags[j].y),
              },
              create: {
                x: Math.round(tags[j].x),
                y: Math.round(tags[j].y),
                photoId,
                postId,
                userId,
              },
            });
          }
        }

        //creates activity for new unique tags
        if (newUniqueTags.length !== 0) {
          for (let i = 0; i < newUniqueTags.length; i++) {
            const activity = await context.prisma.activity.create({
              data: {
                type: "tagged",
                sentById: viewerId,
                receivedById: newUniqueTags[i],
                postId,
              },
            });
          }
        }

        let hashTagsArray;
        let oldUsernames;
        let newUsernames;
        if (text || oldPost.text) {
          hashTagsArray = hashTagFilter(text || "");
          oldUsernames = usernameFilter(oldPost.text).map(
            (user) => user.username
          );
          newUsernames = usernameFilter(text || "").map(
            (user) => user.username
          );

          //identifies mentioned user activity to delete
          if (oldUsernames.length !== 0) {
            for (let i = 0; i < oldUsernames.length; i++) {
              if (newUsernames.indexOf(oldUsernames[i]) === -1) {
                const deletedUser = await context.prisma.user.findUnique({
                  where: { username: oldUsernames[i] },
                  select: { id: true },
                });
                if (!deletedUser) throw new Error("User not found.");
                await context.prisma.activity.deleteMany({
                  where: {
                    type: "post-mention",
                    sentById: viewerId,
                    receivedById: deletedUser.id,
                    postId,
                  },
                });
              }
            }
          }

          //creates new mentioned user activity
          if (newUsernames.length !== 0) {
            for (let i = 0; i < newUsernames.length; i++) {
              if (oldUsernames.indexOf(newUsernames[i]) === -1) {
                const newUser = await context.prisma.user.findUnique({
                  where: { username: newUsernames[i] },
                  select: { id: true },
                });
                if (!newUser) throw new Error("User not found.");

                await context.prisma.activity.create({
                  data: {
                    type: "post-mention",
                    sentById: viewerId,
                    receivedById: newUser.id,
                    postId,
                  },
                });
              }
            }
          }
        }

        return context.prisma.post.update({
          where: { id: postId },
          data: {
            isEdited: true,
            text: text || "",
            hashTags: {
              set: [],
              connectOrCreate: hashTagsArray?.map((tag) => {
                return {
                  where: { name: tag },
                  create: { name: tag },
                };
              }),
            },
            location: location
              ? {
                  connectOrCreate: {
                    where: { id: location.id },
                    create: {
                      id: location.id,
                      lat: location.lat,
                      lon: location.lon,
                      name: location.name,
                    },
                  },
                }
              : { disconnect: true },
          },
        });
      },
    });

    t.nonNull.field("post", {
      type: "Post",
      args: {
        text: nonNull(stringArg()),
      },
      resolve(_parent, args, context) {
        const { text } = args;
        const { userId } = context;
        if (!userId) {
          throw new Error("Cannot post without logging in.");
        }
        const newPost = context.prisma.post.create({
          data: {
            text: text,
            postedBy: { connect: { id: userId } },
          },
        });
        return newPost;
      },
    });
  },
});
