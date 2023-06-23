import outings from "../models/outingModel.js";

//Open Outing Entry
export const openGateEntry = async (req, res) => {
  try {
    const { username } = req.params;
    const { reason } = req.body;

    const newOuting = new outings({
      username,
      reason,
    });

    await newOuting.save();
    res.send("Outing Registered Successfully!");
  } catch (error) {
    res.status(422).send(error);
  }
};

// Outing Status
export const isOutside = async (req, res) => {
  try {
    const { username } = req.params;
    const result = await outings.findOne({ username, isOpen: true });

    if (!result) {
      res.status(200).json({ username, status: "inside" });
    } else {
      const { reason, outTime } = result;
      res.status(200).json({ username, status: "outside", outTime, reason });
    }
  } catch (error) {
    res.status(500).send(error);
  }
};
