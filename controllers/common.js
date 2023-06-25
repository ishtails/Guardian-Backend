import users from "../models/userModel.js";
import outings from "../models/outingModel.js";
import bcrypt from "bcrypt";
import moment from "moment";
import Joi from "joi";

//Register user
export const registerStudent = async (req, res) => {
  try {
    //Form Validation
    const registerSchema = Joi.object({
      email: Joi.string()
        .email({ tlds: { allow: false } })
        .required(),
      password: Joi.string().pattern(new RegExp("^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[@$!%*#?&])[a-zA-Z0-9@$!%*#?&]{8,}$")),
    });

    await registerSchema.validateAsync(req.body);

    const { email, password } = req.body;
    const username = email.split("@")[0];
    const role = "student";

    // Hash password & save to mongoDB
    bcrypt
      .hash(password, 10)
      .then((hash) => {
        const newUser = new users({ email, password: hash, role, username });
        newUser
          .save()
          .then(() => {
            res.json({ message: "Registered Successfully!", username });
          })
          .catch((err) => {
            res.status(400).send(err);
          });
      })
      .catch((error) =>
        res.status(500).send("Password couldn't be hashed: ", error)
      );

  } catch (error) {
    if (error.details) {
      return res.status(422).send(error.details.map(detail => detail.message).join(', '));
    }

    return res.status(500).send(error);
  }
};

// Login User
export const loginUser = async (req, res) => {
  try {
    if (req.session.username) {
      return res.status(400).send("Already logged in!");
    }

    const { id, password } = req.body;

    //Credential Constraints
    if (!id || !password) {
      return res.status(400).send("Error! Bad Credentials!");
    }

    //Search in DB
    const user = await users.findOne(
      {
        $or: [{ email: id }, { username: id }],
      },
      { password: 1, username: 1, role: 1, name: 1 }
    );

    if (!user) {
      return res.status(404).send("Not registered!");
    }

    //Verify Password
    const passwordCorrect = await bcrypt.compare(password, user.password);
    if (passwordCorrect) {
      req.session.username = user.username;
      req.session.role = user.role;
      return res.status(200).json({
        username: user.username,
        role: user.role,
        message: `Login Successful`,
      });
    } else {
      return res.status(400).send("Bad Credentials");
    }
  } catch (error) {
    return res.status(500).send(error);
  }
};

//Update User Details
export const updateUser = (req, res) => {
  try {
    const newObject = req.body;
    const { name, mobile, hostel, room } = newObject;
    const updateFields = { name, mobile, hostel, room };

    const username = req.params.username;
    users
      .updateOne({ username }, { $set: updateFields })
      .then((result) => {
        res.status(200).send(result);
      })
      .catch((err) => res.status(400).send(err));
  } catch (error) {
    res.status(500).send(error);
  }
};

// Get User
export const getCurrentUser = async (req, res) => {
  try {
    const username = req.session.username;
    const user = await users.findOne(
      { username },
      {
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
    return user;
  } catch (error) {
    res.status(500).send(error);
  }
};

//Get Outings
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
