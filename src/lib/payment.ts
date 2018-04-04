import { UserType } from "../../src/models/User";
import * as Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_KEY);

type StripeError = Error & { type: string };

export let processPayment = async (user: UserType, charge: { amount: number, currency: "usd" | "mxn", description: string, source: string }): Promise<Stripe.charges.ICharge> => {
  if (user.customer && !charge.source) { // User has a card registered.
    const customer = user.customer;
    const source = user.paymentSource;
    return stripe.charges.create({ ...charge, customer });
  } else if (charge.source) { // Expect to receive a stripe token.
    return stripe.charges.create(charge);
  } else {
    throw new Error("No payment method specified.");
  }
};
