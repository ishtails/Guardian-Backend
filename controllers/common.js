import users from "../models/userModel.js";
import outings from "../models/outingModel.js";
import moment from "moment";
import { redisClient } from "../server.js";
import cloudinary from "cloudinary";

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_APIKEY,
  api_secret: process.env.CLOUDINARY_APISECRET,
});

// Logout
export const logOut = (req, res) => {
  const { username } = req.session;
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
    }

    redisClient.SREM(
      `active-sessions:${username}`,
      req.sessionID,
      (err, result) => {
        if (err) {
          console.error("Error removing session from active sessions:", err);
        }
      }
    );

    res.clearCookie("sid");
    res.json({ message: "Logged out successfully" });
  });
};

// Functoin to Upload Image to Cloudinary
const uploadImage = async (file) => {
  try {
    const result = await cloudinary.v2.uploader.upload(file, {
      folder: "Guardian",
    });
    const imageUrl = result.secure_url;
    return imageUrl;
  } catch (error) {
    return error;
  }
};

//Update User Details
export const updateUser = (req, res) => {
  try {
    // const newObject = req.body;
    const { name, mobile, hostel, room, idCard } = req.body;

    const imageUrl = uploadImage(idCard);
    const updateFields = { name, mobile, hostel, room, imageUrl };
    // const updateFields = { name, mobile, hostel, room, idCard };

    const username = req.session.username;
    users
      .updateOne({ username }, { $set: updateFields })
      .then((result) => {
        res.status(200).json(result);
      })
      .catch((err) => res.status(400).send(err));
  } catch (error) {
    res.status(500).json({ error: "ERROR: " + error });
  }
};

// Get User Details
export const getCurrentUser = async (req, res) => {
  try {
    const username = req.session.username;
    const user = await users.findOne(
      { username },
      {
        _id: 0,
        email: 1,
        username: 1,
        name: 1,
        role: 1,
        name: 1,
        mobile: 1,
        hostel: 1,
        room: 1,
      }
    );
    res.send(user);
  } catch (error) {
    res.status(500).send(error);
  }
};

// Get Outings
export const getOutings = async (req, res) => {
  try {
    const { username, isLate, startDate, endDate, isOpen, reason } = req.query;
    const outingFilters = {};

    // Conditional Outing Queries
    if (reason) {
      const regexReason = new RegExp(reason, "i");
      outingFilters.reason = regexReason;
    }

    if (username) {
      outingFilters.username = username;
    }

    if (isOpen) {
      outingFilters.isOpen = isOpen;
    }

    if (isLate) {
      outingFilters.lateBy = { $gt: 0 };
    }

    if (startDate && endDate) {
      outingFilters.outTime = {
        $gte: moment(startDate).toDate(),
        $lt: moment(endDate).add(1, "day").toDate(),
      };
    }

    // Role-Based Control
    if (req.session.role === "student") {
      outingFilters.username = req.session.username;
    }

    if (req.session.role === "security") {
      outingFilters.outTime = {
        $gte: moment().subtract(1, "day").toDate(),
        $lt: moment().add(1, "day").toDate(),
      };
    }

    // Fetching Outings
    const allOutings = await outings.find(outingFilters);
    let studentOutingData = [];

    for (const outing of allOutings) {
      const user = await users.findOne(
        { username: outing.username },
        {
          _id: 0,
          username: 1,
          name: 1,
          mobile: 1,
          hostel: 1,
          room: 1,
          idCard: 1,
        }
      );

      let lateBy = "0";
      if (outing.lateBy > 0) {
        const duration = moment.duration(outing.lateBy, "minutes");
        lateBy = moment.utc(duration.asMilliseconds()).format("HH:mm");
      }

      const studentOutingObj = {
        username: user.username,
        name: user.name,
        mobile: user.mobile,
        hostel: user.hostel,
        room: user.room,
        idCard: user.idCard,
        isOpen: outing.isOpen,
        reason: outing.reason,
        lateBy,
        outTime: moment(outing.outTime).format("DD-MM-YYYY HH:mm"),
        inTime: moment(outing.inTime).format("DD-MM-YYYY HH:mm"),
      };

      studentOutingData.push(studentOutingObj);
    }

    res.status(200).send(studentOutingData);
  } catch (error) {
    res.status(500).send(error);
  }
};