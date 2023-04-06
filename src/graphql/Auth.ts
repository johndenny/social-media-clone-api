import { extendType, nonNull, objectType, stringArg } from "nexus";
import * as bcrypt from "bcryptjs";
import { verify } from "jsonwebtoken";
import { createAccessToken, createRefreshToken } from "../utils/auth";

export const AuthPayload = objectType({
  name: "AuthPayload",
  definition(t) {
    t.nonNull.string("accessToken");
  },
});

export const AuthMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("refresh_token", {
      type: AuthPayload,
      async resolve(_parent, _args, context) {
        const { req, res } = context;
        const token = req.cookies.jid;
        if (!token) {
          throw new Error("Refresh token missing.");
        }
        let payload: any = null;
        try {
          payload = verify(token, process.env.JID_REFRESH!);
        } catch (error) {
          throw new Error("Invalid refresh token");
        }
        const user = await context.prisma.user.findUnique({
          where: { id: payload.userId },
        });
        if (!user) {
          throw new Error("No user found.");
        }
        if (user.tokenVersion !== payload.tokenVersion) {
          throw new Error("Invalid refresh token");
        }
        const accessToken = createAccessToken(user);
        const refreshToken = createRefreshToken(user);
        res.cookie("jid", refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 1000 * 60 * 60 * 24 * 7,
        });
        return {
          accessToken,
        };
      },
    });

    t.nonNull.field("login", {
      type: AuthPayload,
      args: {
        email: nonNull(stringArg()),
        password: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { email, password } = args;
        const { res } = context;
        let user: any = null;
        if (email.includes("@")) {
          user = await context.prisma.user.findUnique({
            where: { email },
          });
        } else {
          user = await context.prisma.user.findUnique({
            where: { username: email },
          });
        }
        if (!user) {
          throw new Error(
            "The username you entered doesn't belong to an account. Please check your username and try again."
          );
        }

        const valid = await bcrypt.compare(password, user.password);

        if (!valid) {
          throw new Error(
            "Sorry, your password was incorrect. Please double-check your password."
          );
        }

        const accessToken = createAccessToken(user);
        const refreshToken = createRefreshToken(user);
        res.cookie("jid", refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 1000 * 60 * 60 * 24 * 7,
        });
        return {
          accessToken,
        };
      },
    });

    t.nonNull.field("signup", {
      type: AuthPayload,
      args: {
        fullName: nonNull(stringArg()),
        username: nonNull(stringArg()),
        password: nonNull(stringArg()),
        email: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { email, fullName } = args;
        const { res } = context;
        const confirmation = await context.prisma.emailConfirmation.findUnique({
          where: { email },
        });
        if (!confirmation?.valid) {
          throw new Error("Email was not validated.");
        }
        let username = args.username;
        if (!username) {
          username = email.split("@")[0];
          let usernameTaken = await context.prisma.user.findUnique({
            where: { username },
          });
          while (usernameTaken) {
            const randomNum = Math.floor(Math.random() * 10).toString();
            username = username + randomNum;
            usernameTaken = await context.prisma.user.findUnique({
              where: { username },
            });
          }
        }
        const password = await bcrypt.hash(args.password, 10);
        const user = await context.prisma.user.create({
          data: { email, username, password, fullName },
        });
        const accessToken = createAccessToken(user);
        const refreshToken = createRefreshToken(user);
        res.cookie("jid", refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 1000 * 60 * 60 * 24 * 7,
        });
        await context.prisma.emailConfirmation.delete({ where: { email } });
        return {
          accessToken,
        };
      },
    });

    t.nonNull.boolean("changePassword", {
      args: {
        newPassword: nonNull(stringArg()),
        oldPassword: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { newPassword, oldPassword } = args;
        const { userId } = context;
        if (!userId) throw new Error("Must be logged in to change password.");

        const userPassword = await context.prisma.user.findUnique({
          where: { id: userId },
          select: { password: true },
        });
        if (!userPassword) throw new Error("User doest not exist.");

        const oldPasswordValid = await bcrypt.compare(
          oldPassword,
          userPassword.password
        );
        if (!oldPasswordValid)
          throw new Error(
            "Sorry, your old password was incorrect. Please double check your password."
          );

        if (oldPassword === newPassword)
          throw new Error(
            "Sorry, your password cannot match your previous password."
          );

        const password = await bcrypt.hash(newPassword, 10);
        const userUpdate = await context.prisma.user.update({
          where: { id: userId },
          data: { password },
        });

        return userUpdate ? true : false;
      },
    });

    t.nonNull.field("logout", {
      type: AuthPayload,
      resolve(_parent, _args, context) {
        const { res } = context;
        res.clearCookie("jid");
        return {
          accessToken: "",
        };
      },
    });
  },
});
