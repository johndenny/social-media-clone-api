import { extendType, intArg, nonNull, objectType, stringArg } from "nexus";
import * as nodemailer from "nodemailer";
import { resolve } from "path";

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
        // Generate test SMTP service account from ethereal.email
        // Only needed if you don't have a real mail account for testing
        let testAccount = await nodemailer.createTestAccount();

        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: testAccount.user, // generated ethereal user
            pass: testAccount.pass, // generated ethereal password
          },
        });

        // send mail with defined transport object
        let info = await transporter.sendMail({
          from: '"Instagram Clone" <InstagramClone@fake.com>', // sender address
          to: email, // list of receivers
          subject: "Email Confirmation Code", // Subject line
          text: `This is your confirmation code: ${passcode}`, // plain text body
          html: `<b>This is your confirmation code: ${passcode}</b>`, // html body
        });

        console.log("Message sent: %s", info.messageId);
        // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

        // Preview only available when sending through an Ethereal account
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
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
