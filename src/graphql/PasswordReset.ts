import { extendType, nonNull, objectType, stringArg } from "nexus";
import {
  createAccessToken,
  createPasswordResetToken,
  createRefreshToken,
} from "../utils/auth";
import * as nodemailer from "nodemailer";
import { verify } from "jsonwebtoken";
import * as bcrypt from "bcryptjs";

const URL = "http://localhost:3000";

export const SendReset = objectType({
  name: "sendReset",
  definition(t) {
    t.nonNull.string("censoredEmail");
  },
});

export const VerifyReset = objectType({
  name: "verifyReset",
  definition(t) {
    t.nonNull.boolean("verified");
  },
});

export const ConfirmPassword = objectType({
  name: "confirmPassword",
  definition(t) {
    t.nonNull.boolean("reset");
  },
});

export const PasswordResetMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("sendReset", {
      type: SendReset,
      args: {
        email: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { email } = args;
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
          throw new Error("No User Found.");
        }
        const resetToken = createPasswordResetToken(user);

        let testAccount = await nodemailer.createTestAccount();

        let transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: testAccount.user, // generated ethereal user
            pass: testAccount.pass, // generated ethereal password
          },
        });

        let info = await transporter.sendMail({
          from: '"Instagram Clone" <InstagramClone@fake.com>', // sender address
          to: user.email, // list of receivers
          subject: "Password Reset Link", // Subject line
          text: `This is your Reset Link: ${URL}/accounts/password/reset/confirm/?uid=${user.id}&token=${resetToken}`, // plain text body
          html: `This is your Reset Link: ${URL}/accounts/password/reset/confirm/?uid=${user.id}&token=${resetToken}`, // html body
        });

        console.log("Message sent: %s", info.messageId);
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
        const emailName = user.email.split("@")[0];
        const emailAddress = user.email.split("@")[1];
        const firstletter = emailName[0];
        const lastLetter = emailName[emailName.length - 1];
        const censoredNameArray = new Array(emailName.length).fill("*");
        censoredNameArray.splice(0, 1, firstletter);
        censoredNameArray.splice(-1, 1, lastLetter);
        const censoredEmail = [censoredNameArray.join(""), emailAddress].join(
          "@"
        );
        return {
          censoredEmail,
        };
      },
    });

    t.nonNull.field("verifyReset", {
      type: VerifyReset,
      args: {
        userId: nonNull(stringArg()),
        resetToken: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId, resetToken } = args;
        const user = await context.prisma.user.findUnique({
          where: { id: userId },
        });
        if (!user) {
          throw new Error("User not found.");
        }
        let payload: any = null;
        try {
          payload = verify(resetToken, process.env.PWD_RESET!);
        } catch (error) {
          throw new Error("Invalid reset Token.");
        }
        if (payload.userId !== user.id) {
          throw new Error("Invalid reset Token.");
        }
        return {
          verified: true,
        };
      },
    });

    t.nonNull.field("confirmReset", {
      type: ConfirmPassword,
      args: {
        password: nonNull(stringArg()),
        userId: nonNull(stringArg()),
        resetToken: nonNull(stringArg()),
      },
      async resolve(parent, args, context) {
        const { userId, resetToken, password } = args;
        const { res } = context;
        const user = await context.prisma.user.findUnique({
          where: { id: userId },
        });
        if (!user) {
          throw new Error("User not found.");
        }
        let payload: any = null;
        try {
          payload = verify(resetToken, process.env.PWD_RESET!);
        } catch (error) {
          throw new Error("Invalid reset Token.");
        }
        if (payload.userId !== user.id) {
          throw new Error("Invalid reset Token.");
        }
        const newPassword = await bcrypt.hash(password, 10);
        await context.prisma.user.update({
          where: { id: userId },
          data: { password: newPassword },
        });
        return {
          reset: true,
        };
      },
    });
  },
});
