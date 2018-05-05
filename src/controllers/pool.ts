import { default as Pool, PoolType } from "../models/Pool";
import { default as User, UserType } from "../models/User";
import { Request, Response, NextFunction } from "express";
import * as request from "express-validator";
import { INode, Relationship } from "neo4js";
import { processPayment } from "../lib/payment";
import * as admin from "firebase-admin";

import * as sgMail from "@sendgrid/mail";
const imgur: any = require("imgur");
imgur.setClientId(process.env.IMGUR_CLIENT_ID);

/**
 * POST /pool
 * Create a new pool.
 */
export let postPool = (req: Request, res: Response, next: NextFunction) => {
  req.assert("name", "Pool name must be a alpha string between 3 and 31 characters").isAscii().isLength({ min: 3, max: 31 });
  req.assert("private", "Private must be a boolean").isBoolean();
  req.assert("paymentMethod", "Payment method must be credit or cash").isIn(["credit", "cash"]);
  req.assert("location", "Location must be a LatLnog").optional().isLatLong();
  req.assert("ends", "Ends must be a date").optional().toDate();
  req.assert("starts", "Starts must be a date").optional().toDate();
  req.assert("total", "Total must be a number").isFloat();
  req.assert("currency", "Currency must be one of usd or mxn").isIn(["usd", "mxn"]);
  req.assert("picture", "Picture must be a base 64 string").optional().isBase64();
  req.assert("pictureURL", "PictureURL must be an URL").optional().isURL();

  const errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors);
  }

  const pool = new Pool({
    name: req.body.name,
    private: req.body.private,
    total: req.body.total || 0,
    currency: req.body.currency,
    paymentMethod: req.body.paymentMethod,
    ends: req.body.ends || new Date()
  });

  if (req.body.location) {
    pool.location = req.body.location;
  }
  if (req.body.starts) {
    pool.starts = req.body.starts;
  }

  const savePool = () => {
    pool.save((err: Error) => {
      if (err) {
        return next(err);
      }
      req.user.owns(pool).then(() => {
        req.user.participatesIn(pool, { debt: pool.total }).then(() => {
          delete pool.label;
          res.status(200).send({
            message: "Pool created!",
            pool
          });
        }).catch((err: Error) => {
          console.error(err);
          res.status(500).send("Something went wrong.");
        });
      }).catch((err: Error) => {
        res.status(400).send(err.message);
      });
    });
  };

  if (req.body.picture) {
    imgur.uploadBase64(req.body.picture).then((res: any) => {
      pool.picture = res.data.link;
      savePool();
    }).catch((err: Error) => {
      console.error(err.message);
      res.status(500).send("There was en error uploading the image.");
    });
  } else {
    if (req.body.pictureURL) {
      pool.picture = req.body.pictureURL;
    }
    savePool();
  }
};

/**
 * DELETE /pool/:id
 * Deletes pool :id
 */
export let deletePool = (req: Request, res: Response, next: NextFunction) => {
  if (req.params.id < 0) {
    return res.status(404).send("id should be > 0");
  }

  Pool.findById(req.params.id, (err: Error, pool: PoolType) => {
    if (err) {
      return next(err);
    }
    if (!pool) {
      return res.status(404).send("Pool not found.");
    }

    req.user.hasRelationWith("owns", pool, "any", (err: Error, userOwnsPool: boolean) => {
      if (err) {
        return next(err);
      }
      if (!userOwnsPool) {
        return res.status(403).send("You don't own this pool");
      }

      Pool.removeById(pool._id, (err: Error) => {
        if (err) {
          return next(err);
        }

        res.status(200).send(`Pool ${pool.name} deleted Succesfully`);
      });
    });
  });
};

/**
 * POST /pool/:id
 * Update status of a user in a pool (i.e.: amount, etc.).
 * Requires owner status.
 */
export let postUpdateUserPool = (req: Request, res: Response, next: NextFunction) => {
  req.assert("userInfo").isJSON();
  req.assert("userInfo.debt", "Must be a number").optional().isNumeric();
  req.assert("userInfo.paid", "Must be a number").optional().isNumeric();

  if (req.params.id < 0) {
    return res.status(404).send("id should be > 0");
  }

  Pool.findById(req.params.id, (err: Error, pool: PoolType) => {
    if (err) {
      return next(err);
    }
    if (!pool) {
      return res.status(404).send("Pool not found.");
    }

    req.user.hasRelationWith("owns", pool, "any", (err: Error, userOwnsPool: boolean) => {
      if (err) {
        return next(err);
      }
      if (!userOwnsPool) {
        return res.status(403).send("You don't own this pool");
      }

      req.assert("userEmail", "Invalid email").isEmail();
      req.sanitize("userEmail").normalizeEmail({ gmail_remove_dots: false });

      // FIXME: Update amounts only if they are not bigger than total.
      pool.getRelated("participatesIn", User, "in", (err: Error, participants: Relationship[]) => {
        let totalPaid = 0;
        participants.forEach((pair) => {
          if ((<any>pair.relation).paid && pair.node.email !== req.body.userEmail) {
            totalPaid += (<any>pair.relation).paid;
          }
        });
        const updatedRel: any = {};
        if (req.body.userInfo.debt && totalPaid + req.body.userInfo.debt > pool.total) {
          return res.status(400).send(`Too much debt for user ${req.body.userEmail}`);
        } else {
          updatedRel.debt = req.body.userInfo.debt;
        }
        if (req.body.userInfo.paid && totalPaid + req.body.userInfo.paid > pool.total) {
          return res.status(400).send(`Too much amount paid for user ${req.body.userEmail}`);
        } else {
          updatedRel.paid = req.body.userInfo.paid;
        }

        pool.updateRelation({ email: req.body.userEmail }, "participatesIn", updatedRel, (err, success) => {
          if (err) { return next(err); }
          if (!success) { return res.status(404).send(`User ${req.body.userEmail} not in pool.`); }
          res.status(200).send("User information updated.");
        });
      });
    });
  });
};

/**
 * POST /pool/:id/invite
 * Send an invite link to another user, only if the user owns the pool
 */
export let postInvite = (req: Request, res: Response, next: NextFunction) => {
  if (req.user.email === req.body.email) {
    return res.status(400).send("You cannot invite yourself.");
  }
  if (req.params.id < 0) {
    return res.status(404).send("id should be > 0");
  }
  Pool.findById(req.params.id, (err: Error, pool: PoolType) => {
    if (err) {
      return next(err);
    }
    if (!pool) {
      return res.status(404).send("Pool not found.");
    }
    req.user.hasRelationWith("owns", pool, "any", (err: Error, userOwnsPool: boolean) => {
      if (err) {
        return next(err);
      }
      // if (!userOwnsPool) {
      //   return res.status(403).send("You don't own this pool.");
      // }

      req.assert("email", "Invalid email").isEmail();
      req.sanitize("email").normalizeEmail({ gmail_remove_dots: false });
      User.findOne({ email: req.body.email }, (err: Error, user: UserType) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.status(404).send("User not found D:");
        }

        pool.hasRelationWith("invitedTo", user, "in", (err: Error, hasInvitation: boolean) => {
          if (err) {
            return next(err);
          }
          if (hasInvitation) {
            return res.status(403).send(`${user.name || user.email} is already invited.`);
          }
          pool.inviteUser(<any>req.user, user, (err, result) => {
            if (err) {
              console.error(err);
              return next(err);
            }
            if (process.env.NODE_ENV === "development") {
              console.log(result);
            }
            const msg = {
              to: user.email,
              from: "service@cooper.com",
              subject: `${req.user.name || req.user.email} invited you to join a pool.`,
              text: `Hello!\n\n${req.user.name || req.user.email} just invited you to join his ${pool.name} pool!\n` +
                    `You can join it clicking here: ${process.env.HOST_URI}/pool/accept/${pool.id}.` +
                    `Or you can decline it clicking here: ${process.env.HOST_URI}/pool/decline/${pool.id}.`
            };
            sgMail.send(msg, false, (err: Error) => {
              if (err) {
                next(err);
                res.status(200).send("Invitation sent!");
              }
            });
          });
        });
      });
    });
  });
};

/**
 * GET /pool/accept/:id
 * Accept Invitation to join a pool.
 */
export let getAcceptInvite = (req: Request, res: Response, next: NextFunction) => {
  if (req.params.id < 0) {
    return res.status(404).send("id should be > 0");
  }
  Pool.findById(req.params.id, (err: Error, pool: PoolType) => {
    if (err) {
      return next(err);
    }
    if (!pool) { return res.status(404).send(`Pool with id ${req.params.id} not found.`); }
    req.user.hasRelationWith("invitedTo", pool, "out", (err: Error, hasInivitation: boolean) => {
      if (err) {
        return next(err);
      }
      if (!hasInivitation) { return res.status(401).send("Sorry, you are not invited to this pool."); }
      req.user.participatesIn(pool, { debt: 0, paid: 0 }).then(() => {
        pool.removeRelation("invitedTo", <any>req.user, (err: Error) => {
          if (err) { next(err); }
        });
        res.status(200).send(`Congratulations! You just joined ${pool.name}.`);
      }).catch((err: Error) => {
        console.error(err);
        res.status(500).send("Something went wrong, please try again later.");
      });
    });
  });
};

/**
 * GET /pool/decline/:id
 * Decline Invitation to join a pool.
 */
export let getDeclineInvite = (req: Request, res: Response, next: NextFunction) => {
  if (req.params.id < 0) {
    return res.status(404).send("id should be > 0");
  }
  Pool.findById(req.params.id, (err: Error, pool: PoolType) => {
    if (err) {
      return next(err);
    }
    if (!pool) { return res.status(404).send(`Pool with id ${req.params.id} not found.`); }
    req.user.hasRelationWith("invitedTo", pool, "out", (err: Error, hasInivitation: boolean) => {
      if (err) {
        return next(err);
      }
      if (!hasInivitation) { return res.status(401).send("You are not invited to this pool."); }
      pool.removeRelation("invitedTo", <any>req.user, (err: Error) => {
        if (err) {
          return next(err);
        }
        res.status(200).send(`Invitation to ${pool.name} declined.`);
      });
    });
  });
};

/**
 * POST /profile/pools/invites
 * Send a push notification to pool users.
 */
export let sendPush = (req: Request, res: Response, next: NextFunction) => {
  Pool.findById(req.params.id, (err: Error, pool: PoolType) => {
    if (err) {
      return next(err);
    }
    pool.hasRelationWith("owns", <any>req.user, "any", (err: Error, owns: boolean) => {
      if (err) {
        return next(err);
      }
      if (!owns) {
        return res.status(403).send("You don't own this pool.");
      }
      const payload = {
        notification: {
          title: "Pay your debt",
          body: `It's time for you to pay your debt to ${pool.name}!`
        },
        data: {
          poolId: pool._id.toString()
        }
      };

      admin.messaging().sendToTopic(pool.getTopic(), payload).then((response) => {
        if (process.env.NODE_ENV === "development") {
          console.log("Successfully sent message: ", response);
        }
        res.status(200).send("Success!");
      }).catch(function(error: Error) {
        console.log("Error sending message:", error);
        res.status(500).send("Something went wrong");
      });
    });
  });
};

/**
 * GET /profile/pools/invites
 * See pool invitations.
 */
export let getPoolInvites = (req: Request, res: Response, next: NextFunction) => {
  req.user.getRelated("invitedTo", Pool, "out", (err: Error, invites: Relationship[]) => {
    if (err) { return next(err); }
    invites.forEach((pair) => {
      delete pair.node.invite;
      delete pair.node.label;
    });
    return res.status(200).send(invites.map((pair) => pair.node));
  });
};

/**
 * GET /pool/:id
 * See pool detail.
 */
export let getPool = (req: Request, res: Response, next: NextFunction) => {
  if (req.params.id < 0) {
    return res.status(404).send("id should be > 0");
  }
  Pool.findById(req.params.id, (err: Error, pool: PoolType) => {
    if (err) {
      return next(err);
    }

    if (!pool) {
      return res.status(404).send("Pool not found.");
    }

    pool.getRelated("participatesIn", User, "in", (err: Error, participants: Relationship[]) => {
      if (err) {
        return next(err);
      }

      if (pool.private && !participants.find(rel => rel.node._id == req.user._id)) {
        return res.status(404).send("Pool not found.");
      }

      let totalPaid = 0;
      participants.forEach((pair) => {
        delete pair.node.password;
        delete pair.node.label;
        delete pair.node.tokens;
        // FIXME: define relation type
        if ((<any>pair.relation).paid) {
          totalPaid += (<any>pair.relation).paid;
        }
      });
      pool.totalPaid = totalPaid;
      delete pool.label;
      return res.status(200).send({ pool, participants });
    });
  });
};

/**
 * POST /pool/:id/pay
 * Pay pool.
 */
export let postPayPool = (req: Request, res: Response, next: NextFunction) => {
  req.assert("amount", "Amount must be a number").isFloat();

  const errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors);
  }

  req.user.getRelationWith("participatesIn", Pool, req.params.id, "out", (err: Error, relation: Relationship) => {
    if (err) {
      return next(err);
    }
    const pool = relation.node;
    const poolUser = relation.relation;
    if (!pool) {
      return res.status(404).send("Pool not found.");
    }
    if (!relation.relation) {
      return res.status(400).send("You are not in this pool.");
    }

    pool.getRelated("owns", User, "in", (err: Error, ownerRelation: Relationship[]) => {
      if (err) {
        return next(err);
      }

      const owner = ownerRelation[0].node;
      if (!owner) {
        // TODO: Delete this pool.
        return res.status(404).send(`This pool has no owner, ${pool.name} will be deleted`);
      }

      const now = new Date();
      if (pool.starts && now < pool.starts) {
        return res.status(400).send("You cannot pay until the pool starts");
      }
      if (pool.ends > now) {
        return res.status(400).send("You cannot pay after the pool is over");
      }

      if (pool.paymentMethod === "cash") {
        if (poolUser.debt <= 0) {
          return res.status(202).send("You already paid");
        }
        // TODO: Send Notification to owner to accept this.
        const newDebt = (<number>poolUser.debt) - req.body.amount;
        const newPaid = poolUser.paid + req.body.amount;
        pool.updateRelation({ email: req.user.email }, "participatesIn", {
          paid: newPaid,
          debt: newDebt
        }, (err, success) => {
          if (err) {
            return next(err);
          }
          res.status(200).send({
            message: `You paid ${req.body.amount} to a total of ${newPaid}.`,
            debt: newDebt,
            paid: newPaid
          });
        });
      } else {
        const charge: any = {
          amount: <number>req.body.amount,
          currency: <"mxn" | "usd">pool.currency,
          description: `Payment from ${req.user.name || req.user.email} for pool ${pool.name}`,
        };
        if (req.body.source) {
          charge.source = req.body.source;
        }
        processPayment(<any>req.user, charge).then(payment => {
          res.status(200).send({
            message: "Payment with credit card not implemented.",
            debt: poolUser.debt,
            paid: poolUser.paid,
            ...payment
          });
        }).catch((err: Error) => {
          if (err.message === "No payment method specified.") {
            return res.status(400).send(err.message);
          }
          next(err);
        });
      }
    });
  });
};

/**
 * GET /pool/:id/users/debt
 * Find users with debt.
 */
export let getUsersWithDebt = (req: Request, res: Response, next: NextFunction) => {
  if (req.params.id < 0) {
    return res.status(404).send("id should be > 0");
  }
  Pool.findById(req.params.id, (err: Error, pool: PoolType) => {
    if (err) {
      return next(err);
    }
    pool.hasRelationWith("participatesIn", <any>req.user, "in", (err: Error, exists: boolean) => {
      if (err) {
        return next(err);
      }
      if (!exists) {
        return res.status(403).send("You don't have access to this pool.");
      }
      pool.getRelated("participatesIn", User, "in", (err: Error, pairs: Relationship[]) => {
        if (err) {
          return next(err);
        }
        const users = pairs.filter(pair => pair.relation.debt > 0);
        users.forEach(pair => {
          delete pair.node.label;
          delete pair.node.password;
          delete pair.node.tokens;
        });

        res.status(200).send(users);
      });
    });
  });
};

/**
 * GET /pool/:id/users/overpaid
 * Find users who overpaid.
 */
export let getUsersOverpaid = (req: Request, res: Response, next: NextFunction) => {
  if (req.params.id < 0) {
    return res.status(404).send("id should be > 0");
  }
  Pool.findById(req.params.id, (err: Error, pool: PoolType) => {
    if (err) {
      return next(err);
    }
    pool.hasRelationWith("participatesIn", <any>req.user, "in", (err: Error, exists: boolean) => {
      if (err) {
        return next(err);
      }
      if (!exists) {
        return res.status(403).send("You don't have access to this pool.");
      }
      pool.getRelated("participatesIn", User, "in", (err: Error, pairs: Relationship[]) => {
        if (err) {
          return next(err);
        }
        const users = pairs.filter(pair => pair.relation.debt < 0);
        users.forEach(pair => {
          delete pair.node.label;
          delete pair.node.password;
          delete pair.node.tokens;
        });

        res.status(200).send(users);
      });
    });
  });
};

/**
 * GET /pool/search/:name
 * Find pools that match name.
 */
export let searchPool = (req: Request, res: Response, next: NextFunction) => {
  if (!req.params.name) {
    res.status(400).send("No name provided.");
  }
  Pool.findLike({ name: `(?i).*${req.params.name}.*` }, { private: false }, (err, pools) => {
    if (err) {
      return next(err);
    }
    if (!pools) { return res.status(404).send("No pools found."); }
    pools.forEach((pool) => {
      delete pool.label;
      // TODO: Add the owner of the pool.
    });
    res.status(200).send(pools);
  });
};

/**
 * GET /profile/pools
 * Get all pools that the logged in user participants in.
 */
export let getMyPools = (req: Request, res: Response, next: NextFunction) => {
  req.user.getRelated("participatesIn", Pool, "out", (err: Error, pools: Relationship[]) => {
    if (err) {
      return next(err);
    }
    pools.forEach((pair) => {
      delete pair.node.invite;
      delete pair.node.label;
    });
    return res.status(200).send(pools);
  });
};

/**
 * GET /profile/pools
 * Get all pools that the logged in user is invited to.
 */
export let getInvitedToPools = (req: Request, res: Response, next: NextFunction) => {
  req.user.getRelated("invitedTo", Pool, "out", (err: Error, pools: Relationship[]) => {
    if (err) {
      return next(err);
    }
    pools.forEach((pair) => {
      delete pair.node.invite;
      delete pair.node.label;
    });
    return res.status(200).send(pools);
  });
};

/**
 * GET /profile/own/pools
 * Get all pools that the logged in user participants in.
 */
export let getOwnPools = (req: Request, res: Response, next: NextFunction) => {
  req.user.getRelated("owns", Pool, "out", (err: Error, pools: Relationship[]) => {
    if (err) {
      return next(err);
    }
    pools.forEach((pair) => {
      delete pair.node.label;
    });
    return res.status(200).send(pools);
  });
};

/**
 * GET /join/:invite
 * Join an existing pool.
 */
 export let getJoinPool = (req: Request, res: Response, next: NextFunction) => {
   Pool.findOne({ invite: req.params.invite }, (err: Error, pool: PoolType) => {
     if (err) {
       return next(err);
     }
     if (!pool) {
       return res.status(404).send("Pool not found.");
     }

     pool.hasRelationWith("participatesIn", <any>req.user, "in", (err: Error, exists: boolean) => {
       if (!exists) {
         req.user.participatesIn(pool, { debt: 0, paid: 0 }).then(() => {
           res.status(200).send("Succesfully joined pool!");
           if (req.user.fcmToken) {
             admin.messaging().subscribeToTopic(req.user.fcmToken, pool.getTopic())
              .then(function(response) {
                if (process.env.NODE_ENV === "development") {
                  console.log("Successfully subscribed to topic:", response);
                }
              })
              .catch(function(error) {
                console.log("Error subscribing to topic:", error);
              });
           }
         }).catch((err: Error) => {
           console.error(err);
           res.status(500).send("Something went wrong.");
         });
       } else {
         res.status(400).send("User already joined pool.");
       }
     });
   });
 };
