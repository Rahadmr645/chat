import User from "../models/user.js";

export const isBlockedEitherWay = async (userIdA, userIdB) => {
  const [a, b] = await Promise.all([
    User.findById(userIdA).select("blockedUsers"),
    User.findById(userIdB).select("blockedUsers"),
  ]);
  if (!a || !b) return true;
  const aBlockedB = (a.blockedUsers ?? []).some((id) => String(id) === String(userIdB));
  const bBlockedA = (b.blockedUsers ?? []).some((id) => String(id) === String(userIdA));
  return aBlockedB || bBlockedA;
};
