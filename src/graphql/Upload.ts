import { Post } from "@prisma/client";
import cloudinary from "cloudinary";
import { withFilter } from "graphql-subscriptions";
import {
  extendType,
  floatArg,
  inputObjectType,
  list,
  nonNull,
  nullable,
  objectType,
  stringArg,
} from "nexus";
import { pubsub } from "../context";
import { hashTagFilter, usernameFilter } from "../utils/textFilters";

export const Upload = objectType({
  name: "Upload",
  definition(t) {
    t.nonNull.boolean("success");
  },
});

export const PhotoInputType = inputObjectType({
  name: "PhotoInputType",
  definition(t) {
    t.nonNull.string("photoString");
    t.list.nonNull.field("tags", {
      type: TagInputType,
    });
  },
});

export const LocationInputType = inputObjectType({
  name: "LocationType",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("name");
    t.nonNull.string("lat");
    t.nonNull.string("lon");
  },
});

export const TagInputType = inputObjectType({
  name: "TagInputType",
  definition(t) {
    t.nonNull.string("userId");
    t.nonNull.float("x");
    t.nonNull.float("y");
    t.string("username");
  },
});

export const UploadProfilePhoto = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("uploadProfilePhoto", {
      type: "User",
      args: {
        url: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { url } = args;
        const { userId } = context;
        if (!userId) {
          throw new Error("Cannot change profile photo without logging in.");
        }

        const options = {
          folder: "profile_pictures",
          public_id: userId,
          overwrite: true,
        };
        let result;
        try {
          result = await cloudinary.v2.uploader.upload(url, options);
        } catch (error) {
          throw new Error("Error uploading profile photo");
        }
        const user = await context.prisma.user.update({
          where: { id: userId },
          data: {
            photoVersion: result.version,
          },
        });
        return user;
      },
    });

    t.nonNull.field("removeProfilePhoto", {
      type: "User",
      async resolve(parent, args, context) {
        const { userId } = context;
        if (!userId) {
          throw new Error("Cannot change profile photo without logging in.");
        }

        let result;
        try {
          result = await cloudinary.v2.uploader.destroy(userId);
        } catch (error) {
          throw new Error("Error deleting profile photo");
        }
        const user = await context.prisma.user.update({
          where: { id: userId },
          data: {
            photoVersion: 0,
          },
        });
        return user;
      },
    });

    t.nonNull.field("uploadPhotoPost", {
      type: "Post",
      args: {
        photoData: nonNull(list(nonNull(PhotoInputType))),
        location: nullable(LocationInputType),
        text: stringArg(),
      },
      async resolve(parent, args, context) {
        const { userId } = context;
        const { text, photoData, location } = args;

        if (!userId) {
          throw new Error("Cannot change profile photo without logging in.");
        }

        let hashTagsArray;
        let usernames;
        if (text) {
          hashTagsArray = hashTagFilter(text);
          usernames = usernameFilter(text);
        }

        const post = await context.prisma.post.create({
          data: {
            text: text ? text : "",
            postedBy: { connect: { id: userId } },
            hashTags: {
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
              : {},
          },
        });

        const taggedUsers: string[] = [];
        for (let i = 0; i < photoData.length; i++) {
          const { photoString, tags } = photoData[i];
          const options = {
            folder: "post_uploads",
          };
          let result;
          try {
            result = await cloudinary.v2.uploader.upload(photoString, options);
          } catch (error) {
            throw new Error("Error uploading photo.");
          }

          const photo = await context.prisma.photo.create({
            data: {
              id: result.public_id,
              postId: post.id,
              aspectRatio: result.width / result.height,
            },
          });

          if (!tags) break;
          for (let j = 0; j < tags.length; j++) {
            if (
              taggedUsers.indexOf(tags[j].userId) === -1 &&
              tags[j].userId !== userId
            )
              taggedUsers.push(tags[j].userId);

            const tag = await context.prisma.tag.create({
              data: {
                x: Math.round(tags[j]?.x),
                y: Math.round(tags[j]?.y),
                photoId: result.public_id,
                postId: post.id,
                userId: tags[j]?.userId,
              },
            });
          }
        }

        if (taggedUsers.length !== 0) {
          await context.prisma.activity.createMany({
            data: taggedUsers.map((user) => {
              return {
                type: "tagged",
                sentById: userId,
                receivedById: user,
                postId: post.id,
              };
            }),
          });
        }

        if (usernames && usernames.length !== 0) {
          const userIds = await context.prisma.user.findMany({
            where: { OR: usernames },
            select: { id: true },
          });
          await context.prisma.activity.createMany({
            data: userIds
              .map((user) => {
                return {
                  type: "post-mention",
                  sentById: userId,
                  receivedById: user.id,
                  postId: post.id,
                };
              })
              .filter(
                (user) =>
                  user.receivedById !== userId ||
                  user.receivedById !== post.postedById
              ),
          });
        }

        pubsub.publish("NEW_POST", post);
        return post;
      },
    });

    t.nonNull.field("uploadMessagePhoto", {
      type: "Message",
      args: {
        base64: nonNull(stringArg()),
        aspectRatio: nonNull(floatArg()),
        chatId: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { base64, aspectRatio, chatId } = args;
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in.");

        const options = { folder: "message_uploads" };

        let upload;
        try {
          upload = await cloudinary.v2.uploader.upload(base64, options);
        } catch (error) {
          throw new Error("Error uploading photo.");
        }

        const message = await context.prisma.message.create({
          data: {
            type: "photo",
            photo: {
              create: { id: upload.public_id, aspectRatio },
            },
            chat: { connect: { id: chatId } },
            sentBy: { connect: { id: userId } },
            readBy: { connect: { id: userId } },
          },
        });
        pubsub.publish("NEW_MESSAGE", message);
        return message;
      },
    });
  },
});

export const PostSubscriptions = extendType({
  type: "Subscription",
  definition(t) {
    t.field("newPosts", {
      type: "Post",
      subscribe: withFilter(
        () => pubsub.asyncIterator<Post>(["NEW_POST"]),
        async (payload, args, context) => {
          const { userId } = context;
          if (!userId) throw new Error("No user logged in.");

          const follow = await context.prisma.follows.findUnique({
            where: {
              followerId_followingId: {
                followerId: payload.postedById,
                followingId: userId,
              },
            },
          });

          return follow ? true : false;
        }
      ),
      resolve: async (payload, args, context) => {
        return payload;
      },
    });
  },
});
