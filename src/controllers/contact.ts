import * as nodemailer from "nodemailer";
import { Request, Response } from "express";

const transporter = nodemailer.createTransport({
  service: "SendGrid",
  auth: {
    user: process.env.SENDGRID_USER,
    pass: process.env.SENDGRID_PASSWORD
  }
});

/**
 * GET /contact
 * Contact form page.
 */
export let getContact = (req: Request, res: Response) => {
  res.render("contact", {
    title: "Contact"
  });
};

/**
 * POST /contact
 * Send a contact form via Nodemailer.
 */
export let postContact = (req: Request, res: Response) => {
  req.assert("name", "Name cannot be blank").notEmpty();
  req.assert("email", "Email is not valid").isEmail();
  req.assert("message", "Message cannot be blank").notEmpty();

  const errors = req.validationErrors();

  if (errors) {
    return res.redirect("/contact");
  }

  const mailOptions = {
    to: "your@email.com",
    from: `${req.body.name} <${req.body.email}>`,
    subject: "Contact Form",
    text: req.body.message
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) {
      return res.redirect("/contact");
    }
    res.redirect("/contact");
  });
};
