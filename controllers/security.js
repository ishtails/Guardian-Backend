import moment from "moment";
import outings from "../models/outingModel.js";
import users from "../models/userModel.js";

//Display student info on search
export const searchStudents = async (req, res) => {
  try {
    if (!req.session.username) {
      return res.status(401).json({ error: "Not Authorized!" });
    }

    if (req.session.role === "student") {
      return res.status(401).json({ error: "Not Authorized!" });
    }

    const { key } = req.query;
    const regexKey = new RegExp(key, "i");

    const user = await users
      .find(
        { $or: [{ username: regexKey }, { name: regexKey }] },
        { _id: 0, username: 1, name: 1, hostel: 1, room: 1, mobile: 1 }
      )
      .sort({ name: 1 })
      .limit(5);
    return res.status(200).send(user);
  } catch (error) {
    return res.status(500).send(error);
  }
};

// Close Entry
export const closeGateEntry = async (req, res) => {
  try {
    if (!(req.session.role === "security")) {
      return res.status(401).json({ error: "Not Authorized!" });
    }

    const { username } = req.params;
    const result = await outings.findOne({ username, isOpen: true });

    if (!result) {
      return res.status(404).json({ error: "No open entries for this user!" });
    }

    result.isOpen = false;
    result.inTime = new Date();

    // //Late (in minutes) calculation
    const outDate = moment(result.outTime).format("YYYY-MM-DD");
    const deadlineTime = moment(
      `${outDate} "22:00:00"`,
      "YYYY-MM-DD HH:mm:ss"
    ).toDate();
    const lateInMinutes = moment(result.inTime).diff(
      moment(deadlineTime),
      "minutes"
    );
    result.lateBy = lateInMinutes;

    await result.save();

    res.status(200).send({ message: "Entry closed successfully!" });
  } catch (error) {
    res.status(500).json({ error });
  }
};
