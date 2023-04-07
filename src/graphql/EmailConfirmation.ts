import { extendType, intArg, nonNull, objectType, stringArg } from "nexus";
import * as nodemailer from "nodemailer";

export const EmailConfirmation = objectType({
  name: "EmailConfirmation",
  definition(t) {
    t.nonNull.boolean("status");
  },
});

export const EmailConfirmationMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.nonNull.field("createEmailConfirmation", {
      type: EmailConfirmation,
      args: {
        email: nonNull(stringArg()),
      },
      async resolve(_parent, args, context) {
        const { email } = args;
        const emailUsed = await context.prisma.user.findUnique({
          where: { email },
        });
        if (emailUsed) {
          throw new Error("This email is taken by another account");
        }
        const confirmation = await context.prisma.emailConfirmation.findUnique({
          where: { email },
        });
        if (confirmation) {
          await context.prisma.emailConfirmation.delete({ where: { email } });
        }
        const passcode = Math.floor(100000 + Math.random() * 900000);
        const newEmail = await context.prisma.emailConfirmation.create({
          data: {
            email,
            passcode,
          },
        });

        let transporter = nodemailer.createTransport({
          host: "smtp-relay.sendinblue.com",
          port: 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: process.env.SENDINBLUE_USER,
            pass: process.env.SENDINBLUE_PWD,
          },
        });

        let info = await transporter.sendMail({
          from: '"Social Media Clone" <no-reply@john-denny-social-media-clone.onrender.com>',
          to: email,
          subject: "Email Confirmation Code",
          text: `This is your confirmation code: ${passcode}`,
          html: `<p style="font-size: 24px; text-align: center; margin-top: 36px">This is your confirmation code: <b>${passcode}</b></p>`,
        });

        console.log("Email Confirmation sent:", info.messageId, {
          email,
          passcode,
        }); // email and passcode exposed to populate db with fake accounts.
        return {
          status: true,
        };
      },
    });

    t.nonNull.field("confirmEmail", {
      type: EmailConfirmation,
      args: {
        email: nonNull(stringArg()),
        passcode: nonNull(intArg()),
      },
      async resolve(parent, args, context) {
        const { email, passcode } = args;
        const confirmation = await context.prisma.emailConfirmation.findUnique({
          where: { email },
        });
        if (passcode !== confirmation?.passcode) {
          throw new Error("That code isn't valid. You can request a new one.");
        }
        const valid = await context.prisma.emailConfirmation.update({
          where: { email },
          data: { valid: true },
        });
        return {
          status: true,
        };
      },
    });
  },
});
