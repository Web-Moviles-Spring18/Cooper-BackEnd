import { UserType } from "../../src/models/User";
import * as Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_KEY);

type StripeError = Error & { type: string };

export let processPayment = async (user: UserType, charge: { amount: number, currency: "usd" | "mxn", description: string, source: string }): Promise<string> => {
  if (user.customer && !charge.source) { // User has a card registered.
    const customer = user.customer;
    const source = user.paymentSource;
    return stripe.charges.create({ ...charge, customer }).then((response: Stripe.charges.ICharge) => response.status);
  } else if (charge.source) { // Expect to receive a stripe token.
    stripe.charges.create(charge).then((charge: Stripe.charges.ICharge) => charge.status);
  } else {
    throw "No payment method specified";
  }
};
